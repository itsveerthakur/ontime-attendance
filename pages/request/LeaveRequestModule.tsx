
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { 
    ChevronRightIcon, PlusIcon, SearchIcon, LoaderIcon, 
    XCircleIcon, CheckCircleIcon, FilterIcon, RefreshIcon, 
    InfoIcon, UserCircleIcon, DocumentCheckIcon
} from '../../components/icons';
import type { LeaveRequest, Employee, LeaveBalance } from '../../types';

interface LeaveRequestModuleProps {
    onBack: () => void;
}

const LeaveRequestModule: React.FC<LeaveRequestModuleProps> = ({ onBack }) => {
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    
    // Modal & Form State
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [selectedEmpForLeave, setSelectedEmpForLeave] = useState<string>('');
    const [empBalances, setEmpBalances] = useState<LeaveBalance[]>([]);
    const [formData, setFormData] = useState({
        leave_type: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        reason: ''
    });

    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        try {
            const [reqRes, empRes] = await Promise.all([
                supabase.schema('leaves').from('leave_requests').select('*').order('created_at', { ascending: false }),
                supabase.from('employees').select('employeeCode, firstName, lastName, department').eq('status', 'Active')
            ]);
            setRequests(reqRes.data || []);
            setEmployees(empRes.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    // Fetch balances when an employee is selected in the form
    useEffect(() => {
        if (selectedEmpForLeave) {
            const fetchBalances = async () => {
                const { data } = await supabase.schema('leaves').from('leave_balances').select('*').eq('employee_code', selectedEmpForLeave);
                setEmpBalances(data || []);
                if (data && data.length > 0) setFormData(p => ({ ...p, leave_type: data[0].leave_type }));
            };
            fetchBalances();
        }
    }, [selectedEmpForLeave]);

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmpForLeave || !formData.leave_type) return;

        const start = new Date(formData.start_date);
        const end = new Date(formData.end_date);
        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        if (totalDays <= 0) {
            alert("End date must be after start date.");
            return;
        }

        const balance = empBalances.find(b => b.leave_type === formData.leave_type);
        if (!balance || balance.remaining < totalDays) {
            alert(`Insufficient balance! Remaining: ${balance?.remaining || 0} days.`);
            return;
        }

        setIsSubmitting(true);
        try {
            const emp = employees.find(e => e.employeeCode === selectedEmpForLeave);
            const { error } = await supabase.schema('leaves').from('leave_requests').insert({
                employee_code: selectedEmpForLeave,
                employee_name: `${emp?.firstName} ${emp?.lastName}`,
                leave_type: formData.leave_type,
                start_date: formData.start_date,
                end_date: formData.end_date,
                total_days: totalDays,
                reason: formData.reason,
                status: 'Pending'
            });

            if (error) throw error;
            setIsApplyModalOpen(false);
            fetchRequests();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProcess = async (req: LeaveRequest, action: 'Approved' | 'Rejected') => {
        if (!window.confirm(`Are you sure you want to mark this request as ${action}?`)) return;
        
        setIsLoading(true);
        try {
            // 1. Update Request Status
            const { error: reqError } = await supabase.schema('leaves').from('leave_requests').update({ status: action }).eq('id', req.id);
            if (reqError) throw reqError;

            // 2. If Approved, Deduct Balances & Mark Attendance
            if (action === 'Approved') {
                // Update Balance
                const { data: balance } = await supabase.schema('leaves').from('leave_balances')
                    .select('*').eq('employee_code', req.employee_code).eq('leave_type', req.leave_type).maybeSingle();
                
                if (balance) {
                    await supabase.schema('leaves').from('leave_balances').update({
                        used: Number(balance.used) + req.total_days,
                        remaining: Number(balance.remaining) - req.total_days,
                        updated_at: new Date().toISOString()
                    }).eq('id', balance.id);
                }

                // Add to Leave Applications (for Grid visibility)
                const startDate = new Date(req.start_date);
                const apps = [];
                for (let i = 0; i < req.total_days; i++) {
                    const d = new Date(startDate);
                    d.setDate(d.getDate() + i);
                    apps.push({
                        employee_code: req.employee_code,
                        date: d.toISOString().split('T')[0],
                        leave_type: req.leave_type
                    });
                }
                await supabase.schema('leaves').from('leave_applications').upsert(apps, { onConflict: 'employee_code,date' });
            }

            fetchRequests();
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const filtered = requests.filter(r => {
        const matchesSearch = r.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) || r.employee_code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter ? r.status === statusFilter : true;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 mb-8 gap-4">
                <div className="flex items-center space-x-6">
                    <button onClick={onBack} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 border border-slate-200 group">
                        <ChevronRightIcon className="w-6 h-6 rotate-180 group-hover:text-primary" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none">Leave Center</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Registry and Workflow Management</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <SearchIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="SEARCH..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-black outline-none w-48 uppercase" />
                    </div>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-[11px] font-black uppercase text-slate-700 outline-none cursor-pointer">
                        <option value="">ALL STATUS</option>
                        <option value="Pending">PENDING</option>
                        <option value="Approved">APPROVED</option>
                        <option value="Rejected">REJECTED</option>
                    </select>
                    <button onClick={() => setIsApplyModalOpen(true)} className="flex items-center gap-2 bg-black text-white px-8 py-3.5 rounded-2xl text-[10px] font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 uppercase tracking-widest">
                        <PlusIcon className="w-4 h-4" /> APPLY LEAVE
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-lg flex items-center gap-3"><DocumentCheckIcon className="w-6 h-6 text-primary" /> Application Registry</h3>
                    <span className="px-4 py-1.5 bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-full">{filtered.length} ENTRIES FOUND</span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-black text-white uppercase text-[9px] font-black tracking-widest">
                            <tr>
                                <th className="px-8 py-6 border-r border-slate-800">Staff Member</th>
                                <th className="px-8 py-6 border-r border-slate-800">Leave Type</th>
                                <th className="px-8 py-6 border-r border-slate-800">Timeline</th>
                                <th className="px-8 py-6 border-r border-slate-800 text-center">Days</th>
                                <th className="px-8 py-6 border-r border-slate-800">Reason</th>
                                <th className="px-8 py-6 border-r border-slate-800 text-center">Status</th>
                                <th className="px-8 py-6 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan={7} className="py-32 text-center"><LoaderIcon className="w-14 h-14 text-primary animate-spin mx-auto" /></td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className="py-32 text-center text-slate-400 font-black uppercase text-[11px] tracking-widest">No matching requests found</td></tr>
                            ) : (
                                filtered.map(req => (
                                    <tr key={req.id} className="hover:bg-slate-50/80 transition-all group">
                                        <td className="px-8 py-6 border-r border-slate-100">
                                            <div className="font-black text-slate-800 uppercase tracking-tight leading-none">{req.employee_name}</div>
                                            <div className="text-[9px] text-slate-400 font-black font-mono tracking-widest mt-2 uppercase">{req.employee_code}</div>
                                        </td>
                                        <td className="px-8 py-6 border-r border-slate-100 text-center">
                                            <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-black text-[9px] uppercase tracking-widest border border-blue-100">{req.leave_type}</span>
                                        </td>
                                        <td className="px-8 py-6 border-r border-slate-100 font-bold text-slate-700">
                                            <div className="text-xs">{new Date(req.start_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric'})}</div>
                                            <div className="text-[10px] text-slate-300 mt-0.5">TO {new Date(req.end_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric'})}</div>
                                        </td>
                                        <td className="px-8 py-6 border-r border-slate-100 text-center font-black text-slate-800 text-lg tabular-nums">{req.total_days}</td>
                                        <td className="px-8 py-6 border-r border-slate-100 max-w-xs"><p className="text-[10px] text-slate-500 italic font-medium leading-relaxed">"{req.reason || 'No reason provided'}"</p></td>
                                        <td className="px-8 py-6 border-r border-slate-100 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border ${
                                                req.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                                                req.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                            }`}>{req.status}</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            {req.status === 'Pending' ? (
                                                <div className="flex justify-center gap-3">
                                                    <button onClick={() => handleProcess(req, 'Approved')} className="w-10 h-10 bg-green-500 text-white rounded-xl flex items-center justify-center hover:bg-green-600 shadow-lg shadow-green-100 transition-all active:scale-90"><CheckCircleIcon className="w-5 h-5" /></button>
                                                    <button onClick={() => handleProcess(req, 'Rejected')} className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 shadow-lg shadow-red-100 transition-all active:scale-90"><XCircleIcon className="w-5 h-5" /></button>
                                                </div>
                                            ) : (
                                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Finalized</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Apply Leave Modal */}
            {isApplyModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fadeIn">
                    <div className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full p-10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-1 bg-primary/5 rounded-bl-[40px]"><RefreshIcon className="w-16 h-16 text-primary/10" /></div>
                        
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none">Apply for Leave</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">New application entry</p>
                            </div>
                            <button onClick={() => setIsApplyModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><XCircleIcon className="w-8 h-8" /></button>
                        </div>

                        <form onSubmit={handleApply} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Select Employee</label>
                                    <select 
                                        required 
                                        value={selectedEmpForLeave} 
                                        onChange={e => setSelectedEmpForLeave(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase"
                                    >
                                        <option value="">-- Choose Member --</option>
                                        {employees.map(e => <option key={e.employeeCode} value={e.employeeCode}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
                                    </select>
                                </div>
                                
                                {selectedEmpForLeave && (
                                    <>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Leave Type</label>
                                            <select 
                                                required 
                                                value={formData.leave_type} 
                                                onChange={e => setFormData({...formData, leave_type: e.target.value})}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase"
                                            >
                                                {empBalances.map(b => (
                                                    <option key={b.leave_type} value={b.leave_type}>{b.leave_type} ({b.remaining} Left)</option>
                                                ))}
                                                {empBalances.length === 0 && <option value="" disabled>No Balance Found</option>}
                                            </select>
                                        </div>
                                        <div className="bg-primary/5 rounded-2xl p-4 flex flex-col justify-center">
                                            <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest">Available Credits</span>
                                            <div className="text-2xl font-black text-primary leading-none mt-1">
                                                {empBalances.find(b => b.leave_type === formData.leave_type)?.remaining || 0} <span className="text-[10px] font-bold">DAYS</span>
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Start Date</label>
                                    <input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-3.5 text-sm font-black text-slate-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">End Date</label>
                                    <input type="date" required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-3.5 text-sm font-black text-slate-700 outline-none" />
                                </div>
                                
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Reason for Leave</label>
                                    <textarea required rows={3} value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-300" placeholder="E.g. PERSONAL EMERGENCY / FAMILY EVENT..." />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmitting || !selectedEmpForLeave}
                                className="w-full py-5 bg-primary text-white rounded-[24px] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-primary/30 hover:bg-primary-dark transition-all transform active:scale-[0.95] flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isSubmitting ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <CheckCircleIcon className="w-5 h-5" />}
                                SUBMIT APPLICATION
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaveRequestModule;
