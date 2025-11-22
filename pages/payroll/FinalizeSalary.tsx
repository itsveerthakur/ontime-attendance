
import React, { useState, useEffect } from 'react';
import Payslip from '../../components/Payslip';
import { PrintIcon, ChevronRightIcon, FilterIcon, EyeIcon, XCircleIcon, MoneyIcon, ComplianceIcon, AttendanceIcon, DownloadIcon, CheckCircleIcon } from '../../components/icons';
import type { PayslipData, Employee } from '../../types';
import { supabase } from '../../supabaseClient';

// Declare XLSX for global usage
declare const XLSX: any;

interface FinalizeSalaryProps {
    onBack: () => void;
}

// Extend PayslipData to include table-specific columns and dashboard data
interface ExtendedPayslipData extends PayslipData {
    ctc: number;
    employerContribution: number;
}

interface CompanySettings {
    company_name: string;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    zip_code: string;
    logo_url: string;
}

const FinalizeSalary: React.FC<FinalizeSalaryProps> = ({ onBack }) => {
    const [payslips, setPayslips] = useState<ExtendedPayslipData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [finalizeMonth, setFinalizeMonth] = useState<string>(new Date().toLocaleString('default', { month: 'long' }));
    const [finalizeYear, setFinalizeYear] = useState<number>(new Date().getFullYear());
    const [selectedDepartment, setSelectedDepartment] = useState<string>('');
    
    const [departments, setDepartments] = useState<string[]>([]);
    const [employeesMap, setEmployeesMap] = useState<Record<string, Employee>>({});
    const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

    // Modal State
    const [selectedPayslip, setSelectedPayslip] = useState<PayslipData | null>(null);
    const [showPayslipModal, setShowPayslipModal] = useState(false);

    useEffect(() => {
        // Check if navigated with filters in localStorage
        const storedMonth = localStorage.getItem('payroll_month');
        const storedYear = localStorage.getItem('payroll_year');
        if (storedMonth) {
            setFinalizeMonth(storedMonth);
            localStorage.removeItem('payroll_month');
        }
        if (storedYear) {
            setFinalizeYear(Number(storedYear));
            localStorage.removeItem('payroll_year');
        }

        const fetchMasters = async () => {
            const [deptRes, empRes, settingsRes] = await Promise.all([
                supabase.from('departments').select('name').eq('status', 'active'),
                supabase.from('employees').select('*'),
                supabase.from('settings').select('*').eq('id', 1).single()
            ]);
            
            if (deptRes.data) setDepartments(deptRes.data.map((d: any) => d.name));
            
            if (empRes.data) {
                const map: Record<string, Employee> = {};
                empRes.data.forEach((e: Employee) => {
                    if(e.employeeCode) map[e.employeeCode] = e;
                });
                setEmployeesMap(map);
            }

            if (settingsRes.data) {
                setCompanySettings(settingsRes.data as CompanySettings);
            }
        };
        fetchMasters();
    }, []);

    const handleFetchSystemData = async () => {
        setIsLoading(true);
        setError(null);
        setPayslips([]);
        
        try {
            const { data, error } = await supabase
                .schema('salarySheet')
                .from('monthly_salary_table')
                .select('*')
                .eq('month', finalizeMonth)
                .eq('year', finalizeYear)
                .eq('status', 'Locked');

            if (error) throw error;

            if (!data || data.length === 0) {
                setError(`No locked salary data found for ${finalizeMonth} ${finalizeYear}. Please go to 'Salary Prepare' and lock salaries first.`);
            } else {
                let generatedPayslips: ExtendedPayslipData[] = data.map((row: any) => {
                    const salary = row.salary_data;
                    const empDetails = employeesMap[row.employee_code];

                    // Construct breakdown from saved JSON or fallback to empDetails
                    
                    const earningsList = salary.earningsBreakdown 
                        ? salary.earningsBreakdown.map((e: any) => ({ name: e.name, amount: e.earned }))
                        : [
                            { name: 'Basic Salary', amount: salary.basic },
                            { name: 'HRA', amount: salary.hra },
                            { name: 'Special Allowance', amount: salary.special },
                          ];
                    
                    // Add Arrears if present
                    if (salary.arrearAmount > 0) {
                         if (!earningsList.some((e:any) => e.name === 'Arrears')) {
                             earningsList.push({ name: 'Arrears', amount: salary.arrearAmount });
                         }
                    }

                    const deductionsList = salary.deductionsBreakdown
                        ? salary.deductionsBreakdown.map((d: any) => ({ name: d.name, amount: d.earned }))
                        : [
                            { name: 'PF', amount: salary.epf },
                            { name: 'ESIC', amount: salary.esic },
                        ].filter((d: any) => d.amount > 0);

                    // Add Adjustments
                    if (salary.otherDeduction > 0) deductionsList.push({ name: 'Other Deductions', amount: salary.otherDeduction });
                    if (salary.tds > 0) deductionsList.push({ name: 'TDS', amount: salary.tds });
                    if (salary.advance > 0) deductionsList.push({ name: 'Advance', amount: salary.advance });

                    // Calculate Pay Period properly (first to last day of selected month)
                    const monthIndex = new Date(Date.parse(finalizeMonth +" 1, 2012")).getMonth();
                    const firstDay = new Date(finalizeYear, monthIndex, 1);
                    const lastDay = new Date(finalizeYear, monthIndex + 1, 0);

                    const formatDateISO = (date: Date) => date.toISOString().split('T')[0];

                    return {
                        employeeId: row.employee_code,
                        employeeName: row.employee_name,
                        designation: empDetails?.designation || 'N/A',
                        department: empDetails?.department || '', 
                        dateOfJoining: empDetails?.dateOfJoining,
                        uanNo: empDetails?.uanNo,
                        esicNo: empDetails?.esicNo,
                        bankName: empDetails?.bankName,
                        bankAccount: empDetails?.accountNo,
                        ifscCode: empDetails?.ifscCode,
                        payPeriodStart: formatDateISO(firstDay),
                        payPeriodEnd: formatDateISO(lastDay),
                        earnings: earningsList,
                        deductions: deductionsList,
                        totalEarnings: salary.grossWithArrears,
                        totalDeductions: salary.totalDeduction,
                        netPay: salary.netInHand,
                        ctc: salary.earnedCTC || 0,
                        employerContribution: salary.totalEmployerContribution || 0,
                        workingDays: salary.daysInMonth,
                        paidDays: salary.paidDays,
                        lopDays: (salary.daysInMonth - salary.paidDays)
                    };
                });

                if (selectedDepartment) {
                    generatedPayslips = generatedPayslips.filter(p => (p as any).department === selectedDepartment);
                }

                setPayslips(generatedPayslips);
                if (generatedPayslips.length === 0 && data.length > 0) {
                    setError(`Data found for ${finalizeMonth}, but no employees match the selected department: ${selectedDepartment}`);
                }
            }
        } catch (err: any) {
            setError("Error fetching system data: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-fetch on mount if we have data
    useEffect(() => {
        if (finalizeMonth && finalizeYear && Object.keys(employeesMap).length > 0) {
            handleFetchSystemData();
        }
    }, [employeesMap, finalizeMonth, finalizeYear]); // Re-fetch when month/year changes or employees loaded

    const handleViewPayslip = (payslip: PayslipData) => {
        setSelectedPayslip(payslip);
        setShowPayslipModal(true);
    };

    const handleCloseModal = () => {
        setShowPayslipModal(false);
        setSelectedPayslip(null);
    };

    const handlePrintSingle = () => {
        window.print();
    };

    const handlePrintBreakdown = (title: string, data: { employeeId: string; name: string; amount: number }[]) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const total = data.reduce((acc, item) => acc + item.amount, 0);
        
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title} Report - ${finalizeMonth} ${finalizeYear}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.4; color: #1e293b; background: white; }
                    .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
                    .company-name { font-size: 24px; font-weight: bold; color: #1e293b; margin-bottom: 5px; }
                    .report-title { font-size: 20px; color: #475569; margin-bottom: 5px; }
                    .period { font-size: 14px; color: #64748b; }
                    .summary { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
                    .summary h2 { font-size: 18px; color: #1e293b; margin-bottom: 10px; }
                    .total-amount { font-size: 32px; font-weight: bold; color: #059669; }
                    .employee-count { font-size: 14px; color: #64748b; margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
                    th { background: #f1f5f9; font-weight: 600; color: #374151; font-size: 14px; }
                    td { font-size: 14px; }
                    .amount { text-align: right; font-weight: 600; }
                    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #64748b; }
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .container { padding: 10px; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="company-name">${companySettings?.company_name || 'Company Name'}</div>
                        <div class="report-title">${title} Report</div>
                        <div class="period">Period: ${finalizeMonth} ${finalizeYear}</div>
                    </div>
                    
                    <div class="summary">
                        <h2>Total ${title}</h2>
                        <div class="total-amount">${formatCurrency(total)}</div>
                        <div class="employee-count">${data.length} employees</div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Employee ID</th>
                                <th>Employee Name</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(item => `
                                <tr>
                                    <td>${item.employeeId}</td>
                                    <td>${item.name}</td>
                                    <td class="amount">${formatCurrency(item.amount)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f8fafc; font-weight: bold;">
                                <td colspan="2">Total</td>
                                <td class="amount">${formatCurrency(total)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    <div class="footer">
                        Generated on ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}
                    </div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    const handlePrintSalaryRegister = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Detailed Salary Register - ${finalizeMonth} ${finalizeYear}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.4; color: #1e293b; background: white; }
                    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
                    .company-name { font-size: 24px; font-weight: bold; color: #1e293b; margin-bottom: 5px; }
                    .report-title { font-size: 20px; color: #475569; margin-bottom: 5px; }
                    .period { font-size: 14px; color: #64748b; }
                    .summary { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; display: flex; justify-content: space-around; text-align: center; }
                    .summary-item h3 { font-size: 16px; color: #1e293b; margin-bottom: 5px; }
                    .summary-item .amount { font-size: 20px; font-weight: bold; }
                    .gross { color: #059669; }
                    .deductions { color: #dc2626; }
                    .net { color: #2563eb; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                    th, td { padding: 8px; text-align: left; border: 1px solid #e2e8f0; }
                    th { background: #f1f5f9; font-weight: 600; color: #374151; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .font-medium { font-weight: 600; }
                    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #64748b; }
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .container { padding: 10px; }
                        table { font-size: 10px; }
                        th, td { padding: 6px; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="company-name">${companySettings?.company_name || 'Company Name'}</div>
                        <div class="report-title">Detailed Salary Register</div>
                        <div class="period">Period: ${finalizeMonth} ${finalizeYear}</div>
                    </div>
                    
                    <div class="summary">
                        <div class="summary-item">
                            <h3>Total Employees</h3>
                            <div class="amount">${payslips.length}</div>
                        </div>
                        <div class="summary-item">
                            <h3>Gross Pay</h3>
                            <div class="amount gross">${formatCurrency(payslips.reduce((acc, p) => acc + p.totalEarnings, 0))}</div>
                        </div>
                        <div class="summary-item">
                            <h3>Total Deductions</h3>
                            <div class="amount deductions">${formatCurrency(payslips.reduce((acc, p) => acc + p.totalDeductions, 0))}</div>
                        </div>
                        <div class="summary-item">
                            <h3>Net Payable</h3>
                            <div class="amount net">${formatCurrency(payslips.reduce((acc, p) => acc + p.netPay, 0))}</div>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Emp ID</th>
                                <th>Employee Name</th>
                                <th>Department</th>
                                <th>Designation</th>
                                <th class="text-right">Earnings</th>
                                <th class="text-right">Deductions</th>
                                <th class="text-right">Net Pay</th>
                                <th class="text-right">CTC</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payslips.map(p => `
                                <tr>
                                    <td class="font-medium">${p.employeeId}</td>
                                    <td class="font-medium">${p.employeeName}</td>
                                    <td>${(p as any).department}</td>
                                    <td>${p.designation}</td>
                                    <td class="text-right font-medium">${formatCurrency(p.totalEarnings)}</td>
                                    <td class="text-right">${formatCurrency(p.totalDeductions)}</td>
                                    <td class="text-right font-medium">${formatCurrency(p.netPay)}</td>
                                    <td class="text-right font-medium">${formatCurrency(p.ctc)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f8fafc; font-weight: bold;">
                                <td colspan="4">Total (${payslips.length} employees)</td>
                                <td class="text-right">${formatCurrency(payslips.reduce((acc, p) => acc + p.totalEarnings, 0))}</td>
                                <td class="text-right">${formatCurrency(payslips.reduce((acc, p) => acc + p.totalDeductions, 0))}</td>
                                <td class="text-right">${formatCurrency(payslips.reduce((acc, p) => acc + p.netPay, 0))}</td>
                                <td class="text-right">${formatCurrency(payslips.reduce((acc, p) => acc + p.ctc, 0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    <div class="footer">
                        Generated on ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}
                    </div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    const handleDownloadReport = () => {
        if (payslips.length === 0) {
            alert("No data to export");
            return;
        }
        
        const exportData = payslips.map(p => ({
            'Employee ID': p.employeeId,
            'Name': p.employeeName,
            'Department': p.department,
            'Designation': p.designation,
            'Paid Days': p.paidDays,
            'Total Earnings': p.totalEarnings,
            'Total Deductions': p.totalDeductions,
            'Net Pay': p.netPay,
            'CTC': p.ctc,
            'Bank Name': p.bankName,
            'Account No': p.bankAccount,
            'IFSC': p.ifscCode
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Salary Report");
        XLSX.writeFile(wb, `Salary_Report_${finalizeMonth}_${finalizeYear}.xlsx`);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    return (
        <div>
            <div className="flex items-center text-sm text-slate-500 mb-6 no-print">
                <span onClick={onBack} className="cursor-pointer hover:text-primary">Payroll</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Salary Dashboard</span>
            </div>

            {/* Top Controls / Filter Bar */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print mb-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Salary Dashboard</h2>
                        <p className="text-sm text-slate-500">Review financial data for <span className="font-semibold text-primary">{finalizeMonth} {finalizeYear}</span></p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                             <FilterIcon className="w-4 h-4 text-slate-400" />
                             <select value={finalizeMonth} onChange={e => setFinalizeMonth(e.target.value)} className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 font-medium cursor-pointer">
                                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select value={finalizeYear} onChange={e => setFinalizeYear(Number(e.target.value))} className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 font-medium cursor-pointer">
                                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>

                        <select 
                            value={selectedDepartment} 
                            onChange={e => setSelectedDepartment(e.target.value)} 
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[150px] focus:ring-2 focus:ring-primary-light focus:outline-none"
                        >
                            <option value="">All Departments</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>

                        <button onClick={handleFetchSystemData} disabled={isLoading} className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50 shadow-sm font-medium transition-colors">
                            {isLoading ? 'Fetching...' : 'Refresh Data'}
                        </button>
                    </div>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-center border border-red-100 shadow-sm">{error}</div>}
            
            {/* Metrics Dashboard Grid */}
            {payslips.length > 0 && !error && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 no-print">
                         {/* Total Gross */}
                         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Total Gross Pay</p>
                                    <h3 className="text-2xl font-bold text-slate-800 mt-2">{formatCurrency(payslips.reduce((acc, p) => acc + p.totalEarnings, 0))}</h3>
                                </div>
                                <div className="p-3 bg-indigo-50 rounded-lg">
                                    <MoneyIcon className="w-6 h-6 text-indigo-600" />
                                </div>
                            </div>
                            <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 w-full"></div>
                            </div>
                        </div>

                        {/* Total Net Pay */}
                         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Net Payable</p>
                                    <h3 className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(payslips.reduce((acc, p) => acc + p.netPay, 0))}</h3>
                                </div>
                                 <div className="p-3 bg-green-50 rounded-lg">
                                    <MoneyIcon className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                            <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 w-[75%]"></div>
                            </div>
                        </div>

                        {/* Total Deductions */}
                         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Total Deductions</p>
                                    <h3 className="text-2xl font-bold text-red-600 mt-2">{formatCurrency(payslips.reduce((acc, p) => acc + p.totalDeductions, 0))}</h3>
                                </div>
                                 <div className="p-3 bg-red-50 rounded-lg">
                                    <MoneyIcon className="w-6 h-6 text-red-600" />
                                </div>
                            </div>
                            <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 w-[25%]"></div>
                            </div>
                        </div>

                         {/* Processed Count */}
                         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Processed Employees</p>
                                    <h3 className="text-2xl font-bold text-slate-800 mt-2">{payslips.length}</h3>
                                </div>
                                 <div className="p-3 bg-blue-50 rounded-lg">
                                    <AttendanceIcon className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                            <p className="text-xs text-green-600 mt-4 flex items-center font-medium"><CheckCircleIcon className="w-3 h-3 mr-1"/> Salaries Locked</p>
                        </div>
                    </div>

                    {/* Detailed Breakdown Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 no-print">
                        {/* Employee EPF */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Employee EPF</p>
                                    <h3 className="text-xl font-bold text-blue-600 mt-1">
                                        {formatCurrency(payslips.reduce((acc, p) => {
                                            const epf = p.deductions.find(d => d.name === 'PF' || d.name === 'EPF');
                                            return acc + (epf?.amount || 0);
                                        }, 0))}
                                    </h3>
                                </div>
                                <div className="p-3 bg-blue-50 rounded-lg">
                                    <ComplianceIcon className="w-5 h-5 text-blue-600" />
                                </div>
                            </div>
                            <button 
                                onClick={() => handlePrintBreakdown('Employee EPF', payslips.map(p => ({ 
                                    employeeId: p.employeeId, 
                                    name: p.employeeName, 
                                    amount: p.deductions.find(d => d.name === 'PF' || d.name === 'EPF')?.amount || 0 
                                })).filter(item => item.amount > 0))}
                                className="w-full mt-3 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <PrintIcon className="w-3 h-3" />
                                Print Report
                            </button>
                        </div>

                        {/* Employee ESIC */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Employee ESIC</p>
                                    <h3 className="text-xl font-bold text-green-600 mt-1">
                                        {formatCurrency(payslips.reduce((acc, p) => {
                                            const esic = p.deductions.find(d => d.name === 'ESIC');
                                            return acc + (esic?.amount || 0);
                                        }, 0))}
                                    </h3>
                                </div>
                                <div className="p-3 bg-green-50 rounded-lg">
                                    <ComplianceIcon className="w-5 h-5 text-green-600" />
                                </div>
                            </div>
                            <button 
                                onClick={() => handlePrintBreakdown('Employee ESIC', payslips.map(p => ({ 
                                    employeeId: p.employeeId, 
                                    name: p.employeeName, 
                                    amount: p.deductions.find(d => d.name === 'ESIC')?.amount || 0 
                                })).filter(item => item.amount > 0))}
                                className="w-full mt-3 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <PrintIcon className="w-3 h-3" />
                                Print Report
                            </button>
                        </div>

                        {/* Employer EPF */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Employer EPF</p>
                                    <h3 className="text-xl font-bold text-purple-600 mt-1">
                                        {formatCurrency(payslips.reduce((acc, p) => {
                                            const epf = p.deductions.find(d => d.name === 'PF' || d.name === 'EPF');
                                            return acc + (epf?.amount || 0); // Employer contribution = Employee contribution
                                        }, 0))}
                                    </h3>
                                </div>
                                <div className="p-3 bg-purple-50 rounded-lg">
                                    <ComplianceIcon className="w-5 h-5 text-purple-600" />
                                </div>
                            </div>
                            <button 
                                onClick={() => handlePrintBreakdown('Employer EPF', payslips.map(p => ({ 
                                    employeeId: p.employeeId, 
                                    name: p.employeeName, 
                                    amount: p.deductions.find(d => d.name === 'PF' || d.name === 'EPF')?.amount || 0 
                                })).filter(item => item.amount > 0))}
                                className="w-full mt-3 px-3 py-2 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <PrintIcon className="w-3 h-3" />
                                Print Report
                            </button>
                        </div>

                        {/* Advance */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Advance</p>
                                    <h3 className="text-xl font-bold text-orange-600 mt-1">
                                        {formatCurrency(payslips.reduce((acc, p) => {
                                            const advance = p.deductions.find(d => d.name === 'Advance');
                                            return acc + (advance?.amount || 0);
                                        }, 0))}
                                    </h3>
                                </div>
                                <div className="p-3 bg-orange-50 rounded-lg">
                                    <MoneyIcon className="w-5 h-5 text-orange-600" />
                                </div>
                            </div>
                            <button 
                                onClick={() => handlePrintBreakdown('Advance', payslips.map(p => ({ 
                                    employeeId: p.employeeId, 
                                    name: p.employeeName, 
                                    amount: p.deductions.find(d => d.name === 'Advance')?.amount || 0 
                                })).filter(item => item.amount > 0))}
                                className="w-full mt-3 px-3 py-2 text-xs font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <PrintIcon className="w-3 h-3" />
                                Print Report
                            </button>
                        </div>

                        {/* Employer ESIC */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Employer ESIC</p>
                                    <h3 className="text-xl font-bold text-teal-600 mt-1">
                                        {formatCurrency(payslips.reduce((acc, p) => {
                                            const esic = p.deductions.find(d => d.name === 'ESIC');
                                            return acc + (esic ? esic.amount * 4.75 / 0.75 : 0); // Employer ESIC = Employee ESIC * 4.75/0.75
                                        }, 0))}
                                    </h3>
                                </div>
                                <div className="p-3 bg-teal-50 rounded-lg">
                                    <ComplianceIcon className="w-5 h-5 text-teal-600" />
                                </div>
                            </div>
                            <button 
                                onClick={() => handlePrintBreakdown('Employer ESIC', payslips.map(p => ({ 
                                    employeeId: p.employeeId, 
                                    name: p.employeeName, 
                                    amount: p.deductions.find(d => d.name === 'ESIC') ? (p.deductions.find(d => d.name === 'ESIC')?.amount || 0) * 4.75 / 0.75 : 0 
                                })).filter(item => item.amount > 0))}
                                className="w-full mt-3 px-3 py-2 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <PrintIcon className="w-3 h-3" />
                                Print Report
                            </button>
                        </div>

                        {/* Total Employer Contribution */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Total Employer Cost</p>
                                    <h3 className="text-xl font-bold text-indigo-600 mt-1">
                                        {formatCurrency(payslips.reduce((acc, p) => {
                                            const epf = p.deductions.find(d => d.name === 'PF' || d.name === 'EPF')?.amount || 0;
                                            const esic = p.deductions.find(d => d.name === 'ESIC')?.amount || 0;
                                            const employerEsic = esic * 4.75 / 0.75;
                                            return acc + p.totalEarnings + epf + employerEsic;
                                        }, 0))}
                                    </h3>
                                </div>
                                <div className="p-3 bg-indigo-50 rounded-lg">
                                    <MoneyIcon className="w-5 h-5 text-indigo-600" />
                                </div>
                            </div>
                            <button 
                                onClick={() => handlePrintBreakdown('Total Employer Cost', payslips.map(p => ({ 
                                    employeeId: p.employeeId, 
                                    name: p.employeeName, 
                                    amount: (() => {
                                        const epf = p.deductions.find(d => d.name === 'PF' || d.name === 'EPF')?.amount || 0;
                                        const esic = p.deductions.find(d => d.name === 'ESIC')?.amount || 0;
                                        const employerEsic = esic * 4.75 / 0.75;
                                        return p.totalEarnings + epf + employerEsic;
                                    })()
                                })))}
                                className="w-full mt-3 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <PrintIcon className="w-3 h-3" />
                                Print Report
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Detailed Salary Register</h3>
                            <div className="flex space-x-3">
                                <button 
                                    onClick={handleDownloadReport} 
                                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
                                >
                                    <DownloadIcon className="w-4 h-4" />
                                    <span>Export Excel</span>
                                </button>
                                <button 
                                    onClick={handlePrintSalaryRegister} 
                                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
                                >
                                    <PrintIcon className="w-4 h-4" />
                                    <span>Print</span>
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto border rounded-lg shadow-sm">
                            <table className="w-full text-sm text-left text-slate-600 whitespace-nowrap">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-700 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 border-b">Emp ID</th>
                                        <th className="px-4 py-3 border-b">Name</th>
                                        <th className="px-4 py-3 border-b">Department</th>
                                        <th className="px-4 py-3 border-b">Designation</th>
                                        <th className="px-4 py-3 border-b text-right">Earnings</th>
                                        <th className="px-4 py-3 border-b text-right">Deductions</th>
                                        <th className="px-4 py-3 border-b text-right">Net Pay</th>
                                        <th className="px-4 py-3 border-b text-right text-blue-700">CTC</th>
                                        <th className="px-4 py-3 border-b text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {payslips.map(p => (
                                        <tr key={p.employeeId} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-medium">{p.employeeId}</td>
                                            <td className="px-4 py-3 font-medium text-slate-800">{p.employeeName}</td>
                                            <td className="px-4 py-3">{(p as any).department}</td>
                                            <td className="px-4 py-3">{p.designation}</td>
                                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.totalEarnings)}</td>
                                            <td className="px-4 py-3 text-right text-red-600">{formatCurrency(p.totalDeductions)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-green-700 bg-green-50/20">{formatCurrency(p.netPay)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-700">{formatCurrency(p.ctc)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button 
                                                    onClick={() => handleViewPayslip(p)}
                                                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors text-xs font-medium shadow-sm"
                                                >
                                                    <EyeIcon className="w-3.5 h-3.5" />
                                                    <span>View Slip</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
            
            {payslips.length === 0 && !isLoading && !error && (
                <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 mb-6">
                        <FilterIcon className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">No Salary Data Available</h3>
                    <p className="mt-2 text-slate-500 max-w-md mx-auto">Select a Month & Year above and click "View Data" to load the salary dashboard. Ensure salaries are locked in the "Salary Prepare" module first.</p>
                </div>
            )}

            {/* Modal for Payslip View */}
            {showPayslipModal && selectedPayslip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:p-0 print:block print:static print:bg-white">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden print:shadow-none print:max-h-none print:max-w-none print:w-full print:h-auto print:rounded-none">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 print:hidden">
                            <h3 className="font-bold text-slate-800 text-lg">Payslip Preview</h3>
                            <div className="flex items-center space-x-3">
                                {/* <button 
                                    onClick={handlePrintSingle} 
                                    className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark text-sm font-medium shadow-sm transition-colors"
                                >
                                    <PrintIcon className="w-4 h-4" />
                                    <span>Print / Download</span>
                                </button> */}
                                <button 
                                    onClick={handleCloseModal} 
                                    className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors text-xl font-bold"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 bg-slate-100 print:p-0 print:bg-white print:overflow-visible">
                            <div id="printable-area" className="print:w-full">
                                <Payslip 
                                    data={selectedPayslip} 
                                    companyName={companySettings?.company_name || "Company Name"} 
                                    logoUrl={companySettings?.logo_url}
                                    companyDetails={companySettings}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinalizeSalary;
