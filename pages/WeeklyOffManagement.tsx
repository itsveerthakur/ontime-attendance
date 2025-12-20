
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Employee } from '../types';
import type { Page } from '../App';
import { 
    ChevronRightIcon, SearchIcon, FilterIcon, LoaderIcon, 
    XCircleIcon, CheckCircleIcon, ClockIcon, PlusIcon 
} from '../components/icons';

interface WeeklyOffManagementProps {
    setActivePage: (page: Page) => void;
}

interface WeeklyOffSetting {
    id?: number;
    employee_code: string;
    type: 'Fix Day' | 'Monthly 4';
    days: string[]; // e.g. ["Sunday"]
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
    type text not null, -- 'Fix Day', 'Monthly 4'
    days jsonb default '[]', -- ['Sunday']
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
            <div className="flex items-center text-sm text-slate-500 mb-6">
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
                            onClick={() => setIsModalOpen(true)}
                            disabled={selectedEmployeeCodes.size === 0}
                            className="flex items-center space-x-2 px-4 py-2 text-sm font-bold text-white bg-primary rounded-lg shadow-md hover:bg-primary-dark transition-all disabled:opacity-50"
                        >
                            <PlusIcon className="w-5 h-5" />
                            <span>Assign Weekly Off ({selectedEmployeeCodes.size})</span>
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><LoaderIcon className="w-10 h-10 text-primary animate-spin" /></div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 uppercase text-xs font-black">
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
                                    <th className="px-6 py-4">Selected Days</th>
                                    <th className="px-6 py-4 text-center">Sandwich Rule</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEmployees.length > 0 ? filteredEmployees.map(emp => {
                                    const setting = weeklyOffs[emp.employeeCode];
                                    return (
                                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                    checked={selectedEmployeeCodes.has(emp.employeeCode)}
                                                    onChange={() => toggleSelectEmployee(emp.employeeCode)}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800">{emp.firstName} {emp.lastName}</div>
                                                <div className="text-[10px] text-slate-400 font-mono uppercase">{emp.employeeCode}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{emp.department || '-'}</td>
                                            <td className="px-6 py-4">
                                                {setting ? (
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${setting.type === 'Fix Day' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                        {setting.type}
                                                    </span>
                                                ) : <span className="text-slate-300 italic">Not Assigned</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {setting?.type === 'Fix Day' ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {setting.days.map(d => (
                                                            <span key={d} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">{d}</span>
                                                        ))}
                                                    </div>
                                                ) : setting?.type === 'Monthly 4' ? 'System Entitlement (4)' : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {setting?.sandwich_rule ? (
                                                    <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto" />
                                                ) : setting ? (
                                                    <XCircleIcon className="w-5 h-5 text-slate-300 mx-auto" />
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    );
                                }) : <tr><td colSpan={6} className="text-center py-10 text-slate-400 italic">No employees found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Assignment Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 uppercase tracking-tight">Assign Weekly OFF Rules</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircleIcon className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 font-medium">
                                Updating rules for {selectedEmployeeCodes.size} selected employees.
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase mb-2">OFF Type</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            type="button" 
                                            onClick={() => setFormData({...formData, type: 'Fix Day'})}
                                            className={`p-3 rounded-xl border text-sm font-bold transition-all ${formData.type === 'Fix Day' ? 'bg-primary text-white border-primary shadow-lg scale-105' : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'}`}
                                        >
                                            Fix Day
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setFormData({...formData, type: 'Monthly 4'})}
                                            className={`p-3 rounded-xl border text-sm font-bold transition-all ${formData.type === 'Monthly 4' ? 'bg-primary text-white border-primary shadow-lg scale-105' : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'}`}
                                        >
                                            Monthly 4
                                        </button>
                                    </div>
                                </div>

                                {formData.type === 'Fix Day' && (
                                    <div className="animate-fadeIn">
                                        <label className="block text-xs font-black text-slate-500 uppercase mb-2">Select Rest Days</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {DAYS.map(day => (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => handleToggleDay(day)}
                                                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-colors ${formData.days?.includes(day) ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                                                >
                                                    {day.slice(0, 3)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><ClockIcon className="w-5 h-5" /></div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">Sandwich Rule</h4>
                                            <p className="text-[10px] text-slate-500">Treat OFF as leave if absent on sandwich days.</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={formData.sandwich_rule} 
                                            onChange={e => setFormData({...formData, sandwich_rule: e.target.checked})} 
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase mb-2">Effective From</label>
                                    <input 
                                        type="date" 
                                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                        value={formData.effective_from}
                                        onChange={e => setFormData({...formData, effective_from: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving || (formData.type === 'Fix Day' && formData.days?.length === 0)}
                                    className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark shadow-md transition-all flex items-center gap-2"
                                >
                                    {isSaving ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                                    <span>Apply Rules</span>
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
