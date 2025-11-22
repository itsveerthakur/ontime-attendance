
import React, { useState, useCallback, useEffect } from 'react';
import { SearchIcon, FilterIcon, XCircleIcon, ChevronRightIcon, LockClosedIcon, LockOpenIcon, LoaderIcon, EyeIcon, ImportIcon } from '../../components/icons';
import { supabase } from '../../supabaseClient';
import type { Employee, SalaryStructure } from '../../types';

// Declare XLSX for global usage (provided via CDN in index.html)
declare const XLSX: any;

interface AttendanceRecord {
    holiday: number; weekOff: number; present: number; lwp: number; leave: number; arrearDays: number; totalPaidDays: number; lock_status?: string;
}
interface PayrollAdjustment {
    arrearAmount: number; otherDeduction: number; tds: number; advance: number;
}

interface SalaryPrepareProps {
    onBack: () => void;
}

interface LoanData {
    employee_code: string;
    total_amount: number;
    installment_amount: number;
    repayment_start_date: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const SalaryPrepare: React.FC<SalaryPrepareProps> = ({ onBack }) => {
    const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[new Date().getMonth()]);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
    const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceRecord>>({});
    const [payrollAdjustments, setPayrollAdjustments] = useState<Record<string, PayrollAdjustment>>({});
    const [lockedStatusMap, setLockedStatusMap] = useState<Record<string, string>>({});
    const [searchTerm, setSearchTerm] = useState('');
    
    // Loan State
    const [activeLoans, setActiveLoans] = useState<Record<string, LoanData>>({});
    const [loanBalances, setLoanBalances] = useState<Record<string, number>>({});

    // Selection State
    const [selectedEmployeeCodes, setSelectedEmployeeCodes] = useState<Set<string>>(new Set());

