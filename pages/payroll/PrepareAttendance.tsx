
import React, { useState, useEffect, useCallback } from 'react';
import { ImportIcon, CheckCircleIcon, ChevronRightIcon, SearchIcon, FilterIcon, LockClosedIcon, LockOpenIcon, LoaderIcon } from '../../components/icons';
import { supabase } from '../../supabaseClient';
import type { Employee, LeaveRule, LeaveBalance } from '../../types';

// Declare XLSX for global usage
declare const XLSX: any;

interface PrepareAttendanceProps {
    onBack: () => void;
}

interface AttendanceRecord {
    holiday: number;
    weekOff: number;
    present: number;
    lwp: number;
    leave: number;
    arrearDays: number;
    totalPaidDays: number;
    lock_status?: string;
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const PrepareAttendance: React.FC<PrepareAttendanceProps> = ({ onBack }) => {
    const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[new Date().getMonth()]);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceRecord>>({});
    const [salaryLockStatusMap, setSalaryLockStatusMap] = useState<Record<string, string>>({});
    const [selectedEmployeeCodes, setSelectedEmployeeCodes] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
             const [empRes, attRes, salaryRes] = await Promise.all([
                 supabase.from('employees').select('*').order('employeeCode'),
                 supabase.schema('payroll').from('attendance_entries').select('*').eq('month', selectedMonth).eq('year', selectedYear),
                 supabase.schema('salarySheet').from('monthly_salary_table').select('employee_code, status').eq('month', selectedMonth).eq('year', selectedYear)
             ]);
             
             setEmployees(empRes.data as Employee[] || []);

             const normalizedData: Record<string, AttendanceRecord> = {};
             if (attRes.data) {
                attRes.data.forEach((r: any) => {
                    normalizedData[r.employee_code] = {
                        holiday: Number(r.holiday || 0),
                        weekOff: Number(r.week_off || 0),
                        present: Number(r.present || 0),
                        lwp: Number(r.lwp || 0),
                        leave: Number(r.leave || 0),
                        arrearDays: Number(r.arrear_days || 0),
                        totalPaidDays: Number(r.total_paid_days || 0),
                        lock_status: r.lock_status || 'Open'
                    };
                });
             }
             setAttendanceData(normalizedData);

