
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { ExpenseClaim, Employee } from '../types';
import { PlusIcon, SearchIcon, LoaderIcon, TrashIcon, CheckCircleIcon, XCircleIcon, MoneyIcon, ChevronRightIcon } from '../components/icons';

const ExpenseManagement: React.FC = () => {
    const [claims, setClaims] = useState<ExpenseClaim[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [formData, setFormData] = useState<Partial<ExpenseClaim>>({
        employeeCode: '',
        category: 'Travel',
        amount: 0,
        claimDate: new Date().toISOString().split('T')[0],
        description: '',
        status: 'Pending'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [claimsRes, empRes] = await Promise.all([
                supabase.from('expense_claims').select('*').order('created_at', { ascending: false }),
                supabase.from('employees').select('employeeCode, firstName, lastName').eq('status', 'Active')
            ]);
            
            if (claimsRes.data) setClaims(claimsRes.data);
            if (empRes.data) setEmployees(empRes.data as Employee[]);
        } catch (e) {
            console.error("Error fetching expenses:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const emp = employees.find(e => e.employeeCode === formData.employeeCode);
            const payload = {
                ...formData,
                employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'System User'
            };
            const { error } = await supabase.from('expense_claims').insert([payload]);
            if (error) throw error;
            setIsModalOpen(false);
            fetchData();
        } catch (err: any) {
            alert("Claim submission failed: " + err.message);
        }
    };

    const updateStatus = async (id: number, status: 'Approved' | 'Rejected' | 'Paid') => {
        const { error } = await supabase.from('expense_claims').update({ status }).eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': return 'bg-blue-100 text-blue-800';
            case 'Paid': return 'bg-green-100 text-green-800';
            case 'Rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-amber-100 text-amber-800';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Expense Reimbursement</h1>
                    <p className="text-slate-600 mt-1">Review and process employee expense claims and travel bills.</p>
                </div>
                <button 
                    onClick={() => { setFormData({ category: 'Travel', status: 'Pending', claimDate: new Date().toISOString().split('T')[0] }); setIsModalOpen(true); }}
                    className="flex items-center space-x-2 bg-primary text-white px-5 py-2.5 rounded-xl hover:bg-primary-dark shadow-lg transition-all font-bold"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>Submit New Claim</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Claims (Month)</p>
                    <p className="text-2xl font-black text-slate-800 mt-2">₹{claims.reduce((a, b) => a + b.amount, 0).toLocaleString()}</p>
                </div>
                <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 shadow-sm text-center">
                    <p className="text-xs font-black text-amber-600 uppercase tracking-widest">Pending Audit</p>
                    <p className="text-2xl font-black text-amber-800 mt-2">{claims.filter(c => c.status === 'Pending').length}</p>
                </div>
                <div className="bg-green-50 p-6 rounded-2xl border border-green-200 shadow-sm text-center">
                    <p className="text-xs font-black text-green-600 uppercase tracking-widest">Approved/Paid</p>
                    <p className="text-2xl font-black text-green-800 mt-2">{claims.filter(c => c.status === 'Paid').length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Employee Count</p>
                    <p className="text-2xl font-black text-slate-800 mt-2">{new Set(claims.map(c => c.employeeCode)).size}</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex justify-center py-20"><LoaderIcon className="w-12 h-12 text-primary animate-spin" /></div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 uppercase text-xs font-black">
                                <tr>
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-6 py-4">Category</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4 text-right">Amount</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {claims.length > 0 ? claims.map(claim => (
                                    <tr key={claim.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{claim.employeeName}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">{claim.employeeCode}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold uppercase">{claim.category}</span>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs truncate text-slate-600">{claim.description}</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-900">₹{claim.amount.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${getStatusColor(claim.status)}`}>
                                                {claim.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-2">
                                                {claim.status === 'Pending' && (
                                                    <>
                                                        <button onClick={() => updateStatus(claim.id!, 'Approved')} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="Approve"><CheckCircleIcon className="w-4 h-4" /></button>
                                                        <button onClick={() => updateStatus(claim.id!, 'Rejected')} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="Reject"><XCircleIcon className="w-4 h-4" /></button>
                                                    </>
                                                )}
                                                {claim.status === 'Approved' && (
                                                    <button onClick={() => updateStatus(claim.id!, 'Paid')} className="px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-lg hover:bg-primary-dark">Mark as Paid</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : <tr><td colSpan={6} className="text-center py-10 text-slate-400 italic">No claims filed yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 uppercase tracking-tight">File Expense Claim</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircleIcon className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                             <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Claiming Employee</label>
                                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" value={formData.employeeCode} onChange={e => setFormData({...formData, employeeCode: e.target.value})} required>
                                    <option value="">Select Employee</option>
                                    {employees.map(e => <option key={e.employeeCode} value={e.employeeCode}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                                    <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                                        <option value="Travel">Travel</option>
                                        <option value="Food">Food / Meals</option>
                                        <option value="Stationary">Stationary</option>
                                        <option value="Client Meeting">Client Meeting</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (₹)</label>
                                    <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} required min="1" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expense Description</label>
                                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none h-24" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Explain why this expense was incurred..." required></textarea>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark shadow-md transition-all">Submit for Approval</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpenseManagement;
