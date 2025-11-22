

import React from 'react';
import { MasterMgmtIcon } from '../components/icons';
import type { Page } from '../App';

interface MasterManagementProps {
  setActivePage: (page: Page) => void;
}

const InfoCard: React.FC<{ title: string; onClick?: () => void }> = ({ title, onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center transition-all duration-300 group ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-primary hover:-translate-y-1' : ''}`}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : -1}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
        <div className="bg-primary/10 p-4 rounded-full mb-4 transition-colors group-hover:bg-primary">
             <MasterMgmtIcon className="w-8 h-8 text-primary transition-colors group-hover:text-white" />
        </div>
        <h3 className="font-semibold text-slate-700 text-lg group-hover:text-primary">{title}</h3>
    </div>
);


const MasterManagement: React.FC<MasterManagementProps> = ({ setActivePage }) => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800">Master Management</h1>
      <p className="text-slate-600 mt-2">Central hub for managing all core HR data. Click a category to begin.</p>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <InfoCard title="On-Roll Employees" onClick={() => setActivePage('On-Roll Employees')} />
        <InfoCard title="Contractual Employees" onClick={() => setActivePage('Contractual Employees')} />
        <InfoCard title="Department" onClick={() => setActivePage('Department')} />
        <InfoCard title="Designation" onClick={() => setActivePage('Designation')} />
        <InfoCard title="Sub Department" onClick={() => setActivePage('Sub Department')} />
        <InfoCard title="Work Premises" onClick={() => setActivePage('Work Premises')} />
        <InfoCard title="Location" onClick={() => setActivePage('Location')} />
        <InfoCard title="Sub Location" onClick={() => setActivePage('Sub Location')} />
        <InfoCard title="Role Management" onClick={() => setActivePage('Role Management')} />
      </div>
    </div>
  );
};

export default MasterManagement;