
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { calculateStatus, applyCompounding, STATUS_COLORS, MONTHS } from './AttendanceShared';
import { LoaderIcon, XCircleIcon, CheckCircleIcon, InfoIcon } from '../../components/icons';
import type { Employee, Shift, AttendanceRules, LeaveBalance } from '../../types';

interface MonthlySummaryProps {
    selectedMonth: string;
    selectedYear: number;
    employees: Employee[];
    shifts: Shift[];
    rules: AttendanceRules;
}

const MonthlySummary: React.FC<MonthlySummaryProps> = ({ selectedMonth, selectedYear, employees, shifts, rules }) => {
    const [summaryData, setSummaryData] = useState<Record<string, Record<number, string>>>({});
    const [isLoading, setIsLoading] = useState(true);
    
    // Regularization Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCell, setSelectedCell] = useState<{ emp: Employee; day: number; currentStatus: string } | null>(null);
    const [empBalances, setEmpBalances] = useState<LeaveBalance[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchSummary = useCallback(async () => {
        setIsLoading(true);
        const monthIndex = MONTHS.indexOf(selectedMonth);
        const startDate = new Date(selectedYear, monthIndex, 1).toISOString();
        const endDate = new Date(selectedYear, monthIndex + 1, 0, 23, 59, 59).toISOString();
        
        const [logsRes, weeklyOffRes, appliedRes] = await Promise.all([
            supabase.from('attendance_logs').select('employee_code, punch_time, punch_type').gte('punch_time', startDate).lte('punch_time', endDate),
            supabase.schema('payroll').from('weekly_off_settings').select('employee_code, days'),
            supabase.schema('leaves').from('leave_applications').select('*').gte('date', startDate).lte('date', endDate)
        ]);

        const weeklyOffMap: Record<string, string[]> = {};
        weeklyOffRes.data?.forEach(item => { weeklyOffMap[item.employee_code] = Array.isArray(item.days) ? item.days : []; });

        const appliedLeaveMap: Record<string, Record<number, string>> = {};
        appliedRes.data?.forEach(item => {
            const day = new Date(item.date).getDate();
            if (!appliedLeaveMap[item.employee_code]) appliedLeaveMap[item.employee_code] = {};
            appliedLeaveMap[item.employee_code][day] = item.leave_type;
        });

        const mData: Record<string, Record<number, { in: string; out: string }>> = {};
        logsRes.data?.forEach(log => {
            const code = log.employee_code;
            const dateObj = new Date(log.punch_time);
            const day = dateObj.getDate();
            const time = dateObj.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
            if (!mData[code]) mData[code] = {};
            if (!mData[code][day]) mData[code][day] = { in: '', out: '' };
            if (log.punch_type === 'IN') { if (!mData[code][day].in || time < mData[code][day].in) mData[code][day].in = time; }
            else if (log.punch_type === 'OUT') { if (!mData[code][day].out || time > mData[code][day].out) mData[code][day].out = time; }
        });

        const finalStatusMap: Record<string, Record<number, string>> = {};
        employees.forEach(emp => {
            const code = emp.employeeCode;
            const shift = shifts.find(s => s.id === emp.shiftId);
            const shiftIn = shift?.startTime || '10:00';
            const shiftOut = shift?.endTime || '19:00';
            const employeeWeeklyOffDays = weeklyOffMap[code] || [];
            
            finalStatusMap[code] = {};
            const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                // Check if leave was manually applied first
                if (appliedLeaveMap[code]?.[d]) {
                    finalStatusMap[code][d] = appliedLeaveMap[code][d];
                    continue;
                }

                const dayOfWeek = new Date(selectedYear, monthIndex, d).toLocaleDateString('en-US', { weekday: 'long' });
                const isWeeklyOff = employeeWeeklyOffDays.includes(dayOfWeek);
                const dayLog = mData[code]?.[d];
                
                let inS = dayLog?.in ? calculateStatus(dayLog.in, shiftIn, 'IN', rules) : 'A';
                let outS = dayLog?.out ? calculateStatus(dayLog.out, shiftOut, 'OUT', rules) : 'A';
                
                if (inS === 'A' && outS === 'A' && isWeeklyOff) { inS = 'W/O'; outS = 'W/O'; }
                const compounded = applyCompounding(inS, outS, rules);
                finalStatusMap[code][d] = compounded || (inS !== 'P' && inS !== 'W/O' ? inS : outS);
            }
        });
        setSummaryData(finalStatusMap);
        setIsLoading(false);
    }, [selectedMonth, selectedYear, employees, shifts, rules]);

    useEffect(() => { fetchSummary(); }, [fetchSummary]);

    const handleCellClick = async (emp: Employee, day: number, currentStatus: string) => {
        // Only allow regularization for Absent or N/A
        if (currentStatus !== 'A' && currentStatus !== '#N/A') return;

        setSelectedCell({ emp, day, currentStatus });
        setIsModalOpen(true);
        
        // Fetch balances for this employee
        const { data } = await supabase.schema('leaves').from('leave_balances').select('*').eq('employee_code', emp.employeeCode);
        setEmpBalances(data || []);
    };

    const handleApplyLeave = async (leaveType: string) => {
        if (!selectedCell) return;
        const { emp, day } = selectedCell;
        const balance = empBalances.find(b => b.leave_type === leaveType);
        
        if (!balance || balance.remaining < 1) {
            alert("Insufficient balance for " + leaveType);
            return;
        }

        setIsSubmitting(true);
        try {
            const monthIdx = MONTHS.indexOf(selectedMonth);
            const leaveDate = new Date(selectedYear, monthIdx, day).toISOString().split('T')[0];

            // 1. Record Application
            await supabase.schema('leaves').from('leave_applications').insert({
                employee_code: emp.employeeCode,
                date: leaveDate,
                leave_type: leaveType
            });

            // 2. Update Balance
            await supabase.schema('leaves').from('leave_balances').update({
                used: Number(balance.used) + 1,
                remaining: Number(balance.remaining) - 1,
                updated_at: new Date().toISOString()
            }).eq('employee_code', emp.employeeCode).eq('leave_type', leaveType);

            // 3. Update Attendance Entry (to ensure payroll picks it up)
            const { data: existingEntry } = await supabase.schema('payroll').from('attendance_entries')
                .select('*').eq('employee_code', emp.employeeCode).eq('month', selectedMonth).eq('year', selectedYear).maybeSingle();

            if (existingEntry) {
                await supabase.schema('payroll').from('attendance_entries').update({
                    leave: Number(existingEntry.leave || 0) + 1,
                    total_paid_days: Number(existingEntry.total_paid_days || 0) + 1
                }).eq('id', existingEntry.id);
            }

            alert(`Converted absence on ${day}/${selectedMonth} to ${leaveType}.`);
            setIsModalOpen(false);
            fetchSummary();
        } catch (err: any) {
            alert("Process Failed: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const daysInMonthCount = new Date(selectedYear, MONTHS.indexOf(selectedMonth) + 1, 0).getDate();
    const daysArr = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);

    const setupSql = `
-- Run in SQL Editor
CREATE TABLE IF NOT EXISTS "leaves"."leave_applications" (
    id bigint generated by default as identity primary key,
    employee_code text not null,
    date date not null,
    leave_type text not null,
    created_at timestamptz default now(),
    UNIQUE(employee_code, date)
);
GRANT ALL ON "leaves"."leave_applications" TO anon, authenticated, service_role;
    `.trim();

    return (
        <div className="overflow-x-auto custom-scrollbar">
            <table id="monthly-table" className="w-full text-[10px] border-collapse min-w-max">
                <thead>
                    <tr className="bg-black text-white uppercase text-left font-bold">
                        <th rowSpan={2} className="px-4 py-4 border-r border-slate-800 sticky left-0 bg-black z-20 w-32 min-w-[128px]">EMP CODE</th>
                        <th rowSpan={2} className="px-4 py-4 border-r border-slate-800 sticky left-[128px] bg-black z-20 min-w-[200px] w-64">NAME</th>
                        {daysArr.map(d => (
                            <th key={d} className="px-2 py-2 border-r border-slate-800 text-center w-12 border-b border-slate-800">
                                <div className="text-[8px] text-slate-400 font-medium">{new Date(selectedYear, MONTHS.indexOf(selectedMonth), d).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                <div className="text-[11px]">{d}</div>
                            </th>
                        ))}
                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[420px] z-30 border-l-2 border-slate-700 w-[60px] min-w-[60px]">WRK</th>
                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[360px] z-30 w-[60px]">P</th>
                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[300px] z-30 w-[60px]">LT</th>
                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[240px] z-30 w-[60px]">SL</th>
                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[180px] z-30 w-[60px]">HD</th>
                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[120px] z-30 w-[60px] text-[8px]">MISS</th>
                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[60px] z-30 w-[60px]">W/O</th>
                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-0 z-30 w-[60px]">A</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {employees.map((emp) => {
                        const statuses = summaryData[emp.employeeCode] || {};
                        let counts = { P: 0, LT: 0, SL: 0, HD: 0, MISS: 0, WO: 0, A: 0 };
                        daysArr.forEach(d => {
                            const s = statuses[d] || 'A';
                            if (s === 'P') counts.P++;
                            else if (s === 'LT') counts.LT++;
                            else if (s === 'SL') counts.SL++;
                            else if (s === 'HD') counts.HD++;
                            else if (s === 'PI' || s === 'PO') counts.MISS++;
                            else if (s === 'W/O') counts.WO++;
                            else if (s === 'A') counts.A++;
                        });
                        const working = counts.P + counts.LT + counts.SL + counts.HD;
                        return (
                            <tr key={emp.employeeCode} className="hover:bg-slate-50 group">
                                <td className="px-4 py-2 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10 font-black">{emp.employeeCode}</td>
                                <td className="px-4 py-2 border-r border-slate-200 sticky left-[128px] bg-white group-hover:bg-slate-50 z-10 font-black uppercase truncate">{emp.firstName} {emp.lastName}</td>
                                {daysArr.map(d => {
                                    const s = statuses[d] || 'A';
                                    const isAbsent = s === 'A' || s === '#N/A';
                                    return (
                                        <td key={d} onClick={() => handleCellClick(emp, d, s)} className={`px-1 py-2 border-r border-slate-100 text-center ${isAbsent ? 'cursor-pointer hover:bg-red-50' : ''}`}>
                                            <span className={`inline-flex w-full items-center justify-center py-1 rounded-[4px] min-w-[24px] text-[9px] font-black ${STATUS_COLORS[s] || ''}`}>{s}</span>
                                        </td>
                                    );
                                })}
                                <td className="px-2 py-2 text-center font-black bg-blue-50 sticky right-[420px] z-10 border-l-2 border-slate-200">{working}</td>
                                <td className="px-2 py-2 text-center font-black bg-white sticky right-[360px] z-10">{counts.P}</td>
                                <td className="px-2 py-2 text-center font-black bg-white sticky right-[300px] z-10">{counts.LT}</td>
                                <td className="px-2 py-2 text-center font-black bg-white sticky right-[240px] z-10">{counts.SL}</td>
                                <td className="px-2 py-2 text-center font-black bg-white sticky right-[180px] z-10">{counts.HD}</td>
                                <td className="px-2 py-2 text-center font-black bg-white sticky right-[120px] z-10">{counts.MISS}</td>
                                <td className="px-2 py-2 text-center font-black bg-white sticky right-[60px] z-10">{counts.WO}</td>
                                <td className="px-2 py-2 text-center font-black bg-red-50 text-red-600 sticky right-0 z-10">{counts.A}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {isModalOpen && selectedCell && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fadeIn">
                    <div className="bg-white rounded-[40px] shadow-2xl max-w-lg w-full p-10 overflow-hidden">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Regularize Absence</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">{selectedCell.emp.firstName} {selectedCell.emp.lastName} &bull; {selectedCell.day} {selectedMonth}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><XCircleIcon className="w-8 h-8" /></button>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3">
                                <InfoIcon className="w-5 h-5 text-blue-500" />
                                <p className="text-[11px] text-blue-700 font-bold uppercase tracking-tight">Select a leave type below to consume balance and mark this absence as paid.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {empBalances.length === 0 ? (
                                    <p className="text-center py-8 text-slate-400 font-black uppercase text-[10px] tracking-widest">No available leave balances.</p>
                                ) : (
                                    empBalances.map(bal => {
                                        const disabled = bal.remaining < 1 || isSubmitting;
                                        return (
                                            <button 
                                                key={bal.leave_type}
                                                disabled={disabled}
                                                onClick={() => handleApplyLeave(bal.leave_type)}
                                                className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all group ${disabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-100' : 'bg-white border-slate-100 hover:border-primary hover:shadow-xl active:scale-95'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-400 group-hover:text-primary group-hover:bg-primary/5 transition-colors">{bal.leave_type}</div>
                                                    <div className="text-left">
                                                        <div className="font-black text-slate-800 uppercase tracking-tight text-sm">Consumer Balance</div>
                                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">{bal.leave_type} Account</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xl font-black text-primary leading-none tracking-tighter">{bal.remaining}</div>
                                                    <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1">Available</div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        
                        <div className="mt-10 p-6 bg-slate-900 rounded-[28px] relative group overflow-hidden">
                            <h4 className="text-white font-black text-[10px] uppercase tracking-[0.3em] mb-4 opacity-50">Database Setup Helper</h4>
                            <p className="text-green-400 text-[9px] font-mono leading-relaxed">Ensure "leave_applications" table exists in "leaves" schema. Click to copy SQL if needed.</p>
                            <button onClick={() => { navigator.clipboard.writeText(setupSql); alert("SQL Copied!"); }} className="absolute bottom-4 right-6 text-[9px] font-black text-white/40 uppercase hover:text-white transition-colors underline decoration-dotted">Copy Setup SQL</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonthlySummary;
