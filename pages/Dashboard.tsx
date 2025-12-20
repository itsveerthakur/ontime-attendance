
import React, { useEffect, useState } from 'react';
import { 
    MasterMgmtIcon, LoaderIcon, PrinterIcon, DownloadIcon, 
    AttendanceIcon, MoneyIcon, CheckCircleIcon, XCircleIcon, 
    UserCircleIcon, ChevronRightIcon, FilterIcon 
} from '../components/icons';
import { supabase } from '../supabaseClient';
import type { Employee } from '../types';
import type { Page } from '../App';

// Declare XLSX for global usage
declare const XLSX: any;

interface DashboardProps {
    setActivePage: (page: Page) => void;
}

const StatCard: React.FC<{ 
    title: string; 
    count: number; 
    subText: string; 
    colorClass: string; 
    icon: React.ReactNode;
    isLoading: boolean 
}> = ({ title, count, subText, colorClass, icon, isLoading }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 transition-transform hover:scale-[1.02]">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
                <div className="mt-2 flex items-baseline">
                    {isLoading ? (
                        <div className="h-8 w-16 bg-slate-100 rounded animate-pulse"></div>
                    ) : (
                        <span className={`text-3xl font-bold ${colorClass}`}>{count}</span>
                    )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{subText}</p>
            </div>
            <div className={`p-3 rounded-lg bg-opacity-10 ${colorClass.replace('text-', 'bg-')}`}>
                <div className={colorClass}>{icon}</div>
            </div>
        </div>
    </div>
);

const ProgressBar: React.FC<{ label: string; value: number; total: number; color: string }> = ({ label, value, total, color }) => {
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600 font-medium">{label}</span>
                <span className="text-slate-800 font-bold">{value} <span className="text-slate-400 text-xs font-normal">({percentage}%)</span></span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

interface DashboardStats {
    onRollCount: number;
    contractualCount: number;
    totalActive: number;
    departmentCount: number;
    departments: Record<string, { total: number, active: number }>;
    genderDistribution: { Male: number; Female: number; Other: number };
    recentJoiners: Employee[];
    
    // Attendance Stats
    totalPaidDays: number;
    totalPresent: number;
    totalLeaves: number;
    totalHolidays: number;
    
    // Payroll Stats
    totalPayrollCost: number;
    totalDeductions: number;
    totalNetPay: number;
    processedEmployees: number;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const Dashboard: React.FC<DashboardProps> = ({ setActivePage }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState<string>(new Date().toLocaleString('default', { month: 'long' }));
    const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
    
    // Separate state for Salary Card Filters to allow independent toggling
    const [salaryCardMonth, setSalaryCardMonth] = useState<string>(new Date().toLocaleString('default', { month: 'long' }));
    const [salaryCardYear, setSalaryCardYear] = useState<number>(new Date().getFullYear());
    
    // Deductions breakdown modal state
    const [showDeductionsModal, setShowDeductionsModal] = useState(false);
    const [deductionsBreakdown, setDeductionsBreakdown] = useState({ totalPF: 0, totalESIC: 0, totalAdvance: 0 });
    
    // Employer additionals breakdown state
    const [showEmployerModal, setShowEmployerModal] = useState(false);
    const [employerBreakdown, setEmployerBreakdown] = useState({ totalEmployerPF: 0, totalEmployerESIC: 0 });

    const [stats, setStats] = useState<DashboardStats>({
        onRollCount: 0,
        contractualCount: 0,
        totalActive: 0,
        departmentCount: 0,
        departments: {},
        genderDistribution: { Male: 0, Female: 0, Other: 0 },
        recentJoiners: [],
        totalPaidDays: 0,
        totalPresent: 0,
        totalLeaves: 0,
        totalHolidays: 0,
        totalPayrollCost: 0,
        totalDeductions: 0,
        totalNetPay: 0,
        processedEmployees: 0
    });

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const [empRes, attRes, salaryRes] = await Promise.all([
                    supabase.from('employees').select('*').order('dateOfJoining', { ascending: false }),
                    supabase.schema('payroll').from('attendance_entries').select('*').eq('month', currentMonth).eq('year', currentYear),
                    supabase.schema('salarySheet').from('monthly_salary_table').select('*').eq('month', salaryCardMonth).eq('year', salaryCardYear)
                ]);

                const emps = (empRes.data as Employee[]) || [];
                
                // HR Stats
                const onRoll = emps.filter(e => e.userType === 'On-Roll' && e.status === 'Active').length;
                const contractual = emps.filter(e => e.userType === 'Contractual' && e.status === 'Active').length;
                // Explicitly sum them up to be safe
                const total = onRoll + contractual;

                const deptMap: Record<string, { total: number, active: number }> = {};
                const genderDist = { Male: 0, Female: 0, Other: 0 };

                emps.forEach(e => {
                    const dept = e.department || 'Unassigned';
                    if (!deptMap[dept]) deptMap[dept] = { total: 0, active: 0 };
                    deptMap[dept].total += 1;
                    if (e.status === 'Active') {
                        deptMap[dept].active += 1;
                        const g = e.gender as 'Male' | 'Female' | 'Other';
                        if (genderDist[g] !== undefined) genderDist[g] += 1;
                    }
                });

                // Attendance Stats
                let tPaid = 0, tPres = 0, tLeave = 0, tHol = 0;
                if (attRes.data) {
                    attRes.data.forEach((r: any) => {
                        tPaid += Number(r.total_paid_days || 0);
                        tPres += Number(r.present || 0);
                        tLeave += Number(r.leave || 0);
                        tHol += Number(r.holiday || 0);
                    });
                }

                // Salary Stats (Filtered by Salary Card Selectors)
                let tCost = 0, tDed = 0, tNet = 0, tProcessed = 0;
                let tPF = 0, tESIC = 0, tAdvance = 0;
                let tEmployerPF = 0, tEmployerESIC = 0;
                if (salaryRes.data) {
                    salaryRes.data.forEach((r: any) => {
                        if (r.status === 'Locked') {
                            tProcessed++;
                            const sd = r.salary_data;
                            if (sd) {
                                tCost += Number(sd.grossWithArrears || 0);
                                tDed += Number(sd.totalDeduction || 0);
                                tNet += Number(sd.netInHand || 0);
                                tPF += Number(sd.epf || 0);
                                tESIC += Number(sd.esic || 0);
                                tAdvance += Number(sd.advance || 0);
                                
                                // Calculate employer contributions from employerAdditionalBreakdown array
                                if (sd.employerAdditionalBreakdown && Array.isArray(sd.employerAdditionalBreakdown)) {
                                    sd.employerAdditionalBreakdown.forEach((item: any) => {
                                        if (item.name === 'EPF') {
                                            tEmployerPF += Number(item.earned || item.amount || 0);
                                        } else if (item.name === 'ESIC') {
                                            tEmployerESIC += Number(item.earned || item.amount || 0);
                                        }
                                    });
                                }
                            }
                        }
                    });
                }
                
                setDeductionsBreakdown({ totalPF: tPF, totalESIC: tESIC, totalAdvance: tAdvance });
                setEmployerBreakdown({ totalEmployerPF: tEmployerPF, totalEmployerESIC: tEmployerESIC });

                setStats({
                    onRollCount: onRoll,
                    contractualCount: contractual,
                    totalActive: total,
                    departmentCount: Object.keys(deptMap).length,
                    departments: deptMap,
                    genderDistribution: genderDist,
                    recentJoiners: emps.slice(0, 5),
                    totalPaidDays: tPaid,
                    totalPresent: tPres,
                    totalLeaves: tLeave,
                    totalHolidays: tHol,
                    totalPayrollCost: tCost,
                    totalDeductions: tDed,
                    totalNetPay: tNet,
                    processedEmployees: tProcessed
                });

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [currentMonth, currentYear, salaryCardMonth, salaryCardYear]);

    const handlePrint = () => {
        const dashboardContent = document.querySelector('.dashboard-content')?.innerHTML;
        const newWindow = window.open('', '_blank');
        if (newWindow && dashboardContent) {
            newWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>HR Analytics Dashboard</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @media print {
                            @page { size: A4 landscape; margin: 15mm 10mm; }
                            body { margin: 0; padding: 0; }
                            .no-print { display: none !important; }
                        }
                    </style>
                </head>
                <body class="bg-white p-4">
                    ${dashboardContent}
                    <div class="mt-6 text-center no-print">
                        <button onclick="window.print()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 mr-4">Print</button>
                        <button onclick="window.close()" class="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700">Close</button>
                    </div>
                </body>
                </html>
            `);
            newWindow.document.close();
        }
    };

    const handleDownloadSummary = () => {
        const summaryData = [
            { Metric: 'Total Active Employees', Value: stats.totalActive },
            { Metric: 'On Roll', Value: stats.onRollCount },
            { Metric: 'Contractual', Value: stats.contractualCount },
            { Metric: 'Month/Year', Value: `${currentMonth} ${currentYear}` },
            { Metric: 'Total Paid Days', Value: stats.totalPaidDays },
            { Metric: 'Total Payroll Cost', Value: stats.totalPayrollCost },
            { Metric: 'Processed Salaries', Value: stats.processedEmployees },
        ];
        const ws = XLSX.utils.json_to_sheet(summaryData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dashboard Summary");
        XLSX.writeFile(wb, "HR_Analytics_Summary.xlsx");
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    // Navigate specifically to Salary Dashboard with params if possible (for now just page)
    const handleGoToSalaryDashboard = () => {
        // Store selected month in local storage to persist context if needed, or just navigate
        localStorage.setItem('payroll_month', salaryCardMonth);
        localStorage.setItem('payroll_year', String(salaryCardYear));
        setActivePage('Salary Dashboard'); 
    };

    return (
        <div className="dashboard-content">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 no-print">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">HR Analytics & Overview</h1>
                    <p className="text-slate-500 mt-1">Real-time insights for {currentMonth} {currentYear}</p>
                </div>
                <div className="flex items-center space-x-3 mt-4 md:mt-0">
                    <button onClick={handlePrint} className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm text-sm font-medium transition-colors">
                        <PrinterIcon className="w-4 h-4" />
                        <span>Print</span>
                    </button>
                    <button onClick={handleDownloadSummary} className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark shadow-sm text-sm font-medium transition-colors">
                        <DownloadIcon className="w-4 h-4" />
                        <span>Download Summary</span>
                    </button>
                </div>
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard 
                    title="Total Workforce" 
                    count={stats.totalActive} 
                    subText="On-Roll + Contractual" 
                    colorClass="text-blue-600" 
                    icon={<UserCircleIcon className="w-6 h-6" />} 
                    isLoading={isLoading} 
                />
                <StatCard 
                    title="On Roll" 
                    count={stats.onRollCount} 
                    subText="Permanent Staff" 
                    colorClass="text-indigo-600" 
                    icon={<CheckCircleIcon className="w-6 h-6" />} 
                    isLoading={isLoading} 
                />
                <StatCard 
                    title="Contractual" 
                    count={stats.contractualCount} 
                    subText="Temporary Staff" 
                    colorClass="text-amber-600" 
                    icon={<UserCircleIcon className="w-6 h-6" />} 
                    isLoading={isLoading} 
                />
                <StatCard 
                    title="Active Departments" 
                    count={stats.departmentCount} 
                    subText="Operational Units" 
                    colorClass="text-emerald-600" 
                    icon={<MasterMgmtIcon className="w-6 h-6" />} 
                    isLoading={isLoading} 
                />
            </div>

            {/* Main Dashboard Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                
                {/* Attendance Dashboard Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-50 rounded-lg">
                                <AttendanceIcon className="w-6 h-6 text-orange-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Attendance Dashboard</h3>
                                <p className="text-xs text-slate-500">{currentMonth} {currentYear} Summary</p>
                            </div>
                        </div>
                        <button onClick={() => setActivePage('Attendance Management')} className="text-xs text-orange-600 font-semibold hover:underline flex items-center no-print">
                            View Details <ChevronRightIcon className="w-3 h-3 ml-1" />
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="h-48 flex items-center justify-center"><LoaderIcon className="w-8 h-8 text-slate-300 animate-spin" /></div>
                    ) : stats.totalPaidDays > 0 ? (
                        <div className="flex-1">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100 text-center">
                                    <p className="text-xs text-slate-500 uppercase font-semibold">Total Present</p>
                                    <p className="text-xl font-bold text-orange-700">{stats.totalPresent}</p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                                    <p className="text-xs text-slate-500 uppercase font-semibold">Total Leaves</p>
                                    <p className="text-xl font-bold text-slate-700">{stats.totalLeaves}</p>
                                </div>
                            </div>
                            
                            <h4 className="text-sm font-semibold text-slate-700 mb-3">Monthly Utilization</h4>
                            <ProgressBar label="Presence Rate" value={stats.totalPresent} total={stats.totalPaidDays} color="bg-green-500" />
                            <ProgressBar label="Leave Utilization" value={stats.totalLeaves} total={stats.totalPaidDays} color="bg-red-400" />
                            <ProgressBar label="Paid Holidays" value={stats.totalHolidays} total={stats.totalPaidDays} color="bg-blue-400" />
                        </div>
                    ) : (
                        <div className="text-center py-10 text-slate-400 flex-1 flex flex-col items-center justify-center">
                            <XCircleIcon className="w-8 h-8 mb-2 opacity-50" />
                            <p>No attendance data found for {currentMonth}.</p>
                        </div>
                    )}
                </div>

                {/* Salary Dashboard Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col relative overflow-visible">
                    
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <MoneyIcon className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Salary Dashboard</h3>
                                <p className="text-xs text-slate-500">Payroll Overview</p>
                            </div>
                        </div>
                        
                        {/* Inline Filters for Salary Card */}
                        <div className="flex space-x-1">
                            <select 
                                value={salaryCardMonth} 
                                onChange={(e) => setSalaryCardMonth(e.target.value)}
                                className="text-xs border border-slate-200 rounded py-1 px-1 focus:outline-none focus:ring-1 focus:ring-green-500 bg-slate-50"
                            >
                                {MONTHS.map(m => <option key={m} value={m}>{m.slice(0,3)}</option>)}
                            </select>
                            <select 
                                value={salaryCardYear} 
                                onChange={(e) => setSalaryCardYear(Number(e.target.value))}
                                className="text-xs border border-slate-200 rounded py-1 px-1 focus:outline-none focus:ring-1 focus:ring-green-500 bg-slate-50"
                            >
                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="h-48 flex items-center justify-center"><LoaderIcon className="w-8 h-8 text-slate-300 animate-spin" /></div>
                    ) : (
                        <div className="flex-1 relative z-10">
                            <div className="mb-6">
                                <p className="text-sm text-slate-500 font-medium mb-1">Total Payroll Cost (Gross)</p>
                                <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">{formatCurrency(stats.totalPayrollCost)}</h2>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-sm border-b border-slate-50 pb-2">
                                    <span className="text-slate-600">Total Net Payable</span>
                                    <span className="font-bold text-green-600">{formatCurrency(stats.totalNetPay)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                    <span className="text-slate-600">Total Deductions</span>
                                    <div className="flex items-center space-x-2">
                                        <span className="font-bold text-red-500">{formatCurrency(stats.totalDeductions)}</span>
                                        <button 
                                            onClick={() => setShowDeductionsModal(!showDeductionsModal)}
                                            className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                                        >
                                            {showDeductionsModal ? '−' : '+'}
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Expandable Deductions Breakdown */}
                                {showDeductionsModal && (
                                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-xs text-slate-500 mb-3">Breakdown for {salaryCardMonth} {salaryCardYear}</p>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-600">Employee PF</span>
                                                <span className="font-semibold text-blue-600">{formatCurrency(deductionsBreakdown.totalPF)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-600">Employee ESIC</span>
                                                <span className="font-semibold text-green-600">{formatCurrency(deductionsBreakdown.totalESIC)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-600">Advance</span>
                                                <span className="font-semibold text-orange-600">{formatCurrency(deductionsBreakdown.totalAdvance)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                    <span className="text-slate-600">Total Employer Additionals</span>
                                    <div className="flex items-center space-x-2">
                                        <span className="font-bold text-purple-600">{formatCurrency(employerBreakdown.totalEmployerPF + employerBreakdown.totalEmployerESIC)}</span>
                                        <button 
                                            onClick={() => setShowEmployerModal(!showEmployerModal)}
                                            className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-purple-600 transition-colors"
                                        >
                                            {showEmployerModal ? '−' : '+'}
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Expandable Employer Additionals Breakdown */}
                                {showEmployerModal && (
                                    <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                        <p className="text-xs text-slate-500 mb-3">Employer Contributions for {salaryCardMonth} {salaryCardYear}</p>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-600">Employer's EPF</span>
                                                <span className="font-semibold text-blue-600">{formatCurrency(employerBreakdown.totalEmployerPF)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-600">Employer's ESIC</span>
                                                <span className="font-semibold text-green-600">{formatCurrency(employerBreakdown.totalEmployerESIC)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex justify-between text-sm pt-1">
                                    <span className="text-slate-600">Employees Processed</span>
                                    <span className="font-bold text-blue-600">{stats.processedEmployees} / {stats.totalActive}</span>
                                </div>
                            </div>

                            <button 
                                onClick={handleGoToSalaryDashboard} 
                                className="w-full py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-all shadow-md flex items-center justify-center no-print group"
                            >
                                Go to Salary Dashboard
                                <ChevronRightIcon className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Department Overview */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Department Overview</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 rounded-l-lg">Department</th>
                                    <th className="px-6 py-3 text-center">Headcount</th>
                                    <th className="px-6 py-3 text-center">Active</th>
                                    <th className="px-6 py-3 rounded-r-lg text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {/* Fix: Explicitly type the arguments of map to resolve unknown property access errors */}
                                {Object.entries(stats.departments).map(([dept, counts]: [string, any]) => (
                                    <tr key={dept} className="hover:bg-slate-50">
                                        <td className="px-6 py-3 font-medium text-slate-900">{dept}</td>
                                        <td className="px-6 py-3 text-center">{counts.total}</td>
                                        <td className="px-6 py-3 text-center text-green-600 font-semibold">{counts.active}</td>
                                        <td className="px-6 py-3 text-center">
                                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Operational</span>
                                        </td>
                                    </tr>
                                ))}
                                {Object.keys(stats.departments).length === 0 && (
                                    <tr><td colSpan={4} className="text-center py-4 text-slate-400">No department data.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Joiners */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-1">New Joiners</h3>
                    <p className="text-xs text-slate-500 mb-4">Latest team additions</p>
                    
                    <div className="space-y-4">
                        {stats.recentJoiners.map(emp => (
                            <div key={emp.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                {emp.photoUrl ? (
                                    <img src={emp.photoUrl} alt={emp.firstName} className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                        {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{emp.firstName} {emp.lastName}</p>
                                    <p className="text-xs text-slate-500">{emp.designation}</p>
                                </div>
                                <div className="ml-auto text-xs text-slate-400">
                                    {new Date(emp.dateOfJoining).toLocaleDateString(undefined, {month: 'short', day:'numeric'})}
                                </div>
                            </div>
                        ))}
                        {stats.recentJoiners.length === 0 && (
                            <p className="text-center text-slate-400 text-sm py-4">No recent joiners.</p>
                        )}
                    </div>
                </div>
            </div>
            

        </div>
    );
};

export default Dashboard;
