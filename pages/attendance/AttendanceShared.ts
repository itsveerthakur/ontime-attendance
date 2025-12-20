
import type { AttendanceRules } from '../../types';

export const STATUS_COLORS: Record<string, string> = {
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

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

export const calculateStatus = (punchTime: string, shiftTime: string, type: 'IN' | 'OUT', currentRules: AttendanceRules) => {
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

export const applyCompounding = (inStatus: string, outStatus: string, currentRules: AttendanceRules) => {
    const rule = currentRules.compounding_rules.find(r => r.in_status === inStatus && r.out_status === outStatus);
    return rule ? rule.result_status : null;
};
