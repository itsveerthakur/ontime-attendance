
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { MONTHS } from './AttendanceShared';
import type { Employee } from '../../types';

interface MonthlyDetailedProps {
    selectedMonth: string;
    selectedYear: number;
    employees: Employee[];
}

const MonthlyDetailed: React.FC<MonthlyDetailedProps> = ({ selectedMonth, selectedYear, employees }) => {
    const [monthlyData, setMonthlyData] = useState<Record<string, Record<number, { in: string; out: string }>>>({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchDetailed = useCallback(async () => {
        setIsLoading(true);
        const monthIndex = MONTHS.indexOf(selectedMonth);
        const startDate = new Date(selectedYear, monthIndex, 1).toISOString();
        const endDate = new Date(selectedYear, monthIndex + 1, 0, 23, 59, 59).toISOString();
        const { data: logs } = await supabase.from('attendance_logs').select('employee_code, punch_time, punch_type').gte('punch_time', startDate).lte('punch_time', endDate);

        const mData: Record<string, Record<number, { in: string; out: string }>> = {};
        logs?.forEach(log => {
            const code = log.employee_code;
            const dateObj = new Date(log.punch_time);
            const day = dateObj.getDate();
            const time = dateObj.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
            if (!mData[code]) mData[code] = {};
            if (!mData[code][day]) mData[code][day] = { in: '', out: '' };
            if (log.punch_type === 'IN') { if (!mData[code][day].in || time < mData[code][day].in) mData[code][day].in = time; }
            else if (log.punch_type === 'OUT') { if (!mData[code][day].out || time > mData[code][day].out) mData[code][day].out = time; }
        });
        setMonthlyData(mData);
        setIsLoading(false);
    }, [selectedMonth, selectedYear]);

    useEffect(() => { fetchDetailed(); }, [fetchDetailed]);

    const daysInMonth = new Date(selectedYear, MONTHS.indexOf(selectedMonth) + 1, 0).getDate();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
        <div className="overflow-x-auto custom-scrollbar">
            <table id="monthly-table" className="w-full text-[9px] border-collapse min-w-max">
                <thead>
                    <tr className="bg-black text-white uppercase text-left font-bold border-b border-slate-800">
                        <th rowSpan={3} className="px-3 py-4 border-r border-slate-800 sticky left-0 bg-black z-20 w-24 min-w-[96px] text-center">EMP CODE</th>
                        <th rowSpan={3} className="px-4 py-4 border-r border-slate-800 sticky left-[96px] bg-black z-20 min-w-[200px] w-64">NAME</th>
                        {daysArr.map(d => (
                            <th key={d} colSpan={2} className="px-2 py-1 border-r border-slate-800 text-center border-b border-slate-800">{d}</th>
                        ))}
                    </tr>
                    <tr className="bg-black text-white uppercase text-[8px] font-black">
                        {daysArr.map(d => (
                            <th key={d} colSpan={2} className="px-2 py-1 border-r border-slate-800 text-center border-b border-slate-800 text-slate-400">{new Date(selectedYear, MONTHS.indexOf(selectedMonth), d).toLocaleDateString('en-US', { weekday: 'short' })}</th>
                        ))}
                    </tr>
                    <tr className="bg-black text-white uppercase text-[8px] font-black">
                        {daysArr.map(d => (
                            <React.Fragment key={d}>
                                <th className="px-1 py-1 border-r border-slate-800 text-center w-8">IN</th>
                                <th className="px-1 py-1 border-r border-slate-800 text-center w-8">OUT</th>
                            </React.Fragment>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {employees.map((emp) => {
                        const logs = monthlyData[emp.employeeCode] || {};
                        return (
                            <tr key={emp.employeeCode} className="hover:bg-slate-50 group">
                                <td className="px-3 py-2 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 z-10 font-black text-center">{emp.employeeCode}</td>
                                <td className="px-4 py-2 border-r border-slate-200 sticky left-[96px] bg-white group-hover:bg-slate-50 z-10 font-black uppercase truncate">{emp.firstName} {emp.lastName}</td>
                                {daysArr.map(d => (
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
        </div>
    );
};

export default MonthlyDetailed;
