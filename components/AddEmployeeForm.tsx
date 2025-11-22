
import React, { useState, useEffect } from 'react';
import { XCircleIcon, LoaderIcon } from './icons';
import type { Employee, Department, Designation, WorkPremise, SubDepartment, Location, SubLocation, Shift, Role } from '../types';
import { supabase } from '../supabaseClient';

interface AddEmployeeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (employee: Omit<Employee, 'id' | 'status'>) => void;
  userType: 'On-Roll' | 'Contractual';
  employeeToEdit?: Employee | null;
}

const initialFormData: Omit<Employee, 'id' | 'status'> = {
  userType: 'On-Roll',
  userRole: '',
  photoUrl: '',
  employeeCode: '',
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  fatherName: '',
  motherName: '',
  gender: '',
  email: '',
  phone: '',
  department: '',
  subDepartment: '',
  designation: '',
  workPremises: '',
  dateOfJoining: '',
  dateOfLeaving: '',
  managerName: '',
  contractorName: '',
  permanentAddress: '',
  presentAddress: '',
  location: '',
  subLocation: '',
  shiftId: null,
  appLoginAccess: false,
  attendanceViewAccess: false,
  loginPassword: '',
  bankName: '',
  ifscCode: '',
  accountNo: '',
  modeOfPayment: '',
  uanNo: '',
  esicNo: '',
};


const InputField: React.FC<{ label: string; name: keyof Omit<Employee, 'id'>; type?: string; placeholder?: string; required?: boolean; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; disabled?: boolean;}> = ({ label, name, type = 'text', placeholder, required = false, value, onChange, disabled }) => (
    <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
        <input name={name} type={type} placeholder={placeholder || label} required={required} value={value} onChange={onChange} disabled={disabled} className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed" />
    </div>
);

const SelectField: React.FC<{ label: string; name: keyof Omit<Employee, 'id'>; children: React.ReactNode; required?: boolean; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; }> = ({ label, name, children, required = false, value, onChange }) => (
     <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
        <select name={name} required={required} value={value} onChange={onChange} className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent">
            {children}
        </select>
    </div>
);

const ToggleSwitch: React.FC<{ label: React.ReactNode; name: keyof Omit<Employee, 'id'>; checked: boolean; onChange: () => void; }> = ({ label, name, checked, onChange }) => (
    <div className="flex items-center justify-between bg-white p-3 border border-slate-300 rounded-lg">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name={name} checked={checked} onChange={onChange} className="sr-only peer" />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-light/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
    </div>
);


const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="pt-6">
        <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-4">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {children}
        </div>
    </div>
);


