
import React, { useState } from 'react';
import { RequestIcon, ChevronRightIcon } from '../components/icons';
import LeaveRequestModule from './request/LeaveRequestModule';

const Request: React.FC = () => {
  const [activeView, setActiveView] = useState<'Dashboard' | 'Leave'>('Dashboard');

  if (activeView === 'Leave') {
    return <LeaveRequestModule onBack={() => setActiveView('Dashboard')} />;
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center text-sm text-slate-500 mb-8">
          <span>Home</span>
          <ChevronRightIcon className="w-4 h-4 mx-2 text-slate-300" />
          <span className="font-bold text-slate-800 tracking-tight uppercase">Requests</span>
      </div>

      <div className="mb-10">
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase leading-none">Employee Requests</h1>
          <p className="text-slate-500 mt-2 text-lg font-medium">Self-service portal for attendance, leaves, and workplace requests.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
        <RequestCard title="Leave Requests" onClick={() => setActiveView('Leave')} />
        <RequestCard title="Onduty" />
        <RequestCard title="Overtime" />
        <RequestCard title="Work From Home" />
        <RequestCard title="Work From Office" />
        <RequestCard title="Attendance Regularization" />
        <RequestCard title="Gate Pass" />
      </div>
    </div>
  );
};

const RequestCard: React.FC<{ title: string; onClick?: () => void }> = ({ title, onClick }) => (
    <div 
        onClick={onClick}
        className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-2xl hover:border-primary/20 hover:-translate-y-2 transition-all duration-300 group active:scale-95"
    >
        <div className="bg-primary/5 p-5 rounded-2xl mb-6 transition-colors group-hover:bg-primary">
             <RequestIcon className="w-10 h-10 text-primary transition-colors group-hover:text-white" />
        </div>
        <h3 className="font-black text-slate-700 uppercase tracking-tight text-xs group-hover:text-primary transition-colors">{title}</h3>
    </div>
);

export default Request;
