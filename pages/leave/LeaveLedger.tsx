
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { 
    LoaderIcon, RefreshIcon, UserCircleIcon, CheckCircleIcon, 
    InfoIcon, SearchIcon, XCircleIcon
} from '../../components/icons';
import type { LeaveBalance, LeaveRule, Employee } from '../../types';

const LeaveLedger: React.FC = () => {
    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSqlModal, setShowSqlModal] = useState(false);

    const fetchLedger = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.schema('leaves').from('leave_balances').select('*').order('employee_name');
            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    setShowSqlModal(true);
                }
                throw error;
            }
            setBalances(data || []);
        } catch (err) {
            console.error("Ledger Fetch Error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchLedger(); }, [fetchLedger]);

    const handleAutoCredit = async () => {
        setIsSyncing(true);
        try {
            // 1. Fetch Master Data
            const [rulesRes, empRes, logsRes, offRes] = await Promise.all([
                supabase.schema('leaves').from('leave_rules').select('*').eq('status', 'active'),
                supabase.from('employees').select('employeeCode, firstName, lastName, dateOfJoining, department, status').eq('status', 'Active'),
                supabase.from('attendance_logs').select('employee_code, punch_time'),
                supabase.schema('payroll').from('weekly_off_settings').select('*')
            ]);

            if (rulesRes.error) throw rulesRes.error;
            if (empRes.error) throw empRes.error;

            const rules = rulesRes.data as LeaveRule[];
            const employees = empRes.data as Employee[];
            const logs = logsRes.data || [];
            const weeklyOffs = offRes.data || [];
            const today = new Date();
            const updates: any[] = [];

            // 2. Build Work Map (Punches per employee per date)
            const workMap: Record<string, Set<string>> = {};
            logs.forEach(log => {
                const dateKey = new Date(log.punch_time).toISOString().split('T')[0];
                if (!workMap[log.employee_code]) workMap[log.employee_code] = new Set();
                workMap[log.employee_code].add(dateKey);
            });

            // 3. Process each employee
            for (const emp of employees) {
                const doj = new Date(emp.dateOfJoining);
                const daysEmployed = Math.floor((today.getTime() - doj.getTime()) / (1000 * 60 * 60 * 24));

                for (const rule of rules) {
                    if (daysEmployed < rule.eligibility_days) continue;

                    // Check Eligibility Scope
                    let isEligibleScope = false;
                    if (rule.eligibility_scope === 'Global') isEligibleScope = true;
                    else if (rule.eligibility_scope === 'Department') {
                        if (rule.scope_value.split(',').map(s => s.trim()).includes(emp.department)) isEligibleScope = true;
                    } else if (rule.eligibility_scope === 'Specific Employees') {
                        if (rule.scope_value.split(',').map(s => s.trim()).includes(emp.employeeCode)) isEligibleScope = true;
                    }

                    if (!isEligibleScope) continue;

                    let opening = 0;

                    // LOGIC A: Fixed / Working Days Based
                    if (rule.allocation_type === 'Fixed' || rule.allocation_type === 'Working Days Based') {
                        opening = Number(rule.allocated_count);
                    } 
                    // LOGIC B: Compensatory Off (Work on Weekly Off)
                    else if (rule.allocation_type === 'Work on Weekly Off') {
                        const setting = weeklyOffs.find(o => o.employee_code === emp.employeeCode);
                        if (setting && Array.isArray(setting.days)) {
                            const empPunches = workMap[emp.employeeCode] || new Set();
                            let earnedCO = 0;
                            
                            // Check past 90 days for work on weekly offs (adjustable lookback)
                            for (let i = 0; i < 90; i++) {
                                const checkDate = new Date();
                                checkDate.setDate(checkDate.getDate() - i);
                                const dateKey = checkDate.toISOString().split('T')[0];
                                const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'long' });
                                
                                if (setting.days.includes(dayName) && empPunches.has(dateKey)) {
                                    earnedCO++;
                                }
                            }
                            opening = earnedCO * (rule.allocated_count || 1);
                        }
                    }

                    if (opening > 0 || rule.allocation_type === 'Work on Weekly Off') {
                        const { data: existing } = await supabase.schema('leaves')
                            .from('leave_balances')
                            .select('*')
                            .eq('employee_code', emp.employeeCode)
                            .eq('leave_type', rule.leave_type_code)
                            .maybeSingle();

                        if (existing) {
                            updates.push({
                                id: existing.id,
                                employee_code: emp.employeeCode,
                                employee_name: `${emp.firstName} ${emp.lastName}`,
                                leave_type: rule.leave_type_code,
                                opening: opening,
                                used: Number(existing.used),
                                remaining: opening - Number(existing.used),
                                updated_at: new Date().toISOString()
                            });
                        } else {
                            updates.push({
                                employee_code: emp.employeeCode,
                                employee_name: `${emp.firstName} ${emp.lastName}`,
                                leave_type: rule.leave_type_code,
                                opening: opening,
                                used: 0,
                                remaining: opening,
                                updated_at: new Date().toISOString()
                            });
                        }
                    }
                }
            }

            if (updates.length > 0) {
                const { error } = await supabase.schema('leaves').from('leave_balances').upsert(updates);
                if (error) throw error;
                alert(`Ledger Synced! Processed ${updates.length} balance updates including CO earned from rest-day work.`);
            } else {
                alert("Ledger is already up to date.");
            }

            fetchLedger();
        } catch (err: any) { 
            alert("Sync Failed: " + err.message); 
        } finally { 
            setIsSyncing(false); 
        }
    };

    const filtered = balances.filter(b => 
        b.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        b.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.leave_type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const setupSql = `
-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS "leaves"."leave_balances" (
    id bigint generated by default as identity primary key,
    employee_code text not null,
    employee_name text not null,
    leave_type text not null,
    opening numeric default 0,
    used numeric default 0,
    remaining numeric default 0,
    updated_at timestamptz default now(),
    UNIQUE(employee_code, leave_type)
);

GRANT ALL ON TABLE "leaves"."leave_balances" TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "leaves" TO anon, authenticated, service_role;
    `.trim();

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[28px] shadow-sm border border-slate-200 gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary"><RefreshIcon className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} /></div>
                    <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Balance Controller</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Real-time ledger and automated crediting</p></div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative"><SearchIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="SEARCH LEDGER..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-[11px] font-black outline-none w-64 focus:border-primary/20 transition-all uppercase" /></div>
                    <button onClick={handleAutoCredit} disabled={isSyncing} className="flex items-center gap-3 bg-black text-white px-8 py-3.5 rounded-xl text-[10px] font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 tracking-widest">{isSyncing ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}RUN AUTO-CREDIT ENGINE</button>
                </div>
            </div>

            <div className="bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30"><h3 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-2">Employee Balance Real-Time Snapshot<InfoIcon className="w-4 h-4 text-slate-300" /></h3><div className="flex gap-2"><span className="px-4 py-1.5 bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-full">{filtered.length} ENTRIES</span></div></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-black text-white uppercase text-[10px] font-black tracking-[0.2em]">
                            <tr><th className="px-8 py-6 border-r border-slate-800">Staff Member Details</th><th className="px-8 py-6 border-r border-slate-800 text-center">Leave Type</th><th className="px-8 py-6 border-r border-slate-800 text-right">Opening Bal</th><th className="px-8 py-6 border-r border-slate-800 text-right">Consumption</th><th className="px-8 py-6 text-right font-black text-primary bg-slate-900">Closing Net Balance</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (<tr><td colSpan={5} className="py-32 text-center"><LoaderIcon className="w-14 h-14 text-primary animate-spin mx-auto" /><p className="text-[10px] font-black text-slate-400 mt-6 uppercase tracking-[0.3em]">Querying Ledger Nodes...</p></td></tr>) : filtered.length === 0 ? (<tr><td colSpan={5} className="py-32 text-center"><div className="flex flex-col items-center"><UserCircleIcon className="w-16 h-16 text-slate-100 mb-4" /><p className="text-slate-400 font-black uppercase tracking-widest text-[11px]">Ledger is empty</p><p className="text-[9px] text-slate-300 mt-2 uppercase tracking-tighter max-w-[240px]">Click 'Run Auto-Credit Engine' to detect work-based leave credits (CO) and assign policy leaves.</p></div></td></tr>) : (
                                filtered.map((b, i) => (
                                    <tr key={i} className="hover:bg-slate-50/80 transition-all group">
                                        <td className="px-8 py-6 border-r border-slate-100"><div className="font-black text-slate-800 uppercase tracking-tight text-base leading-none">{b.employee_name}</div><div className="text-[10px] text-slate-400 font-black font-mono tracking-[0.2em] mt-2 group-hover:text-primary transition-colors">{b.employee_code}</div></td>
                                        <td className="px-8 py-6 text-center border-r border-slate-100"><span className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-black text-[10px] uppercase tracking-widest border-2 border-slate-200">{b.leave_type}</span></td>
                                        <td className="px-8 py-6 text-right font-black text-slate-600 border-r border-slate-100 text-lg tabular-nums">{b.opening}</td>
                                        <td className="px-8 py-6 text-right text-red-500 font-black border-r border-slate-100 text-lg tabular-nums">{b.used}</td>
                                        <td className="px-8 py-6 text-right font-black text-primary text-2xl tracking-tighter bg-slate-50/30 group-hover:bg-primary/5 transition-colors tabular-nums">{b.remaining} <span className="text-[10px] text-slate-300 font-black tracking-widest ml-1">DAYS</span></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showSqlModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full p-10 relative">
                        <button onClick={() => setShowSqlModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 transition-colors"><XCircleIcon className="w-8 h-8" /></button>
                        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-4">Initialize Ledger</h2>
                        <p className="text-slate-500 mb-8 font-medium">The <code>leave_balances</code> table is required for the ledger to function. Run the following SQL to enable tracking:</p>
                        <div className="bg-slate-900 rounded-3xl p-6 relative overflow-hidden">
                            <button onClick={() => { navigator.clipboard.writeText(setupSql); alert("SQL Copied!"); }} className="absolute top-4 right-4 bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-white/20 transition-all">Copy SQL</button>
                            <pre className="text-green-400 font-mono text-[11px] overflow-x-auto pt-4">{setupSql}</pre>
                        </div>
                        <button onClick={() => { setShowSqlModal(false); fetchLedger(); }} className="mt-8 w-full py-5 bg-black text-white rounded-[24px] font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all">Refresh Connection</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaveLedger;
