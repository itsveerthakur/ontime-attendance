
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { 
    PencilIcon, TrashIcon, PlusIcon, LoaderIcon, 
    XCircleIcon, CheckCircleIcon, RefreshIcon, InfoIcon, SearchIcon
} from '../../components/icons';
import type { LeaveRule, LeaveType, Department } from '../../types';

const LeaveRules: React.FC = () => {
    const [rules, setRules] = useState<LeaveRule[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [deptSearchTerm, setDeptSearchTerm] = useState('');

    const [formData, setFormData] = useState<Omit<LeaveRule, 'id'>>({
        leave_type_code: '',
        eligibility_days: 0,
        allocation_type: 'Fixed',
        min_working_days: 0,
        auto_add_frequency: 'Yearly',
        auto_remove_frequency: 'Yearly',
        eligibility_scope: 'Global',
        scope_value: 'All',
        allocated_count: 0,
        status: 'active'
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [rulesRes, typesRes, deptsRes] = await Promise.all([
                supabase.schema('leaves').from('leave_rules').select('*').order('id'),
                supabase.schema('leaves').from('leave_types').select('*').eq('status', 'active'),
                supabase.from('departments').select('*').eq('status', 'active')
            ]);

            if (rulesRes.error) {
                if (rulesRes.error.code === '42P01') setShowSqlModal(true);
                else throw rulesRes.error;
            }

            setRules(rulesRes.data || []);
            setLeaveTypes(typesRes.data || []);
            setDepartments(deptsRes.data || []);
            
            if (typesRes.data && typesRes.data.length > 0 && !formData.leave_type_code) {
                setFormData(prev => ({ ...prev, leave_type_code: typesRes.data![0].code }));
            }
        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [formData.leave_type_code]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async () => {
        if (!formData.leave_type_code || formData.allocated_count < 0) {
            alert("Please select a Leave Type and valid allocation count.");
            return;
        }

        if (formData.eligibility_scope === 'Department' && (!formData.scope_value || formData.scope_value === '')) {
            alert("Please select at least one department.");
            return;
        }

        setIsSaving(true);
        try {
            if (editingId) {
                const { error } = await supabase.schema('leaves').from('leave_rules').update(formData).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.schema('leaves').from('leave_rules').insert([formData]);
                if (error) throw error;
            }
            resetForm();
            fetchData();
        } catch (err: any) {
            alert("Error saving rule: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (rule: LeaveRule) => {
        setEditingId(rule.id!);
        setFormData({
            leave_type_code: rule.leave_type_code,
            eligibility_days: rule.eligibility_days,
            allocation_type: rule.allocation_type,
            min_working_days: rule.min_working_days,
            auto_add_frequency: rule.auto_add_frequency,
            auto_remove_frequency: rule.auto_remove_frequency,
            eligibility_scope: rule.eligibility_scope,
            scope_value: rule.scope_value,
            allocated_count: rule.allocated_count,
            status: rule.status
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Permanently delete this leave rule?")) return;
        try {
            const { error } = await supabase.schema('leaves').from('leave_rules').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err: any) {
            alert("Delete failed: " + err.message);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setDeptSearchTerm('');
        setFormData({
            leave_type_code: leaveTypes[0]?.code || '',
            eligibility_days: 0,
            allocation_type: 'Fixed',
            min_working_days: 0,
            auto_add_frequency: 'Yearly',
            auto_remove_frequency: 'Yearly',
            eligibility_scope: 'Global',
            scope_value: 'All',
            allocated_count: 0,
            status: 'active'
        });
    };

    const handleToggleDept = (deptName: string) => {
        const currentDepts = formData.scope_value === 'All' || !formData.scope_value 
            ? [] 
            : formData.scope_value.split(',').map(s => s.trim()).filter(Boolean);
            
        let nextDepts;
        if (currentDepts.includes(deptName)) {
            nextDepts = currentDepts.filter(d => d !== deptName);
        } else {
            nextDepts = [...currentDepts, deptName];
        }
        
        setFormData({ ...formData, scope_value: nextDepts.join(',') });
    };

    const handleSelectAllDepts = () => {
        const allDeptNames = departments.map(d => d.name);
        setFormData({ ...formData, scope_value: allDeptNames.join(',') });
    };

    const handleClearDepts = () => {
        setFormData({ ...formData, scope_value: '' });
    };

    const selectedDeptList = formData.scope_value === 'All' || !formData.scope_value
        ? [] 
        : formData.scope_value.split(',').map(s => s.trim()).filter(Boolean);

    const filteredDepartments = departments.filter(d => 
        d.name.toLowerCase().includes(deptSearchTerm.toLowerCase())
    );

    const setupSql = `
-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS "leaves"."leave_rules" (
    id bigint generated by default as identity primary key,
    leave_type_code text not null,
    eligibility_days integer default 0,
    allocation_type text default 'Fixed',
    min_working_days integer default 0,
    auto_add_frequency text default 'Yearly',
    auto_remove_frequency text default 'Yearly',
    eligibility_scope text default 'Global',
    scope_value text default 'All',
    allocated_count numeric default 0,
    status text default 'active',
    updated_at timestamptz default now()
);

GRANT ALL ON TABLE "leaves"."leave_rules" TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "leaves" TO anon, authenticated, service_role;
    `.trim();

    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-fadeIn pb-12">
            {/* Table Section */}
            <div className="xl:col-span-7 bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-fit">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tighter text-xl">Leave Rules Engine</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Logic-based leave allocation master</p>
                    </div>
                    <div className="flex gap-2">
                        <span className="px-4 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] rounded-full">{rules.length} ACTIVE POLICIES</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-black text-white uppercase text-[9px] font-black tracking-widest sticky top-0">
                            <tr>
                                <th className="px-6 py-5 border-r border-slate-800">Code</th>
                                <th className="px-6 py-5 border-r border-slate-800">Eligibility</th>
                                <th className="px-6 py-5 border-r border-slate-800">Allocation Type</th>
                                <th className="px-6 py-5 border-r border-slate-800 text-center">Qty</th>
                                <th className="px-6 py-5 border-r border-slate-800">Scope</th>
                                <th className="px-6 py-5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center">
                                        <LoaderIcon className="w-12 h-12 text-primary animate-spin mx-auto" />
                                        <p className="text-[10px] font-black text-slate-400 mt-4 uppercase tracking-[0.3em]">Synching Policy Grid...</p>
                                    </td>
                                </tr>
                            ) : rules.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center">
                                        <div className="flex flex-col items-center">
                                            <InfoIcon className="w-12 h-12 text-slate-200 mb-4" />
                                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">No rules registered.</p>
                                            <p className="text-[9px] text-slate-300 mt-2 uppercase tracking-tighter">Use the form to define your first leave policy.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                rules.map(rule => (
                                    <tr key={rule.id} className="hover:bg-slate-50 transition-all group">
                                        <td className="px-6 py-5 border-r border-slate-100">
                                            <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-mono font-black text-[11px] border-2 border-slate-200 uppercase tracking-widest">{rule.leave_type_code}</span>
                                        </td>
                                        <td className="px-6 py-5 border-r border-slate-100 font-black text-slate-600 uppercase text-[10px]">
                                            {rule.eligibility_days} <span className="text-slate-400 font-medium">Days Post Joining</span>
                                        </td>
                                        <td className="px-6 py-5 border-r border-slate-100">
                                            <div className="font-black text-slate-800 uppercase text-[10px]">{rule.allocation_type}</div>
                                            {rule.allocation_type === 'Working Days Based' ? (
                                                <div className="text-[9px] text-slate-400 font-medium uppercase mt-0.5">Min {rule.min_working_days} Days / Cycle</div>
                                            ) : rule.allocation_type === 'Work on Weekly Off' ? (
                                                <div className="text-[9px] text-orange-400 font-black uppercase mt-0.5">Auto-Credit Strategy</div>
                                            ) : (
                                                <div className="text-[9px] text-slate-400 font-medium uppercase mt-0.5">Static Credit</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 border-r border-slate-100 text-center">
                                            <span className="text-lg font-black text-primary tracking-tighter">{rule.allocated_count}</span>
                                            <span className="text-[8px] font-black text-slate-300 uppercase ml-1">Lvs</span>
                                        </td>
                                        <td className="px-6 py-5 border-r border-slate-100 max-w-[200px]">
                                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${rule.eligibility_scope === 'Global' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{rule.eligibility_scope}</span>
                                            <div className="text-[9px] text-slate-400 truncate mt-1 uppercase font-medium" title={rule.scope_value}>{rule.scope_value}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEdit(rule)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><PencilIcon className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(rule.id!)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><TrashIcon className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Form Section */}
            <div className="xl:col-span-5 space-y-6">
                <div className="bg-white rounded-[32px] shadow-2xl border border-slate-200 p-10 h-fit sticky top-8 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-1 bg-primary/5 rounded-bl-[40px]">
                        <RefreshIcon className={`w-12 h-12 text-primary/10 ${isSaving ? 'animate-spin' : ''}`} />
                    </div>
                    
                    <h3 className="font-black text-slate-800 mb-10 flex items-center gap-4 uppercase tracking-tighter text-xl">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                            {editingId ? <PencilIcon className="w-7 h-7" /> : <PlusIcon className="w-7 h-7" />}
                        </div>
                        {editingId ? 'Edit Condition' : 'Leave Conditions'}
                    </h3>
                    
                    <div className="space-y-6">
                        {/* Leave Selection */}
                        <div className="grid grid-cols-2 gap-5">
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Target Leave Type</label>
                                <select 
                                    value={formData.leave_type_code} 
                                    onChange={e => setFormData({...formData, leave_type_code: e.target.value})}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>SELECT TYPE</option>
                                    {leaveTypes.map(t => <option key={t.id} value={t.code}>{t.name} ({t.code})</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Eligibility & Allocation */}
                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Joining Eligibility</label>
                                <div className="relative">
                                    <input type="number" value={formData.eligibility_days} onChange={e => setFormData({...formData, eligibility_days: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all" />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300 uppercase">Days</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Leaves Allocated</label>
                                <div className="relative">
                                    <input type="number" step="0.5" value={formData.allocated_count} onChange={e => setFormData({...formData, allocated_count: parseFloat(e.target.value) || 0})} className="w-full bg-white border-2 border-primary/20 rounded-2xl px-5 py-4 text-sm font-black text-primary outline-none focus:ring-4 focus:ring-primary/10 transition-all" />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-primary/40 uppercase">Count</span>
                                </div>
                            </div>
                        </div>

                        {/* Frequency & Logic */}
                        <div className="space-y-5 p-6 bg-slate-50 rounded-3xl border-2 border-slate-100/50">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Allocation Strategy</label>
                                <select 
                                    value={formData.allocation_type} 
                                    onChange={e => setFormData({...formData, allocation_type: e.target.value as any})}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/10"
                                >
                                    <option value="Fixed">FIXED CREDIT</option>
                                    <option value="Working Days Based">BASED ON WORKING DAYS</option>
                                    <option value="Work on Weekly Off">CREDIT ON WEEKLY OFF WORK</option>
                                </select>
                                {formData.allocation_type === 'Work on Weekly Off' && (
                                    <p className="text-[9px] text-orange-600 font-bold uppercase mt-2 animate-pulse flex items-center gap-1">
                                        <InfoIcon className="w-3 h-3" /> Auto-credits to balance when employee works on rest days (respects sandwich rule).
                                    </p>
                                )}
                            </div>
                            
                            {formData.allocation_type === 'Working Days Based' && (
                                <div className="animate-fadeIn">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Min Work Days (For Accrual)</label>
                                    <input type="number" value={formData.min_working_days} onChange={e => setFormData({...formData, min_working_days: parseInt(e.target.value) || 0})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Auto-Add Freq</label>
                                    <select value={formData.auto_add_frequency} onChange={e => setFormData({...formData, auto_add_frequency: e.target.value as any})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-bold text-slate-700">
                                        <option value="Monthly">MONTHLY</option>
                                        <option value="Quarterly">QUARTERLY</option>
                                        <option value="Half-Yearly">HALF-YEARLY</option>
                                        <option value="Yearly">YEARLY</option>
                                        <option value="None">MANUAL ONLY</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Auto-Remove Freq</label>
                                    <select value={formData.auto_remove_frequency} onChange={e => setFormData({...formData, auto_remove_frequency: e.target.value as any})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-bold text-slate-700">
                                        <option value="Yearly">YEARLY (LAPSE)</option>
                                        <option value="Cycle End">END OF CYCLE</option>
                                        <option value="Never">NO AUTO REMOVE</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Eligibility Scope */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Application Scope</label>
                            <div className="flex gap-2 mb-4">
                                {['Global', 'Department', 'Specific Employees'].map(s => (
                                    <button 
                                        key={s}
                                        type="button"
                                        onClick={() => setFormData({...formData, eligibility_scope: s as any, scope_value: s === 'Global' ? 'All' : ''})}
                                        className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${formData.eligibility_scope === s ? 'bg-primary text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            
                            {formData.eligibility_scope === 'Department' && (
                                <div className="space-y-4 animate-fadeIn">
                                    <div className="relative">
                                        <SearchIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="text" 
                                            placeholder="SEARCH DEPARTMENTS..." 
                                            value={deptSearchTerm}
                                            onChange={e => setDeptSearchTerm(e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-slate-700 uppercase outline-none focus:border-primary/20 transition-all"
                                        />
                                    </div>
                                    
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{selectedDeptList.length} SELECTED</span>
                                        <div className="space-x-3">
                                            <button onClick={handleSelectAllDepts} type="button" className="text-[9px] font-black text-slate-400 uppercase hover:text-primary transition-colors">Select All</button>
                                            <button onClick={handleClearDepts} type="button" className="text-[9px] font-black text-slate-400 uppercase hover:text-red-500 transition-colors">Clear</button>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 max-h-[220px] overflow-y-auto custom-scrollbar space-y-2 shadow-inner">
                                        {filteredDepartments.map(d => (
                                            <label 
                                                key={d.id} 
                                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedDeptList.includes(d.name) ? 'bg-white shadow-sm border-primary/20 border' : 'hover:bg-white/50 border border-transparent'}`}
                                            >
                                                <div className="relative flex items-center">
                                                    <input 
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={selectedDeptList.includes(d.name)}
                                                        onChange={() => handleToggleDept(d.name)}
                                                    />
                                                    <div className="w-5 h-5 border-2 border-slate-200 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                                                        <CheckCircleIcon className={`w-3 h-3 text-white transition-opacity ${selectedDeptList.includes(d.name) ? 'opacity-100' : 'opacity-0'}`} />
                                                    </div>
                                                </div>
                                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{d.name}</span>
                                            </label>
                                        ))}
                                        {filteredDepartments.length === 0 && (
                                            <div className="py-8 text-center">
                                                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No departments found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {formData.eligibility_scope === 'Specific Employees' && (
                                <input 
                                    type="text" 
                                    placeholder="ENTER EMP CODES (COMMA SEPARATED)" 
                                    value={formData.scope_value} 
                                    onChange={e => setFormData({...formData, scope_value: e.target.value})}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-black text-slate-700 uppercase"
                                />
                            )}
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button onClick={handleSave} disabled={isSaving} className="flex-1 py-5 bg-primary text-white rounded-[24px] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-primary/30 hover:bg-primary-dark transition-all transform active:scale-95 flex items-center justify-center gap-3">
                                {isSaving ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <CheckCircleIcon className="w-5 h-5" />}
                                {editingId ? 'UPDATE POLICY' : 'COMMIT RULE'}
                            </button>
                            {editingId && (
                                <button onClick={resetForm} className="p-5 bg-slate-100 text-slate-400 rounded-[24px] hover:bg-red-50 hover:text-red-500 transition-all">
                                    <XCircleIcon className="w-6 h-6" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Missing Table SQL Modal */}
            {showSqlModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full p-10 relative">
                        <button onClick={() => setShowSqlModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 transition-colors"><XCircleIcon className="w-8 h-8" /></button>
                        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-4">Schema Node Missing</h2>
                        <p className="text-slate-500 mb-8 font-medium">The <code>leave_rules</code> table needs to be initialized in your database. Run the following SQL to enable the rules engine:</p>
                        
                        <div className="bg-slate-900 rounded-3xl p-6 relative group overflow-hidden">
                            <button 
                                onClick={() => { navigator.clipboard.writeText(setupSql); alert("SQL Copied!"); }}
                                className="absolute top-4 right-4 bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-white/20 transition-all"
                            >
                                Copy SQL
                            </button>
                            <pre className="text-green-400 font-mono text-[11px] overflow-x-auto custom-scrollbar pt-4">{setupSql}</pre>
                        </div>
                        
                        <button onClick={() => { setShowSqlModal(false); fetchData(); }} className="mt-8 w-full py-5 bg-black text-white rounded-[24px] font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all">
                            Refresh Connection
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaveRules;
