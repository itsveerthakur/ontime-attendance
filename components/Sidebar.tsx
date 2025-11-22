import React from 'react';
import {
  DashboardIcon, MasterMgmtIcon, AttendanceIcon, ShiftIcon,
  LeaveIcon, RequestIcon, PayrollIcon, ReportsIcon,
  ComplianceIcon, SupportIcon
} from './icons';
import type { Page } from '../App';


interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
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
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
      <div className="h-16 flex items-center justify-center border-b border-slate-200 px-4">
        <h1 className="text-2xl font-bold text-primary">OnTime<span className="font-light text-slate-500">attendance</span></h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
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
              className={`flex items-center space-x-3 p-3 rounded-lg text-sm transition-all duration-200 group ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
                <div className={`absolute left-0 h-6 w-1 rounded-r-full transition-all ${isActive ? 'bg-primary' : 'bg-transparent'}`}></div>
                {item.icon}
                <span>{item.name}</span>
            </a>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-200">
          <p className="text-xs text-center text-slate-400">
              © {new Date().getFullYear()} On Time attendance.
          </p>
      </div>
    </aside>
  );
};

export default Sidebar;