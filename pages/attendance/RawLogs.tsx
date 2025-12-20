
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { LoaderIcon } from '../../components/icons';

const RawLogs: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            setIsLoading(true);
            const { data } = await supabase.from('attendance_logs').select('*').order('punch_time', { ascending: false });
            setLogs(data || []);
            setIsLoading(false);
        };
        fetchLogs();
    }, []);

    return (
        <div className="overflow-x-auto custom-scrollbar">
            {isLoading ? (
                <div className="py-20 flex justify-center"><LoaderIcon className="w-12 h-12 text-primary animate-spin" /></div>
            ) : (
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
                        {logs.map((p) => (
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
    );
};

export default RawLogs;
