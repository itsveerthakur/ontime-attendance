
import React, { useState } from 'react';
import { 
    ChevronRightIcon, PlusIcon, XCircleIcon, 
    ComplianceIcon, DocumentCheckIcon, BookOpenIcon
} from '../components/icons';

// Import split modules
import LeaveRegister from './leave/LeaveRegister';
import LeaveTypes from './leave/LeaveTypes';
import LeaveRules from './leave/LeaveRules';
import LeaveLedger from './leave/LeaveLedger';

const LeaveManagement: React.FC = () => {
    const [activeView, setActiveView] = useState<'Dashboard' | 'Register' | 'Types' | 'Rules' | 'Ledger'>('Dashboard');

    // Dashboard Navigation
    if (activeView === 'Dashboard') {
        return (
            <div className="max-w-7xl mx-auto animate-fadeIn">
                <div className="flex items-center text-sm text-slate-500 mb-8">
                    <span>Home</span><ChevronRightIcon className="w-4 h-4 mx-2 text-slate-300" />
                    <span className="font-black text-slate-800 tracking-tight uppercase">Leave Management</span>
                </div>
                <div className="mb-10">
                    <h1 className="text-5xl font-black text-slate-800 tracking-tighter uppercase leading-none">Leave Management</h1>
                    <p className="text-slate-500 mt-2 text-lg font-medium">Administer employee leave policies, requests, and balances.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <ModuleCard title="Leaves Register" icon={<DocumentCheckIcon className="w-10 h-10" />} onClick={() => setActiveView('Register')} />
                    <ModuleCard title="Leave Type" icon={<PlusIcon className="w-10 h-10" />} onClick={() => setActiveView('Types')} />
                    <ModuleCard title="Leave Rules" icon={<ComplianceIcon className="w-10 h-10" />} onClick={() => setActiveView('Rules')} />
                    <ModuleCard title="Leave Ledger" icon={<BookOpenIcon className="w-10 h-10" />} onClick={() => setActiveView('Ledger')} />
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-[24px] shadow-sm border border-slate-200">
                <div className="flex items-center space-x-6">
                    <button onClick={() => setActiveView('Dashboard')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-all border border-slate-200 group">
                        <ChevronRightIcon className="w-6 h-6 rotate-180 group-hover:text-primary transition-colors" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none">
                            {activeView === 'Register' ? 'Leaves Register' : 
                             activeView === 'Types' ? 'Leave Types Grid' : 
                             activeView === 'Rules' ? 'Leave Rules Engine' : 'Leave Balance Ledger'}
                        </h1>
                        <p className="text-xs text-slate-400 uppercase font-black tracking-[0.2em] mt-1">Leave Management System</p>
                    </div>
                </div>
            </div>

            {/* Render Modular Views */}
            {activeView === 'Register' && <LeaveRegister />}
            {activeView === 'Types' && <LeaveTypes />}
            {activeView === 'Rules' && <LeaveRules />}
            {activeView === 'Ledger' && <LeaveLedger />}
        </div>
    );
};

const ModuleCard: React.FC<{ title: string; icon: React.ReactNode; onClick: () => void }> = ({ title, icon, onClick }) => (
    <div onClick={onClick} className="bg-white p-10 rounded-[32px] shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center transition-all duration-300 group cursor-pointer hover:shadow-2xl hover:border-primary/20 hover:-translate-y-2 active:scale-95">
        <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center mb-6 transition-all group-hover:bg-primary group-hover:rotate-6">
             <div className="text-primary group-hover:text-white transition-colors">
                {icon}
             </div>
        </div>
        <h3 className="font-black text-slate-700 text-sm group-hover:text-primary transition-colors tracking-tight uppercase leading-tight">{title}</h3>
    </div>
);

export default LeaveManagement;
