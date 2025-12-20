
import React from 'react';
import { 
    DocumentCheckIcon, ComplianceIcon, MoneyIcon, AttendanceIcon, PayrollIcon, CreditCardIcon
} from '../../components/icons';

interface PayrollDashboardProps {
    onNavigate: (view: string) => void;
}

const PayrollCard: React.FC<{ title: string; icon: React.ElementType; onClick: () => void; isNew?: boolean }> = ({ title, icon: Icon, onClick, isNew }) => (
    <div onClick={onClick} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg hover:border-primary hover:-translate-y-1 transition-all duration-300 group relative">
        {isNew && <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full animate-pulse">NEW</span>}
        <div className="bg-primary/10 p-4 rounded-full mb-4 transition-colors group-hover:bg-primary">
            <Icon className="w-8 h-8 text-primary transition-colors group-hover:text-white" />
        </div>
        <h3 className="font-semibold text-slate-700 group-hover:text-primary">{title}</h3>
    </div>
);

const PayrollDashboard: React.FC<PayrollDashboardProps> = ({ onNavigate }) => {
    return (
        <div>
            <h1 className="text-3xl font-bold text-slate-800">Payroll</h1>
            <p className="text-slate-600 mt-2">Manage salary structures, compliance, and processing.</p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <PayrollCard title="Salary Structure" icon={DocumentCheckIcon} onClick={() => onNavigate('Salary Structure')} />
                <PayrollCard title="Compliances" icon={ComplianceIcon} onClick={() => onNavigate('Compliances')} />
                <PayrollCard title="Deductions" icon={MoneyIcon} onClick={() => onNavigate('Deductions')} />
                <PayrollCard title="Earnings" icon={MoneyIcon} onClick={() => onNavigate('Earnings')} />
                <PayrollCard title="Employer Additional" icon={MoneyIcon} onClick={() => onNavigate('Employer Additional')} />
                <PayrollCard title="Prepare Attendance" icon={AttendanceIcon} onClick={() => onNavigate('Prepare Attendance')} />
                <PayrollCard title="Salary Prepare" icon={PayrollIcon} onClick={() => onNavigate('Salary Prepare')} />
                <PayrollCard title="Salary Dashboard" icon={PayrollIcon} onClick={() => onNavigate('Salary Dashboard')} />
                <PayrollCard title="Staff Advance or Loan" icon={CreditCardIcon} onClick={() => onNavigate('Staff Advance or Loan')} />
            </div>
        </div>
    );
};

export default PayrollDashboard;
