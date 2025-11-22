
import React from 'react';
import {
  DashboardIcon, MasterMgmtIcon, AttendanceIcon, ShiftIcon,
  LeaveIcon, RequestIcon, PayrollIcon, ReportsIcon,
  ComplianceIcon, SupportIcon, MobileIcon
} from './icons';
import type { Page } from '../App';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

const menuItems: { name: Page; icon: React.ReactNode }[] = [
  { name: 'Dashboards', icon: <DashboardIcon className="w-6 h-6" /> },
  { name: 'Master Management', icon: <MasterMgmtIcon className="w-6 h-6" /> },
  { name: 'Attendance Management', icon: <AttendanceIcon className="w-6 h-6" /> },
  { name: 'Shift Management', icon: <ShiftIcon className="w-6 h-6" /> },
  { name: 'Leave Management', icon: <LeaveIcon className="w-6 h-6" /> },
  { name: 'Request', icon: <RequestIcon className="w-6 h-6" /> },
  { name: 'Payroll', icon: <PayrollIcon className="w-6 h-6" /> },
  { name: 'Reports', icon: <ReportsIcon className="w-6 h-6" /> },
  { name: 'Compliance Management', icon: <ComplianceIcon className="w-6 h-6" /> },
  { name: 'Support', icon: <SupportIcon className="w-6 h-6" /> },
  { name: 'Mobile Attendance', icon: <MobileIcon className="w-6 h-6" /> },
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, isCollapsed, onToggle }) => {
  return (
    <aside className={`${isCollapsed ? 'w-25' : 'w-64'} flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-300`}>
      <div className="h-16 flex items-center justify-between border-b border-slate-200 px-4">
        {!isCollapsed && (
          <h1 className="text-2xl font-bold text-primary">OnTime<span className="font-light text-slate-500">attendance</span></h1>
        )}
        <button 
          onClick={onToggle}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = activePage === item.name;
          return (
            <a
              key={item.name}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActivePage(item.name);
              }}
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} p-3 rounded-lg text-sm transition-all duration-200 group relative ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title={isCollapsed ? item.name : ''}
            >
                <div className={`absolute left-0 h-6 w-1 rounded-r-full transition-all ${isActive ? 'bg-primary' : 'bg-transparent'}`}></div>
                {item.icon}
                {!isCollapsed && <span>{item.name}</span>}
            </a>
          );
        })}
      </nav>
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-200">
            <p className="text-xs text-center text-slate-400">
                © {new Date().getFullYear()} On Time attendance.
            </p>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
