
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Page } from '../App';
import { 
    ChevronRightIcon, ClockIcon, SaveIcon, LoaderIcon, 
    CheckCircleIcon, XCircleIcon, InfoIcon, RefreshIcon, PlusIcon, TrashIcon 
} from '../components/icons';
/* Import shared types from types.ts */
import type { AttendanceRules, CompoundingRule } from '../types';

interface AttendanceConditionsProps {
    setActivePage: (page: Page) => void;
}

const AttendanceConditions: React.FC<AttendanceConditionsProps> = ({ setActivePage }) => {
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
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSqlModal, setShowSqlModal] = useState(false);

    const fetchRules = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.schema('payroll').from('attendance_rules').select('*').eq('id', 1).maybeSingle();
            if (error) {
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    setShowSqlModal(true);
                }
            } else if (data) {
                setRules({
                    id: data.id,
                    in_grace_period: data.in_grace_period ?? 13,
                    out_grace_period: data.out_grace_period ?? 5,
                    late_threshold: data.late_threshold ?? 13,
                    in_short_leave_threshold: data.in_short_leave_threshold ?? 30,
                    out_short_leave_threshold: data.out_short_leave_threshold ?? 120,
                    in_half_day_threshold: data.in_half_day_threshold ?? 120,
                    out_half_day_threshold: data.out_half_day_threshold ?? 240,
                    compounding_rules: data.compounding_rules || []
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload = {
                id: 1,
                in_grace_period: rules.in_grace_period,
                out_grace_period: rules.out_grace_period,
                late_threshold: rules.late_threshold,
                in_short_leave_threshold: rules.in_short_leave_threshold,
                out_short_leave_threshold: rules.out_short_leave_threshold,
                in_half_day_threshold: rules.in_half_day_threshold,
                out_half_day_threshold: rules.out_half_day_threshold,
                compounding_rules: rules.compounding_rules,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.schema('payroll').from('attendance_rules').upsert(payload, { onConflict: 'id' });

            if (error) throw error;
            alert("Rules saved. Note: High thresholds (HD) take priority over lower ones (SL/ED) during calculation.");
            await fetchRules();
        } catch (err: any) {
            alert("Failed to save rules: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const addRule = () => {
        setRules(prev => ({
            ...prev,
            compounding_rules: [...prev.compounding_rules, { in_status: '', out_status: '', result_status: '' }]
        }));
    };

    const removeRule = (index: number) => {
        setRules(prev => ({
            ...prev,
            compounding_rules: prev.compounding_rules.filter((_, i) => i !== index)
        }));
    };

    const updateRule = (index: number, field: keyof CompoundingRule, value: string) => {
        setRules(prev => {
            const next = [...prev.compounding_rules];
            next[index] = { ...next[index], [field]: value.toUpperCase() };
            return { ...prev, compounding_rules: next };
        });
    };

    const getSetupSql = () => `
CREATE TABLE IF NOT EXISTS "payroll"."attendance_rules" (
    id bigint primary key default 1,
    in_grace_period integer default 5,
    out_grace_period integer default 5,
    late_threshold integer default 15,
    in_short_leave_threshold integer default 120,
    out_short_leave_threshold integer default 120,
    in_half_day_threshold integer default 240,
    out_half_day_threshold integer default 240,
    compounding_rules jsonb default '[]',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
INSERT INTO "payroll"."attendance_rules" (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    `.trim();

    return (
        <div className="animate-fadeIn pb-10">
            <div className="flex items-center text-sm text-slate-500 mb-6">
                <span onClick={() => setActivePage('Dashboards')} className="cursor-pointer hover:text-primary">Home</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span onClick={() => setActivePage('Attendance Management')} className="cursor-pointer hover:text-primary">Attendance Management</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Functions & Conditions</span>
            </div>

            <div className="mb-10">
                <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase leading-none">Attendance Processing Logic</h1>
                <p className="text-slate-500 mt-2 text-lg">Define how the system calculates statuses for the Monthly Register Summary.</p>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><LoaderIcon className="w-12 h-12 text-primary animate-spin" /></div>
            ) : (
                <form onSubmit={handleSave} className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    <div className="xl:col-span-5 space-y-8">
                        <div className="bg-white rounded-[20px] shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                                <ClockIcon className="w-6 h-6 text-primary" />
                                <h2 className="text-lg font-black text-slate-700 uppercase tracking-tight">Thresholds & Graces</h2>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-2 gap-6 pb-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">IN Grace Period (Mins)</label>
                                        <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20" value={rules.in_grace_period} onChange={e => setRules({...rules, in_grace_period: parseInt(e.target.value) || 0})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">OUT Grace Period (Mins)</label>
                                        <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20" value={rules.out_grace_period} onChange={e => setRules({...rules, out_grace_period: parseInt(e.target.value) || 0})} />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <RuleInput label="Late Arrival Mark (LT)" sub="Mins after shift start to mark as LATE." value={rules.late_threshold} onChange={v => setRules({...rules, late_threshold: v})} />
                                    <RuleInput label="IN Short Leave Mark (SL)" sub="Mins after shift start to mark as SHORT LEAVE." value={rules.in_short_leave_threshold} onChange={v => setRules({...rules, in_short_leave_threshold: v})} />
                                    <RuleInput label="OUT Short Leave Mark (SL)" sub="Mins before shift end to mark as SHORT LEAVE." value={rules.out_short_leave_threshold} onChange={v => setRules({...rules, out_short_leave_threshold: v})} />
                                    <RuleInput label="IN Half Day Mark (HD)" sub="Mins after shift start to mark as HALF DAY." value={rules.in_half_day_threshold} onChange={v => setRules({...rules, in_half_day_threshold: v})} />
                                    <RuleInput label="OUT Half Day Mark (HD)" sub="Mins before shift end to mark as HALF DAY." value={rules.out_half_day_threshold} onChange={v => setRules({...rules, out_half_day_threshold: v})} />
                                </div>
                            </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex gap-4">
                            <InfoIcon className="w-6 h-6 text-blue-500 flex-shrink-0" />
                            <p className="text-blue-800 text-sm font-medium">
                                Logic: Larger thresholds override smaller ones. If a punch is 160m early, it checks Half Day (150m) first and marks HD.
                            </p>
                        </div>
                    </div>
                    <div className="xl:col-span-7 space-y-8 flex flex-col">
                        <div className="bg-white rounded-[20px] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <CheckCircleIcon className="w-6 h-6 text-green-500" />
                                    <h2 className="text-lg font-black text-slate-700 uppercase tracking-tight">Compounding Logic Engine</h2>
                                </div>
                                <button type="button" onClick={addRule} className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center gap-2">
                                    <PlusIcon className="w-4 h-4" /> Add Condition
                                </button>
                            </div>
                            <div className="p-8 flex-1">
                                <div className="space-y-4">
                                    {rules.compounding_rules.length > 0 && (
                                        <div className="grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                            <div className="col-span-4">If In Status Is</div>
                                            <div className="col-span-4">And Out Status Is</div>
                                            <div className="col-span-3">Resulting Status</div>
                                            <div className="col-span-1"></div>
                                        </div>
                                    )}
                                    {rules.compounding_rules.map((rule, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-4 items-center animate-fadeIn p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                                            <div className="col-span-4"><input type="text" placeholder="e.g. SL" value={rule.in_status} onChange={e => updateRule(idx, 'in_status', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 uppercase" /></div>
                                            <div className="col-span-4"><input type="text" placeholder="e.g. P" value={rule.out_status} onChange={e => updateRule(idx, 'out_status', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 uppercase" /></div>
                                            <div className="col-span-3"><input type="text" placeholder="e.g. SL" value={rule.result_status} onChange={e => updateRule(idx, 'result_status', e.target.value)} className="w-full bg-white border border-primary/30 rounded-xl px-4 py-2.5 font-black text-primary outline-none focus:ring-2 focus:ring-primary/20 uppercase shadow-sm" /></div>
                                            <div className="col-span-1 flex justify-center"><button type="button" onClick={() => removeRule(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><TrashIcon className="w-5 h-5" /></button></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                                <button type="button" onClick={() => setActivePage('Attendance Management')} className="px-8 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all shadow-sm">Cancel</button>
                                <button type="submit" disabled={isSaving} className="px-10 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all flex items-center gap-3">
                                    {isSaving ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />}
                                    Commit Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
};

const RuleInput: React.FC<{ label: string; sub: string; value: number; onChange: (v: number) => void }> = ({ label, sub, value, onChange }) => (
    <div className="flex items-center justify-between p-3 px-5 bg-slate-50/50 border border-slate-100 rounded-[18px] group transition-all hover:border-primary/20">
        <div>
            <h3 className="text-[13px] font-black text-slate-700 tracking-tight">{label}</h3>
            <p className="text-[9px] text-slate-400 font-medium">{sub}</p>
        </div>
        <div className="flex items-center gap-3">
            <input type="number" className="w-[72px] bg-white border border-slate-200 rounded-xl px-2 py-2 font-black text-slate-800 text-center outline-none focus:ring-2 focus:ring-primary/20" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)} />
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Min</span>
        </div>
    </div>
);

export default AttendanceConditions;
