
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { 
    PlusIcon, TrashIcon, LoaderIcon, XCircleIcon, 
    PencilIcon, CheckCircleIcon, RefreshIcon 
} from '../../components/icons';
import type { LeaveType } from '../../types';

const LeaveTypes: React.FC = () => {
    const [types, setTypes] = useState<LeaveType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    
    const [formData, setFormData] = useState<Omit<LeaveType, 'id'>>({ 
        name: '', 
        code: '', 
        gender_applicability: 'All',
        frequency: 'Yearly',
        carry_forward: false,
        encashable: false,
        is_comp_off: false,
        status: 'active'
    });

    const fetchTypes = useCallback(async () => {
        setIsLoading(true);
        setPermissionError(null);
        try {
            const { data, error } = await supabase
                .schema('leaves')
                .from('leave_types')
                .select('*')
                .order('id', { ascending: true });

            if (error) {
                if (error.code === '42501') {
                    setPermissionError("Permission Denied: Ensure 'leaves' schema is exposed in Supabase settings.");
                }
                console.error("Fetch Error:", error);
                setTypes([]);
            } else {
                setTypes(data || []);
            }
        } catch (err) {
            console.error("Unexpected Error:", err);
            setTypes([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { 
        fetchTypes(); 
    }, [fetchTypes]);

    const handleSave = async () => {
        const normalizedCode = formData.code.trim().toUpperCase();
        if (!formData.name || !normalizedCode) {
            alert("Please provide both Leave Name and Unique Code.");
            return;
        }

        // Local Validation: Check for duplicate codes before sending to server
        const isDuplicate = types.some(t => 
            t.code.toUpperCase() === normalizedCode && t.id !== editingId
        );

        if (isDuplicate) {
            alert(`The code "${normalizedCode}" is already assigned to another leave type. Please use a unique code.`);
            return;
        }

        try {
            const finalData = { ...formData, code: normalizedCode };

            if (editingId) {
                const { error } = await supabase.schema('leaves').from('leave_types').update(finalData).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.schema('leaves').from('leave_types').insert([finalData]);
                if (error) throw error;
            }
            
            resetForm();
            fetchTypes();
        } catch (err: any) {
            // Specific handling for PostgreSQL Unique Violation Error (23505)
            if (err.code === '23505') {
                alert(`Unique Constraint Violation: The code "${normalizedCode}" is already in use in the database. Please choose a different code.`);
            } else {
                alert("Save Operation Failed: " + (err.message || "Unknown error"));
            }
        }
    };

    const handleEdit = (type: LeaveType) => {
        setEditingId(type.id!);
        setFormData({
            name: type.name,
            code: type.code,
            gender_applicability: type.gender_applicability,
            frequency: type.frequency,
            carry_forward: type.carry_forward,
            encashable: type.encashable,
            is_comp_off: type.is_comp_off,
            status: type.status
        });
        // Scroll to form for mobile users
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const toggleStatus = async (type: LeaveType) => {
        const newStatus = type.status === 'active' ? 'inactive' : 'active';
        try {
            const { error } = await supabase.schema('leaves').from('leave_types').update({ status: newStatus }).eq('id', type.id);
            if (error) throw error;
            fetchTypes();
        } catch (err: any) {
            alert("Status Toggle Failed");
        }
    };

    const deleteType = async (id: number) => {
        if (!window.confirm("Permanently delete this leave configuration?")) return;
        try {
            const { error } = await supabase.schema('leaves').from('leave_types').delete().eq('id', id);
            if (error) throw error;
            fetchTypes();
        } catch (err: any) {
            alert("Delete Operation Failed");
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({ 
            name: '', code: '', gender_applicability: 'All', frequency: 'Yearly', 
            carry_forward: false, encashable: false, is_comp_off: false, status: 'active' 
        });
    };

    if (permissionError) {
        return (
            <div className="bg-white p-12 rounded-[32px] shadow-2xl border border-red-100 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6"><XCircleIcon className="w-12 h-12" /></div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-4">Schema Access Error</h2>
                <p className="text-slate-500 mb-8 max-w-md">{permissionError}</p>
                <button onClick={fetchTypes} className="px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl">Retry Connection</button>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            {/* Table Section */}
            <div className="xl:col-span-8 bg-white rounded-[28px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tighter text-xl">Leave Master Management</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Configure system-wide leave policies</p>
                    </div>
                    <span className="px-5 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-primary/20">{types.length} RECORDS</span>
                </div>

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left">
                        <thead className="bg-black text-white uppercase text-[10px] font-black tracking-widest sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-5 border-r border-slate-800 text-center w-16">ID</th>
                                <th className="px-6 py-5 border-r border-slate-800">Leave Name</th>
                                <th className="px-6 py-5 border-r border-slate-800 text-center w-24">Code</th>
                                <th className="px-6 py-5 border-r border-slate-800">Applicability</th>
                                <th className="px-6 py-5 border-r border-slate-800">Frequency</th>
                                <th className="px-4 py-5 border-r border-slate-800 text-center w-12" title="Carry Forward">C/F</th>
                                <th className="px-4 py-5 border-r border-slate-800 text-center w-12" title="Encashable">ENC</th>
                                <th className="px-4 py-5 border-r border-slate-800 text-center w-12" title="Is Comp Off">COMP</th>
                                <th className="px-6 py-5 border-r border-slate-800 text-center w-24">Status</th>
                                <th className="px-6 py-5 text-center w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={10} className="py-32 text-center">
                                        <LoaderIcon className="w-12 h-12 text-primary animate-spin mx-auto" />
                                        <p className="text-xs font-black text-slate-400 mt-6 uppercase tracking-[0.3em]">Accessing Schema Nodes...</p>
                                    </td>
                                </tr>
                            ) : types.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-32 text-center text-slate-400 italic font-medium">No leave types found. Use the form on the right to add one.</td>
                                </tr>
                            ) : (
                                types.map(t => (
                                    <tr key={t.id} className={`hover:bg-slate-50 transition-all group ${t.status === 'inactive' ? 'opacity-60 bg-slate-50/30' : ''}`}>
                                        <td className="px-6 py-5 text-slate-400 font-mono font-black text-center">{t.id}</td>
                                        <td className="px-6 py-5">
                                            <div className="font-black text-slate-800 uppercase tracking-tight">{t.name}</div>
                                            {t.is_comp_off && <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest">Compensatory</span>}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-mono font-black text-[11px] border-2 border-slate-200 uppercase">{t.code}</span>
                                        </td>
                                        <td className="px-6 py-5 font-black text-slate-500 uppercase text-[10px] tracking-wider">{t.gender_applicability}</td>
                                        <td className="px-6 py-5 font-black text-slate-800 uppercase text-[10px] tracking-wider">{t.frequency}</td>
                                        <td className="px-4 py-5 text-center">
                                            <div className={`w-3 h-3 rounded-full mx-auto shadow-sm ${t.carry_forward ? 'bg-green-500' : 'bg-slate-200'}`}></div>
                                        </td>
                                        <td className="px-4 py-5 text-center">
                                            <div className={`w-3 h-3 rounded-full mx-auto shadow-sm ${t.encashable ? 'bg-blue-500' : 'bg-slate-200'}`}></div>
                                        </td>
                                        <td className="px-4 py-5 text-center">
                                            <div className={`w-3 h-3 rounded-full mx-auto shadow-sm ${t.is_comp_off ? 'bg-orange-500' : 'bg-slate-200'}`}></div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                                                t.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                                            }`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(t)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Edit">
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => toggleStatus(t)} className={`p-2 rounded-lg transition-all ${t.status === 'active' ? 'text-amber-500 hover:bg-amber-50' : 'text-green-500 hover:bg-green-50'}`} title={t.status === 'active' ? 'Deactivate' : 'Activate'}>
                                                    <RefreshIcon className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => deleteType(t.id!)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
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
            <div className="xl:col-span-4 space-y-6">
                <div className="bg-white rounded-[28px] shadow-2xl border border-slate-200 p-10 h-fit sticky top-8">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="font-black text-slate-800 flex items-center gap-4 uppercase tracking-tighter text-xl">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                                {editingId ? <PencilIcon className="w-8 h-8" /> : <PlusIcon className="w-8 h-8" />}
                            </div>
                            {editingId ? 'Edit Leave Entry' : 'New Leave Entry'}
                        </h3>
                        {editingId && (
                            <button onClick={resetForm} className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors">Cancel</button>
                        )}
                    </div>
                    
                    <div className="space-y-6">
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Full Leave Name</label>
                                <input type="text" placeholder="E.G. EARNED LEAVE" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all uppercase" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Unique Code</label>
                                <input type="text" placeholder="E.G. EL" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all uppercase tracking-widest" />
                                <p className="text-[9px] text-slate-400 mt-2 ml-1">Must be unique across all leave types.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Gender</label>
                                    <select value={formData.gender_applicability} onChange={e => setFormData({...formData, gender_applicability: e.target.value as any})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 text-xs font-black text-slate-700 outline-none uppercase cursor-pointer">
                                        <option value="All">ALL GENDERS</option>
                                        <option value="Male">MALE ONLY</option>
                                        <option value="Female">FEMALE ONLY</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Frequency</label>
                                    <select value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value as any})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 text-xs font-black text-slate-700 outline-none uppercase cursor-pointer">
                                        <option value="Yearly">YEARLY</option>
                                        <option value="Half-Yearly">HALF-YEARLY</option>
                                        <option value="Quarterly">QUARTERLY</option>
                                        <option value="Monthly">MONTHLY</option>
                                        <option value="One Time">ONE TIME</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t-2 border-slate-50">
                            <FormToggle label="Carry Forward" checked={formData.carry_forward} onChange={v => setFormData({...formData, carry_forward: v})} />
                            <FormToggle label="Encashable" checked={formData.encashable} onChange={v => setFormData({...formData, encashable: v})} />
                            <FormToggle label="Is Comp-Off" checked={formData.is_comp_off} onChange={v => setFormData({...formData, is_comp_off: v})} />
                            
                            <div className="flex items-center justify-between p-4 bg-slate-50/50 border-2 border-slate-50 rounded-2xl">
                                <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Entry Status</span>
                                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="bg-transparent text-[11px] font-black text-slate-800 uppercase focus:outline-none cursor-pointer">
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        <button onClick={handleSave} className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-primary/30 hover:bg-primary-dark transition-all transform active:scale-[0.95] mt-4 flex items-center justify-center gap-3">
                            {editingId ? <CheckCircleIcon className="w-5 h-5" /> : <PlusIcon className="w-5 h-5" />}
                            {editingId ? 'COMMIT CHANGES' : 'COMMIT TO REGISTRY'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FormToggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between p-4 bg-slate-50/50 border-2 border-slate-50 rounded-2xl transition-all hover:bg-white hover:border-primary/10">
        <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{label}</span>
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
            <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
        </label>
    </div>
);

export default LeaveTypes;