             const map: Record<string, string> = {};
             if (salaryRes.data) {
                salaryRes.data.forEach((r: any) => map[r.employee_code] = r.status);
             }
             setSalaryLockStatusMap(map);

        } catch (e) {
             console.error("Error fetching data", e);
        } finally {
            setIsLoading(false);
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        fetchData();
        setSelectedEmployeeCodes(new Set());
    }, [fetchData]);

    const handleAttendanceChange = (code: string, field: keyof AttendanceRecord, val: string) => {
        const num = parseFloat(val);
        const safeNum = isNaN(num) ? 0 : num;
        if (safeNum < 0) return;

        const daysInMonth = new Date(selectedYear, MONTHS.indexOf(selectedMonth) + 1, 0).getDate();

        setAttendanceData(prev => {
            const curr = prev[code] || { holiday: 0, weekOff: 0, present: 0, lwp: 0, leave: 0, arrearDays: 0, totalPaidDays: 0, lock_status: 'Open' };
            
            if (curr.lock_status === 'Locked') return prev;
            if (salaryLockStatusMap[code] === 'Locked') return prev;

            let projectedTotalPaidDays = curr.totalPaidDays;

            if (['holiday', 'weekOff', 'present', 'leave'].includes(field)) {
                const h = field === 'holiday' ? safeNum : (curr.holiday || 0);
                const w = field === 'weekOff' ? safeNum : (curr.weekOff || 0);
                const p = field === 'present' ? safeNum : (curr.present || 0);
                const l = field === 'leave' ? safeNum : (curr.leave || 0);
                projectedTotalPaidDays = h + w + p + l;

                if (projectedTotalPaidDays > daysInMonth) {
                    alert(`Total paid days cannot exceed ${daysInMonth} for the selected month.`);
                    return prev;
                }
            }

            const updated = { ...curr, [field]: safeNum };
            
            if (['holiday', 'weekOff', 'present', 'leave'].includes(field)) {
                 updated.totalPaidDays = projectedTotalPaidDays;
            }
            
            return { ...prev, [code]: updated };
        });
    };

    const processCompOffCredits = async (codes: string[]) => {
        try {
            const { data: coRules } = await supabase.schema('leaves')
                .from('leave_rules')
                .select('*')
                .eq('allocation_type', 'Work on Weekly Off')
                .eq('status', 'active');
            
            if (!coRules || coRules.length === 0) return;

            const { data: woSettings } = await supabase.schema('payroll')
                .from('weekly_off_settings')
                .select('*')
                .in('employee_code', codes);
            
            if (!woSettings) return;

            const monthIndex = MONTHS.indexOf(selectedMonth);
            const startDate = new Date(selectedYear, monthIndex, 1).toISOString();
            const endDate = new Date(selectedYear, monthIndex + 1, 0, 23, 59, 59).toISOString();
            
            const { data: logs } = await supabase.from('attendance_logs')
                .select('employee_code, punch_time')
                .gte('punch_time', startDate)
                .lte('punch_time', endDate);

            if (!logs) return;

            const workMap: Record<string, Set<number>> = {};
            logs.forEach(log => {
                if (!workMap[log.employee_code]) workMap[log.employee_code] = new Set();
                workMap[log.employee_code].add(new Date(log.punch_time).getDate());
            });

            const creditsToApply: Record<string, Record<string, number>> = {};

            for (const code of codes) {
                const setting = woSettings.find(s => s.employee_code === code);
                if (!setting) continue;

                const daysWorked = workMap[code] || new Set();
                const daysInMonthCount = new Date(selectedYear, monthIndex + 1, 0).getDate();
                let coEarned = 0;

                for (let d = 1; d <= daysInMonthCount; d++) {
                    const dateObj = new Date(selectedYear, monthIndex, d);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                    
                    const isWeeklyOff = Array.isArray(setting.days) && setting.days.includes(dayName);
                    const didWork = daysWorked.has(d);

                    if (isWeeklyOff && didWork) {
                        let isSandwiched = false;
                        if (setting.sandwich_rule) {
                            const findAbsenceOnWorkDay = (day: number, direction: number) => {
                                let check = day + direction;
                                while (check >= 1 && check <= daysInMonthCount) {
                                    const cDate = new Date(selectedYear, monthIndex, check);
                                    const cDayName = cDate.toLocaleDateString('en-US', { weekday: 'long' });
                                    if (!setting.days.includes(cDayName)) {
                                        return !daysWorked.has(check);
                                    }
                                    check += direction;
                                }
                                return false;
                            };

                            const absentBefore = findAbsenceOnWorkDay(d, -1);
                            const absentAfter = findAbsenceOnWorkDay(d, 1);
                            if (absentBefore && absentAfter) isSandwiched = true;
                        }

                        if (!isSandwiched) coEarned++;
                    }
                }

                if (coEarned > 0) {
                    coRules.forEach(rule => {
                        let eligible = false;
                        if (rule.eligibility_scope === 'Global') eligible = true;
                        else if (rule.eligibility_scope === 'Department') {
                            const emp = employees.find(e => e.employeeCode === code);
                            if (emp && rule.scope_value?.split(',').includes(emp.department)) eligible = true;
                        }

                        if (eligible) {
                            if (!creditsToApply[code]) creditsToApply[code] = {};
                            creditsToApply[code][rule.leave_type_code] = coEarned * (rule.allocated_count || 1);
                        }
                    });
                }
            }

            for (const [code, leaveMap] of Object.entries(creditsToApply)) {
                for (const [leaveCode, qty] of Object.entries(leaveMap)) {
                    const { data: existing } = await supabase.schema('leaves')
                        .from('leave_balances')
                        .select('*')
                        .eq('employee_code', code)
                        .eq('leave_type', leaveCode)
                        .maybeSingle();
                    
                    const emp = employees.find(e => e.employeeCode === code);
                    const name = emp ? `${emp.firstName} ${emp.lastName}` : 'User';

                    if (existing) {
                        await supabase.schema('leaves').from('leave_balances').update({
                            opening: Number(existing.opening || 0) + qty,
                            remaining: Number(existing.remaining || 0) + qty,
                            updated_at: new Date().toISOString()
                        }).eq('id', existing.id);
                    } else {
                        await supabase.schema('leaves').from('leave_balances').insert({
                            employee_code: code,
                            employee_name: name,
                            leave_type: leaveCode,
                            opening: qty,
                            used: 0,
                            remaining: qty
                        });
                    }
                }
            }
        } catch (err) { console.error("CO Processing Error:", err); }
    };

    const handleAttendanceImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target?.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws);
                const dim = new Date(selectedYear, MONTHS.indexOf(selectedMonth) + 1, 0).getDate();

                setAttendanceData(prev => {
                    const next = { ...prev };
                    data.forEach((row: any) => {
                        const code = String(row['Employee Code'] || row['Code'] || '').trim();
                        if (code && !(salaryLockStatusMap[code] === 'Locked')) {
                            const holiday = Number(row['Holiday'] || 0);
                            const weekOff = Number(row['Week Off'] || 0);
                            const present = Number(row['Present'] || 0);
                            const leave = Number(row['Leave'] || 0);
                            const total = holiday + weekOff + present + leave;
                            if (total <= dim) {
                                next[code] = {
                                    holiday, weekOff, present, lwp: Number(row['LWP'] || 0), leave,
                                    arrearDays: Number(row['Arrear Days'] || 0), totalPaidDays: total, lock_status: 'Open'
                                };
                            }
                        }
                    });
                    return next;
                });
                alert("Attendance imported successfully!");
            } catch (e) { alert("Error parsing Excel file"); }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadAttendanceTemplate = () => {
        const data = [{ 'Employee Code': 'EMP001', 'Name': 'John Doe', 'Holiday': 0, 'Week Off': 4, 'Present': 22, 'LWP': 0, 'Leave': 0, 'Arrear Days': 0 }];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
        XLSX.writeFile(wb, 'Attendance_Import_Template.xlsx');
    };

    const saveAttendance = async (targetCodes: string[] = [], newLockStatus?: 'Open' | 'Locked', forceProcessCO = false) => {
        setIsSaving(true);
        try {
            const codesToProcess = targetCodes.length > 0 ? targetCodes : Object.keys(attendanceData);
            const validCodes = new Set(employees.map(e => e.employeeCode));
            const upsertData = codesToProcess.filter(code => validCodes.has(code)).map(code => {
                const record = attendanceData[code] || { holiday: 0, weekOff: 0, present: 0, lwp: 0, leave: 0, arrearDays: 0, totalPaidDays: 0, lock_status: 'Open' };
                const status = newLockStatus !== undefined ? newLockStatus : (record.lock_status || 'Open');
                return {
                    employee_code: code, month: selectedMonth, year: selectedYear,
                    holiday: record.holiday, week_off: record.weekOff, present: record.present, lwp: record.lwp,
                    leave: record.leave, total_paid_days: record.totalPaidDays, arrear_days: record.arrearDays,
                    lock_status: status, updated_at: new Date().toISOString()
                };
            });

            if (upsertData.length > 0) {
                const { error } = await supabase.schema('payroll').from('attendance_entries').upsert(upsertData, { onConflict: 'employee_code,month,year' });
                if (error) throw error;
                if (newLockStatus === 'Locked' || forceProcessCO) {
                    await processCompOffCredits(codesToProcess);
                }
                setAttendanceData(prev => {
                    const next = { ...prev };
                    upsertData.forEach((item: any) => {
                        if (next[item.employee_code]) {
                            next[item.employee_code] = { ...next[item.employee_code], lock_status: item.lock_status };
                        }
                    });
                    return next;
                });
                if (forceProcessCO) alert("Attendance saved and CO credits processed based on Weekly Off work.");
            }
        } catch (error: any) { alert("Failed to save: " + error.message); }
        finally { setIsSaving(false); }
    };

    const handleToggleLock = async (code: string) => {
        const currentStatus = attendanceData[code]?.lock_status || 'Open';
        if (currentStatus === 'Locked' && salaryLockStatusMap[code] === 'Locked') {
            alert("Access Denied: Salary for this employee is 'Locked'. Unlock Salary first.");
            return;
        }
        await saveAttendance([code], currentStatus === 'Locked' ? 'Open' : 'Locked');
    };
    
    const handleBulkLock = async (lock: boolean) => {
        if (selectedEmployeeCodes.size === 0) return;
        if (!lock) {
             const lockedSalaries = Array.from(selectedEmployeeCodes).filter(code => salaryLockStatusMap[code] === 'Locked');
             if (lockedSalaries.length > 0) { alert(`Cannot unlock: Salary is Locked for some employees.`); return; }
        }
        await saveAttendance(Array.from(selectedEmployeeCodes), lock ? 'Locked' : 'Open');
    };

    // Advanced filtering based on selected month/year and employee lifecycle
    const filteredEmployees = employees.filter(e => {
        // 1. Search Filter
        const matchesSearch = 
            e.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
            e.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;

        // 2. Date Lifecycle Filter
        const monthIdx = MONTHS.indexOf(selectedMonth);
        const periodStart = new Date(selectedYear, monthIdx, 1);
        const periodEnd = new Date(selectedYear, monthIdx + 1, 0); // Last day of selected month

        const doj = new Date(e.dateOfJoining);
        const dol = e.dateOfLeaving ? new Date(e.dateOfLeaving) : null;

        // Condition A: Joined on or before the end of the selected month
        const isJoined = doj <= periodEnd;
        // Condition B: Not resigned, or resigned on or after the first day of the selected month
        const isNotYetLeft = !dol || dol >= periodStart;

        return isJoined && isNotYetLeft;
    });

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedEmployeeCodes(new Set(filteredEmployees.map(e => e.employeeCode)));
        } else {
            setSelectedEmployeeCodes(new Set());
        }
    };

    const toggleSelectEmployee = (code: string) => {
        const next = new Set(selectedEmployeeCodes);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        setSelectedEmployeeCodes(next);
    };

    const handleExportAttendance = () => {
        const exportData = filteredEmployees.map(emp => {
             const r = attendanceData[emp.employeeCode] || { holiday: 0, weekOff: 0, present: 0, lwp: 0, leave: 0, arrearDays: 0, totalPaidDays: 0, lock_status: 'Open' };
             return {
                 'Employee Code': emp.employeeCode, 'Name': `${emp.firstName} ${emp.lastName}`, 'Month': selectedMonth, 'Year': selectedYear,
                 'Holiday': r.holiday, 'Week Off': r.weekOff, 'Present': r.present, 'LWP': r.lwp, 'Leave': r.leave, 'Paid Days': r.totalPaidDays, 'Arrear Days': r.arrearDays, 'Status': r.lock_status || 'Open'
             };
        });
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `Attendance_Export_${selectedMonth}_${selectedYear}.xlsx`);
    };

    return (
        <div>
            <div className="flex items-center text-sm text-slate-500 mb-6">
                <span onClick={onBack} className="cursor-pointer hover:text-primary">Payroll</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Prepare Attendance</span>
            </div>
            {isLoading ? (
                <div className="flex justify-center py-20"><LoaderIcon className="w-8 h-8 text-primary animate-spin" /></div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                        <div><h2 className="text-lg font-semibold text-slate-800">Prepare Attendance</h2><p className="text-sm text-slate-500">Lock records to auto-calculate CO credits.</p></div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center space-x-2 bg-slate-100 rounded-lg px-3 py-2 border border-slate-200">
                                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 font-semibold cursor-pointer">{MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select>
                                <div className="w-px h-4 bg-slate-300"></div>
                                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 font-semibold cursor-pointer">{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select>
                            </div>
                            <div className="relative"><SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" /><input type="text" placeholder="Search Employee..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 w-48 lg:w-64 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-light outline-none" /></div>
                            <label className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center shadow-sm"><ImportIcon className="w-4 h-4 mr-2 text-slate-500" />Import<input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleAttendanceImport} /></label>
                            <button onClick={handleDownloadAttendanceTemplate} className="text-sm text-primary hover:underline font-medium px-2">Template</button>
                            <button onClick={handleExportAttendance} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm flex items-center">Export</button>
                            {selectedEmployeeCodes.size > 0 && (<div className="flex space-x-2"><button onClick={() => handleBulkLock(true)} className="px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 shadow-sm flex items-center"><LockClosedIcon className="w-4 h-4 mr-1" />Lock Selected</button><button onClick={() => handleBulkLock(false)} className="px-3 py-2 text-sm font-medium text-slate-700 bg-gray-200 rounded-lg hover:bg-gray-300 shadow-sm flex items-center"><LockOpenIcon className="w-4 h-4 mr-1" />Unlock Selected</button></div>)}
                        </div>
                    </div>
                    <div className="overflow-x-auto border rounded-lg shadow-sm max-h-[600px]">
                        <table className="w-full text-sm text-left text-slate-600 whitespace-nowrap">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 text-center border-r border-b w-10 bg-slate-50"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" checked={selectedEmployeeCodes.size === filteredEmployees.length && filteredEmployees.length > 0} onChange={(e) => toggleSelectAll(e.target.checked)} /></th>
                                    <th className="px-4 py-3 border-r border-b font-semibold">Code</th><th className="px-4 py-3 border-r border-b font-semibold">Name</th><th className="px-4 py-3 border-r border-b font-semibold text-center w-32">Lock Status</th><th className="px-3 py-3 border-r border-b font-semibold text-center min-w-[80px]">Holiday</th><th className="px-3 py-3 border-r border-b font-semibold text-center min-w-[80px]">Week Off</th><th className="px-3 py-3 border-r border-b font-semibold text-center min-w-[80px]">Present</th><th className="px-3 py-3 border-r border-b font-semibold text-center min-w-[80px]">LWP</th><th className="px-3 py-3 border-r border-b font-semibold text-center min-w-[80px]">Leave</th><th className="px-3 py-3 border-r border-b font-bold text-center min-w-[80px] bg-slate-100">Paid Days</th><th className="px-3 py-3 border-b font-semibold text-center min-w-[80px]">Arrear Days</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEmployees.map(emp => {
                                    const r = attendanceData[emp.employeeCode] || { holiday: 0, weekOff: 0, present: 0, lwp: 0, leave: 0, arrearDays: 0, totalPaidDays: 0, lock_status: 'Open' };
                                    const locked = r.lock_status === 'Locked' || salaryLockStatusMap[emp.employeeCode] === 'Locked';
                                    return (
                                        <tr key={emp.id} className={`bg-white hover:bg-slate-50 transition-colors ${locked ? 'bg-slate-50/50' : ''}`}>
                                            <td className="p-4 text-center border-r"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" checked={selectedEmployeeCodes.has(emp.employeeCode)} onChange={() => toggleSelectEmployee(emp.employeeCode)} /></td>
                                            <td className="px-4 py-3 border-r text-slate-500">{emp.employeeCode}</td><td className="px-4 py-3 border-r font-medium text-slate-800">{emp.firstName} {emp.lastName}</td>
                                            <td className="px-4 py-3 border-r text-center"><button onClick={() => handleToggleLock(emp.employeeCode)} className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${locked ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'}`}>{locked ? <><LockClosedIcon className="w-3 h-3 mr-1.5" /> Locked</> : <><LockOpenIcon className="w-3 h-3 mr-1.5" /> Open</>}</button></td>
                                            <td className="px-2 py-2 border-r text-center"><input type="number" disabled={locked} value={r.holiday} onChange={(e) => handleAttendanceChange(emp.employeeCode, 'holiday', e.target.value)} className="w-16 text-center text-sm border border-slate-300 rounded px-1 py-1 disabled:bg-slate-100" /></td>
                                            <td className="px-2 py-2 border-r text-center"><input type="number" disabled={locked} value={r.weekOff} onChange={(e) => handleAttendanceChange(emp.employeeCode, 'weekOff', e.target.value)} className="w-16 text-center text-sm border border-slate-300 rounded px-1 py-1 disabled:bg-slate-100" /></td>
                                            <td className="px-2 py-2 border-r text-center"><input type="number" disabled={locked} value={r.present} onChange={(e) => handleAttendanceChange(emp.employeeCode, 'present', e.target.value)} className="w-16 text-center text-sm border border-slate-300 rounded px-1 py-1 disabled:bg-slate-100" /></td>
                                            <td className="px-2 py-2 border-r text-center"><input type="number" disabled={locked} value={r.lwp} onChange={(e) => handleAttendanceChange(emp.employeeCode, 'lwp', e.target.value)} className="w-16 text-center text-sm border border-slate-300 rounded px-1 py-1 disabled:bg-slate-100" /></td>
                                            <td className="px-2 py-2 border-r text-center"><input type="number" disabled={locked} value={r.leave} onChange={(e) => handleAttendanceChange(emp.employeeCode, 'leave', e.target.value)} className="w-16 text-center text-sm border border-slate-300 rounded px-1 py-1 disabled:bg-slate-100" /></td>
                                            <td className="px-2 py-2 border-r text-center bg-slate-50"><span className="font-bold text-slate-800">{r.totalPaidDays}</span></td>
                                            <td className="px-2 py-2 text-center"><input type="number" disabled={locked} value={r.arrearDays} onChange={(e) => handleAttendanceChange(emp.employeeCode, 'arrearDays', e.target.value)} className="w-16 text-center text-sm border border-slate-300 rounded px-1 py-1 disabled:bg-slate-100" /></td>
                                        </tr>
                                    );
                                })}
                                {filteredEmployees.length === 0 && (<tr><td colSpan={13} className="px-6 py-12 text-center text-slate-500">No Eligible Employees Found for the Selected Period</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 flex justify-between items-center">
                         <div className="text-sm text-slate-500">Showing {filteredEmployees.length} employees</div>
                        <div className="flex space-x-3">
                            <button onClick={() => saveAttendance(Object.keys(attendanceData), undefined, true)} disabled={isSaving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark shadow-sm disabled:opacity-50 flex items-center gap-2">{isSaving ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}Save & Process CO</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrepareAttendance;