    const [isLocking, setIsLocking] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);

    // Modal State
    const [viewSalaryModalOpen, setViewSalaryModalOpen] = useState(false);
    const [viewSalaryData, setViewSalaryData] = useState<any>(null);

    // Fetching Logic
    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        setSelectedEmployeeCodes(new Set()); // Reset selection on fetch
        try {
            // 1. Fetch Employees and Structures
            const [empRes, structRes] = await Promise.all([
                supabase.from('employees').select('*').order('employeeCode'),
                supabase.schema('payroll').from('employee_salary_structures').select('*')
            ]);

            if (empRes.error) throw empRes.error;
            setEmployees(empRes.data as Employee[] || []);
            setSalaryStructures(structRes.data as SalaryStructure[] || []);

            // 2. Fetch Attendance for Month
            const { data: attData, error: attError } = await supabase
                .schema('payroll')
                .from('attendance_entries')
                .select('*')
                .eq('month', selectedMonth)
                .eq('year', selectedYear);
            
            if (attError) throw attError;

            const attMap: Record<string, AttendanceRecord> = {};
            attData?.forEach((r: any) => {
                attMap[r.employee_code] = {
                    holiday: Number(r.holiday),
                    weekOff: Number(r.week_off),
                    present: Number(r.present),
                    lwp: Number(r.lwp),
                    leave: Number(r.leave),
                    arrearDays: Number(r.arrear_days),
                    totalPaidDays: Number(r.total_paid_days),
                    lock_status: r.lock_status
                };
            });
            setAttendanceData(attMap);

            // 3. Fetch Existing Locked Salaries (if any) for CURRENT month
            const { data: salaryData, error: salaryError } = await supabase
                .schema('salarySheet')
                .from('monthly_salary_table')
                .select('*')
                .eq('month', selectedMonth)
                .eq('year', selectedYear);
            
            const lockMap: Record<string, string> = {};
            const adjMap: Record<string, PayrollAdjustment> = {};

            if (salaryData) {
                salaryData.forEach((row: any) => {
                    lockMap[row.employee_code] = row.status;
                    if (row.salary_data) {
                        adjMap[row.employee_code] = {
                            arrearAmount: Number(row.salary_data.manualArrears || row.salary_data.arrearAmount || 0),
                            otherDeduction: Number(row.salary_data.otherDeduction || 0),
                            tds: Number(row.salary_data.tds || 0),
                            advance: Number(row.salary_data.advance || 0)
                        };
                    }
                });
            }
            setLockedStatusMap(lockMap);
            
            // 4. Fetch Loans & Calculate Repayments
            // 4a. Active Loans
            const { data: loansData } = await supabase.schema('payroll').from('staff_loans').select('*')
                .or('status.eq.Approved,status.eq.Active');
            
            const activeLoansMap: Record<string, LoanData> = {};
            if (loansData) {
                loansData.forEach((l: any) => {
                    // Assuming one active loan per employee for simplicity, or prioritizing last one
                    activeLoansMap[l.employee_code] = {
                        employee_code: l.employee_code,
                        total_amount: l.amount,
                        installment_amount: l.installment_amount || 0,
                        repayment_start_date: l.repayment_start_date || l.disbursement_date
                    };
                });
            }
            setActiveLoans(activeLoansMap);

            // 4b. Calculate Repaid Amount from ALL locked salary records
            // Note: In a production app with years of data, this query should be optimized or aggregated.
            const { data: historyData } = await supabase
                .schema('salarySheet')
                .from('monthly_salary_table')
                .select('employee_code, salary_data, month, year')
                .eq('status', 'Locked'); // Only count locked salaries as repaid

            const repaymentMap: Record<string, number> = {};
            if (historyData) {
                const currentMonthIndex = MONTHS.indexOf(selectedMonth);
                
                historyData.forEach((row: any) => {
                    // Filter out records strictly for the FUTURE relative to current selection?
                    // Actually, usually we count all *previous* locked records.
                    // If we are editing Nov 2025, we sum up everything from before Nov 2025.
                    // And ignore current month's data from history because we are editing it.
                    
                    const rowMonthIndex = MONTHS.indexOf(row.month);
                    const isPast = (row.year < selectedYear) || (row.year === selectedYear && rowMonthIndex < currentMonthIndex);
                    
                    if (isPast) {
                        const adv = Number(row.salary_data?.advance || 0);
                        if (adv > 0) {
                            repaymentMap[row.employee_code] = (repaymentMap[row.employee_code] || 0) + adv;
                        }
                    }
                });
            }

            // 5. Initialize Adjustments with Auto-Deduction Logic
            const newAdjMap = { ...adjMap };
            const currentMonthDate = new Date(selectedYear, MONTHS.indexOf(selectedMonth), 1);
            const balanceMap: Record<string, number> = {};

            // Loop through active loans to determine auto-deduction and balances
            Object.keys(activeLoansMap).forEach(code => {
                const loan = activeLoansMap[code];
                const totalRepaid = repaymentMap[code] || 0;
                const outstanding = Math.max(0, loan.total_amount - totalRepaid);
                balanceMap[code] = outstanding;

                // Auto-populate deduction ONLY if:
                // 1. No existing saved adjustment for this month (i.e. new preparation)
                // 2. Loan start date has passed or is this month
                // 3. Outstanding balance exists
                
                if (!newAdjMap[code] && outstanding > 0) {
                    const loanStartDate = new Date(loan.repayment_start_date);
                    // Compare only Month/Year
                    const isDue = (currentMonthDate.getFullYear() > loanStartDate.getFullYear()) || 
                                  (currentMonthDate.getFullYear() === loanStartDate.getFullYear() && currentMonthDate.getMonth() >= loanStartDate.getMonth());
                    
                    if (isDue) {
                        const deduction = Math.min(outstanding, loan.installment_amount);
                        if (deduction > 0) {
                            newAdjMap[code] = {
                                arrearAmount: 0,
                                otherDeduction: 0,
                                tds: 0,
                                advance: deduction
                            };
                        }
                    }
                }
            });
            
            setLoanBalances(balanceMap);
            setPayrollAdjustments(newAdjMap);

        } catch (err: any) {
            console.error("Error fetching data:", err);
        } finally {
            setIsLoading(false);
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleAdjustmentChange = (code: string, field: keyof PayrollAdjustment, value: string) => {
        if (lockedStatusMap[code] === 'Locked') return;
        const val = parseFloat(value) || 0;
        setPayrollAdjustments(prev => ({
            ...prev,
            [code]: {
                ...(prev[code] || { arrearAmount: 0, otherDeduction: 0, tds: 0, advance: 0 }),
                [field]: val
            }
        }));
    };

    const calculateSalary = (emp: Employee) => {
        const structure = salaryStructures.find(s => s.employee_code === emp.employeeCode);
        const attendance = attendanceData[emp.employeeCode] || { totalPaidDays: 0, arrearDays: 0 };
        const adjustment = payrollAdjustments[emp.employeeCode] || { arrearAmount: 0, otherDeduction: 0, tds: 0, advance: 0 };

        if (!structure) return null;

        const daysInMonth = new Date(selectedYear, MONTHS.indexOf(selectedMonth) + 1, 0).getDate();
        const paidDays = attendance.totalPaidDays;
        const arrearDays = attendance.arrearDays || 0;
        
        // Proration Factor
        const factor = daysInMonth > 0 ? (paidDays / daysInMonth) : 0;
        
        // 1. Earnings Calculation
        const earnedEarnings = structure.earnings_breakdown.map(e => {
            return { ...e, earned: Math.round(e.amount * factor) };
        });

        const totalEarnedGross = earnedEarnings.reduce((sum, e) => sum + e.earned, 0);
        
        // 2. Deductions Calculation
        const earnedDeductions = structure.deductions_breakdown.map(d => {
            return { ...d, earned: Math.round(d.amount * factor) };
        });
        
        const totalEarnedDeductions = earnedDeductions.reduce((sum, d) => sum + d.earned, 0);
        
        // 3. Employer Additional Calculation
        const earnedEmployerAdditional = (structure.employer_additional_breakdown || []).map(ea => {
             return { ...ea, earned: Math.round(ea.amount * factor) };
        });
        const totalEmployerContribution = earnedEmployerAdditional.reduce((sum, ea) => sum + ea.earned, 0);

        // 4. Arrear Calculation (Automatic based on Arrear Days)
        const dailyGross = daysInMonth > 0 ? (structure.monthly_gross / daysInMonth) : 0;
        const calculatedArrears = Math.round(dailyGross * arrearDays);
        
        // Total Arrears = Calculated from Days + Manual Adjustment
        const manualArrears = adjustment.arrearAmount;
        const totalArrears = calculatedArrears + manualArrears;

        // 5. Final Math
        const grossWithArrears = totalEarnedGross + totalArrears;
        const totalAdjustments = adjustment.otherDeduction + adjustment.tds + adjustment.advance;
        const totalDeductionWithAdjustments = totalEarnedDeductions + totalAdjustments;
        const netInHand = grossWithArrears - totalDeductionWithAdjustments;

        // CTC Calculation (Gross with Arrears + Employer Contributions)
        const earnedCTC = grossWithArrears + totalEmployerContribution;

        // Extract key components for Summary View & Backward Compatibility
        const basicComp = earnedEarnings.find(e => e.name.toLowerCase().includes('basic'));
        const hraComp = earnedEarnings.find(e => e.name.toLowerCase().includes('hra'));
        const specialComp = earnedEarnings.find(e => e.name.toLowerCase().includes('special'));
        
        const pfComp = earnedDeductions.find(d => d.name.toLowerCase().includes('pf') || d.name.toLowerCase().includes('provident'));
        const esiComp = earnedDeductions.find(d => d.name.toLowerCase().includes('esi'));

        return {
            // Summary / Flat fields
            basic: basicComp?.earned || 0,
            hra: hraComp?.earned || 0,
            special: specialComp?.earned || 0,
            epf: pfComp?.earned || 0,
            esic: esiComp?.earned || 0,
            
            // Totals
            grossEarned: totalEarnedGross,
            totalDeduction: totalDeductionWithAdjustments,
            netInHand,
            grossWithArrears,
            earnedCTC,
            totalEmployerContribution,
            
            // Arrears Details
            arrearDays,
            calculatedArrears,
            manualArrears,
            arrearAmount: totalArrears, // For backward compatibility
            
            // Detailed Breakdown Arrays
            earningsBreakdown: earnedEarnings,
            deductionsBreakdown: earnedDeductions,
            employerAdditionalBreakdown: earnedEmployerAdditional,
            
            // Adjustments
            ...adjustment,
            
            // Metadata
            paidDays,
            daysInMonth,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            employeeCode: emp.employeeCode,
            designation: emp.designation,
            department: emp.department
        };
    };

    // Single Lock
    const handleLockSalary = async (empCode: string) => {
        setIsLocking(true);
        try {
            const emp = employees.find(e => e.employeeCode === empCode);
            if (!emp) return;
            
            const salary = calculateSalary(emp);
            if (!salary) {
                alert("No salary structure found for this employee.");
                return;
            }

            const record = {
                employee_code: empCode,
                employee_name: `${emp.firstName} ${emp.lastName}`,
                month: selectedMonth,
                year: selectedYear,
                status: 'Locked',
                salary_data: salary,
                net_pay: salary.netInHand,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .schema('salarySheet')
                .from('monthly_salary_table')
                .upsert(record, { onConflict: 'employee_code,month,year' });

            if (error) throw error;

            setLockedStatusMap(prev => ({ ...prev, [empCode]: 'Locked' }));

        } catch (e: any) {
            console.error("Error locking salary:", e);
            alert("Failed to lock salary: " + e.message);
        } finally {
            setIsLocking(false);
        }
    };
    
    // Single Unlock
    const handleUnlockSalary = async (empCode: string) => {
        if (!window.confirm("Are you sure? Unlocking allows editing but requires re-locking to finalize.")) return;
        setIsLocking(true);
        try {
             const { error } = await supabase
                .schema('salarySheet')
                .from('monthly_salary_table')
                .update({ status: 'Open' })
                .eq('employee_code', empCode)
                .eq('month', selectedMonth)
                .eq('year', selectedYear);

             if (error) throw error;
             setLockedStatusMap(prev => ({ ...prev, [empCode]: 'Open' }));
        } catch (e: any) {
             console.error("Error unlocking salary:", e);
             alert("Failed to unlock: " + e.message);
        } finally {
            setIsLocking(false);
        }
    };

    // Bulk Actions
    const handleBulkLockAction = async (status: 'Locked' | 'Open') => {
        if (selectedEmployeeCodes.size === 0) return;
        if (status === 'Open' && !window.confirm("Are you sure you want to unlock selected salaries?")) return;

        setIsLocking(true);
        try {
            const codes = Array.from(selectedEmployeeCodes);
            const updates = [];

            for (const code of codes) {
                const emp = employees.find(e => e.employeeCode === code);
                if (!emp) continue;

                if (status === 'Locked') {
                     const salary = calculateSalary(emp);
                     if (salary) {
                         updates.push({
                            employee_code: code,
                            employee_name: `${emp.firstName} ${emp.lastName}`,
                            month: selectedMonth,
                            year: selectedYear,
                            status: 'Locked',
                            salary_data: salary,
                            net_pay: salary.netInHand,
                            updated_at: new Date().toISOString()
                         });
                     }
                } else {
                    // For bulk unlock, we don't push updates, we do a bulk update query below
                }
            }

            if (status === 'Locked' && updates.length > 0) {
                 const { error } = await supabase
                    .schema('salarySheet')
                    .from('monthly_salary_table')
                    .upsert(updates, { onConflict: 'employee_code,month,year' });
                 if (error) throw error;
            } else if (status === 'Open') {
                 const { error } = await supabase
                    .schema('salarySheet')
                    .from('monthly_salary_table')
                    .update({ status: 'Open' })
                    .in('employee_code', codes)
                    .eq('month', selectedMonth)
                    .eq('year', selectedYear);
                 if (error) throw error;
            }

            // Update local state
            setLockedStatusMap(prev => {
                const next = { ...prev };
                codes.forEach(c => next[c] = status);
                return next;
            });
            setSelectedEmployeeCodes(new Set()); // Clear selection

        } catch (e: any) {
            console.error("Error in bulk action:", e);
            alert("Failed to process bulk action: " + e.message);
        } finally {
            setIsLocking(false);
        }
    };

    const handleViewSalary = (emp: Employee) => {
        const salary = calculateSalary(emp);
        if (salary) {
            setViewSalaryData(salary);
            setViewSalaryModalOpen(true);
        } else {
            alert("Salary structure not assigned for this employee.");
        }
    };

    const filteredEmployees = employees.filter(e => 
        e.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Select All / Single
    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedEmployeeCodes(new Set(filteredEmployees.map(e => e.employeeCode)));
        } else {
            setSelectedEmployeeCodes(new Set());
        }
    };

    const toggleSelectEmployee = (code: string) => {
        const newSet = new Set(selectedEmployeeCodes);
        if (newSet.has(code)) newSet.delete(code);
        else newSet.add(code);
        setSelectedEmployeeCodes(newSet);
    };

    // --- EXPORT & IMPORT FUNCTIONS ---

    const handleDownloadTemplate = () => {
        const template = [
            { 'Employee Code': 'EMP001', 'Arrear Amount': 500, 'Other Deduction': 200, 'TDS': 1000, 'Advance': 0 }
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Adjustments');
        XLSX.writeFile(wb, 'Salary_Adjustment_Template.xlsx');
    };

    const handleImportAdjustments = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target?.result, { type: 'binary' });
                const sheetName = wb.SheetNames[0];
                const sheet = wb.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(sheet);
                
                let count = 0;
                setPayrollAdjustments(prev => {
                    const next = { ...prev };
                    data.forEach((row: any) => {
                        const code = String(row['Employee Code'] || row['Code'] || '').trim();
                        if (code && lockedStatusMap[code] !== 'Locked') {
                            const currentAdj = next[code] || { arrearAmount: 0, otherDeduction: 0, tds: 0, advance: 0 };
                            
                            next[code] = {
                                arrearAmount: row['Arrear Amount'] !== undefined ? Number(row['Arrear Amount']) : currentAdj.arrearAmount,
                                otherDeduction: row['Other Deduction'] !== undefined ? Number(row['Other Deduction']) : currentAdj.otherDeduction,
                                tds: row['TDS'] !== undefined ? Number(row['TDS']) : currentAdj.tds,
                                advance: row['Advance'] !== undefined ? Number(row['Advance']) : currentAdj.advance
                            };
                            count++;
                        }
                    });
                    return next;
                });
                
                alert(`Adjustments imported for ${count} employees.`);
                e.target.value = ''; // Reset input
            } catch (err) {
                console.error("Import Error:", err);
                alert("Failed to import file.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleExportSalarySheet = () => {
        if (filteredEmployees.length === 0) {
            alert("No data to export.");
            return;
        }
        
        const exportData = filteredEmployees.map(emp => {
            const salary = calculateSalary(emp);
            const structure = salaryStructures.find(s => s.employee_code === emp.employeeCode);

            if (!salary) return null;
            
            // Create ordered row object according to specified column order
            const row: any = {};
            
            // Basic Info
            row['Employee Code'] = emp.employeeCode;
            row['Name'] = `${emp.firstName} ${emp.lastName}`;
            row['Department'] = emp.department;
            row['Designation'] = emp.designation;
            row['Bank Name'] = emp.bankName;
            row['Account No'] = emp.accountNo;
            row['IFSC Code'] = emp.ifscCode;
            
            // Attendance
            row['Days In Month'] = salary.daysInMonth;
            row['Paid Days'] = salary.paidDays;
            row['Arrear Days'] = salary.arrearDays;
            
            // Structure
            row['Monthly Structure Gross'] = structure ? structure.monthly_gross : 0;
            
            // Earnings breakdown
            row['Basic'] = salary.basic;
            row['HRA'] = salary.hra;
            
            // Add other earnings components dynamically
            salary.earningsBreakdown.forEach((e: any) => {
                if (!['Basic', 'HRA'].some(name => e.name.toLowerCase().includes(name.toLowerCase()))) {
                    row[e.name] = e.earned;
                }
            });
            
            // Arrears
            row['Arrears (Calc)'] = salary.calculatedArrears;
            row['Arrears (Manual)'] = salary.manualArrears;
            row['Total Arrears'] = salary.arrearAmount;
            
            // Totals
            row['Gross Earned'] = salary.grossEarned;
            row['Gross With Arrears'] = salary.grossWithArrears;

            // Statutory deductions
            row['EPF'] = salary.epf;
            row['ESIC'] = salary.esic;
                        
            // Adjustments
            row['Other Deduction'] = salary.otherDeduction;
            row['TDS'] = salary.tds;
            row['Advance'] = salary.advance;
            
            // Final calculations
            row['Total Deductions'] = salary.totalDeduction;
            row['Net Pay'] = salary.netInHand;

            // Employer contributions
            row['Employer EPF'] = salary.epf; // Employer EPF = Employee EPF
            row['Employer ESIC'] = salary.esic > 0 ? Math.round(salary.esic * 3.75 / 0.75) : 0; // Employer ESIC calculation

            // Final CTC
            row['CTC'] = salary.earnedCTC;
            row['Status'] = lockedStatusMap[emp.employeeCode] || 'Open';
            
            
            
            return row;
        }).filter(Boolean);
        
        if (exportData.length === 0) return;
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Detailed Salary Sheet");
        XLSX.writeFile(wb, `Salary_Sheet_${selectedMonth}_${selectedYear}.xlsx`);
    };

    return (
        <div>
            <div className="flex items-center text-sm text-slate-500 mb-6">
                <span onClick={onBack} className="cursor-pointer hover:text-primary">Payroll</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Salary Prepare</span>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <LoaderIcon className="w-8 h-8 text-primary animate-spin" />
                    <p className="mt-2 text-slate-500">Loading salary data...</p>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Prepare & Process Salary</h2>
                            <p className="text-sm text-slate-500">Calculate final payouts and lock salary data.</p>
                        </div>
                        
                        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                <FilterIcon className="w-4 h-4 text-slate-400" />
                                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 font-medium cursor-pointer">
                                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 font-medium cursor-pointer">
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            
                            <label className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center shadow-sm">
                                <ImportIcon className="w-4 h-4 mr-2 text-slate-500" /> 
                                Import Adj.
                                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportAdjustments} />
                            </label>

                            <button onClick={handleDownloadTemplate} className="text-sm text-primary hover:underline font-medium px-2">
                                Template
                            </button>

                            <button onClick={handleExportSalarySheet} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm">
                                Export Sheet
                            </button>

                            <div className="relative">
                                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light w-48"
                                />
                            </div>

                            {selectedEmployeeCodes.size > 0 && (
                                 <div className="flex space-x-2">
                                    <button onClick={() => handleBulkLockAction('Locked')} disabled={isLocking} className="px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 shadow-sm flex items-center transition-colors">
                                        <LockClosedIcon className="w-4 h-4 mr-1" /> Lock Selected
                                    </button>
                                    <button onClick={() => handleBulkLockAction('Open')} disabled={isLocking} className="px-3 py-2 text-sm font-medium text-slate-700 bg-gray-200 rounded-lg hover:bg-gray-300 shadow-sm flex items-center transition-colors">
                                        <LockOpenIcon className="w-4 h-4 mr-1" /> Unlock Selected
                                    </button>
                                 </div>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto border rounded-lg shadow-sm max-h-[600px]">
                        <table className="w-full text-sm text-left text-slate-600 whitespace-nowrap">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 text-center border-b w-10 bg-slate-50">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            checked={selectedEmployeeCodes.size === filteredEmployees.length && filteredEmployees.length > 0}
                                            onChange={(e) => toggleSelectAll(e.target.checked)}
                                        />
                                    </th>
                                    <th className="px-4 py-3 border-b">Employee</th>
                                    <th className="px-4 py-3 border-b text-center">Paid Days</th>
                                    <th className="px-4 py-3 border-b text-right text-blue-600">Earned Gross</th>
                                    <th className="px-4 py-3 border-b text-center w-24">Arrears (+)</th>
                                    <th className="px-4 py-3 border-b text-center w-24">Loan Bal.</th>
                                    <th className="px-4 py-3 border-b text-center w-24">Advance (-)</th>
                                    <th className="px-4 py-3 border-b text-right text-red-600">Structure Ded.</th>
                                    <th className="px-4 py-3 border-b text-center w-24">Other Ded. (-)</th>
                                    <th className="px-4 py-3 border-b text-center w-24">TDS (-)</th>
                                    <th className="px-4 py-3 border-b text-right font-bold text-green-700">Net Pay</th>
                                    <th className="px-4 py-3 border-b text-right font-bold text-blue-800">CTC</th>
                                    <th className="px-4 py-3 border-b text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEmployees.map(emp => {
                                    const attendance = attendanceData[emp.employeeCode] || { totalPaidDays: 0, arrearDays: 0 };
                                    const adj = payrollAdjustments[emp.employeeCode] || { arrearAmount: 0, otherDeduction: 0, tds: 0, advance: 0 };
                                    const calculated = calculateSalary(emp);
                                    const isLocked = lockedStatusMap[emp.employeeCode] === 'Locked';
                                    
                                    // Calculate dynamic balance display
                                    const originalOutstanding = loanBalances[emp.employeeCode] || 0;
                                    const displayedBalance = Math.max(0, originalOutstanding - adj.advance);

                                    return (
                                        <tr key={emp.id} className={`hover:bg-slate-50 transition-colors ${isLocked ? 'bg-slate-50' : 'bg-white'}`}>
                                            <td className="p-4 text-center border-r">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    checked={selectedEmployeeCodes.has(emp.employeeCode)}
                                                    onChange={() => toggleSelectEmployee(emp.employeeCode)}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900 cursor-pointer hover:text-primary" onClick={() => handleViewSalary(emp)}>{emp.firstName} {emp.lastName}</div>
                                                <div className="text-xs text-slate-400">{emp.employeeCode}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center font-semibold">{attendance.totalPaidDays}</td>
                                            <td className="px-4 py-3 text-right font-medium text-blue-700">
                                                {calculated ? Math.round(calculated.grossEarned) : '-'}
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <input 
                                                    type="number" 
                                                    disabled={isLocked}
                                                    value={adj.arrearAmount} 
                                                    onChange={e => handleAdjustmentChange(emp.employeeCode, 'arrearAmount', e.target.value)}
                                                    className="w-20 text-right border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-light disabled:bg-transparent disabled:border-none"
                                                    placeholder="Adj."
                                                />
                                            </td>
                                            <td className="px-2 py-2 text-center text-xs font-medium text-slate-600">
                                                {originalOutstanding > 0 ? `₹${displayedBalance}` : '-'}
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <input 
                                                    type="number" 
                                                    disabled={isLocked}
                                                    value={adj.advance} 
                                                    onChange={e => handleAdjustmentChange(emp.employeeCode, 'advance', e.target.value)}
                                                    className={`w-20 text-right border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-light disabled:bg-transparent disabled:border-none ${adj.advance > 0 ? 'bg-yellow-50 text-yellow-800 font-semibold' : ''}`}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right text-red-600">
                                                {calculated ? Math.round(calculated.grossWithArrears - calculated.netInHand - adj.otherDeduction - adj.tds - adj.advance) : '-'}
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <input 
                                                    type="number" 
                                                    disabled={isLocked}
                                                    value={adj.otherDeduction} 
                                                    onChange={e => handleAdjustmentChange(emp.employeeCode, 'otherDeduction', e.target.value)}
                                                    className="w-20 text-right border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-light disabled:bg-transparent disabled:border-none"
                                                />
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <input 
                                                    type="number" 
                                                    disabled={isLocked}
                                                    value={adj.tds} 
                                                    onChange={e => handleAdjustmentChange(emp.employeeCode, 'tds', e.target.value)}
                                                    className="w-20 text-right border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-light disabled:bg-transparent disabled:border-none"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-green-700 text-base">
                                                {calculated ? Math.round(calculated.netInHand) : '-'}
                                            </td>
                                             <td className="px-4 py-3 text-right font-bold text-blue-800 text-base">
                                                {calculated ? Math.round(calculated.earnedCTC) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center flex items-center justify-center space-x-2">
                                                <button 
                                                    onClick={() => handleViewSalary(emp)}
                                                    className="p-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                                                    title="View Details"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                {calculated && (
                                                    <button 
                                                        onClick={() => isLocked ? handleUnlockSalary(emp.employeeCode) : handleLockSalary(emp.employeeCode)}
                                                        disabled={isLocking}
                                                        className={`p-1.5 rounded-full transition-colors ${
                                                            isLocked 
                                                                ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                        }`}
                                                        title={isLocked ? "Unlock Salary" : "Lock Salary"}
                                                    >
                                                        {isLocked ? <LockClosedIcon className="w-4 h-4" /> : <LockOpenIcon className="w-4 h-4" />}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredEmployees.length === 0 && (
                                     <tr>
                                        <td colSpan={13} className="px-6 py-12 text-center text-slate-500">
                                            No employees found based on filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detailed Salary Sheet Modal */}
            {viewSalaryModalOpen && viewSalaryData && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Complete Salary Sheet</h3>
                                <p className="text-sm text-slate-500">{viewSalaryData.employeeName} ({viewSalaryData.employeeCode}) | {viewSalaryData.designation}</p>
                            </div>
                            <button onClick={() => setViewSalaryModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
                                <XCircleIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto bg-white">
                            <div className="flex justify-between items-center mb-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="text-center">
                                    <p className="text-xs text-slate-500 uppercase">Paid Days</p>
                                    <p className="font-bold text-slate-800">{viewSalaryData.paidDays} / {viewSalaryData.daysInMonth}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-slate-500 uppercase">Gross Earned</p>
                                    <p className="font-bold text-blue-700">₹{Math.round(viewSalaryData.grossEarned)}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-slate-500 uppercase">Net Pay</p>
                                    <p className="font-bold text-green-700 text-xl">₹{Math.round(viewSalaryData.netInHand)}</p>
                                </div>
                                 <div className="text-center">
                                    <p className="text-xs text-slate-500 uppercase">Earned CTC</p>
                                    <p className="font-bold text-blue-800 text-xl">₹{Math.round(viewSalaryData.earnedCTC)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Earnings */}
                                <div className="bg-slate-50/50 p-3 rounded border border-slate-100">
                                    <h4 className="font-bold text-slate-700 border-b pb-2 mb-3 flex items-center"><span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>Earnings</h4>
                                    <div className="space-y-2 text-sm">
                                        {viewSalaryData.earningsBreakdown.map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between">
                                                <span className="text-slate-600">{item.name}</span>
                                                <span className="font-medium">₹{item.earned}</span>
                                            </div>
                                        ))}
                                        
                                        {viewSalaryData.calculatedArrears > 0 && (
                                            <div className="flex justify-between text-green-600 font-medium">
                                                <span>Arrears ({viewSalaryData.arrearDays} Days)</span>
                                                <span>+ ₹{viewSalaryData.calculatedArrears}</span>
                                            </div>
                                        )}
                                        {viewSalaryData.manualArrears > 0 && (
                                            <div className="flex justify-between text-green-600 font-medium">
                                                <span>Arrears (Adj)</span>
                                                <span>+ ₹{viewSalaryData.manualArrears}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="border-t mt-3 pt-2 flex justify-between font-bold text-slate-800">
                                        <span>Total Earnings</span>
                                        <span>₹{Math.round(viewSalaryData.grossWithArrears)}</span>
                                    </div>
                                </div>

                                {/* Deductions */}
                                <div className="bg-slate-50/50 p-3 rounded border border-slate-100">
                                    <h4 className="font-bold text-slate-700 border-b pb-2 mb-3 flex items-center"><span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>Deductions</h4>
                                    <div className="space-y-2 text-sm">
                                        {viewSalaryData.deductionsBreakdown.map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between">
                                                <span className="text-slate-600">{item.name}</span>
                                                <span className="font-medium">₹{item.earned}</span>
                                            </div>
                                        ))}
                                        {viewSalaryData.otherDeduction > 0 && (
                                            <div className="flex justify-between text-red-500">
                                                <span>Other Ded.</span>
                                                <span>₹{viewSalaryData.otherDeduction}</span>
                                            </div>
                                        )}
                                        {viewSalaryData.tds > 0 && (
                                            <div className="flex justify-between text-red-500">
                                                <span>TDS</span>
                                                <span>₹{viewSalaryData.tds}</span>
                                            </div>
                                        )}
                                        {viewSalaryData.advance > 0 && (
                                            <div className="flex justify-between text-red-500 font-medium">
                                                <span>Advance/Loan</span>
                                                <span>₹{viewSalaryData.advance}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="border-t mt-3 pt-2 flex justify-between font-bold text-slate-800">
                                        <span>Total Deductions</span>
                                        <span>₹{Math.round(viewSalaryData.totalDeduction)}</span>
                                    </div>
                                </div>

                                {/* Employer Contributions */}
                                <div className="bg-slate-50/50 p-3 rounded border border-slate-100">
                                     <h4 className="font-bold text-slate-700 border-b pb-2 mb-3 flex items-center"><span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>Employer Contrib.</h4>
                                     <div className="space-y-2 text-sm">
                                        {(viewSalaryData.employerAdditionalBreakdown || []).map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between">
                                                <span className="text-slate-600">{item.name}</span>
                                                <span className="font-medium">₹{item.earned}</span>
                                            </div>
                                        ))}
                                        {(!viewSalaryData.employerAdditionalBreakdown || viewSalaryData.employerAdditionalBreakdown.length === 0) && (
                                            <p className="text-slate-400 italic text-xs">No employer contributions.</p>
                                        )}
                                     </div>
                                     <div className="border-t mt-3 pt-2 flex justify-between font-bold text-slate-800">
                                        <span>Total Contrib.</span>
                                        <span>₹{Math.round(viewSalaryData.totalEmployerContribution)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
                            <button onClick={() => setViewSalaryModalOpen(false)} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalaryPrepare;
