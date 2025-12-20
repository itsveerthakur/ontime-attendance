
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Employee } from '../types';
import type { Page } from '../App';
import { 
    ChevronRightIcon, SearchIcon, FilterIcon, LoaderIcon, 
    XCircleIcon, CheckCircleIcon, ClockIcon, PlusIcon, PencilIcon
} from '../components/icons';

interface WeeklyOffManagementProps {
    setActivePage: (page: Page) => void;
}

interface WeeklyOffSetting {
    id?: number;
    employee_code: string;
    type: 'Fix Day' | 'Monthly 4' | 'Monthly (Custom)';
    days: string[]; // e.g. ["Sunday"]
    monthly_count?: number;
    sandwich_rule: boolean;
    effective_from: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const WeeklyOffManagement: React.FC<WeeklyOffManagementProps> = ({ setActivePage }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [weeklyOffs, setWeeklyOffs] = useState<Record<string, WeeklyOffSetting>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSqlModal, setShowSqlModal] = useState(false);
    
    // Assignment Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployeeCodes, setSelectedEmployeeCodes] = useState<Set<string>>(new Set());
    
    const [formData, setFormData] = useState<Partial<WeeklyOffSetting>>({
        type: 'Fix Day',
        days: ['Sunday'],
        monthly_count: 4,
        sandwich_rule: false,
        effective_from: new Date().toISOString().split('T')[0]
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [empRes, offRes] = await Promise.all([
                supabase.from('employees').select('*').eq('status', 'Active'),
                supabase.schema('payroll').from('weekly_off_settings').select('*')
            ]);

            if (empRes.data) setEmployees(empRes.data as Employee[]);
            
            if (offRes.error) {
                if (offRes.error.code === '42P01' || offRes.error.message.includes('does not exist')) {
                    setShowSqlModal(true);
                }
            } else {
                const map: Record<string, WeeklyOffSetting> = {};
                offRes.data.forEach((item: WeeklyOffSetting) => {
                    map[item.employee_code] = item;
                });
                setWeeklyOffs(map);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToggleDay = (day: string) => {
        setFormData(prev => {
            const current = prev.days || [];
            const next = current.includes(day) 
                ? current.filter(d => d !== day) 
                : [...current, day];
            return { ...prev, days: next };
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedEmployeeCodes.size === 0) return;
        
        setIsSaving(true);
        try {
            const payloads = Array.from(selectedEmployeeCodes).map(code => ({
                employee_code: code,
                type: formData.type,
                days: formData.type === 'Fix Day' ? formData.days : [],
                monthly_count: formData.type === 'Monthly (Custom)' ? Number(formData.monthly_count) : (formData.type === 'Monthly 4' ? 4 : 0),
                sandwich_rule: formData.sandwich_rule,
                effective_from: formData.effective_from,
                updated_at: new Date().toISOString()
            }));

            const { error } = await supabase.schema('payroll').from('weekly_off_settings').upsert(payloads, { onConflict: 'employee_code' });
            if (error) throw error;

            alert(`Weekly Off updated for ${payloads.length} employees.`);
            setIsModalOpen(false);
            setSelectedEmployeeCodes(new Set());
            fetchData();
        } catch (err: any) {
            alert("Failed to save: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditSingle = (emp: Employee) => {
        const existing = weeklyOffs[emp.employeeCode];
        if (existing) {
            setFormData({
                type: existing.type || 'Fix Day',
                days: existing.days || [],
                monthly_count: existing.monthly_count || 4,
                sandwich_rule: existing.sandwich_rule,
                effective_from: existing.effective_from
            });
        } else {
            setFormData({
                type: 'Fix Day',
                days: ['Sunday'],
                monthly_count: 4,
                sandwich_rule: false,
                effective_from: new Date().toISOString().split('T')[0]
            });
        }
        setSelectedEmployeeCodes(new Set([emp.employeeCode]));
        setIsModalOpen(true);
    };

    const handleOpenBulkAssign = () => {
        if (selectedEmployeeCodes.size === 1) {
            const code = Array.from(selectedEmployeeCodes)[0];
            const existing = weeklyOffs[code];
            if (existing) {
                setFormData({
                    type: existing.type || 'Fix Day',
                    days: existing.days || [],
                    monthly_count: existing.monthly_count || 4,
                    sandwich_rule: existing.sandwich_rule,
                    effective_from: existing.effective_from
                });
            }
        } else {
            setFormData({
                type: 'Fix Day',
                days: ['Sunday'],
                monthly_count: 4,
                sandwich_rule: false,
                effective_from: new Date().toISOString().split('T')[0]
            });
        }
        setIsModalOpen(true);
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedEmployeeCodes(new Set(filteredEmployees.map(e => e.employeeCode)));
        } else {
            setSelectedEmployeeCodes(new Set());
        }
    };

    const toggleSelectEmployee = (code: string) => {
        const next = new Set(selectedEmployeeCodes);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        setSelectedEmployeeCodes(next);
    };

    const filteredEmployees = employees.filter(e => 
        e.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getSetupSql = () => `
-- Setup Weekly OFF table
CREATE TABLE IF NOT EXISTS "payroll"."weekly_off_settings" (
    id bigint generated by default as identity primary key,
    employee_code text not null unique,
    type text not null, -- 'Fix Day', 'Monthly 4', 'Monthly (Custom)'
    days jsonb default '[]', -- ['Sunday']
    monthly_count integer default 0,
    sandwich_rule boolean default false,
    effective_from date,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

ALTER TABLE "payroll"."weekly_off_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON "payroll"."weekly_off_settings" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
    `.trim();

    return (
        <div>
            <div className="flex items-center text-sm text-slate-500 mb-6 no-print">
                <span onClick={() => setActivePage('Dashboards')} className="cursor-pointer hover:text-primary">Home</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span onClick={() => setActivePage('Master Management')} className="cursor-pointer hover:text-primary">Master Management</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Weekly OFF Management</span>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Weekly OFF Assignment</h2>
                        <p className="text-sm text-slate-500">Configure weekly rest days and sandwich rules for employees.</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                            <input 
                                type="text" 
                                placeholder="Search employee or dept..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-light outline-none"
                            />
                        </div>
                        
                        <button 
                            onClick={handleOpenBulkAssign}
                            disabled={selectedEmployeeCodes.size === 0}
                            className="flex items-center space-x-2 bg-primary text-white px-6 py-2.5 rounded-xl hover:bg-primary-dark shadow-lg transition-all disabled:opacity-50 font-black uppercase text-xs tracking-widest"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>Assign Weekly Off ({selectedEmployeeCodes.size})</span>
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><LoaderIcon className="w-10 h-10 text-primary animate-spin" /></div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4 w-10">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                            checked={selectedEmployeeCodes.size === filteredEmployees.length && filteredEmployees.length > 0}
                                            onChange={e => toggleSelectAll(e.target.checked)}
                                        />
                                    </th>
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-6 py-4">Department</th>
                                    <th className="px-6 py-4">Assignment Type</th>
                                    <th className="px-6 py-4">Selected Days / Count</th>
                                    <th className="px-6 py-4 text-center">Sandwich Rule</th>
                                    <th className="px-6 py-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEmployees.length > 0 ? filteredEmployees.map(emp => {
                                    const setting = weeklyOffs[emp.employeeCode];
                                    return (
                                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                    checked={selectedEmployeeCodes.has(emp.employeeCode)}
                                                    onChange={() => toggleSelectEmployee(emp.employeeCode)}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 uppercase tracking-tight">{emp.firstName} {emp.lastName}</div>
                                                <div className="text-[10px] text-slate-400 font-mono uppercase">{emp.employeeCode}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-medium">{emp.department || '-'}</td>
                                            <td className="px-6 py-4">
                                                {setting ? (
                                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                                        setting.type === 'Fix Day' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                                        setting.type === 'Monthly 4' ? 'bg-purple-50 text-purple-700 border-purple-100' : 
                                                        'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                    }`}>
                                                        {setting.type}
                                                    </span>
                                                ) : <span className="text-slate-300 italic text-[10px]">Not Assigned</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {setting?.type === 'Fix Day' ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {setting.days.map(d => (
                                                            <span key={d} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[9px] font-black uppercase border border-slate-200">{d}</span>
                                                        ))}
                                                    </div>
                                                ) : setting?.type === 'Monthly 4' ? (
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">System Entitlement (4)</span>
                                                ) : setting?.type === 'Monthly (Custom)' ? (
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tight bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                                                        {setting.monthly_count} Weekly Offs / Month
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {setting?.sandwich_rule ? (
                                                    <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto" />
                                                ) : setting ? (
                                                    <XCircleIcon className="w-5 h-5 text-slate-300 mx-auto" />
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button 
                                                    onClick={() => handleEditSingle(emp)}
                                                    className="p-2 text-primary hover:bg-primary/5 rounded-xl transition-all"
                                                    title="Edit Weekly Off"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                }) : <tr><td colSpan={7} className="text-center py-10 text-slate-400 italic font-medium uppercase text-[11px] tracking-widest">No matching employees found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Assignment Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden animate-fadeIn border border-slate-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-black text-slate-800 uppercase tracking-tight text-xl">Weekly Off Assignment</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Configure schedule for {selectedEmployeeCodes.size} member(s)</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><XCircleIcon className="w-8 h-8" /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">OFF Type Selection</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <button 
                                            type="button" 
                                            onClick={() => setFormData({...formData, type: 'Fix Day'})}
                                            className={`p-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-[0.1em] transition-all ${formData.type === 'Fix Day' ? 'bg-primary text-white border-primary shadow-lg scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-primary/20 hover:text-slate-600'}`}
                                        >
                                            Fix Day
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setFormData({...formData, type: 'Monthly 4'})}
                                            className={`p-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-[0.1em] transition-all ${formData.type === 'Monthly 4' ? 'bg-primary text-white border-primary shadow-lg scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-primary/20 hover:text-slate-600'}`}
                                        >
                                            Monthly 4
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setFormData({...formData, type: 'Monthly (Custom)'})}
                                            className={`p-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-[0.1em] transition-all ${formData.type === 'Monthly (Custom)' ? 'bg-primary text-white border-primary shadow-lg scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-primary/20 hover:text-slate-600'}`}
                                        >
                                            Monthly (Custom)
                                        </button>
                                    </div>
                                </div>

                                {formData.type === 'Fix Day' && (
                                    <div className="animate-fadeIn p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Select Specific Rest Days</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {DAYS.map(day => (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => handleToggleDay(day)}
                                                    className={`px-2 py-2 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${formData.days?.includes(day) ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-primary/30 hover:text-slate-600'}`}
                                                >
                                                    {day.slice(0, 3)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {formData.type === 'Monthly (Custom)' && (
                                    <div className="animate-fadeIn p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 ml-1">Manual Weekly Off Count</label>
                                        <div className="flex items-center gap-4">
                                            <input 
                                                type="number" 
                                                min="0"
                                                max="31"
                                                className="w-full bg-white border-2 border-emerald-200 rounded-2xl px-6 py-4 text-lg font-black text-emerald-700 outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                                value={formData.monthly_count}
                                                onChange={e => setFormData({...formData, monthly_count: parseInt(e.target.value) || 0})}
                                                placeholder="Enter no. of W/Os"
                                                required
                                            />
                                            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-tight">Days<br/>Per Month</div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between p-5 bg-slate-50 border-2 border-slate-100 rounded-[24px] transition-all hover:bg-white hover:border-primary/10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-inner"><ClockIcon className="w-6 h-6" /></div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Sandwich Rule</h4>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Auto-leave if absent on flanks</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={formData.sandwich_rule} 
                                            onChange={e => setFormData({...formData, sandwich_rule: e.target.checked})} 
                                        />
                                        <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500 shadow-inner"></div>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Effective Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                        value={formData.effective_from}
                                        onChange={e => setFormData({...formData, effective_from: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancel</button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving || (formData.type === 'Fix Day' && formData.days?.length === 0)}
                                    className="px-8 py-4 bg-primary text-white rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:bg-primary-dark transition-all transform active:scale-95 flex items-center gap-3 disabled:opacity-50"
                                >
                                    {isSaving ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                                    <span>COMMIT ASSIGNMENT</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SQL Setup Modal */}
            {showSqlModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">Database Setup Required</h2>
                            <button onClick={() => setShowSqlModal(false)}><XCircleIcon className="w-8 h-8 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <p className="text-slate-600 mb-4">The <code>weekly_off_settings</code> table is missing in the <code>payroll</code> schema. Please run this SQL in your Supabase SQL Editor:</p>
                            <div className="bg-slate-900 rounded-lg p-4 relative">
                                <button 
                                    onClick={() => { navigator.clipboard.writeText(getSetupSql()); alert("Copied!"); }} 
                                    className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1 rounded transition-colors"
                                >
                                    Copy SQL
                                </button>
                                <pre className="text-green-400 font-mono text-xs overflow-x-auto p-2">{getSetupSql()}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WeeklyOffManagement;
