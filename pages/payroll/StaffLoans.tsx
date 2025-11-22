
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRightIcon, PlusIcon, SearchIcon, LoaderIcon, XCircleIcon, TrashIcon, PencilIcon, FilterIcon, EyeIcon, PrinterIcon, MoneyIcon } from '../../components/icons';
import { supabase } from '../../supabaseClient';
import type { Employee } from '../../types';

interface StaffLoansProps {
    onBack: () => void;
}

interface LoanRecord {
    id?: number;
    employee_code: string;
    employee_name: string;
    loan_type: 'Advance' | 'Loan' | 'Installment';
    amount: number;
    disbursement_date: string;
    repayment_start_date?: string; // Used as Deduction From
    no_of_installments?: number;
    installment_amount?: number;
    reason?: string;
    status: 'Pending' | 'Approved' | 'Active' | 'Rejected' | 'Closed';
    created_at?: string;
}

interface LedgerItem {
    date: string; // ISO date string
    description: string;
    type: 'Debit' | 'Credit';
    amount: number;
    balance: number;
}

const StaffLoans: React.FC<StaffLoansProps> = ({ onBack }) => {
    const [loans, setLoans] = useState<LoanRecord[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Add/Edit Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [editingLoan, setEditingLoan] = useState<LoanRecord | null>(null);
    
    // Statement Modal State
    const [isStatementOpen, setIsStatementOpen] = useState(false);
    const [statementData, setStatementData] = useState<LedgerItem[]>([]);
    const [statementEmployee, setStatementEmployee] = useState<Employee | null>(null);
    const [statementLoading, setStatementLoading] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');

    // Form State
    const [formData, setFormData] = useState<Partial<LoanRecord>>({
        employee_code: '',
        loan_type: 'Advance',
        amount: 0,
        disbursement_date: new Date().toISOString().split('T')[0],
        status: 'Pending',
        no_of_installments: 1,
        installment_amount: 0
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [loanRes, empRes] = await Promise.all([
                supabase.schema('payroll').from('staff_loans').select('*').order('created_at', { ascending: false }),
                supabase.from('employees').select('*').eq('status', 'Active')
            ]);

            if (empRes.data) setEmployees(empRes.data as Employee[]);
            
            if (loanRes.error) {
                console.error("Error fetching loans:", loanRes.error);
                // Check for missing table error
                if (loanRes.error.code === '42P01' || loanRes.error.message.includes('does not exist')) {
                    setShowSqlModal(true);
                }
            } else {
                setLoans(loanRes.data as LoanRecord[]);
            }
        } catch (e) {
            console.error("Unexpected error:", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handlers for Two-Way Calculation Logic
    const handleAmountChange = (val: number) => {
        setFormData(prev => {
            const updates: any = { amount: val };
            // Strategy: Keep tenure fixed, update installment amount (Standard behavior)
            // Unless installment amount was manually rounded, but for simplicity, we reset to equal split on total change
            if (prev.no_of_installments && prev.no_of_installments > 0) {
                updates.installment_amount = parseFloat((val / prev.no_of_installments).toFixed(2));
            }
            return { ...prev, ...updates };
        });
    };

    const handleTenureChange = (val: number) => {
        setFormData(prev => {
            const updates: any = { no_of_installments: val };
            // Strategy: User changed tenure -> Recalculate Installment Amount (Equal Split)
            if (prev.amount && val > 0) {
                updates.installment_amount = parseFloat((prev.amount / val).toFixed(2));
            }
            return { ...prev, ...updates };
        });
    };

    const handleInstallmentAmountChange = (val: number) => {
        setFormData(prev => {
            const updates: any = { installment_amount: val };
            // Strategy: User changed installment amount -> Recalculate Tenure
            // e.g. 30000 total, 3000 installment -> 10 months
            // e.g. 32000 total, 3000 installment -> ceil(32000/3000) = 11 months
            if (prev.amount && val > 0) {
                updates.no_of_installments = Math.ceil(prev.amount / val);
            }
            return { ...prev, ...updates };
        });
    };

    // Helper to display breakdown
    const getBreakdownString = () => {
        if (!formData.amount || !formData.installment_amount || !formData.no_of_installments) return null;
        
        const total = formData.amount;
        const installment = formData.installment_amount;
        const count = formData.no_of_installments;
        
        // Case 1: Perfect Division
        if (Math.abs(total - (installment * count)) < 1) {
            return null; // No need to show complex breakdown if it's simple
        }
        
        // Case 2: Remainder (Rounded Amount Logic)
        // If user entered 3000 for 32000 total. Tenure became 11.
        // 10 * 3000 = 30000. Remaining 2000.
        const regularCount = count - 1;
        const regularTotal = installment * regularCount;
        const lastInstallment = total - regularTotal;
        
        if (regularCount > 0 && lastInstallment > 0) {
             return (
                 <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100 text-xs text-blue-700">
                     <span className="font-semibold">Plan:</span> {regularCount} installments of ₹{installment} + 1 last installment of ₹{parseFloat(lastInstallment.toFixed(2))}
                 </div>
             );
        }
        return null;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.employee_code || !formData.amount) return;

        try {
            const emp = employees.find(e => e.employeeCode === formData.employee_code);
            const payload = {
                ...formData,
                employee_name: emp ? `${emp.firstName} ${emp.lastName}` : (formData.employee_name || 'Unknown'),
                updated_at: new Date().toISOString() 
            };

            if (editingLoan?.id) {
                const { error } = await supabase.schema('payroll').from('staff_loans').update(payload).eq('id', editingLoan.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.schema('payroll').from('staff_loans').insert([payload]);
                if (error) throw error;
            }
            
            setIsModalOpen(false);
            setEditingLoan(null);
            fetchData();
        } catch (err: any) {
            alert("Failed to save: " + err.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure you want to delete this record?")) return;
        try {
            const { error } = await supabase.schema('payroll').from('staff_loans').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err: any) {
            alert("Failed to delete: " + err.message);
        }
    };

    const openModal = (loan?: LoanRecord) => {
        if (loan) {
            setEditingLoan(loan);
            setFormData(loan);
        } else {
            setEditingLoan(null);
            setFormData({
                employee_code: '',
                loan_type: 'Advance',
                amount: 0,
                disbursement_date: new Date().toISOString().split('T')[0],
                status: 'Pending',
                installment_amount: 0,
                no_of_installments: 1,
                reason: ''
            });
        }
        setIsModalOpen(true);
    };

    // --- STATEMENT LOGIC ---

    const handleViewStatement = async (loan: LoanRecord) => {
        setStatementLoading(true);
        setIsStatementOpen(true);
        setStatementEmployee(employees.find(e => e.employeeCode === loan.employee_code) || null);
        
        try {
            // 1. Fetch ALL loans for this employee to build full debit history
            const { data: allLoans } = await supabase
                .schema('payroll')
                .from('staff_loans')
                .select('*')
                .eq('employee_code', loan.employee_code)
                .or('status.eq.Approved,status.eq.Active,status.eq.Closed'); // Only real loans

            // 2. Fetch ALL locked salary records for repayments (Credits)
            const { data: repayments } = await supabase
                .schema('salarySheet')
                .from('monthly_salary_table')
                .select('month, year, salary_data')
                .eq('employee_code', loan.employee_code)
                .eq('status', 'Locked');

            const ledger: LedgerItem[] = [];

            // Add Loans (Debits)
            if (allLoans) {
                allLoans.forEach((l: any) => {
                    ledger.push({
                        date: l.disbursement_date || l.created_at,
                        description: `Loan Disbursement (${l.loan_type})`,
                        type: 'Debit',
                        amount: Number(l.amount),
                        balance: 0
                    });
                });
            }

            // Add Repayments (Credits) from Salary
            if (repayments) {
                repayments.forEach((r: any) => {
                    const deduction = Number(r.salary_data?.advance || 0);
                    if (deduction > 0) {
                        // Approximate date as end of salary month
                        const monthIdx = new Date(`${r.month} 1, 2000`).getMonth();
                        const date = new Date(r.year, monthIdx + 1, 0).toISOString().split('T')[0];
                        
                        ledger.push({
                            date: date,
                            description: `Salary Deduction - ${r.month} ${r.year}`,
                            type: 'Credit',
                            amount: deduction,
                            balance: 0
                        });
                    }
                });
            }

            // Sort chronologically
            ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // Calculate Running Balance
            let runningBalance = 0;
            for (let i = 0; i < ledger.length; i++) {
                if (ledger[i].type === 'Debit') {
                    runningBalance += ledger[i].amount;
                } else {
                    runningBalance -= ledger[i].amount;
                }
                ledger[i].balance = runningBalance;
            }

            setStatementData(ledger);

        } catch (error) {
            console.error("Error generating statement:", error);
            alert("Failed to generate statement.");
        } finally {
            setStatementLoading(false);
        }
    };

    const handlePrintStatement = () => {
        window.print();
    };

    const filteredLoans = loans.filter(l => {
        const matchesSearch = l.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) || l.employee_code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus ? l.status === filterStatus : true;
        return matchesSearch && matchesFilter;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': return 'bg-blue-100 text-blue-800';
            case 'Active': return 'bg-green-100 text-green-800';
            case 'Closed': return 'bg-gray-100 text-gray-800';
            case 'Rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    const getLoanTypeBadge = (type: string) => {
        switch (type) {
            case 'Loan': return 'bg-purple-50 text-purple-700 border-purple-100';
            case 'Installment': return 'bg-teal-50 text-teal-700 border-teal-100';
            default: return 'bg-orange-50 text-orange-700 border-orange-100';
        }
    };

    const getSetupSql = () => `
-- Create Table for Staff Loans if not exists
CREATE TABLE IF NOT EXISTS "payroll"."staff_loans" (
    id bigint generated by default as identity primary key,
    employee_code text not null,
    employee_name text not null,
    loan_type text not null, -- 'Advance', 'Loan', 'Installment'
    amount numeric not null,
    disbursement_date date,
    repayment_start_date date,
    no_of_installments integer default 1,
    installment_amount numeric default 0,
    reason text,
    status text default 'Pending', -- 'Pending', 'Approved', 'Active', 'Rejected', 'Closed'
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

ALTER TABLE "payroll"."staff_loans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON "payroll"."staff_loans" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
    `.trim();

    const copyToClipboard = () => {
        navigator.clipboard.writeText(getSetupSql());
        alert("SQL code copied!");
    };

    return (
        <div>
            <div className="flex items-center text-sm text-slate-500 mb-6 no-print">
                <span onClick={onBack} className="cursor-pointer hover:text-primary">Payroll</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Staff Advance & Loan</span>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-lg font-semibold text-slate-800">Loan Management</h2>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                            <input 
                                type="text" 
                                placeholder="Search employee..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                            />
                        </div>
                        
                        <div className="relative">
                            <FilterIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none" />
                            <select 
                                value={filterStatus} 
                                onChange={e => setFilterStatus(e.target.value)}
                                className="pl-10 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light appearance-none bg-white"
                            >
                                <option value="">All Status</option>
                                <option value="Pending">Pending</option>
                                <option value="Active">Active</option>
                                <option value="Closed">Closed</option>
                            </select>
                        </div>

                        <button onClick={() => openModal()} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">
                            <PlusIcon className="w-5 h-5" />
                            <span>New Request</span>
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><LoaderIcon className="w-8 h-8 text-primary animate-spin" /></div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3">Employee</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3 text-right">Amount</th>
                                    <th className="px-6 py-3 text-center">Date</th>
                                    <th className="px-6 py-3 text-right">Installment</th>
                                    <th className="px-6 py-3 text-center">Status</th>
                                    <th className="px-6 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredLoans.length > 0 ? filteredLoans.map((loan) => (
                                    <tr key={loan.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{loan.employee_name}</div>
                                            <div className="text-xs text-slate-500">{loan.employee_code}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getLoanTypeBadge(loan.loan_type)}`}>
                                                {loan.loan_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium">₹{loan.amount.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-center">{new Date(loan.disbursement_date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            {loan.installment_amount ? `₹${loan.installment_amount}` : '-'}
                                            {loan.no_of_installments && loan.no_of_installments > 1 ? <span className="text-xs text-slate-400 block">({loan.no_of_installments} EMIs)</span> : null}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(loan.status)}`}>
                                                {loan.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center space-x-2">
                                                <button 
                                                    onClick={() => handleViewStatement(loan)} 
                                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                                    title="View Statement"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => openModal(loan)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"><PencilIcon className="w-4 h-4" /></button>
                                                <button onClick={() => loan.id && handleDelete(loan.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={7} className="text-center py-8 text-slate-500">No records found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">{editingLoan ? 'Edit Request' : 'New Request'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircleIcon className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
                                <select 
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-light outline-none"
                                    value={formData.employee_code}
                                    onChange={e => setFormData({...formData, employee_code: e.target.value})}
                                    required
                                    disabled={!!editingLoan}
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.employeeCode}>{emp.firstName} {emp.lastName} ({emp.employeeCode})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                                    <select 
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                                        value={formData.loan_type}
                                        onChange={e => setFormData({...formData, loan_type: e.target.value as any})}
                                    >
                                        <option value="Advance">Salary Advance</option>
                                        <option value="Loan">Personal Loan</option>
                                        <option value="Installment">Installment</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
                                    <input 
                                        type="number" 
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                                        value={formData.amount}
                                        onChange={e => handleAmountChange(parseFloat(e.target.value))}
                                        required
                                        min="1"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Disbursement Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                                        value={formData.disbursement_date}
                                        onChange={e => setFormData({...formData, disbursement_date: e.target.value})}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                    <select 
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                                        value={formData.status}
                                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Active">Active (Disbursed)</option>
                                        <option value="Closed">Closed</option>
                                        <option value="Rejected">Rejected</option>
                                    </select>
                                </div>
                            </div>

                            {(formData.loan_type === 'Loan' || formData.loan_type === 'Installment') && (
                                <div className="space-y-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">No. of Installments</label>
                                            <input 
                                                type="number" 
                                                className="w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none bg-white"
                                                value={formData.no_of_installments || ''}
                                                onChange={e => handleTenureChange(parseFloat(e.target.value))}
                                                placeholder="e.g. 5"
                                                min="1"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">Deduction From</label>
                                            <input 
                                                type="date" 
                                                className="w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none bg-white"
                                                value={formData.repayment_start_date || ''}
                                                onChange={e => setFormData({...formData, repayment_start_date: e.target.value})}
                                                placeholder="Start Month"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Monthly Installment Amt (Auto)</label>
                                        <input 
                                            type="number" 
                                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none bg-white"
                                            value={formData.installment_amount || ''}
                                            onChange={e => handleInstallmentAmountChange(parseFloat(e.target.value))}
                                            placeholder="Enter rounded amount"
                                        />
                                        {getBreakdownString()}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Remarks</label>
                                <textarea 
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
                                    rows={2}
                                    value={formData.reason || ''}
                                    onChange={e => setFormData({...formData, reason: e.target.value})}
                                ></textarea>
                            </div>

                            <div className="flex justify-end space-x-3 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark">Save Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Statement Modal */}
            {isStatementOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto print:p-0 print:block print:bg-white">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] print:shadow-none print:max-w-full print:max-h-none print:rounded-none">
                        {/* Modal Header - Hidden in Print */}
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 print:hidden">
                            <h3 className="font-bold text-slate-800 flex items-center">
                                <MoneyIcon className="w-5 h-5 mr-2 text-primary" /> 
                                Statement of Account
                            </h3>
                            <div className="flex items-center space-x-3">
                                <button 
                                    onClick={handlePrintStatement} 
                                    className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors"
                                >
                                    <PrinterIcon className="w-4 h-4" />
                                    <span>Print / PDF</span>
                                </button>
                                <button onClick={() => setIsStatementOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    <XCircleIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Printable Content */}
                        <div id="printable-area" className="p-8 overflow-y-auto flex-1 print:overflow-visible">
                            {statementLoading ? (
                                <div className="flex justify-center py-12">
                                    <LoaderIcon className="w-10 h-10 text-primary animate-spin" />
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {/* Statement Header */}
                                    <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6">
                                        <div>
                                            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wide">Loan Account Statement</h1>
                                            <p className="text-sm text-slate-500 mt-1">Generated on: {new Date().toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="text-lg font-bold text-slate-800">{statementEmployee?.firstName} {statementEmployee?.lastName}</h2>
                                            <p className="text-sm text-slate-600 font-mono">{statementEmployee?.employeeCode}</p>
                                            <p className="text-xs text-slate-500 mt-1">{statementEmployee?.department} &bull; {statementEmployee?.designation}</p>
                                        </div>
                                    </div>

                                    {/* Ledger Table */}
                                    <div className="border rounded-lg overflow-hidden print:border-black">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-xs print:bg-gray-200 print:text-black">
                                                <tr>
                                                    <th className="px-4 py-3 border-b print:border-black">Date</th>
                                                    <th className="px-4 py-3 border-b print:border-black">Description</th>
                                                    <th className="px-4 py-3 border-b text-right print:border-black">Debit (+)</th>
                                                    <th className="px-4 py-3 border-b text-right print:border-black">Credit (-)</th>
                                                    <th className="px-4 py-3 border-b text-right print:border-black">Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 print:divide-black">
                                                {statementData.length > 0 ? (
                                                    statementData.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50 print:hover:bg-transparent">
                                                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                                {new Date(item.date).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-slate-800">
                                                                {item.description}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-red-600 font-medium">
                                                                {item.type === 'Debit' ? item.amount.toLocaleString('en-IN', {style: 'currency', currency: 'INR'}) : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-green-600 font-medium">
                                                                {item.type === 'Credit' ? item.amount.toLocaleString('en-IN', {style: 'currency', currency: 'INR'}) : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-slate-900 bg-slate-50 print:bg-transparent">
                                                                {item.balance.toLocaleString('en-IN', {style: 'currency', currency: 'INR'})}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No transactions found for this employee.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            <tfoot className="bg-slate-50 font-bold text-slate-900 print:bg-gray-100">
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-3 text-right border-t print:border-black">Closing Balance</td>
                                                    <td className="px-4 py-3 text-right border-t print:border-black">
                                                        {statementData.length > 0 
                                                            ? statementData[statementData.length - 1].balance.toLocaleString('en-IN', {style: 'currency', currency: 'INR'})
                                                            : '₹0.00'
                                                        }
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Footer Disclaimer */}
                                    <div className="text-center text-xs text-slate-400 mt-8 pt-4 border-t border-slate-100 print:border-black">
                                        <p>This is a computer-generated statement.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SQL Setup Modal */}
            {showSqlModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">Database Setup Required</h2>
                            <button onClick={() => setShowSqlModal(false)}><XCircleIcon className="w-8 h-8 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <p className="text-slate-600 mb-4">The <code>staff_loans</code> table is missing. Please run this SQL in Supabase:</p>
                            <div className="bg-slate-900 rounded-lg p-4 relative">
                                <button onClick={copyToClipboard} className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1 rounded transition-colors">Copy SQL</button>
                                <pre className="text-green-400 font-mono text-xs overflow-x-auto p-2">{getSetupSql()}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffLoans;
