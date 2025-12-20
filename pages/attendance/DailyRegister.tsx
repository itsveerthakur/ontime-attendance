
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { calculateStatus, STATUS_COLORS } from './AttendanceShared';
import type { Employee, Shift, AttendanceRules } from '../../types';

interface DailyRegisterProps {
    selectedDate: string;
    employees: Employee[];
    shifts: Shift[];
    rules: AttendanceRules;
}

const DailyRegister: React.FC<DailyRegisterProps> = ({ selectedDate, employees, shifts, rules }) => {
    const [processedLogs, setProcessedLogs] = useState<Record<string, { in: string | null; out: string | null }>>({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchDailyData = useCallback(async () => {
        setIsLoading(true);
        const startDate = `${selectedDate}T00:00:00Z`;
        const endDate = `${selectedDate}T23:59:59Z`;
        
        const { data: logs } = await supabase.from('attendance_logs')
            .select('employee_code, punch_time, punch_type')
            .gte('punch_time', startDate)
            .lte('punch_time', endDate);
        
        const map: Record<string, { in: string | null; out: string | null }> = {};
        logs?.forEach(log => {
            const code = log.employee_code;
            const time = new Date(log.punch_time).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
            if (!map[code]) map[code] = { in: null, out: null };
            if (log.punch_type === 'IN') { if (!map[code].in || time < map[code].in) map[code].in = time; }
            else if (log.punch_type === 'OUT') { if (!map[code].out || time > map[code].out!) map[code].out = time; }
        });
        setProcessedLogs(map);
        setIsLoading(false);
    }, [selectedDate]);

    useEffect(() => { fetchDailyData(); }, [fetchDailyData]);

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

    return (
        <div className="overflow-x-auto custom-scrollbar">
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
                    {employees.map((emp) => {
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
        </div>
    );
};

export default DailyRegister;
