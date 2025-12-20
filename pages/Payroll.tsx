
import React, { useState, useEffect } from 'react';
import PayrollDashboard from './payroll/PayrollDashboard';
import Earnings from './payroll/Earnings';
import Deductions from './payroll/Deductions';
import EmployerAdditional from './payroll/EmployerAdditional';
import SalaryStructure from './payroll/SalaryStructure';
import Compliances from './payroll/Compliances';
import PrepareAttendance from './payroll/PrepareAttendance';
import SalaryPrepare from './payroll/SalaryPrepare';
import FinalizeSalary from './payroll/FinalizeSalary';
import StaffLoans from './payroll/StaffLoans';
import ExcelPayslipGenerator from './ExcelPayslipGenerator';

interface PayrollProps {
    initialView?: string;
}

const Payroll: React.FC<PayrollProps> = ({ initialView }) => {
  const [activeView, setActiveView] = useState<string>(initialView || 'Dashboard');

  useEffect(() => {
      setActiveView(initialView || 'Dashboard');
  }, [initialView]);

  const renderView = () => {
      switch (activeView) {
          case 'Earnings':
              return <Earnings onBack={() => setActiveView('Dashboard')} />;
          case 'Deductions':
              return <Deductions onBack={() => setActiveView('Dashboard')} />;
          case 'Employer Additional':
              return <EmployerAdditional onBack={() => setActiveView('Dashboard')} />;
          case 'Salary Structure':
              return <SalaryStructure onBack={() => setActiveView('Dashboard')} />;
          case 'Compliances':
              return <Compliances onBack={() => setActiveView('Dashboard')} />;
          case 'Prepare Attendance':
              return <PrepareAttendance onBack={() => setActiveView('Dashboard')} />;
          case 'Salary Prepare':
              return <SalaryPrepare onBack={() => setActiveView('Dashboard')} />;
          case 'Salary Dashboard':
              return <FinalizeSalary onBack={() => setActiveView('Dashboard')} />;
          case 'Staff Advance or Loan':
              return <StaffLoans onBack={() => setActiveView('Dashboard')} />;
          case 'Excel Payslip Generator':
              return (
                <div>
                   <button onClick={() => setActiveView('Dashboard')} className="mb-4 text-sm font-bold text-primary hover:underline flex items-center">
                       <span className="mr-1">←</span> Back to Payroll Dashboard
                   </button>
                   <ExcelPayslipGenerator />
                </div>
              );
          case 'Dashboard':
          default:
              return <PayrollDashboard onNavigate={setActiveView} />;
      }
  };

  return (
    <div className="fade-in">
        {renderView()}
    </div>
  );
};

export default Payroll;
