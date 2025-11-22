
import React from 'react';
import { XCircleIcon, MoneyIcon, SupportIcon, AttendanceIcon, MasterMgmtIcon, PrinterIcon, UserCircleIcon } from './icons';
import type { Employee } from '../types';

interface ViewEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

const DetailItem: React.FC<{ label: string; value: string | number | null | undefined }> = ({ label, value }) => (
    <div className="flex flex-col pb-3 border-b border-slate-100 last:border-0">
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</span>
        <span className="text-sm text-slate-800 font-semibold mt-1 break-words">{value || '-'}</span>
    </div>
);

const Section: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden h-full shadow-sm">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-slate-700 text-sm uppercase">{title}</h3>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {children}
        </div>
    </div>
);

const ViewEmployeeModal: React.FC<ViewEmployeeModalProps> = ({ isOpen, onClose, employee }) => {
    if (!isOpen || !employee) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print-bg">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn" id="printable-modal">
                {/* Header */}
                <div className="relative bg-slate-800 text-white p-6 flex-shrink-0">
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors no-print"
                    >
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                    
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        <div className="relative flex-shrink-0">
                            {employee.photoUrl && !employee.photoUrl.includes('ui-avatars.com') ? (
                                <img 
                                    src={employee.photoUrl} 
                                    alt="Profile" 
                                    className="w-24 h-24 rounded-full border-4 border-white/20 object-cover shadow-lg bg-slate-700"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full border-4 border-white/20 shadow-lg bg-slate-700 flex items-center justify-center text-slate-300">
                                    <UserCircleIcon className="w-16 h-16" />
                                </div>
                            )}
                            {/* Fallback element if image fails to load, usually hidden */}
                            <div className="hidden w-24 h-24 rounded-full border-4 border-white/20 shadow-lg bg-slate-700 flex items-center justify-center text-slate-300 absolute top-0 left-0">
                                <UserCircleIcon className="w-16 h-16" />
                            </div>

                            <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-slate-800 ${employee.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`} title={employee.status}></div>
                        </div>
                        <div className="text-center sm:text-left">
                            <h2 className="text-2xl font-bold">{employee.firstName} {employee.lastName}</h2>
                            <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1 mt-1 text-slate-300 text-sm">
                                <span className="flex items-center gap-1">
                                    <span className="opacity-70">Code:</span> 
                                    <span className="text-white font-mono">{employee.employeeCode}</span>
                                </span>
                                <span className="hidden sm:inline">&bull;</span>
                                <span className="text-white">{employee.designation}</span>
                                <span className="hidden sm:inline">&bull;</span>
                                <span className="text-white">{employee.department}</span>
                            </div>
                            <div className="mt-3 flex justify-center sm:justify-start gap-2">
                                <span className="px-2.5 py-1 rounded bg-white/10 text-xs font-medium border border-white/10">{employee.userType}</span>
                                <span className="px-2.5 py-1 rounded bg-white/10 text-xs font-medium border border-white/10">{employee.gender}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Scrollable */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        <Section title="Personal Information" icon={AttendanceIcon}>
                            <DetailItem label="First Name" value={employee.firstName} />
                            <DetailItem label="Middle Name" value={employee.middleName} />
                            <DetailItem label="Last Name" value={employee.lastName} />
                            <DetailItem label="Date of Birth" value={employee.dateOfBirth} />
                            <DetailItem label="Father's Name" value={employee.fatherName} />
                            <DetailItem label="Mother's Name" value={employee.motherName} />
                        </Section>

                        <Section title="Contact Details" icon={SupportIcon}>
                            <DetailItem label="Email Address" value={employee.email} />
                            <DetailItem label="Phone Number" value={employee.phone} />
                            <div className="sm:col-span-2">
                                <DetailItem label="Current Address" value={employee.presentAddress} />
                            </div>
                            <div className="sm:col-span-2">
                                <DetailItem label="Permanent Address" value={employee.permanentAddress} />
                            </div>
                        </Section>

                        <Section title="Employment Details" icon={MasterMgmtIcon}>
                            <DetailItem label="Date of Joining" value={employee.dateOfJoining} />
                            <DetailItem label="Date of Leaving" value={employee.dateOfLeaving} />
                            <DetailItem label="Designation" value={employee.designation} />
                            <DetailItem label="Department" value={employee.department} />
                            <DetailItem label="Sub Department" value={employee.subDepartment} />
                            <DetailItem label="Manager" value={employee.managerName} />
                            <DetailItem label="Work Premises" value={employee.workPremises} />
                            <DetailItem label="Role" value={employee.userRole} />
                            {employee.contractorName && <DetailItem label="Contractor" value={employee.contractorName} />}
                        </Section>

                        <Section title="Location & Access" icon={SupportIcon}>
                            <DetailItem label="Assigned Location" value={employee.location} />
                            <DetailItem label="Sub Location" value={employee.subLocation} />
                            <DetailItem label="Shift ID" value={employee.shiftId} />
                            <DetailItem label="App Login Access" value={employee.appLoginAccess ? 'Enabled' : 'Disabled'} />
                            <DetailItem label="Attendance View" value={employee.attendanceViewAccess ? 'Enabled' : 'Disabled'} />
                        </Section>

                        <Section title="Bank & Statutory" icon={MoneyIcon}>
                            <DetailItem label="Bank Name" value={employee.bankName} />
                            <DetailItem label="Account Number" value={employee.accountNo} />
                            <DetailItem label="IFSC Code" value={employee.ifscCode} />
                            <DetailItem label="Payment Mode" value={employee.modeOfPayment} />
                            <DetailItem label="UAN Number" value={employee.uanNo} />
                            <DetailItem label="ESIC Number" value={employee.esicNo} />
                        </Section>

                    </div>
                </div>
                
                {/* Footer Actions */}
                <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 no-print">
                    <button 
                        onClick={handlePrint}
                        className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark border border-transparent rounded-lg transition-colors shadow-sm flex items-center gap-2"
                    >
                        <PrinterIcon className="w-4 h-4" />
                        Print / Download
                    </button>
                    <button 
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ViewEmployeeModal;
