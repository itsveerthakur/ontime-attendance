
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { calculateStatus, applyCompounding, STATUS_COLORS, MONTHS } from './AttendanceShared';
import type { Employee, Shift, AttendanceRules } from '../../types';

interface MonthlyStatusProps {
    selectedMonth: string;
    selectedYear: number;
    employees: Employee[];
    shifts: Shift[];
    rules: AttendanceRules;
}

const MonthlyStatus: React.FC<MonthlyStatusProps> = ({ selectedMonth, selectedYear, employees, shifts, rules }) => {
    const [statusData, setStatusData] = useState<Record<string, Record<number, { inStatus: string; outStatus: string }>>>({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchStatusData = useCallback(async () => {
        setIsLoading(true);
        const monthIndex = MONTHS.indexOf(selectedMonth);
        const startDate = new Date(selectedYear, monthIndex, 1).toISOString();
        const endDate = new Date(selectedYear, monthIndex + 1, 0, 23, 59, 59).toISOString();
        
        const [logsRes, weeklyOffRes] = await Promise.all([
            supabase.from('attendance_logs').select('employee_code, punch_time, punch_type').gte('punch_time', startDate).lte('punch_time', endDate),
            supabase.schema('payroll').from('weekly_off_settings').select('employee_code, days')
        ]);

        const weeklyOffMap: Record<string, string[]> = {};
        weeklyOffRes.data?.forEach(item => { weeklyOffMap[item.employee_code] = Array.isArray(item.days) ? item.days : []; });

        const mData: Record<string, Record<number, { in: string; out: string }>> = {};
        logsRes.data?.forEach(log => {
            const code = log.employee_code;
            const day = new Date(log.punch_time).getDate();
            const time = new Date(log.punch_time).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
            if (!mData[code]) mData[code] = {};
            if (!mData[code][day]) mData[code][day] = { in: '', out: '' };
            if (log.punch_type === 'IN') { if (!mData[code][day].in || time < mData[code][day].in) mData[code][day].in = time; }
            else if (log.punch_type === 'OUT') { if (!mData[code][day].out || time > mData[code][day].out) mData[code][day].out = time; }
        });

        const statusMap: Record<string, Record<number, { inStatus: string; outStatus: string }>> = {};
        employees.forEach(emp => {
            const code = emp.employeeCode;
            const shift = shifts.find(s => s.id === emp.shiftId);
            const shiftIn = shift?.startTime || '10:00';
            const shiftOut = shift?.endTime || '19:00';
            const employeeWeeklyOffDays = weeklyOffMap[code] || [];
            
            statusMap[code] = {};
            const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const dayOfWeek = new Date(selectedYear, monthIndex, d).toLocaleDateString('en-US', { weekday: 'long' });
                const isWeeklyOff = employeeWeeklyOffDays.includes(dayOfWeek);
                const dayLog = mData[code]?.[d];
                
                let inS = dayLog?.in ? calculateStatus(dayLog.in, shiftIn, 'IN', rules) : 'A';
                let outS = dayLog?.out ? calculateStatus(dayLog.out, shiftOut, 'OUT', rules) : 'A';
                if (inS === 'A' && outS === 'A' && isWeeklyOff) { inS = 'W/O'; outS = 'W/O'; }
                statusMap[code][d] = { inStatus: inS, outStatus: outS };
            }
        });
        setStatusData(statusMap);
        setIsLoading(false);
    }, [selectedMonth, selectedYear, employees, shifts, rules]);

    useEffect(() => { fetchStatusData(); }, [fetchStatusData]);

    const daysInMonth = new Date(selectedYear, MONTHS.indexOf(selectedMonth) + 1, 0).getDate();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
        <div className="overflow-x-auto custom-scrollbar">
            <table id="monthly-table" className="w-full text-[10px] border-collapse min-w-max">
                <thead>
                    <tr className="bg-black text-white uppercase text-left font-bold">
                        <th rowSpan={3} className="px-3 py-4 border-r border-slate-800 sticky left-0 bg-black z-30 w-24 min-w-[96px] text-center">EMP CODE</th>
                        <th rowSpan={3} className="px-4 py-4 border-r border-slate-800 sticky left-[96px] bg-black z-30 min-w-[200px] w-64">NAME</th>
                        {daysArr.map(d => (
                            <th key={d} colSpan={2} className="px-1 py-1 border-r border-slate-800 text-center border-b border-slate-800">{d}</th>
                        ))}
                    </tr>
                    <tr className="bg-black text-white uppercase text-[8px] font-black">
                        {daysArr.map(d => (
                            <th key={d} colSpan={2} className="px-1 py-1 border-r border-slate-800 text-center border-b border-slate-800 text-slate-400">{new Date(selectedYear, MONTHS.indexOf(selectedMonth), d).toLocaleDateString('en-US', { weekday: 'short' })}</th>
                        ))}
                    </tr>
                    <tr className="bg-black text-white uppercase text-[7px] font-black">
                        {daysArr.map(d => (
                            <React.Fragment key={d}>
                                <th className="px-1 py-1 border-r border-slate-800 text-center w-10">IN</th>
                                <th className="px-1 py-1 border-r border-slate-800 text-center w-10">OUT</th>
                            </React.Fragment>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {employees.map((emp) => {
                        const statuses = statusData[emp.employeeCode] || {};
                        return (
                            <tr key={emp.employeeCode} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-3 py-2 border-r border-slate-300 sticky left-0 bg-white group-hover:bg-slate-50 z-10 font-black text-center">{emp.employeeCode}</td>
                                <td className="px-4 py-2 border-r border-slate-300 sticky left-[96px] bg-white group-hover:bg-slate-50 z-10 font-black uppercase truncate">{emp.firstName} {emp.lastName}</td>
                                {daysArr.map(d => {
                                    const s = statuses[d] || { inStatus: 'A', outStatus: 'A' };
                                    return (
                                        <React.Fragment key={d}>
                                            <td className="px-1 py-2 border-r border-slate-200 text-center font-bold">
                                                <span className={`inline-flex w-full items-center justify-center py-1 rounded-[4px] min-w-[28px] ${STATUS_COLORS[s.inStatus] || ''}`}>{s.inStatus}</span>
                                            </td>
                                            <td className="px-1 py-2 border-r border-slate-200 text-center font-bold">
                                                <span className={`inline-flex w-full items-center justify-center py-1 rounded-[4px] min-w-[28px] ${STATUS_COLORS[s.outStatus] || ''}`}>{s.outStatus}</span>
                                            </td>
                                        </React.Fragment>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default MonthlyStatus;