const AddEmployeeForm: React.FC<AddEmployeeFormProps> = ({ isOpen, onClose, onSave, userType, employeeToEdit }) => {
  const [formData, setFormData] = useState(initialFormData);
  const [isLoading, setIsLoading] = useState(false);

  // State for dropdown data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [workPremises, setWorkPremises] = useState<WorkPremise[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [subLocations, setSubLocations] = useState<SubLocation[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // State for filtered dropdowns
  const [filteredSubDepartments, setFilteredSubDepartments] = useState<SubDepartment[]>([]);
  const [filteredSubLocations, setFilteredSubLocations] = useState<SubLocation[]>([]);
  
  useEffect(() => {
    if (isOpen) {
        const fetchMasterData = async () => {
            setIsLoading(true);
            try {
                const [ depts, desigs, premises, allEmployees, subDepts, locs, subLocs, allShifts, allRoles ] = await Promise.all([
                    supabase.from('departments').select('*').eq('status', 'active'),
                    supabase.from('designations').select('*').eq('status', 'active'),
                    supabase.from('work_premises').select('*').eq('status', 'active'),
                    supabase.from('employees').select('*'),
                    supabase.from('sub_departments').select('*').eq('status', 'active'),
                    supabase.from('locations').select('*').eq('status', 'active'),
                    supabase.from('sub_locations').select('*').eq('status', 'active'),
                    supabase.from('shifts').select('*').eq('status', 'active'),
                    supabase.from('roles').select('*').eq('status', 'active'),
                ]);

                if (depts.error) throw depts.error;
                if (desigs.error) throw desigs.error;
                if (premises.error) throw premises.error;
                if (allEmployees.error) throw allEmployees.error;
                if (subDepts.error) throw subDepts.error;
                if (locs.error) throw locs.error;
                if (subLocs.error) throw subLocs.error;
                if (allShifts.error) throw allShifts.error;
                if (allRoles.error) throw allRoles.error;

                setDepartments(depts.data as Department[]);
                setDesignations(desigs.data as Designation[]);
                setWorkPremises(premises.data as WorkPremise[]);
                setManagers(allEmployees.data as Employee[]);
                setSubDepartments(subDepts.data as SubDepartment[]);
                setLocations(locs.data as Location[]);
                setSubLocations(subLocs.data as SubLocation[]);
                setShifts(allShifts.data as Shift[]);
                setRoles(allRoles.data as Role[]);

            } catch (error: any) {
                console.error("Failed to fetch master data for employee form:", error.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMasterData();
        
        if (employeeToEdit) {
            const safeString = (val: any) => val === null || val === undefined ? '' : val;
            
            setFormData({
                userType: employeeToEdit.userType,
                userRole: safeString(employeeToEdit.userRole),
                photoUrl: safeString(employeeToEdit.photoUrl),
                employeeCode: safeString(employeeToEdit.employeeCode),
                firstName: safeString(employeeToEdit.firstName),
                middleName: safeString(employeeToEdit.middleName),
                lastName: safeString(employeeToEdit.lastName),
                dateOfBirth: safeString(employeeToEdit.dateOfBirth),
                fatherName: safeString(employeeToEdit.fatherName),
                motherName: safeString(employeeToEdit.motherName),
                gender: safeString(employeeToEdit.gender),
                email: safeString(employeeToEdit.email),
                phone: safeString(employeeToEdit.phone),
                department: safeString(employeeToEdit.department),
                subDepartment: safeString(employeeToEdit.subDepartment),
                designation: safeString(employeeToEdit.designation),
                workPremises: safeString(employeeToEdit.workPremises),
                dateOfJoining: safeString(employeeToEdit.dateOfJoining),
                dateOfLeaving: safeString(employeeToEdit.dateOfLeaving),
                managerName: safeString(employeeToEdit.managerName),
                contractorName: safeString(employeeToEdit.contractorName),
                permanentAddress: safeString(employeeToEdit.permanentAddress),
                presentAddress: safeString(employeeToEdit.presentAddress),
                location: safeString(employeeToEdit.location),
                subLocation: safeString(employeeToEdit.subLocation),
                shiftId: employeeToEdit.shiftId,
                appLoginAccess: !!employeeToEdit.appLoginAccess,
                attendanceViewAccess: !!employeeToEdit.attendanceViewAccess,
                loginPassword: safeString(employeeToEdit.loginPassword),
                bankName: safeString(employeeToEdit.bankName),
                ifscCode: safeString(employeeToEdit.ifscCode),
                accountNo: safeString(employeeToEdit.accountNo),
                modeOfPayment: safeString(employeeToEdit.modeOfPayment),
                uanNo: safeString(employeeToEdit.uanNo),
                esicNo: safeString(employeeToEdit.esicNo),
            });
        } else {
            setFormData({ ...initialFormData, userType: userType });
        }
    }
  }, [isOpen, userType, employeeToEdit]);

  useEffect(() => {
      if (formData.department) {
          setFilteredSubDepartments(subDepartments.filter(sd => sd.departmentName === formData.department));
      } else {
          setFilteredSubDepartments([]);
      }
  }, [formData.department, subDepartments]);

  useEffect(() => {
      if (formData.location) {
          setFilteredSubLocations(subLocations.filter(sl => sl.locationName === formData.location));
      } else {
          setFilteredSubLocations([]);
      }
  }, [formData.location, subLocations]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggle = (name: keyof Omit<Employee, 'id'>) => {
      setFormData(prev => ({ ...prev, [name]: !prev[name as keyof typeof prev] }));
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <>
        <div className={`fixed inset-0 bg-black/50 z-20 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
        
        <div className={`fixed top-0 right-0 h-full w-full max-w-4xl bg-slate-50 shadow-2xl z-30 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
                <div className="flex justify-between items-center p-5 border-b border-slate-200 bg-white">
                    <h2 className="text-xl font-bold text-slate-800">{employeeToEdit ? 'Edit' : 'Add New'} {userType} Employee</h2>
                    <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100">
                        <XCircleIcon className="w-8 h-8" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <LoaderIcon className="w-10 h-10 text-primary animate-spin" />
                            <p className="mt-3 text-slate-500 font-medium">Loading master data...</p>
                        </div>
                    ) : (
                        <>
                            <FormSection title="Basic Details">
                                <InputField label="User Type" name="userType" value={formData.userType} onChange={handleChange} disabled />
                                <InputField label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} required />
                                <InputField label="Middle Name" name="middleName" value={formData.middleName} onChange={handleChange} />
                                <InputField label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} required />
                                <InputField label="Date of Birth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} required />
                                <InputField label="Father's Name" name="fatherName" value={formData.fatherName} onChange={handleChange} required />
                                <InputField label="Mother's Name" name="motherName" value={formData.motherName} onChange={handleChange} />
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Employee Photo</label>
                                    <div className="flex items-center space-x-4">
                                        {formData.photoUrl && (
                                            <img src={formData.photoUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                                        )}
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                        />
                                    </div>
                                </div>
                            </FormSection>

                             <FormSection title="Official Details">
                                <InputField label="Employee Code" name="employeeCode" value={formData.employeeCode} onChange={handleChange} required />
                                <SelectField label="User Role" name="userRole" required value={formData.userRole} onChange={handleChange}>
                                    <option value="">Select Role</option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.name}>{role.name}</option>
                                    ))}
                                </SelectField>
                                <SelectField label="Gender" name="gender" required value={formData.gender} onChange={handleChange}>
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </SelectField>
                                <InputField label="Email ID" name="email" type="email" value={formData.email} onChange={handleChange} required />
                                <InputField label="Phone No." name="phone" type="tel" value={formData.phone} onChange={handleChange} required />
                                <SelectField label="Department" name="department" value={formData.department} onChange={handleChange} required>
                                  <option value="">Select Department</option>
                                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                </SelectField>
                                <SelectField label="Sub-Department" name="subDepartment" value={formData.subDepartment} onChange={handleChange}>
                                  <option value="">Select Sub-Department</option>
                                  {filteredSubDepartments.map(sd => <option key={sd.id} value={sd.name}>{sd.name}</option>)}
                                </SelectField>
                                <SelectField label="Designation" name="designation" value={formData.designation} onChange={handleChange} required>
                                  <option value="">Select Designation</option>
                                  {designations.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                </SelectField>
                                <SelectField label="Work Premises" name="workPremises" value={formData.workPremises} onChange={handleChange} required>
                                  <option value="">Select Work Premises</option>
                                  {workPremises.map(wp => <option key={wp.id} value={wp.name}>{wp.name}</option>)}
                                </SelectField>
                                <InputField label="Date of Joining" name="dateOfJoining" type="date" value={formData.dateOfJoining} onChange={handleChange} required />
                                <InputField label="Date of Leaving" name="dateOfLeaving" type="date" value={formData.dateOfLeaving} onChange={handleChange} />
                                <SelectField label="Manager" name="managerName" value={formData.managerName} onChange={handleChange}>
                                  <option value="">Select Manager</option>
                                  {managers.map(m => <option key={m.id} value={`${m.firstName} ${m.lastName}`}>{`${m.firstName} ${m.lastName}`}</option>)}
                                </SelectField>
                                {userType === 'Contractual' && (
                                    <SelectField label="Contractor Name" name="contractorName" value={formData.contractorName || ''} onChange={handleChange}><option>Select Contractor</option></SelectField>
                                )}
                             </FormSection>

                            <FormSection title="Address Details">
                                <InputField label="Permanent Address" name="permanentAddress" value={formData.permanentAddress} onChange={handleChange} required />
                                <InputField label="Present Address" name="presentAddress" value={formData.presentAddress} onChange={handleChange} />
                            </FormSection>

                            <FormSection title="Access & Attendance">
                                <SelectField label="Location (for Geofencing)" name="location" value={formData.location} onChange={handleChange}>
                                  <option value="">Select Location</option>
                                  {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                </SelectField>
                                <SelectField label="Sub-Location (for Geofencing)" name="subLocation" value={formData.subLocation} onChange={handleChange}>
                                  <option value="">Select Sub-Location</option>
                                  {filteredSubLocations.map(sl => <option key={sl.id} value={sl.name}>{sl.name}</option>)}
                                </SelectField>
                                <SelectField label="Shift" name="shiftId" value={String(formData.shiftId || '')} onChange={(e) => setFormData(p => ({...p, shiftId: e.target.value ? Number(e.target.value) : null}))}>
                                  <option value="">Select Shift</option>
                                  {shifts.map(s => <option key={s.id} value={String(s.id)}>{`${s.name} (${s.startTime}-${s.endTime})`}</option>)}
                                </SelectField>
                                <ToggleSwitch 
                                    label={<>App Login Access <span className="text-red-500">*</span></>} 
                                    name="appLoginAccess" 
                                    checked={formData.appLoginAccess} 
                                    onChange={() => handleToggle('appLoginAccess')} 
                                />
                                <InputField 
                                    label="Login Password" 
                                    name="loginPassword" 
                                    value={formData.loginPassword || ''} 
                                    onChange={handleChange} 
                                    required={formData.appLoginAccess}
                                />
                                <ToggleSwitch 
                                    label={<>Attendance View Access <span className="text-red-500">*</span></>} 
                                    name="attendanceViewAccess" 
                                    checked={formData.attendanceViewAccess} 
                                    onChange={() => handleToggle('attendanceViewAccess')} 
                                />
                            </FormSection>

                            <FormSection title="Bank Details">
                                 <InputField label="Bank Name" name="bankName" value={formData.bankName} onChange={handleChange} />
                                 <InputField label="IFSC Code" name="ifscCode" value={formData.ifscCode} onChange={handleChange} />
                                 <InputField label="Account No." name="accountNo" value={formData.accountNo} onChange={handleChange} />
                                 <SelectField label="Mode of Payment" name="modeOfPayment" value={formData.modeOfPayment} onChange={handleChange} required>
                                     <option value="">Select Mode</option>
                                     <option value="Bank Transfer">Bank Transfer</option>
                                     <option value="Cash">Cash</option>
                                     <option value="Cheque">Cheque</option>
                                 </SelectField>
                            </FormSection>
                            
                             <FormSection title="Statutory Details">
                                <InputField label="UAN No." name="uanNo" value={formData.uanNo} onChange={handleChange} />
                                <InputField label="ESIC No." name="esicNo" value={formData.esicNo} onChange={handleChange} />
                            </FormSection>
                        </>
                    )}
                </div>
                
                <div className="p-4 border-t border-slate-200 bg-white flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50">Cancel</button>
                    <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">{employeeToEdit ? 'Update' : 'Save'} Employee</button>
                </div>
            </form>
        </div>
    </>
  );
};

export default AddEmployeeForm;
