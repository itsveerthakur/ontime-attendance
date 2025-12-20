
import React, { useState, useEffect } from 'react';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import type { Employee } from './types';

import Dashboard from './pages/Dashboard';
import MasterManagement from './pages/MasterManagement';
import AttendanceManagement from './pages/AttendanceManagement';
import AttendanceConditions from './pages/AttendanceConditions';
import ShiftManagement from './pages/ShiftRotaManagement';
import LeaveManagement from './pages/LeaveManagement';
import Request from './pages/Request';
import Payroll from './pages/Payroll';
import Reports from './pages/Reports';
import ComplianceManagement from './pages/ComplianceManagement';
import Support from './pages/Support';
import OnRollEmployees from './pages/OnRollEmployees';
import ContractualEmployees from './pages/ContractualEmployees';
import Department from './pages/Department';
import Designation from './pages/Designation';
import SubDepartment from './pages/SubDepartment';
import Location from './pages/Location';
import WorkPremises from './pages/WorkPremises';
import SubLocation from './pages/SubLocation';
import RoleManagement from './pages/RoleManagement';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import MobileAttendance from './pages/MobileAttendance';
import WeeklyOffManagement from './pages/WeeklyOffManagement';

export type Page = 
  | 'Dashboards' 
  | 'Mobile Attendance'
  | 'Master Management' 
  | 'Attendance Management' 
  | 'Attendance Conditions'
  | 'Shift Management' 
  | 'Weekly OFF'
  | 'Leave Management' 
  | 'Request' 
  | 'Payroll'
  | 'Salary Dashboard'
  | 'Reports' 
  | 'Compliance Management' 
  | 'Support'
  | 'On-Roll Employees'
  | 'Contractual Employees'
  | 'Department'
  | 'Designation'
  | 'Sub Department'
  | 'Location'
  | 'Work Premises'
  | 'Sub Location'
  | 'Role Management'
  | 'Profile'
  | 'Settings';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [activePage, setActivePage] = useState<Page>('Dashboards');
  const [payrollKey, setPayrollKey] = useState(0);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setIsAuthenticated(true);
      } catch (e) {
        console.error("Failed to parse saved user", e);
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  const handleLoginSuccess = (user: Employee) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleUpdateUser = (updatedUser: Employee) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('currentUser');
    setActivePage('Dashboards');
  };

  const renderPage = () => {
    switch (activePage) {
      case 'Dashboards':
        return <Dashboard setActivePage={setActivePage} />;
      case 'Mobile Attendance':
        return <MobileAttendance currentUser={currentUser} />;
      case 'Master Management':
        return <MasterManagement setActivePage={setActivePage} />;
      case 'Attendance Management':
        return <AttendanceManagement setActivePage={setActivePage} />;
      case 'Attendance Conditions':
        return <AttendanceConditions setActivePage={setActivePage} />;
      case 'Shift Management':
        return <ShiftManagement />;
      case 'Weekly OFF':
        return <WeeklyOffManagement setActivePage={setActivePage} />;
      case 'Leave Management':
        return <LeaveManagement />;
      case 'Request':
        return <Request />;
      case 'Payroll':
        return <Payroll key={payrollKey} />;
      case 'Salary Dashboard':
        return <Payroll key={payrollKey + 1000} initialView="Salary Dashboard" />;
      case 'Reports':
        return <Reports />;
      case 'Compliance Management':
        return <ComplianceManagement />;
      case 'Support':
        return <Support />;
      case 'On-Roll Employees':
        return <OnRollEmployees setActivePage={setActivePage} />;
      case 'Contractual Employees':
        return <ContractualEmployees setActivePage={setActivePage} />;
      case 'Department':
        return <Department setActivePage={setActivePage} />;
      case 'Designation':
        return <Designation setActivePage={setActivePage} />;
      case 'Sub Department':
        return <SubDepartment setActivePage={setActivePage} />;
      case 'Location':
        return <Location setActivePage={setActivePage} />;
      case 'Work Premises':
        return <WorkPremises setActivePage={setActivePage} />;
      case 'Sub Location':
        return <SubLocation setActivePage={setActivePage} />;
      case 'Role Management':
        return <RoleManagement setActivePage={setActivePage} />;
      case 'Profile':
        return <ProfilePage currentUser={currentUser} onUpdateUser={handleUpdateUser} />;
      case 'Settings':
        return <SettingsPage />;
      default:
        return <Dashboard setActivePage={setActivePage} />;
    }
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const handlePageChange = (page: Page) => {
    if (page === 'Payroll') {
      setPayrollKey(prev => prev + 1);
    }
    setActivePage(page);
  };

  return (
    <MainLayout 
      activePage={activePage} 
      setActivePage={handlePageChange} 
      currentUser={currentUser}
      onLogout={handleLogout}
    >
      {renderPage()}
    </MainLayout>
  );
};

export default App;
