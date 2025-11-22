
import React from 'react';
import type { Employee } from '../types';
import { MoneyIcon, AttendanceIcon, SupportIcon } from '../components/icons';

interface ProfilePageProps {
  currentUser: Employee | null;
}

const DetailRow: React.FC<{ label: string; value: string | number | undefined | null }> = ({ label, value }) => (
  <div className="py-3 border-b border-slate-100 last:border-0 flex flex-col sm:flex-row sm:justify-between">
    <span className="text-sm text-slate-500 font-medium">{label}</span>
    <span className="text-sm text-slate-800 font-semibold mt-1 sm:mt-0 text-right">{value || '-'}</span>
  </div>
);

const SectionCard: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
    <div className="px-6 py-4 border-b border-slate-100 flex items-center space-x-2 bg-slate-50/50">
      {icon && <div className="text-primary">{icon}</div>}
      <h3 className="font-bold text-slate-700">{title}</h3>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

const ProfilePage: React.FC<ProfilePageProps> = ({ currentUser }) => {
  if (!currentUser) {
    return <div className="text-center py-10 text-slate-500">No user profile data available.</div>;
  }

  const initials = `${currentUser.firstName.charAt(0)}${currentUser.lastName.charAt(0)}`;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="relative bg-gradient-to-r from-primary to-blue-600 h-48 rounded-2xl shadow-md overflow-hidden">
        <div className="absolute inset-0 bg-white/10 pattern-grid-lg opacity-30"></div>
        <div className="absolute bottom-0 left-0 w-full p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-end space-y-4 sm:space-y-0 sm:space-x-6">
          <div className="relative">
            {currentUser.photoUrl ? (
              <img 
                src={currentUser.photoUrl} 
                alt="Profile" 
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg object-cover bg-white"
              />
            ) : (
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg bg-white flex items-center justify-center text-4xl font-bold text-primary">
                {initials}
              </div>
            )}
            <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white ${currentUser.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`} title={currentUser.status}></div>
          </div>
          <div className="text-center sm:text-left text-white mb-2">
            <h1 className="text-3xl font-bold">{currentUser.firstName} {currentUser.lastName}</h1>
            <p className="text-blue-100 font-medium mt-1">{currentUser.designation} &bull; {currentUser.department}</p>
            <p className="text-xs text-blue-200 mt-1 opacity-80">{currentUser.employeeCode}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-16">
        
        {/* Left Column */}
        <div className="space-y-6">
          <SectionCard title="Contact Information" icon={<SupportIcon className="w-5 h-5" />}>
            <DetailRow label="Email" value={currentUser.email} />
            <DetailRow label="Phone" value={currentUser.phone} />
            <DetailRow label="Present Address" value={currentUser.presentAddress} />
            <DetailRow label="Permanent Address" value={currentUser.permanentAddress} />
          </SectionCard>

          <SectionCard title="Bank Details" icon={<MoneyIcon className="w-5 h-5" />}>
            <DetailRow label="Bank Name" value={currentUser.bankName} />
            <DetailRow label="Account No" value={currentUser.accountNo} />
            <DetailRow label="IFSC Code" value={currentUser.ifscCode} />
            <DetailRow label="Payment Mode" value={currentUser.modeOfPayment} />
          </SectionCard>
        </div>

        {/* Middle Column */}
        <div className="space-y-6">
          <SectionCard title="Personal Details" icon={<AttendanceIcon className="w-5 h-5" />}>
            <DetailRow label="Date of Birth" value={currentUser.dateOfBirth} />
            <DetailRow label="Gender" value={currentUser.gender} />
            <DetailRow label="Father's Name" value={currentUser.fatherName} />
            <DetailRow label="Mother's Name" value={currentUser.motherName} />
          </SectionCard>

          <SectionCard title="Official Info" icon={<SupportIcon className="w-5 h-5" />}>
            <DetailRow label="Employee Code" value={currentUser.employeeCode} />
            <DetailRow label="Date of Joining" value={currentUser.dateOfJoining} />
            <DetailRow label="Work Premises" value={currentUser.workPremises} />
            <DetailRow label="Sub Department" value={currentUser.subDepartment} />
            <DetailRow label="Location" value={currentUser.location} />
            <DetailRow label="Sub Location" value={currentUser.subLocation} />
            <DetailRow label="Manager" value={currentUser.managerName} />
            {currentUser.contractorName && <DetailRow label="Contractor" value={currentUser.contractorName} />}
          </SectionCard>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
           <SectionCard title="Statutory Info" icon={<MoneyIcon className="w-5 h-5" />}>
            <DetailRow label="UAN No" value={currentUser.uanNo} />
            <DetailRow label="ESIC No" value={currentUser.esicNo} />
            <DetailRow label="User Type" value={currentUser.userType} />
            <DetailRow label="Role" value={currentUser.userRole} />
          </SectionCard>

          <div className="bg-blue-50 rounded-xl p-6 border border-blue-100 text-center">
             <h3 className="text-primary font-bold mb-2">Need to update info?</h3>
             <p className="text-sm text-slate-600 mb-4">Contact the HR department to request changes to your profile details.</p>
             <button className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors shadow-sm w-full">
                Request Update
             </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfilePage;
