
import React, { useState, useEffect, useCallback } from 'react';
import { 
    CheckCircleIcon, ChevronRightIcon, SearchIcon, FilterIcon, 
    LoaderIcon, ClockIcon, ImportIcon, XCircleIcon, AttendanceIcon, ComplianceIcon, DocumentCheckIcon
} from '../components/icons';
import { supabase } from '../supabaseClient';
import type { Employee, Shift, AttendanceRules } from '../types';
import type { Page } from '../App';

import { MONTHS, YEARS, STATUS_COLORS } from './attendance/AttendanceShared';
import DailyRegister from './attendance/DailyRegister';
import MonthlySummary from './attendance/MonthlySummary';
import MonthlyDetailed from './attendance/MonthlyDetailed';
import MonthlyStatus from './attendance/MonthlyStatus';
import RawLogs from './attendance/RawLogs';

declare const XLSX: any;

interface AttendanceManagementProps {
    setActivePage: (page: Page) => void;
}

const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ setActivePage }) => {
    const [activeView, setActiveView] = useState<'Dashboard' | 'DailyRegister' | 'MonthlySummary' | 'MonthlyDetailed' | 'MonthlyStatus' | 'Logs'>('Dashboard');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[new Date().getMonth()]);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [rules, setRules] = useState<AttendanceRules>({
        in_grace_period: 13, out_grace_period: 5, late_threshold: 13,
        in_short_leave_threshold: 30, out_short_leave_threshold: 120,
        in_half_day_threshold: 120, out_half_day_threshold: 240, compounding_rules: []
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [deptFilter, setDeptFilter] = useState('');
    const [shiftFilter, setShiftFilter] = useState('');
    const [locFilter, setLocFilter] = useState('');
    const [userTypeFilter, setUserTypeFilter] = useState('');
    
    const [masterDepts, setMasterDepts] = useState<string[]>([]);
    const [masterLocs, setMasterLocs] = useState<string[]>([]);

    const fetchBaseData = useCallback(async () => {
        setIsLoading(true);
        const [empRes, shiftRes, rulesRes, deptRes, locRes] = await Promise.all([
            supabase.from('employees').select('*').order('employeeCode'),
            supabase.from('shifts').select('*'),
            supabase.schema('payroll').from('attendance_rules').select('*').eq('id', 1).maybeSingle(),
            supabase.from('departments').select('name'),
            supabase.from('locations').select('name')
        ]);
        
        if (empRes.data) setEmployees(empRes.data);
        if (shiftRes.data) setShifts(shiftRes.data);
        if (rulesRes.data) {
            setRules({
                in_grace_period: Number(rulesRes.data.in_grace_period ?? 13),
                out_grace_period: Number(rulesRes.data.out_grace_period ?? 5),
                late_threshold: Number(rulesRes.data.late_threshold ?? 13),
                in_short_leave_threshold: Number(rulesRes.data.in_short_leave_threshold ?? 30),
                out_short_leave_threshold: Number(rulesRes.data.out_short_leave_threshold ?? 120),
                in_half_day_threshold: Number(rulesRes.data.in_half_day_threshold ?? 120),
                out_half_day_threshold: Number(rulesRes.data.out_half_day_threshold ?? 240),
                compounding_rules: rulesRes.data.compounding_rules ?? []
            });
        }
        setMasterDepts(deptRes.data?.map(d => d.name) || []);
        setMasterLocs(locRes.data?.map(l => l.name) || []);
        setIsLoading(false);
    }, []);

    useEffect(() => { fetchBaseData(); }, [fetchBaseData]);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws);
                const logs = data.map((row: any) => ({
                    employee_code: String(row['Employee Code'] || row['Code'] || '').trim(),
                    punch_time: new Date(`${row['Date'] || selectedDate} ${row['Time']}`).toISOString(),
                    punch_type: (row['Type'] || 'IN').toUpperCase(),
                    location_name: 'Manual Import',
                    is_verified: true
                })).filter(l => l.employee_code && !isNaN(new Date(l.punch_time).getTime()));
                
                if (logs.length > 0) {
                    const { error } = await supabase.from('attendance_logs').insert(logs);
                    if (error) throw error;
                    alert(`Imported ${logs.length} records.`);
                    window.location.reload();
                }
            } catch (err: any) { alert("Import failed: " + err.message); }
        };
        reader.readAsBinaryString(file);
    };

    const handleExport = () => {
        const table = document.querySelector('table');
        if (!table) return;
        const wb = XLSX.utils.table_to_book(table);
        XLSX.writeFile(wb, `${activeView}_Export.xlsx`);
    };

    if (activeView === 'Dashboard') {
        return (
            <div className="max-w-7xl mx-auto animate-fadeIn">
                <div className="flex items-center text-sm text-slate-500 mb-8">
                    <span>Home</span><ChevronRightIcon className="w-4 h-4 mx-2 text-slate-300" />
                    <span className="font-semibold text-slate-800 tracking-tight text-xs uppercase">Attendance Management</span>
                </div>
                <div className="mb-10">
                    <h1 className="text-5xl font-black text-slate-800 tracking-tighter uppercase leading-none">Attendance Operations</h1>
                    <p className="text-slate-500 mt-3 text-lg font-medium">Workforce tracking, grid analytics and automated logic management.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                    <AttendanceCard title="Daily Register" icon={<CheckCircleIcon className="w-8 h-8" />} onClick={() => setActiveView('DailyRegister')} />
                    <AttendanceCard title="Monthly Summary" icon={<AttendanceIcon className="w-8 h-8" />} onClick={() => setActiveView('MonthlySummary')} />
                    <AttendanceCard title="Detailed Register" icon={<DocumentCheckIcon className="w-8 h-8" />} onClick={() => setActiveView('MonthlyDetailed')} />
                    <AttendanceCard title="Status Audit" icon={<DocumentCheckIcon className="w-8 h-8" />} onClick={() => setActiveView('MonthlyStatus')} />
                    <AttendanceCard title="Entry Logs" icon={<ClockIcon className="w-8 h-8" />} onClick={() => setActiveView('Logs')} />
                    <AttendanceCard title="Logic Engine" icon={<ComplianceIcon className="w-8 h-8" />} onClick={() => setActivePage('Attendance Conditions')} />
                </div>
            </div>
        );
    }

    const filteredEmployees = employees.filter(e => {
        const matchesSearch = searchTerm === '' || `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = !deptFilter || e.department === deptFilter;
        const matchesShift = !shiftFilter || e.shiftId === Number(shiftFilter);
        const matchesLoc = !locFilter || e.location === locFilter;
        const matchesType = !userTypeFilter || e.userType === userTypeFilter;
        return matchesSearch && matchesDept && matchesShift && matchesLoc && matchesType;
    });

    return (
        <div className="animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-[24px] shadow-sm border border-slate-200 no-print">
                <div className="flex items-center space-x-6">
                    <button onClick={() => setActiveView('Dashboard')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-all border border-slate-200 group">
                        <ChevronRightIcon className="w-6 h-6 rotate-180 group-hover:text-primary transition-colors" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none">
                            {activeView === 'DailyRegister' ? 'DAILY REGISTER' : 
                             activeView === 'MonthlySummary' ? 'MONTHLY SUMMARY' :
                             activeView === 'MonthlyStatus' ? 'STATUS AUDIT' :
                             activeView === 'MonthlyDetailed' ? 'DETAILED TIMINGS' : 'RAW LOGS'}
                        </h1>
                        <p className="text-xs text-slate-400 font-black uppercase tracking-[0.2em] mt-1">
                            {activeView === 'DailyRegister' ? selectedDate : `${selectedMonth} ${selectedYear}`}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {activeView === 'DailyRegister' ? (
                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm font-black text-slate-700 outline-none" />
                    ) : (
                        <div className="flex items-center space-x-2 bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 shadow-inner">
                             <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent border-none text-xs font-black uppercase focus:ring-0 text-slate-700 cursor-pointer">
                                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <div className="w-px h-4 bg-slate-300"></div>
                            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-xs font-black focus:ring-0 text-slate-700 cursor-pointer">
                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    )}
                    
                    <div className="relative">
                        <SearchIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="SEARCH..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-black outline-none w-48 uppercase" />
                    </div>
                    
                    <button onClick={() => setShowFilters(!showFilters)} className={`p-3 rounded-xl border-2 transition-all ${showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}><FilterIcon className="w-5 h-5" /></button>

                    {activeView === 'DailyRegister' && (
                        <label className="flex items-center gap-2 bg-[#6366f1] text-white px-7 py-3 rounded-xl text-xs font-black hover:bg-indigo-700 transition-all cursor-pointer shadow-lg shadow-indigo-100 uppercase tracking-widest">
                            <ImportIcon className="w-4 h-4" /> <span>IMPORT</span>
                            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                        </label>
                    )}
                    <button onClick={handleExport} className="flex items-center gap-2 bg-black text-white px-7 py-3 rounded-xl text-xs font-black hover:bg-slate-800 transition-all shadow-lg uppercase tracking-widest">
                        EXPORT
                    </button>
                </div>
            </div>

            {showFilters && (
                <div className="mb-8 p-8 bg-white rounded-[32px] border-4 border-slate-50 shadow-2xl animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <FilterSelect label="Department" value={deptFilter} options={masterDepts} onChange={setDeptFilter} />
                        <FilterSelect label="Work Location" value={locFilter} options={masterLocs} onChange={setLocFilter} />
                        <FilterSelect label="Shift" value={shiftFilter} options={shifts.map(s => String(s.id))} displayOptions={shifts.map(s => s.name)} onChange={setShiftFilter} />
                        <FilterSelect label="User Type" value={userTypeFilter} options={['On-Roll', 'Contractual']} onChange={setUserTypeFilter} />
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden mb-12">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-48">
                        <LoaderIcon className="w-16 h-16 text-primary animate-spin" />
                        <p className="mt-4 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Processing Data Nodes...</p>
                    </div>
                ) : (
                    <>
                        {activeView === 'DailyRegister' && <DailyRegister selectedDate={selectedDate} employees={filteredEmployees} shifts={shifts} rules={rules} />}
                        {activeView === 'MonthlySummary' && <MonthlySummary selectedMonth={selectedMonth} selectedYear={selectedYear} employees={filteredEmployees} shifts={shifts} rules={rules} />}
                        {activeView === 'MonthlyDetailed' && <MonthlyDetailed selectedMonth={selectedMonth} selectedYear={selectedYear} employees={filteredEmployees} />}
                        {activeView === 'MonthlyStatus' && <MonthlyStatus selectedMonth={selectedMonth} selectedYear={selectedYear} employees={filteredEmployees} shifts={shifts} rules={rules} />}
                        {activeView === 'Logs' && <RawLogs />}
                    </>
                )}
            </div>

            {(activeView !== 'Logs') && (
                <div className="bg-white p-10 rounded-[32px] border border-slate-200 shadow-sm no-print">
                    <div className="w-full mb-8 flex items-center gap-6">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">CODE REFERENCE</h3>
                        <div className="flex-1 h-0.5 bg-slate-50"></div>
                    </div>
                    <div className="flex flex-wrap gap-x-12 gap-y-8">
                        {Object.entries(STATUS_COLORS).filter(([k]) => k !== '#N/A' && k !== 'W/O').map(([key, cls]) => (
                            <div key={key} className="flex items-center gap-4 group cursor-default">
                                <div className={`w-14 h-10 flex items-center justify-center rounded-xl text-[11px] font-black shadow-lg transition-transform group-hover:scale-110 ${cls}`}>{key}</div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    {key === 'P' ? 'Present' : key === 'A' ? 'Absent' : key === 'LT' ? 'Late Arrival' : key === 'LTS' ? 'Late to Shift' : key === 'SL' ? 'Short Leave' : key === 'HD' ? 'Half Day' : key === 'ED' ? 'Early Departure' : key}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const AttendanceCard: React.FC<{ title: string; icon: React.ReactNode; onClick: () => void }> = ({ title, icon, onClick }) => (
    <div onClick={onClick} className="bg-white p-10 rounded-[32px] shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center transition-all duration-300 group cursor-pointer hover:shadow-2xl hover:border-primary/20 hover:-translate-y-2 active:scale-95">
        <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center mb-6 transition-all group-hover:bg-primary group-hover:rotate-6">
             <div className="text-primary group-hover:text-white transition-colors">
                {icon}
             </div>
        </div>
        <h3 className="font-black text-slate-700 text-xs group-hover:text-primary transition-colors tracking-widest uppercase leading-tight">{title}</h3>
    </div>
);

const FilterSelect: React.FC<{ label: string; value: string; options: string[]; displayOptions?: string[]; onChange: (v: string) => void }> = ({ label, value, options, displayOptions, onChange }) => (
    <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase cursor-pointer">
            <option value="">ALL {label}S</option>
            {options.map((opt, i) => <option key={opt} value={opt}>{(displayOptions ? displayOptions[i] : opt).toUpperCase()}</option>)}
        </select>
    </div>
);

export default AttendanceManagement;
