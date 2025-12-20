
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { 
    SearchIcon, LoaderIcon, CheckCircleIcon, XCircleIcon, 
    CalendarIcon, FilterIcon, RefreshIcon, InfoIcon, 
    MapPinIcon, MasterMgmtIcon
} from '../../components/icons';
import type { LeaveRequest, Employee, LeaveBalance, Department, Location } from '../../types';

interface AbsentInstance {
    employee_code: string;
    employee_name: string;
    date: string;
    day_name: string;
    department: string;
    location: string;
}

const LeaveRegister: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'Registry' | 'Audit'>('Audit');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    
    // --- Master Filter State ---
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA'); // YYYY-MM-DD
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toLocaleDateString('en-CA');
    
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    const [searchTerm, setSearchTerm] = useState('');
    const [deptFilter, setDeptFilter] = useState('');
    const [locFilter, setLocFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    // --- Data State ---
    const [depts, setDepts] = useState<Department[]>([]);
    const [locs, setLocs] = useState<Location[]>([]);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [absentees, setAbsentees] = useState<AbsentInstance[]>([]);
    
    // --- Regularization Modal ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAbsent, setSelectedAbsent] = useState<AbsentInstance | null>(null);
    const [empBalances, setEmpBalances] = useState<LeaveBalance[]>([]);

    // Helper: Get YYYY-MM-DD from a date object in Local Time
    const toLocalKey = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const fetchMasterData = useCallback(async () => {
        const [dRes, lRes] = await Promise.all([
            supabase.from('departments').select('*').eq('status', 'active'),
            supabase.from('locations').select('*').eq('status', 'active')
        ]);
        if (dRes.data) setDepts(dRes.data);
        if (lRes.data) setLocs(lRes.data);
    }, []);

    const fetchRegistry = useCallback(async () => {
        setIsLoading(true);
        // Registry is also filtered by the master date range
        const { data } = await supabase.schema('leaves')
            .from('leave_requests')
            .select('*')
            .gte('start_date', startDate)
            .lte('start_date', endDate)
            .order('created_at', { ascending: false });
        if (data) setRequests(data);
        setIsLoading(false);
    }, [startDate, endDate]);

    const runAbsentAudit = useCallback(async () => {
        setIsLoading(true);
        try {
            // Helper for strictly Local Date iteration
            const getLocalDates = (start: string, end: string) => {
                const arr = [];
                const dt = new Date(start + 'T00:00:00');
                const endDt = new Date(end + 'T00:00:00');
                while (dt <= endDt) {
                    arr.push(toLocalKey(dt));
                    dt.setDate(dt.getDate() + 1);
                }
                return arr;
            };

            const dateRange = getLocalDates(startDate, endDate);
            
            // Strictly bound the query to local days to avoid timezone leaks
            const queryStart = `${startDate} 00:00:00`;
            const queryEnd = `${endDate} 23:59:59`;

            const [empRes, logsRes, offRes, appRes] = await Promise.all([
                supabase.from('employees').select('employeeCode, firstName, lastName, department, location, userType').eq('status', 'Active'),
                supabase.from('attendance_logs').select('employee_code, punch_time').gte('punch_time', queryStart).lte('punch_time', queryEnd),
                supabase.schema('payroll').from('weekly_off_settings').select('employee_code, days'),
                supabase.schema('leaves').from('leave_applications').select('employee_code, date').gte('date', startDate).lte('date', endDate)
            ]);

            const employees = empRes.data || [];
            const logs = logsRes.data || [];
            const weeklyOffs = offRes.data || [];
            const applications = appRes.data || [];

            // 1. Build Work Map using Local Interpretation of punch times
            const workMap: Record<string, Set<string>> = {};
            logs.forEach(l => {
                const dateKey = toLocalKey(new Date(l.punch_time));
                if (!workMap[l.employee_code]) workMap[l.employee_code] = new Set();
                workMap[l.employee_code].add(dateKey);
            });

            // 2. Weekly Off Map
            const offMap: Record<string, string[]> = {};
            weeklyOffs.forEach(o => { offMap[o.employee_code] = Array.isArray(o.days) ? o.days : []; });

            // 3. Applied Leave Map
            const appliedMap: Record<string, Set<string>> = {};
            applications.forEach(a => {
                if (!appliedMap[a.employee_code]) appliedMap[a.employee_code] = new Set();
                appliedMap[a.employee_code].add(a.date); // Application dates are already YYYY-MM-DD
            });

            const absentList: AbsentInstance[] = [];
            const seenKeys = new Set<string>(); // Crucial to prevent logical duplicates

            employees.forEach(emp => {
                const empWeeklyOffs = offMap[emp.employeeCode] || [];
                const empWorkDates = workMap[emp.employeeCode] || new Set();
                const empAppDates = appliedMap[emp.employeeCode] || new Set();

                dateRange.forEach(dateStr => {
                    const uniqueKey = `${emp.employeeCode}_${dateStr}`;
                    if (seenKeys.has(uniqueKey)) return;

                    const dateObj = new Date(dateStr + 'T00:00:00');
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

                    const isWeeklyOff = empWeeklyOffs.includes(dayName);
                    const hasPunched = empWorkDates.has(dateStr);
                    const hasApplied = empAppDates.has(dateStr);

                    // Logic: NO punch AND NOT a rest day AND NO approved leave registered
                    if (!hasPunched && !isWeeklyOff && !hasApplied) {
                        absentList.push({
                            employee_code: emp.employeeCode,
                            employee_name: `${emp.firstName} ${emp.lastName}`,
                            date: dateStr,
                            day_name: dayName,
                            department: emp.department || 'Unassigned',
                            location: emp.location || 'Default'
                        });
                        seenKeys.add(uniqueKey);
                    }
                });
            });

            setAbsentees(absentList);
        } catch (e) {
            console.error("Audit Engine Failure:", e);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchMasterData();
        if (activeTab === 'Registry') fetchRegistry();
        else runAbsentAudit();
    }, [activeTab, startDate, endDate, fetchRegistry, runAbsentAudit, fetchMasterData]);

    const handleAction = async (id: number, status: 'Approved' | 'Rejected') => {
        const { error } = await supabase.schema('leaves').from('leave_requests').update({ status }).eq('id', id);
        if (!error) fetchRegistry();
    };

    const handleOpenRegularize = async (absent: AbsentInstance) => {
        setSelectedAbsent(absent);
        setIsModalOpen(true);
        const { data } = await supabase.schema('leaves').from('leave_balances').select('*').eq('employee_code', absent.employee_code);
        setEmpBalances(data || []);
    };

    const handleConvertAbsent = async (leaveType: string) => {
        if (!selectedAbsent) return;
        const bal = empBalances.find(b => b.leave_type === leaveType);
        if (!bal || bal.remaining < 1) {
            alert("Insufficient balance!");
            return;
        }

        setIsProcessing(true);
        try {
            await supabase.schema('leaves').from('leave_applications').insert({
                employee_code: selectedAbsent.employee_code,
                date: selectedAbsent.date,
                leave_type: leaveType
            });

            await supabase.schema('leaves').from('leave_balances').update({
                used: Number(bal.used) + 1,
                remaining: Number(bal.remaining) - 1,
                updated_at: new Date().toISOString()
            }).eq('id', (bal as any).id);

            setIsModalOpen(false);
            runAbsentAudit();
        } catch (err: any) {
            alert("Process Failed: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- Master Filtering Logic ---
    const filteredAudit = useMemo(() => {
        return absentees.filter(a => {
            const matchesSearch = a.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) || a.employee_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesDept = deptFilter ? a.department === deptFilter : true;
            const matchesLoc = locFilter ? a.location === locFilter : true;
            return matchesSearch && matchesDept && matchesLoc;
        });
    }, [absentees, searchTerm, deptFilter, locFilter]);

    const filteredRegistry = useMemo(() => {
        return requests.filter(r => {
            const matchesSearch = r.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) || r.employee_name.toLowerCase().includes(searchTerm.toLowerCase());
            // Map the employee from employees list to get their dept/loc if registry record lacks it
            // (Assumes you might want to filter historical requests by CURRENT dept/loc)
            return matchesSearch;
        });
    }, [requests, searchTerm]);

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Master Control Bar */}
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                    {/* View Switcher */}
                    <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto">
                        <button onClick={() => setActiveTab('Audit')} className={`flex-1 lg:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'Audit' ? 'bg-black text-white shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600'}`}>Absentee Audit</button>
                        <button onClick={() => setActiveTab('Registry')} className={`flex-1 lg:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'Registry' ? 'bg-black text-white shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600'}`}>Application Registry</button>
                    </div>

                    {/* Master Filter Set */}
                    <div className="flex flex-wrap items-center justify-center lg:justify-end gap-3 w-full lg:w-auto">
                        <div className="flex items-center space-x-2 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-2 shadow-inner group transition-all focus-within:border-primary/20">
                             <CalendarIcon className="w-4 h-4 text-slate-400 group-focus-within:text-primary" />
                             <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[11px] font-black focus:ring-0 text-slate-700 cursor-pointer uppercase" />
                             <span className="text-slate-300 font-bold">TO</span>
                             <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[11px] font-black focus:ring-0 text-slate-700 cursor-pointer uppercase" />
                        </div>
                        
                        <div className="relative flex-1 lg:flex-none">
                            <SearchIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="EMP CODE / NAME..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-black outline-none w-full lg:w-56 uppercase focus:border-primary/20 transition-all shadow-inner"
                            />
                        </div>

                        <button 
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            className={`p-3.5 border-2 rounded-2xl transition-all ${showAdvancedFilters ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                        >
                            <FilterIcon className="w-5 h-5" />
                        </button>

                        <button onClick={activeTab === 'Audit' ? runAbsentAudit : fetchRegistry} className="p-4 bg-white border-2 border-slate-100 rounded-2xl text-slate-400 hover:text-primary hover:border-primary/20 transition-all active:scale-95"><RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} /></button>
                    </div>
                </div>

                {/* Collapsible Advanced Master Filters */}
                {showAdvancedFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-100 animate-fadeIn">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Master: Department</label>
                            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-[11px] font-black text-slate-700 outline-none uppercase appearance-none cursor-pointer">
                                <option value="">All Departments</option>
                                {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Master: Work Location</label>
                            <select value={locFilter} onChange={e => setLocFilter(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-[11px] font-black text-slate-700 outline-none uppercase appearance-none cursor-pointer">
                                <option value="">All Locations</option>
                                {locs.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Staff Classification</label>
                            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-[11px] font-black text-slate-700 outline-none uppercase appearance-none cursor-pointer">
                                <option value="">Unified Registry</option>
                                <option value="On-Roll">On-Roll Only</option>
                                <option value="Contractual">Contractual Only</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-xl flex items-center gap-3">
                        {activeTab === 'Audit' ? 'Unresolved Absent Gaps' : 'Official Application Ledger'}
                        <div className="px-3 py-1 bg-primary text-white rounded-lg text-[9px] font-black tracking-widest uppercase">
                            {new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short' })} - {new Date(endDate + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}
                        </div>
                    </h3>
                    <span className="px-5 py-2 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                        {activeTab === 'Audit' ? filteredAudit.length : filteredRegistry.length} ENTRIES IN FILTERED SCOPE
                    </span>
                </div>

                <div className="overflow-x-auto min-h-[500px]">
                    {isLoading ? (
                        <div className="py-48 flex flex-col items-center justify-center">
                            <LoaderIcon className="w-16 h-16 text-primary animate-spin" />
                            <p className="mt-6 text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Running Accurate Audit Engine...</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-black text-white uppercase text-[10px] font-black tracking-[0.2em]">
                                {activeTab === 'Audit' ? (
                                    <tr>
                                        <th className="px-8 py-6 border-r border-slate-800">Staff Profile</th>
                                        <th className="px-8 py-6 border-r border-slate-800">Timeline Impact</th>
                                        <th className="px-8 py-6 border-r border-slate-800">Organizational Unit</th>
                                        <th className="px-8 py-6 border-r border-slate-800 text-center">Current Status</th>
                                        <th className="px-8 py-6 text-center">Workflow</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="px-8 py-6 border-r border-slate-800">Staff Member</th>
                                        <th className="px-8 py-6 border-r border-slate-800">Leave Type</th>
                                        <th className="px-8 py-6 border-r border-slate-800">Duration</th>
                                        <th className="px-8 py-6 border-r border-slate-800">Reason / Context</th>
                                        <th className="px-8 py-6 border-r border-slate-800 text-center">Status</th>
                                        <th className="px-8 py-6 text-center">Control</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {activeTab === 'Audit' ? (
                                    filteredAudit.length > 0 ? (
                                        filteredAudit.map((a, i) => (
                                            <tr key={`${a.employee_code}_${a.date}`} className="hover:bg-slate-50/80 transition-all group">
                                                <td className="px-8 py-6 border-r border-slate-100">
                                                    <div className="font-black text-slate-800 uppercase tracking-tight text-base leading-none">{a.employee_name}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold font-mono tracking-widest uppercase mt-2">{a.employee_code}</div>
                                                </td>
                                                <td className="px-8 py-6 border-r border-slate-100 font-black text-slate-700">
                                                    <div className="text-sm">{new Date(a.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                    <div className="text-[10px] text-slate-300 uppercase tracking-widest mt-1 font-bold">{a.day_name}</div>
                                                </td>
                                                <td className="px-8 py-6 border-r border-slate-100">
                                                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                                                        <MasterMgmtIcon className="w-3.5 h-3.5" />
                                                        <span className="text-[11px] font-black uppercase tracking-tight">{a.department}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-400">
                                                        <MapPinIcon className="w-3.5 h-3.5" />
                                                        <span className="text-[10px] font-bold uppercase">{a.location}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 border-r border-slate-100 text-center">
                                                    <span className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 shadow-sm">Marked Absent (A)</span>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <button 
                                                        onClick={() => handleOpenRegularize(a)}
                                                        className="px-8 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all transform active:scale-90"
                                                    >
                                                        Regularize Gap
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={5} className="py-32 text-center text-slate-300 font-black uppercase tracking-[0.3em]">No Gaps Detected in Filtered Set</td></tr>
                                    )
                                ) : (
                                    filteredRegistry.map(req => (
                                        <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-8 py-6 border-r border-slate-100">
                                                <div className="font-black text-slate-800 uppercase tracking-tight leading-none">{req.employee_name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold font-mono tracking-widest uppercase mt-2">{req.employee_code}</div>
                                            </td>
                                            <td className="px-8 py-6 border-r border-slate-100">
                                                <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-black text-[10px] uppercase tracking-widest border border-blue-100">{req.leave_type}</span>
                                            </td>
                                            <td className="px-8 py-6 border-r border-slate-100">
                                                <div className="text-slate-800 font-black tracking-tight">{new Date(req.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} TO {new Date(req.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{req.total_days} FULL DAY(S)</div>
                                            </td>
                                            <td className="px-8 py-6 border-r border-slate-100 max-w-xs">
                                                <p className="text-slate-500 text-[11px] italic font-medium leading-relaxed">"{req.reason || 'Not specified'}"</p>
                                            </td>
                                            <td className="px-8 py-6 border-r border-slate-100 text-center">
                                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                    req.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                                                    req.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>{req.status}</span>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                {req.status === 'Pending' ? (
                                                    <div className="flex justify-center space-x-3">
                                                        <button onClick={() => handleAction(req.id!, 'Approved')} className="p-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all shadow-lg shadow-green-100 active:scale-90"><CheckCircleIcon className="w-5 h-5" /></button>
                                                        <button onClick={() => handleAction(req.id!, 'Rejected')} className="p-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-100 active:scale-90"><XCircleIcon className="w-5 h-5" /></button>
                                                    </div>
                                                ) : <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Locked</span>}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Regularization Modal */}
            {isModalOpen && selectedAbsent && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fadeIn">
                    <div className="bg-white rounded-[40px] shadow-2xl max-w-md w-full p-12 overflow-hidden relative">
                         <div className="absolute top-0 right-0 p-1 bg-primary/5 rounded-bl-[40px]"><CalendarIcon className="w-16 h-16 text-primary/10" /></div>
                        
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Gap Regularization</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">{selectedAbsent.employee_name} &bull; {new Date(selectedAbsent.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short'})}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><XCircleIcon className="w-8 h-8" /></button>
                        </div>

                        <div className="space-y-4">
                            {empBalances.length === 0 ? (
                                <div className="text-center py-10 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                                    <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">No available leave balances found.</p>
                                    <p className="text-[9px] text-slate-300 uppercase mt-1">Visit Leave Ledger to sync credits.</p>
                                </div>
                            ) : (
                                empBalances.map(b => {
                                    const disabled = b.remaining < 1 || isProcessing;
                                    return (
                                        <button 
                                            key={b.leave_type}
                                            disabled={disabled}
                                            onClick={() => handleConvertAbsent(b.leave_type)}
                                            className={`flex items-center justify-between w-full p-5 rounded-2xl border-2 transition-all group ${disabled ? 'opacity-50 grayscale cursor-not-allowed border-slate-50' : 'bg-white border-slate-100 hover:border-primary hover:shadow-xl active:scale-95'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-400 group-hover:text-primary group-hover:bg-primary/5 transition-colors">{b.leave_type}</div>
                                                <div className="text-left">
                                                    <div className="font-black text-slate-800 uppercase tracking-tight text-sm">Convert to {b.leave_type}</div>
                                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Policy Ledger Entry</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-black text-primary leading-none tracking-tighter">{b.remaining}</div>
                                                <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1">Left</div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaveRegister;
