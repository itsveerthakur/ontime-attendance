
import React, { useState, useEffect, useCallback } from 'react';
import { ImportIcon, CheckCircleIcon, ChevronRightIcon, SearchIcon, FilterIcon, LockClosedIcon, LockOpenIcon, LoaderIcon } from '../../components/icons';
import { supabase } from '../../supabaseClient';
import type { Employee } from '../../types';

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

             const mappedData: Record<string, AttendanceRecord> = {};
             if (attRes.data) {
                attRes.data.forEach((r: any) => {
                    mappedData[r.employee_code] = {
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
             }
             setAttendanceData(mappedData);

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
            
            // If locked, do not allow changes
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

    const handleAttendanceImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target?.result, { type: 'binary' });
                const sheetName = wb.SheetNames[0];
                const sheet = wb.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(sheet);
                
                const daysInMonth = new Date(selectedYear, MONTHS.indexOf(selectedMonth) + 1, 0).getDate();

                setAttendanceData(prev => {
                    const next = { ...prev };
                    data.forEach((row: any) => {
                        const code = String(row['Employee Code'] || row['Code'] || '').trim();
                        if (code) {
                             const curr = next[code] || { lock_status: 'Open' };
                             const isSalaryLocked = salaryLockStatusMap[code] === 'Locked';
                             
                             if (curr.lock_status === 'Locked' || isSalaryLocked) return; // Skip if locked

                            const holiday = Number(row['Holiday'] || 0);
                            const weekOff = Number(row['Week Off'] || 0);
                            const present = Number(row['Present'] || 0);
                            const leave = Number(row['Leave'] || 0);
                            const total = holiday + weekOff + present + leave;
                            
                            if (total <= daysInMonth) {
                                next[code] = {
                                    holiday,
                                    weekOff,
                                    present,
                                    lwp: Number(row['LWP'] || 0),
                                    leave,
                                    arrearDays: Number(row['Arrear Days'] || 0),
                                    totalPaidDays: total,
                                    lock_status: curr.lock_status || 'Open'
                                };
                            }
                        }
                    });
                    return next;
                });
                alert("Attendance imported successfully!");
            } catch (e) {
                console.error("Error parsing Excel", e);
                alert("Error parsing Excel file");
            }
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

    const saveAttendance = async (targetCodes: string[] = [], newLockStatus?: 'Open' | 'Locked') => {
        setIsSaving(true);
        try {
            const codesToProcess = targetCodes.length > 0 ? targetCodes : Object.keys(attendanceData);
            
            // Only filter for valid employees in current list to avoid junk data
            const validCodes = new Set(employees.map(e => e.employeeCode));
            
            const upsertData = codesToProcess.filter(code => validCodes.has(code)).map(code => {
                const record = attendanceData[code] || { holiday: 0, weekOff: 0, present: 0, lwp: 0, leave: 0, arrearDays: 0, totalPaidDays: 0, lock_status: 'Open' };
                
                // Determine lock status: explicit new status > existing record status > default 'Open'
                const status = newLockStatus !== undefined ? newLockStatus : (record.lock_status || 'Open');

                return {
                    employee_code: code,
                    month: selectedMonth,
                    year: selectedYear,
                    holiday: record.holiday,
                    week_off: record.weekOff,
                    present: record.present,
                    lwp: record.lwp,
                    leave: record.leave,
                    total_paid_days: record.totalPaidDays,
                    arrear_days: record.arrearDays,
                    lock_status: status,
                    updated_at: new Date().toISOString()
                };
            });

            if (upsertData.length === 0) {
                setIsSaving(false);
                return;
            }

            const { error } = await supabase.schema('payroll').from('attendance_entries').upsert(upsertData, { onConflict: 'employee_code,month,year' });

            if (error) throw error;

            // Update local state to reflect saved status
            setAttendanceData(prev => {
                const next = { ...prev };
                upsertData.forEach((item: any) => {
                    if (next[item.employee_code]) {
                        next[item.employee_code] = {
                            ...next[item.employee_code],
                            lock_status: item.lock_status
                        };
                    }
                });
                return next;
            });

            // alert("Attendance saved successfully!"); // Optional: suppress for smoother toggle feel
        } catch (error: any) {
            console.error("Error saving attendance:", error);
            alert("Failed to save: " + (error.message || JSON.stringify(error)));
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleLock = async (code: string) => {
        const currentStatus = attendanceData[code]?.lock_status || 'Open';
        // Use the map. If status is explicitly 'Locked', prevent unlock.
        const isSalaryLocked = salaryLockStatusMap[code] === 'Locked';
        
        // Condition: If Salary is Locked, cannot unlock Attendance.
        if (currentStatus === 'Locked' && isSalaryLocked) {
            alert("Access Denied: Salary for this employee is 'Locked' in Salary Preparation.\n\nYou must unlock the Salary before you can modify or unlock Attendance.");
            return;
        }

        const newStatus = currentStatus === 'Locked' ? 'Open' : 'Locked';
        await saveAttendance([code], newStatus);
    };
    
    const handleBulkLock = async (lock: boolean) => {
        if (selectedEmployeeCodes.size === 0) return;
        
        if (!lock) { // If Unlocking
             const lockedSalaries = Array.from(selectedEmployeeCodes).filter(code => salaryLockStatusMap[code] === 'Locked');
             if (lockedSalaries.length > 0) {
                 alert(`Cannot unlock attendance for selected employees because their Salary is Locked. Please unlock Salary first.`);
                 return;
             }
        }

        await saveAttendance(Array.from(selectedEmployeeCodes), lock ? 'Locked' : 'Open');
    };

    const filteredEmployees = employees.filter(e => 
        e.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleExportAttendance = () => {
        if (filteredEmployees.length === 0) {
            alert("No data to export");
            return;
        }
        
        const exportData = filteredEmployees.map(emp => {
             const record = attendanceData[emp.employeeCode] || { holiday: 0, weekOff: 0, present: 0, lwp: 0, leave: 0, arrearDays: 0, totalPaidDays: 0, lock_status: 'Open' };
             return {
                 'Employee Code': emp.employeeCode,
                 'Name': `${emp.firstName} ${emp.lastName}`,
                 'Month': selectedMonth,
                 'Year': selectedYear,
                 'Holiday': record.holiday,
                 'Week Off': record.weekOff,
                 'Present': record.present,
                 'LWP': record.lwp,
                 'Leave': record.leave,
                 'Paid Days': record.totalPaidDays,
                 'Arrear Days': record.arrearDays,
                 'Status': record.lock_status || 'Open'
             };
        });
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `Attendance_Export_${selectedMonth}_${selectedYear}.xlsx`);
    };

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

    return (
        <div>
            <div className="flex items-center text-sm text-slate-500 mb-6">
                <span onClick={onBack} className="cursor-pointer hover:text-primary">Payroll</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Prepare Attendance</span>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <LoaderIcon className="w-8 h-8 text-primary animate-spin" />
                    <p className="mt-2 text-slate-500">Loading attendance...</p>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    {/* Header Controls */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Prepare Attendance</h2>
                            <p className="text-sm text-slate-500">Enter or import attendance details for salary processing.</p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Month/Year Selector */}
                            <div className="flex items-center space-x-2 bg-slate-100 rounded-lg px-3 py-2 border border-slate-200">
                                 <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 font-semibold cursor-pointer">
                                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <div className="w-px h-4 bg-slate-300"></div>
                                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-sm focus:ring-0 text-slate-700 font-semibold cursor-pointer">
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>

                             {/* Search */}
                            <div className="relative">
                                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search Employee..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 w-48 lg:w-64 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                                />
                            </div>

                            {/* Action Buttons */}
                             <label className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center shadow-sm">
                                <ImportIcon className="w-4 h-4 mr-2 text-slate-500" /> 
                                Import
                                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleAttendanceImport} />
                            </label>
                            
                            <button onClick={handleDownloadAttendanceTemplate} className="text-sm text-primary hover:underline font-medium px-2">
                                Template
                            </button>

                             <button onClick={handleExportAttendance} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center shadow-sm">
                                Export
                            </button>

                            {/* Bulk Actions if selected */}
                            {selectedEmployeeCodes.size > 0 && (
                                 <div className="flex space-x-2">
                                    <button onClick={() => handleBulkLock(true)} className="px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 shadow-sm flex items-center">
                                        <LockClosedIcon className="w-4 h-4 mr-1" /> Lock Selected
                                    </button>
                                    <button onClick={() => handleBulkLock(false)} className="px-3 py-2 text-sm font-medium text-slate-700 bg-gray-200 rounded-lg hover:bg-gray-300 shadow-sm flex items-center">
                                        <LockOpenIcon className="w-4 h-4 mr-1" /> Unlock Selected
                                    </button>
                                 </div>
                            )}
                        </div>
                    </div>

                    {/* Attendance Table */}
                    <div className="overflow-x-auto border rounded-lg shadow-sm max-h-[600px]">
                        <table className="w-full text-sm text-left text-slate-600 whitespace-nowrap">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 text-center border-r border-b w-10 bg-slate-50">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            checked={selectedEmployeeCodes.size === filteredEmployees.length && filteredEmployees.length > 0}
                                            onChange={(e) => toggleSelectAll(e.target.checked)}
                                        />
                                    </th>
                                    <th className="px-4 py-3 border-r border-b font-semibold">Code</th>
                                    <th className="px-4 py-3 border-r border-b font-semibold">Name</th>
                                    <th className="px-4 py-3 border-r border-b font-semibold text-center w-32">Lock Status</th>
                                    <th className="px-3 py-3 border-r border-b font-semibold text-center min-w-[80px]">Holiday</th>
                                    <th className="px-3 py-3 border-r border-b font-semibold text-center min-w-[80px]">Week Off</th>
                                    <th className="px-3 py-3 border-r border-b font-semibold text-center min-w-[80px]">Present</th>
                                    <th className="px-3 py-3 border-r border-b font-semibold text-center min-w-[80px]">LWP</th>
                                    <th className="px-3 py-3 border-r border-b font-semibold text-center min-w-[80px]">Leave</th>
                                    <th className="px-3 py-3 border-r border-b font-bold text-center min-w-[80px] bg-slate-100">Paid Days</th>
                                    <th className="px-3 py-3 border-b font-semibold text-center min-w-[80px]">Arrear Days</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEmployees.map(emp => {
                                    const record = attendanceData[emp.employeeCode] || { holiday: 0, weekOff: 0, present: 0, lwp: 0, leave: 0, arrearDays: 0, totalPaidDays: 0, lock_status: 'Open' };
                                    const isSalaryLocked = salaryLockStatusMap[emp.employeeCode] === 'Locked';
                                    const isLocked = record.lock_status === 'Locked' || isSalaryLocked;
                                    
                                    return (
                                        <tr key={emp.id} className={`bg-white hover:bg-slate-50 transition-colors ${isLocked ? 'bg-slate-50/50' : ''}`}>
                                            <td className="p-4 text-center border-r">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    checked={selectedEmployeeCodes.has(emp.employeeCode)}
                                                    onChange={() => toggleSelectEmployee(emp.employeeCode)}
                                                />
                                            </td>
                                            <td className="px-4 py-3 border-r text-slate-500">{emp.employeeCode}</td>
                                            <td className="px-4 py-3 border-r font-medium text-slate-800">{emp.firstName} {emp.lastName}</td>
                                            <td className="px-4 py-3 border-r text-center">
                                                <button 
                                                    onClick={() => handleToggleLock(emp.employeeCode)}
                                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                                        isLocked 
                                                        ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200' 
                                                        : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'
                                                    }`}
                                                    title={isSalaryLocked ? "Locked by Salary Preparation" : (isLocked ? "Unlock" : "Lock")}
                                                >
                                                    {isLocked ? (
                                                        <><LockClosedIcon className="w-3 h-3 mr-1.5" /> Locked</>
                                                    ) : (
                                                        <><LockOpenIcon className="w-3 h-3 mr-1.5" /> Open</>
                                                    )}
                                                </button>
                                            </td>
                                            
                                            <td className="px-2 py-2 border-r text-center">
                                                <input 
                                                    type="number" 
                                                    disabled={isLocked}
                                                    value={record.holiday} 
                                                    onChange={(e) => handleAttendanceChange(emp.employeeCode, 'holiday', e.target.value)}
                                                    className="w-16 text-center text-sm border border-slate-300 rounded px-1 py-1 focus:ring-1 focus:ring-primary-light focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                                />
                                            </td>
                                            <td className="px-2 py-2 border-r text-center">
                                                <input 
                                                    type="number" 
                                                    disabled={isLocked}
                                                    value={record.weekOff} 
                                                    onChange={(e) => handleAttendanceChange(emp.employeeCode, 'weekOff', e.target.value)}
                                                    className="w-16 text-center text-sm border border-slate-300 rounded px-1 py-1 focus:ring-1 focus:ring-primary-light focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                                />
                                            </td>
                                            <td className="px-2 py-2 border-r text-center">
                                                <input 
                                                    type="number" 
                                                    disabled={isLocked}
                                                    value={record.present} 
                                                    onChange={(e) => handleAttendanceChange(emp.employeeCode, 'present', e.target.value)}
                                                    className="w-16 text-center text-sm border border-slate-300 rounded px-1 py-1 focus:ring-1 focus:ring-primary-light focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                                />
                                            </td>
                                            <td className="px-2 py-2 border-r text-center">
                                                <input 
                                                    type="number" 
                                                    disabled={isLocked}
                                                    value={record.lwp} 
                                                    onChange={(e) => handleAttendanceChange(emp.employeeCode, 'lwp', e.target.value)}
                                                    className="w-16 text-center text-sm border border-slate-300 rounded px-1 py-1 focus:ring-1 focus:ring-primary-light focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                                />
                                            </td>
                                            <td className="px-2 py-2 border-r text-center">
                                                <input 
                                                    type="number" 
                                                    disabled={isLocked}
                                                    value={record.leave} 
                                                    onChange={(e) => handleAttendanceChange(emp.employeeCode, 'leave', e.target.value)}
                                                    className="w-16 text-center text-sm border border-slate-300 rounded px-1 py-1 focus:ring-1 focus:ring-primary-light focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                                />
                                            </td>
                                            <td className="px-2 py-2 border-r text-center bg-slate-50">
                                                <span className="font-bold text-slate-800">{record.totalPaidDays}</span>
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <input 
                                                    type="number" 
                                                    disabled={isLocked}
                                                    value={record.arrearDays} 
                                                    onChange={(e) => handleAttendanceChange(emp.employeeCode, 'arrearDays', e.target.value)}
                                                    className="w-16 text-center text-sm border border-slate-300 rounded px-1 py-1 focus:ring-1 focus:ring-primary-light focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                                
                                {filteredEmployees.length === 0 && (
                                    <tr>
                                        <td colSpan={13} className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <p className="text-lg font-medium">No Employees Found</p>
                                                <p className="text-sm mt-1">Try adjusting your search filters or add new employees.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Footer Actions */}
                    <div className="mt-6 flex justify-between items-center">
                         <div className="text-sm text-slate-500">
                            Showing {filteredEmployees.length} employees
                        </div>
                        <div className="flex space-x-3">
                            <button onClick={() => { /* reset logic */ }} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Reset Changes</button>
                            <button 
                                onClick={() => saveAttendance(Object.keys(attendanceData), undefined)} // Save all with current status
                                disabled={isSaving} 
                                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark shadow-sm disabled:bg-primary/70 flex items-center"
                            >
                                {isSaving ? 'Saving...' : 'Save Attendance'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrepareAttendance;
