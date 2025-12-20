
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    CheckCircleIcon, ChevronRightIcon, SearchIcon, FilterIcon, 
    PrinterIcon, DownloadIcon, LoaderIcon, ClockIcon, UserCircleIcon,
    ImportIcon, XCircleIcon, MapPinIcon, RefreshIcon, AttendanceIcon, ComplianceIcon, DocumentCheckIcon
} from '../components/icons';
import { supabase } from '../supabaseClient';
import type { Employee, Shift, Department, Location } from '../types';
import type { Page } from '../App';

declare const XLSX: any;

interface AttendanceManagementProps {
    setActivePage: (page: Page) => void;
}

interface RawPunchLog {
    id: number;
    employee_code: string;
    punch_time: string;
    punch_type: 'IN' | 'OUT';
    latitude: number | null;
    longitude: number | null;
    location_name: string;
    is_verified: boolean;
    distance: number | null;
}

interface AttendanceRules {
    in_grace_period: number;
    out_grace_period: number;
    late_threshold: number;
    in_short_leave_threshold: number;
    out_short_leave_threshold: number;
    in_half_day_threshold: number;
    out_half_day_threshold: number;
    compounding_rules: { in_status: string; out_status: string; result_status: string }[];
}

interface WeeklyOffSetting {
    employee_code: string;
    days: string[];
}

const STATUS_COLORS: Record<string, string> = {
    'P': 'bg-[#92D050] text-black',      // Present - Bright Green
    'A': 'bg-[#FF0000] text-white',      // Absent - Red
    'LTS': 'bg-[#C6EFCE] text-[#006100]', // Late To Shift - Light Green
    'LT': 'bg-[#FFEB9C] text-[#9C6500]',  // Late - Yellow
    'SL': 'bg-[#FFCC00] text-black',      // Short Leave - Amber
    'HD': 'bg-[#F4B084] text-black',      // Half Day - Orange/Salmon
    'ED': 'bg-[#DEEBF7] text-[#203764]',  // Early Departure - Blue
    'W/O': 'bg-slate-100 text-slate-400',
    '#N/A': 'bg-slate-100 text-slate-400',
    'PI': 'bg-amber-50 text-amber-700 border border-amber-200',
    'PO': 'bg-amber-50 text-amber-700 border border-amber-200'
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ setActivePage }) => {
    const [activeView, setActiveView] = useState<'Dashboard' | 'DailyRegister' | 'MonthlySummary' | 'MonthlyDetailed' | 'MonthlyStatus' | 'Logs'>('Dashboard');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[new Date().getMonth()]);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [processedLogs, setProcessedLogs] = useState<Record<string, { in: string | null; out: string | null }>>({});
    const [monthlyData, setMonthlyData] = useState<Record<string, Record<number, { in: string; out: string }>>>({});
    const [monthlyStatusData, setMonthlyStatusData] = useState<Record<string, Record<number, { inStatus: string; outStatus: string; finalStatus: string }>>>({});
    
    const [searchTerm, setSearchTerm] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [rawPunches, setRawPunches] = useState<RawPunchLog[]>([]);

    // Master Filter States
    const [showFilters, setShowFilters] = useState(false);
    const [deptFilter, setDeptFilter] = useState('');
    const [shiftFilter, setShiftFilter] = useState('');
    const [locFilter, setLocFilter] = useState('');
    const [userTypeFilter, setUserTypeFilter] = useState('');
    
    // Master Selection Lists
    const [masterDepts, setMasterDepts] = useState<string[]>([]);
    const [masterLocs, setMasterLocs] = useState<string[]>([]);

    const [rules, setRules] = useState<AttendanceRules>({
        in_grace_period: 13,
        out_grace_period: 5,
        late_threshold: 13,
        in_short_leave_threshold: 30,
        out_short_leave_threshold: 120,
        in_half_day_threshold: 120,
        out_half_day_threshold: 240,
        compounding_rules: []
    });

    const calculateStatus = (punchTime: string, shiftTime: string, type: 'IN' | 'OUT', currentRules: AttendanceRules) => {
        if (!punchTime || punchTime === 'A' || punchTime === '-') return 'A';
        
        const [ph, pm] = punchTime.split(':').map(Number);
        const [sh, sm] = shiftTime.split(':').map(Number);
        const pTotal = ph * 60 + pm;
        const sTotal = sh * 60 + sm;

        if (type === 'IN') {
            const diff = pTotal - sTotal; 
            if (diff >= currentRules.in_half_day_threshold) return 'HD';
            if (diff >= currentRules.in_short_leave_threshold) return 'SL';
            if (diff >= currentRules.late_threshold) return 'LT';
            if (diff > currentRules.in_grace_period) return 'LT'; 
            return 'P'; 
        } else {
            const earlyDiff = sTotal - pTotal; 
            
            if (earlyDiff >= currentRules.out_half_day_threshold) return 'HD';
            if (earlyDiff >= currentRules.out_short_leave_threshold) return 'SL';
            if (earlyDiff > currentRules.out_grace_period) return 'ED';
            
            return 'P';
        }
    };

    const applyCompounding = (inStatus: string, outStatus: string, currentRules: AttendanceRules) => {
        const rule = currentRules.compounding_rules.find(r => r.in_status === inStatus && r.out_status === outStatus);
        return rule ? rule.result_status : null;
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const monthIndex = MONTHS.indexOf(selectedMonth);
            const [empRes, shiftRes, rulesRes, weeklyOffRes, deptRes, locRes] = await Promise.all([
                supabase.from('employees').select('*').order('employeeCode'),
                supabase.from('shifts').select('*'),
                supabase.schema('payroll').from('attendance_rules').select('*').eq('id', 1).maybeSingle(),
                supabase.schema('payroll').from('weekly_off_settings').select('employee_code, days'),
                supabase.from('departments').select('name'),
                supabase.from('locations').select('name')
            ]);
            
            const dbRules: AttendanceRules = rulesRes.data ? {
                in_grace_period: Number(rulesRes.data.in_grace_period ?? 13),
                out_grace_period: Number(rulesRes.data.out_grace_period ?? 5),
                late_threshold: Number(rulesRes.data.late_threshold ?? 13),
                in_short_leave_threshold: Number(rulesRes.data.in_short_leave_threshold ?? 30),
                out_short_leave_threshold: Number(rulesRes.data.out_short_leave_threshold ?? 120),
                in_half_day_threshold: Number(rulesRes.data.in_half_day_threshold ?? 120),
                out_half_day_threshold: Number(rulesRes.data.out_half_day_threshold ?? 240),
                compounding_rules: rulesRes.data.compounding_rules ?? []
            } : rules;

            setRules(dbRules);
            
            const fetchedEmployees = (empRes.data as Employee[]) || [];
            const fetchedShifts = (shiftRes.data as Shift[]) || [];
            const fetchedWeeklyOffs = (weeklyOffRes.data as WeeklyOffSetting[]) || [];
            
            setMasterDepts(deptRes.data?.map(d => d.name) || []);
            setMasterLocs(locRes.data?.map(l => l.name) || []);

            const weeklyOffMap: Record<string, string[]> = {};
            fetchedWeeklyOffs.forEach(item => {
                weeklyOffMap[item.employee_code] = Array.isArray(item.days) ? item.days : [];
            });
            
            setEmployees(fetchedEmployees);
            setShifts(fetchedShifts);

            if (activeView === 'DailyRegister') {
                const startDate = `${selectedDate}T00:00:00Z`;
                const endDate = `${selectedDate}T23:59:59Z`;
                const { data: logs } = await supabase.from('attendance_logs').select('employee_code, punch_time, punch_type').gte('punch_time', startDate).lte('punch_time', endDate);
                
                const map: Record<string, { in: string | null; out: string | null }> = {};
                logs?.forEach(log => {
                    const code = log.employee_code;
                    const time = new Date(log.punch_time).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
                    if (!map[code]) map[code] = { in: null, out: null };
                    if (log.punch_type === 'IN') { if (!map[code].in || time < map[code].in) map[code].in = time; }
                    else if (log.punch_type === 'OUT') { if (!map[code].out || time > map[code].out!) map[code].out = time; }
                });
                setProcessedLogs(map);

            } else if (activeView === 'MonthlySummary' || activeView === 'MonthlyDetailed' || activeView === 'MonthlyStatus') {
                const startDate = new Date(selectedYear, monthIndex, 1).toISOString();
                const endDate = new Date(selectedYear, monthIndex + 1, 0, 23, 59, 59).toISOString();
                const { data: logs } = await supabase.from('attendance_logs').select('employee_code, punch_time, punch_type').gte('punch_time', startDate).lte('punch_time', endDate);

                const mData: Record<string, Record<number, { in: string; out: string }>> = {};
                const mStatusData: Record<string, Record<number, { inStatus: string; outStatus: string; finalStatus: string }>> = {};
                
                logs?.forEach(log => {
                    const code = log.employee_code;
                    const dateObj = new Date(log.punch_time);
                    const day = dateObj.getDate();
                    const time = dateObj.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
                    
                    if (!mData[code]) mData[code] = {};
                    if (!mData[code][day]) mData[code][day] = { in: '', out: '' };
                    
                    if (log.punch_type === 'IN') { 
                        if (!mData[code][day].in || time < mData[code][day].in) mData[code][day].in = time;
                    } else if (log.punch_type === 'OUT') { 
                        if (!mData[code][day].out || time > mData[code][day].out) mData[code][day].out = time;
                    }
                });

                fetchedEmployees.forEach(emp => {
                    const code = emp.employeeCode;
                    const shift = fetchedShifts.find(s => s.id === emp.shiftId);
                    const shiftIn = shift?.startTime || '10:00';
                    const shiftOut = shift?.endTime || '19:00';
                    const employeeWeeklyOffDays = weeklyOffMap[code] || [];

                    mStatusData[code] = {};
                    const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
                    for (let d = 1; d <= daysInMonth; d++) {
                        const currentDate = new Date(selectedYear, monthIndex, d);
                        const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
                        const isWeeklyOff = employeeWeeklyOffDays.includes(dayOfWeek);

                        const dayLog = mData[code]?.[d];
                        
                        let inS = dayLog?.in ? calculateStatus(dayLog.in, shiftIn, 'IN', dbRules) : 'A';
                        let outS = dayLog?.out ? calculateStatus(dayLog.out, shiftOut, 'OUT', dbRules) : 'A';
                        
                        if (inS === 'A' && outS === 'A' && isWeeklyOff) {
                            inS = 'W/O';
                            outS = 'W/O';
                        }

                        const compounded = applyCompounding(inS, outS, dbRules);
                        let finalS = compounded || (inS !== 'P' && inS !== 'W/O' ? inS : outS);

                        mStatusData[code][d] = { inStatus: inS, outStatus: outS, finalStatus: finalS };
                    }
                });

                setMonthlyData(mData);
                setMonthlyStatusData(mStatusData);

            } else if (activeView === 'Logs') {
                const { data } = await supabase.from('attendance_logs').select('*').order('punch_time', { ascending: false });
                setRawPunches(data || []);
            }
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [selectedDate, selectedMonth, selectedYear, activeView]);

    useEffect(() => {
        if (activeView !== 'Dashboard') fetchData();
    }, [activeView, fetchData]);

    const calculateDailyRow = (emp: Employee) => {
        const shift = shifts.find(s => s.id === emp.shiftId);
        const log = processedLogs[emp.employeeCode];
        const dayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short' });
        const shiftIn = shift?.startTime || '10:00';
        const shiftOut = shift?.endTime || '19:00';
        
        if (!log || (!log.in && !log.out)) {
            return { wo: dayOfWeek, shiftIn, shiftOut, IN: 'A', OUT: 'A', atin: 'A', atout: 'A', wh: '0', fl: 'A', gr: '0' };
        }

        const inTime = log.in || 'A';
        const outTime = log.out || 'A';
        const atin = calculateStatus(inTime, shiftIn, 'IN', rules);
        const atout = calculateStatus(outTime, shiftOut, 'OUT', rules);

        let wh = '0';
        if (inTime !== 'A' && outTime !== 'A') {
            const [ih, im] = inTime.split(':').map(Number);
            const [oh, om] = outTime.split(':').map(Number);
            const diffMin = (oh * 60 + om) - (ih * 60 + im);
            if (diffMin > 0) wh = (diffMin / 60).toFixed(1);
        }
        return { wo: dayOfWeek, shiftIn, shiftOut, IN: inTime, OUT: outTime, atin, atout, wh, fl: atin, gr: '0' };
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];

                if (activeView === 'MonthlyDetailed') {
                    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
                    if (rawData.length < 3) throw new Error("Invalid format.");
                    
                    const logs: any[] = [];
                    const monthIndex = MONTHS.indexOf(selectedMonth);
                    
                    for (let i = 2; i < rawData.length; i++) {
                        const row = rawData[i];
                        const code = String(row[0] || '').trim();
                        if (!code) continue;

                        for (let col = 2; col < row.length; col++) {
                            const timeStr = String(row[col] || '').trim();
                            if (!timeStr || timeStr.toLowerCase() === 'a' || timeStr === '-') continue;

                            const dayOffset = Math.floor((col - 2) / 2) + 1;
                            const isOut = (col - 2) % 2 !== 0;
                            const type = isOut ? 'OUT' : 'IN';
                            const [h, m] = timeStr.split(':');
                            if (!h) continue;

                            const punchTime = new Date(selectedYear, monthIndex, dayOffset, Number(h), Number(m)).toISOString();
                            logs.push({
                                employee_code: code,
                                punch_time: punchTime,
                                punch_type: type,
                                location_name: 'Grid Import',
                                is_verified: true
                            });
                        }
                    }

                    if (logs.length > 0) {
                        const { error } = await supabase.from('attendance_logs').insert(logs);
                        if (error) throw error;
                        fetchData();
                        alert(`Imported ${logs.length} punch records.`);
                    }
                } else {
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
                        fetchData();
                        alert(`Imported ${logs.length} records.`);
                    }
                }
            } catch (err: any) { 
                console.error(err);
                alert("Import failed: " + (err.message || "Unknown error")); 
            }
            finally { setIsImporting(false); e.target.value = ''; }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadTemplate = () => {
        if (activeView === 'MonthlyDetailed' || activeView === 'MonthlyStatus') {
            const header1 = ['EMP CODE', 'NAME'];
            const header2 = ['', ''];
            for (let d = 1; d <= 31; d++) {
                header1.push(String(d), '');
                header2.push('IN', 'OUT');
            }
            const ws = XLSX.utils.aoa_to_sheet([header1, header2]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "AttendanceTemplate");
            XLSX.writeFile(wb, "Attendance_Grid_Template.xlsx");
        } else {
            const headers = [['Employee Code', 'Date', 'Time', 'Type']];
            const ws = XLSX.utils.aoa_to_sheet(headers);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "AttendanceTemplate");
            XLSX.writeFile(wb, "Attendance_List_Template.xlsx");
        }
    };

    const handleExport = () => {
        const tableId = activeView === 'DailyRegister' ? 'attendance-table' : (activeView === 'Logs' ? 'entry-logs-table' : 'monthly-table');
        const table = document.getElementById(tableId);
        const wb = XLSX.utils.table_to_book(table);
        XLSX.writeFile(wb, `${activeView}_Export.xlsx`);
    };

    if (activeView === 'Dashboard') {
        return (
            <div className="max-w-7xl mx-auto animate-fadeIn">
                <div className="flex items-center text-sm text-slate-500 mb-8">
                    <span>Home</span><ChevronRightIcon className="w-4 h-4 mx-2 text-slate-300" />
                    <span className="font-semibold text-slate-800 tracking-tight">Attendance Management</span>
                </div>
                <div className="mb-10">
                    <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">Attendance Management</h1>
                    <p className="text-slate-500 mt-2 text-lg">Central workforce tracking and analytics hub.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                    <AttendanceCard title="Daily Register" icon={<CheckCircleIcon className="w-8 h-8" />} onClick={() => setActiveView('DailyRegister')} />
                    <AttendanceCard title="Monthly Summary" icon={<AttendanceIcon className="w-8 h-8" />} onClick={() => setActiveView('MonthlySummary')} />
                    <AttendanceCard title="Monthly Attendance Detailed" icon={<DocumentCheckIcon className="w-8 h-8" />} onClick={() => setActiveView('MonthlyDetailed')} />
                    <AttendanceCard title="Monthly Attendance Status" icon={<DocumentCheckIcon className="w-8 h-8" />} onClick={() => setActiveView('MonthlyStatus')} />
                    <AttendanceCard title="Raw Entry Logs" icon={<ClockIcon className="w-8 h-8" />} onClick={() => setActiveView('Logs')} />
                    <AttendanceCard title="Functions & Conditions" icon={<ComplianceIcon className="w-8 h-8" />} onClick={() => setActivePage('Attendance Conditions')} />
                </div>
            </div>
        );
    }

    // Global Filtering Logic
    const filteredEmployees = employees.filter(e => {
        const matchesSearch = searchTerm === '' || `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = !deptFilter || e.department === deptFilter;
        const matchesShift = !shiftFilter || e.shiftId === Number(shiftFilter);
        const matchesLoc = !locFilter || e.location === locFilter;
        const matchesType = !userTypeFilter || e.userType === userTypeFilter;
        return matchesSearch && matchesDept && matchesShift && matchesLoc && matchesType;
    });
    
    const activeFilterCount = [deptFilter, shiftFilter, locFilter, userTypeFilter].filter(Boolean).length;
    const monthIndex = MONTHS.indexOf(selectedMonth);
    const numDays = new Date(selectedYear, monthIndex + 1, 0).getDate();
    const daysInMonthArray = Array.from({ length: numDays }, (_, i) => i + 1);
    const getWeekday = (d: number) => new Date(selectedYear, monthIndex, d).toLocaleDateString('en-US', { weekday: 'short' });

    return (
        <div className="animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 no-print">
                <div className="flex items-center space-x-6">
                    <button onClick={() => setActiveView('Dashboard')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-all border border-slate-200 group">
                        <ChevronRightIcon className="w-5 h-5 rotate-180 group-hover:text-primary transition-colors" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none">
                            {activeView === 'DailyRegister' ? 'DAILY ATTENDANCE REGISTER' : 
                             activeView === 'MonthlySummary' ? 'MONTHLY REGISTER SUMMARY' :
                             activeView === 'MonthlyStatus' ? 'MONTHLY ATTENDANCE STATUS' :
                             activeView === 'MonthlyDetailed' ? 'MONTHLY ATTENDANCE REGISTER (DETAILED)' : 'ENTRY RAW LOGS'}
                        </h1>
                        <p className="text-sm text-slate-500 mt-2 font-medium uppercase tracking-widest">
                            {activeView === 'DailyRegister' ? `Records for ${new Date(selectedDate).toDateString()}` : `Record for ${selectedMonth} ${selectedYear}`}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {activeView === 'DailyRegister' ? (
                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none" />
                    ) : (
                        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
                             <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 font-medium cursor-pointer">
                                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <div className="w-px h-4 bg-slate-300"></div>
                            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 font-medium cursor-pointer">
                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <SearchIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none w-48 lg:w-64" />
                        </div>
                        
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 relative ${showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                            <FilterIcon className="w-4 h-4" />
                            <span className="text-xs font-black uppercase hidden lg:inline">Filters</span>
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white">{activeFilterCount}</span>
                            )}
                        </button>
                    </div>

                    {['DailyRegister', 'MonthlyDetailed'].includes(activeView) && (
                        <>
                            <button onClick={handleDownloadTemplate} className="text-primary hover:underline text-xs font-bold px-2 uppercase">Template</button>
                            <label className="flex items-center gap-2 bg-[#6366f1] text-white px-7 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-700 transition-all cursor-pointer shadow-lg shadow-indigo-100 uppercase">
                                <ImportIcon className="w-4 h-4" /> <span>IMPORT</span>
                                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={isImporting} />
                            </label>
                        </>
                    )}
                    <button onClick={handleExport} className="flex items-center gap-2 bg-[#10b981] text-white px-7 py-2.5 rounded-xl text-sm font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 uppercase tracking-wider">
                        EXPORT
                    </button>
                </div>
            </div>

            {/* Expanded Master Filter Panel */}
            {showFilters && (
                <div className="mb-8 p-6 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100/50 animate-fadeIn overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-1 bg-primary h-full"></div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div className="flex items-center gap-3">
                            <FilterIcon className="w-5 h-5 text-primary" />
                            <h3 className="font-black text-slate-700 uppercase tracking-tight">Master Filter Suite</h3>
                        </div>
                        <button 
                            onClick={() => { setDeptFilter(''); setShiftFilter(''); setLocFilter(''); setUserTypeFilter(''); }}
                            className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest flex items-center gap-1.5"
                        >
                            <XCircleIcon className="w-3 h-3" /> Clear All Filters
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Department</label>
                            <select 
                                value={deptFilter} 
                                onChange={e => setDeptFilter(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                            >
                                <option value="">ALL DEPARTMENTS</option>
                                {masterDepts.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Shift</label>
                            <select 
                                value={shiftFilter} 
                                onChange={e => setShiftFilter(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                            >
                                <option value="">ALL SHIFTS</option>
                                {shifts.map(s => <option key={s.id} value={String(s.id)}>{s.name.toUpperCase()} ({s.startTime}-{s.endTime})</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Work Location</label>
                            <select 
                                value={locFilter} 
                                onChange={e => setLocFilter(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                            >
                                <option value="">ALL LOCATIONS</option>
                                {masterLocs.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Employee Type</label>
                            <select 
                                value={userTypeFilter} 
                                onChange={e => setUserTypeFilter(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                            >
                                <option value="">ALL TYPES</option>
                                <option value="On-Roll">ON-ROLL</option>
                                <option value="Contractual">CONTRACTUAL</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[20px] shadow-2xl border border-slate-200 overflow-hidden mb-10">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-40">
                        <LoaderIcon className="w-14 h-14 text-primary animate-spin" />
                        <p className="mt-4 text-slate-500 font-black uppercase tracking-widest text-xs">Crunching Attendance Data...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        {activeView === 'DailyRegister' && (
                            <table id="attendance-table" className="w-full text-[11px] border-collapse min-w-max">
                                <thead>
                                    <tr className="bg-black text-white uppercase text-left font-bold">
                                        <th className="px-4 py-4 border-r border-slate-800 sticky left-0 bg-black z-10 w-32 min-w-[128px]">EMPLOYEE CODE</th>
                                        <th className="px-4 py-4 border-r border-slate-800 min-w-[120px]">DEPARTMENT</th>
                                        <th className="px-4 py-4 border-r border-slate-800 min-w-[220px]">EMPLOYEE NAME</th>
                                        <th className="px-4 py-4 border-r border-slate-800 text-center w-20">W/O</th>
                                        <th className="px-4 py-4 border-r border-slate-800 text-center">SHIFT IN</th>
                                        <th className="px-4 py-4 border-r border-slate-800 text-center">SHIFT OUT</th>
                                        <th className="px-4 py-4 border-r border-slate-800 text-center bg-slate-900 w-24">IN</th>
                                        <th className="px-4 py-4 border-r border-slate-800 text-center bg-slate-900 w-24">OUT</th>
                                        <th className="px-4 py-4 border-r border-slate-800 text-center w-24">ATIN</th>
                                        <th className="px-4 py-4 border-r border-slate-800 text-center w-24">ATOUT</th>
                                        <th className="px-4 py-4 border-r border-slate-800 text-center w-20">WH 1</th>
                                        <th className="px-4 py-4 border-r border-slate-800 text-center w-24">FL1</th>
                                        <th className="px-4 py-4 text-center w-20">GR1</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredEmployees.map((emp) => {
                                        const calc = calculateDailyRow(emp);
                                        return (
                                            <tr key={emp.employeeCode} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-4 py-3.5 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10 font-black text-slate-800 w-32 min-w-[128px]">{emp.employeeCode}</td>
                                                <td className="px-4 py-3.5 border-r border-slate-200 text-slate-400 font-medium">{emp.department || '-'}</td>
                                                <td className="px-4 py-3.5 border-r border-slate-200 font-black text-slate-800 uppercase">{emp.firstName} {emp.lastName}</td>
                                                <td className="px-4 py-3.5 border-r border-slate-200 text-center text-slate-500 font-bold">{calc.wo}</td>
                                                <td className="px-4 py-3.5 border-r border-slate-200 text-center font-bold text-slate-700">{calc.shiftIn}</td>
                                                <td className="px-4 py-3.5 border-r border-slate-200 text-center font-bold text-slate-700">{calc.shiftOut}</td>
                                                <td className={`px-4 py-3.5 border-r border-slate-200 text-center font-black ${calc.IN === 'A' ? 'text-red-600' : 'text-slate-900'}`}>{calc.IN}</td>
                                                <td className={`px-4 py-3.5 border-r border-slate-200 text-center font-black ${calc.OUT === 'A' ? 'text-red-600' : 'text-slate-900'}`}>{calc.OUT}</td>
                                                <td className="px-4 py-3.5 border-r border-slate-200 text-center"><span className={`inline-flex items-center justify-center w-full py-1 rounded font-black ${STATUS_COLORS[calc.atin] || ''}`}>{calc.atin}</span></td>
                                                <td className="px-4 py-3.5 border-r border-slate-200 text-center"><span className={`inline-flex items-center justify-center w-full py-1 rounded font-black ${STATUS_COLORS[calc.atout] || ''}`}>{calc.atout}</span></td>
                                                <td className="px-4 py-3.5 border-r border-slate-200 text-center font-black text-slate-900 bg-slate-50/30">{calc.wh}</td>
                                                <td className="px-4 py-3.5 border-r border-slate-200 text-center"><span className={`inline-flex items-center justify-center w-full py-1 rounded font-black ${STATUS_COLORS[calc.fl] || ''}`}>{calc.fl}</span></td>
                                                <td className="px-4 py-3.5 text-center bg-amber-50/10 font-black text-slate-800">{calc.gr}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}

                        {activeView === 'MonthlyStatus' && (
                            <table id="monthly-table" className="w-full text-[10px] border-collapse min-w-max">
                                <thead>
                                    <tr className="bg-black text-white uppercase text-left font-bold">
                                        <th rowSpan={3} className="px-3 py-4 border-r border-slate-800 sticky left-0 bg-black z-30 w-24 min-w-[96px] text-center">EMP CODE</th>
                                        <th rowSpan={3} className="px-4 py-4 border-r border-slate-800 sticky left-[96px] bg-black z-30 min-w-[200px] w-64">NAME</th>
                                        {daysInMonthArray.map(d => (
                                            <th key={d} colSpan={2} className="px-1 py-1 border-r border-slate-800 text-center border-b border-slate-800">{d}</th>
                                        ))}
                                    </tr>
                                    <tr className="bg-black text-white uppercase text-[8px] font-black">
                                        {daysInMonthArray.map(d => (
                                            <th key={d} colSpan={2} className="px-1 py-1 border-r border-slate-800 text-center border-b border-slate-800 text-slate-400">{getWeekday(d)}</th>
                                        ))}
                                    </tr>
                                    <tr className="bg-black text-white uppercase text-[7px] font-black">
                                        {daysInMonthArray.map(d => (
                                            <React.Fragment key={d}>
                                                <th className="px-1 py-1 border-r border-slate-800 text-center w-10">IN</th>
                                                <th className="px-1 py-1 border-r border-slate-800 text-center w-10">OUT</th>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredEmployees.map((emp) => {
                                        const statuses = monthlyStatusData[emp.employeeCode] || {};
                                        return (
                                            <tr key={emp.employeeCode} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-3 py-2 border-r border-slate-300 sticky left-0 bg-white group-hover:bg-slate-50 z-10 font-black text-center text-slate-800 w-24 min-w-[96px]">{emp.employeeCode}</td>
                                                <td className="px-4 py-2 border-r border-slate-300 sticky left-[96px] bg-white group-hover:bg-slate-50 z-10 font-black uppercase truncate text-slate-800 min-w-[200px] w-64">{emp.firstName} {emp.lastName}</td>
                                                {daysInMonthArray.map(d => {
                                                    const s = statuses[d] || { inStatus: 'A', outStatus: 'A' };
                                                    return (
                                                        <React.Fragment key={d}>
                                                            <td className="px-1 py-2 border-r border-slate-200 text-center font-bold w-10">
                                                                <span className={`inline-flex w-full items-center justify-center py-1 rounded-[4px] min-w-[28px] ${STATUS_COLORS[s.inStatus] || ''}`}>
                                                                    {s.inStatus}
                                                                </span>
                                                            </td>
                                                            <td className="px-1 py-2 border-r border-slate-200 text-center font-bold w-10">
                                                                <span className={`inline-flex w-full items-center justify-center py-1 rounded-[4px] min-w-[28px] ${STATUS_COLORS[s.outStatus] || ''}`}>
                                                                    {s.outStatus}
                                                                </span>
                                                            </td>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}

                        {activeView === 'MonthlySummary' && (
                            <table id="monthly-table" className="w-full text-[10px] border-collapse min-w-max">
                                <thead>
                                    <tr className="bg-black text-white uppercase text-left font-bold">
                                        <th rowSpan={2} className="px-4 py-4 border-r border-slate-800 sticky left-0 bg-black z-20 w-32 min-w-[128px]">EMP CODE</th>
                                        <th rowSpan={2} className="px-4 py-4 border-r border-slate-800 sticky left-[128px] bg-black z-20 min-w-[200px] w-64">NAME</th>
                                        {daysInMonthArray.map(d => (
                                            <th key={d} className="px-2 py-2 border-r border-slate-800 text-center w-12 border-b border-slate-800">
                                                <div className="text-[8px] text-slate-400 font-medium">{getWeekday(d)}</div>
                                                <div className="text-[11px]">{d}</div>
                                            </th>
                                        ))}
                                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[420px] z-30 border-l-2 border-slate-700 w-[60px] min-w-[60px] max-w-[60px]">WRK</th>
                                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[360px] z-30 w-[60px] min-w-[60px] max-w-[60px]">P</th>
                                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[300px] z-30 w-[60px] min-w-[60px] max-w-[60px]">LT</th>
                                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[240px] z-30 w-[60px] min-w-[60px] max-w-[60px]">SL</th>
                                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[180px] z-30 w-[60px] min-w-[60px] max-w-[60px]">HD</th>
                                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[120px] z-30 w-[60px] min-w-[60px] max-w-[60px] text-[8px] leading-tight">MISS<br/>(PI+PO)</th>
                                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-[60px] z-30 w-[60px] min-w-[60px] max-w-[60px]">W/O</th>
                                        <th rowSpan={2} className="px-2 py-4 bg-[#1e293b] text-center sticky right-0 z-30 w-[60px] min-w-[60px] max-w-[60px]">A</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredEmployees.map((emp) => {
                                        const statuses = monthlyStatusData[emp.employeeCode] || {};
                                        
                                        let cP = 0, cLT = 0, cSL = 0, cHD = 0, cMISS = 0, cWO = 0, cA = 0;

                                        daysInMonthArray.forEach(d => {
                                            const s = statuses[d]?.finalStatus || 'A';
                                            if (s === 'P') cP++;
                                            else if (s === 'LT') cLT++;
                                            else if (s === 'SL') cSL++;
                                            else if (s === 'HD') cHD++;
                                            else if (s === 'PI' || s === 'PO') cMISS++;
                                            else if (s === 'W/O') cWO++;
                                            else if (s === 'A') cA++;
                                        });

                                        const cWorking = cP + cLT + cSL + cHD;

                                        return (
                                            <tr key={emp.employeeCode} className="hover:bg-slate-50 group">
                                                <td className="px-4 py-2 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10 font-black w-32 min-w-[128px]">{emp.employeeCode}</td>
                                                <td className="px-4 py-2 border-r border-slate-200 sticky left-[128px] bg-white group-hover:bg-slate-50 z-10 font-black uppercase w-64 min-w-[200px]">{emp.firstName} {emp.lastName}</td>
                                                {daysInMonthArray.map(d => {
                                                    const status = statuses[d]?.finalStatus || 'A';
                                                    return (
                                                        <td key={d} className="px-1 py-2 border-r border-slate-100 text-center">
                                                            <span className={`inline-flex w-full items-center justify-center py-1 rounded-[4px] min-w-[24px] text-[9px] font-black ${STATUS_COLORS[status] || ''}`}>
                                                                {status}
                                                            </span>
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-2 py-2 text-center font-black bg-blue-50 sticky right-[420px] z-10 group-hover:bg-blue-100 border-l-2 border-slate-200 w-[60px] min-w-[60px] max-w-[60px]">{cWorking}</td>
                                                <td className="px-2 py-2 text-center font-black bg-white sticky right-[360px] z-10 group-hover:bg-slate-50 w-[60px] min-w-[60px] max-w-[60px]">{cP}</td>
                                                <td className="px-2 py-2 text-center font-black bg-white sticky right-[300px] z-10 group-hover:bg-slate-50 w-[60px] min-w-[60px] max-w-[60px]">{cLT}</td>
                                                <td className="px-2 py-2 text-center font-black bg-white sticky right-[240px] z-10 group-hover:bg-slate-50 w-[60px] min-w-[60px] max-w-[60px]">{cSL}</td>
                                                <td className="px-2 py-2 text-center font-black bg-white sticky right-[180px] z-10 group-hover:bg-slate-50 w-[60px] min-w-[60px] max-w-[60px]">{cHD}</td>
                                                <td className="px-2 py-2 text-center font-black bg-white sticky right-[120px] z-10 group-hover:bg-slate-50 w-[60px] min-w-[60px] max-w-[60px]">{cMISS}</td>
                                                <td className="px-2 py-2 text-center font-black bg-white sticky right-[60px] z-10 group-hover:bg-slate-50 w-[60px] min-w-[60px] max-w-[60px]">{cWO}</td>
                                                <td className="px-2 py-2 text-center font-black bg-red-50 text-red-600 sticky right-0 z-10 group-hover:bg-red-100 w-[60px] min-w-[60px] max-w-[60px]">{cA}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}

                        {activeView === 'MonthlyDetailed' && (
                            <table id="monthly-table" className="w-full text-[9px] border-collapse min-w-max">
                                <thead>
                                    <tr className="bg-black text-white uppercase text-left font-bold border-b border-slate-800">
                                        <th rowSpan={3} className="px-3 py-4 border-r border-slate-800 sticky left-0 bg-black z-20 w-24 min-w-[96px] text-center">EMP CODE</th>
                                        <th rowSpan={3} className="px-4 py-4 border-r border-slate-800 sticky left-[96px] bg-black z-20 min-w-[200px] w-64">NAME</th>
                                        {daysInMonthArray.map(d => (
                                            <th key={d} colSpan={2} className="px-2 py-1 border-r border-slate-800 text-center border-b border-slate-800">{d}</th>
                                        ))}
                                    </tr>
                                    <tr className="bg-black text-white uppercase text-[8px] font-black">
                                        {daysInMonthArray.map(d => (
                                            <th key={d} colSpan={2} className="px-2 py-1 border-r border-slate-800 text-center border-b border-slate-800 text-slate-400">{getWeekday(d)}</th>
                                        ))}
                                    </tr>
                                    <tr className="bg-black text-white uppercase text-[8px] font-black">
                                        {daysInMonthArray.map(d => (
                                            <React.Fragment key={d}>
                                                <th className="px-1 py-1 border-r border-slate-800 text-center w-8">IN</th>
                                                <th className="px-1 py-1 border-r border-slate-800 text-center w-8">OUT</th>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredEmployees.map((emp) => {
                                        const logs = monthlyData[emp.employeeCode] || {};
                                        return (
                                            <tr key={emp.employeeCode} className="hover:bg-slate-50 group">
                                                <td className="px-3 py-2 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10 font-black text-center w-24 min-w-[96px]">{emp.employeeCode}</td>
                                                <td className="px-4 py-2 border-r border-slate-200 sticky left-[96px] bg-white group-hover:bg-slate-50 z-10 font-black uppercase truncate w-64 min-w-[200px]">{emp.firstName} {emp.lastName}</td>
                                                {daysInMonthArray.map(d => (
                                                    <React.Fragment key={d}>
                                                        <td className={`px-0.5 py-2 border-r border-slate-100 text-center ${logs[d]?.in ? 'text-slate-900 font-bold' : 'text-red-300'}`}>{logs[d]?.in || 'A'}</td>
                                                        <td className={`px-0.5 py-2 border-r border-slate-100 text-center ${logs[d]?.out ? 'text-slate-900 font-bold' : 'text-red-300'}`}>{logs[d]?.out || 'A'}</td>
                                                    </React.Fragment>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                        
                        {activeView === 'Logs' && (
                             <table id="entry-logs-table" className="w-full text-[12px] border-collapse min-w-max">
                                <thead>
                                    <tr className="bg-black text-white uppercase text-left font-bold">
                                        <th className="px-6 py-4 border-r border-slate-700">ID</th>
                                        <th className="px-6 py-4 border-r border-slate-700">Code</th>
                                        <th className="px-6 py-4 border-r border-slate-700">Punch Time</th>
                                        <th className="px-6 py-4 border-r border-slate-700">Type</th>
                                        <th className="px-6 py-4 border-r border-slate-700">Location</th>
                                        <th className="px-6 py-4 font-bold">Verified</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rawPunches.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-3 text-slate-400 font-mono">{p.id}</td>
                                            <td className="px-6 py-3 font-black text-slate-800">{p.employee_code}</td>
                                            <td className="px-6 py-3 font-medium">{new Date(p.punch_time).toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded font-black text-[10px] ${p.punch_type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{p.punch_type}</span></td>
                                            <td className="px-6 py-3 text-slate-600">{p.location_name || '-'}</td>
                                            <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-black ${p.is_verified ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>{p.is_verified ? 'VERIFIED' : 'UNVERIFIED'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {(activeView === 'DailyRegister' || activeView === 'MonthlySummary' || activeView === 'MonthlyStatus') && (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm no-print">
                    <div className="w-full mb-6 flex items-center gap-3">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">ATTENDANCE CODE REFERENCE</h3>
                        <div className="flex-1 h-px bg-slate-100"></div>
                    </div>
                    <div className="flex flex-wrap gap-x-10 gap-y-6">
                        {Object.entries(STATUS_COLORS).filter(([k]) => k !== '#N/A' && k !== 'W/O').map(([key, cls]) => (
                            <div key={key} className="flex items-center gap-4 group cursor-default">
                                <div className={`w-12 h-8 flex items-center justify-center rounded-lg text-[11px] font-black shadow-sm transition-transform group-hover:scale-110 ${cls}`}>{key}</div>
                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">
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
    <div onClick={onClick} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center transition-all duration-300 group cursor-pointer hover:shadow-2xl hover:border-primary/20 hover:-translate-y-2 active:scale-95">
        <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-6 transition-all group-hover:bg-primary group-hover:rotate-6">
             <div className="text-primary group-hover:text-white transition-colors">
                {icon}
             </div>
        </div>
        <h3 className="font-black text-slate-700 text-sm group-hover:text-primary transition-colors tracking-tight uppercase leading-tight">{title}</h3>
    </div>
);

export default AttendanceManagement;
