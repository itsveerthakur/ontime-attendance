
import React, { useState, useRef, useEffect } from 'react';
import type { Page } from '../App';
import type { Employee } from '../types';
import { supabase } from '../supabaseClient';
import { 
    SearchIcon, ChevronDownIcon, PlusIcon, ImportIcon, FilterIcon, 
    DotsVerticalIcon, PencilIcon, AttendanceSummaryIcon, CheckCircleIcon, XCircleIcon, TrashIcon, LoaderIcon, EyeIcon, DownloadIcon, UserCircleIcon
} from '../components/icons';
import AddEmployeeForm from '../components/AddEmployeeForm';
import ViewEmployeeModal from '../components/ViewEmployeeModal';

// Declare XLSX for global usage
declare const XLSX: any;

interface ContractualEmployeesProps {
  setActivePage: (page: Page) => void;
}

const StatusBadge: React.FC<{ status: 'Active' | 'Inactive' }> = ({ status }) => (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
        status === 'Active' 
        ? 'bg-green-100 text-green-800' 
        : 'bg-red-100 text-red-800'
    }`}>
        <span className={`h-2 w-2 mr-1.5 rounded-full ${status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
        {status}
    </span>
);

// Utility to parse dates from Excel (Serial Number or String)
const processExcelDate = (value: any): string | null => {
    if (!value) return null;
    
    // Case 1: Excel Serial Number
    if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
             return date.toISOString().split('T')[0];
        }
    }
    
    // Case 2: String Date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }
    
    return null;
};

const ContractualEmployees: React.FC<ContractualEmployeesProps> = ({ setActivePage }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isAddFormOpen, setIsAddFormOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // Filter & Search States
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const [filters, setFilters] = useState({ department: '', status: '' });
    const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);

    const actionMenuRef = useRef<HTMLDivElement>(null);
    const filterMenuRef = useRef<HTMLDivElement>(null);

    const fetchEmployees = async (background = false) => {
        if (!background) setIsLoading(true);
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('userType', 'Contractual')
            .order('employeeCode', { ascending: true });

        if (error) {
            console.error("Error fetching contractual employees:", error.message);
        } else {
            const emps = data as Employee[] || [];
            setEmployees(emps);
            // Extract unique departments for filter
            const depts = Array.from(new Set(emps.map(e => e.department).filter(Boolean))).sort();
            setAvailableDepartments(depts);
        }
        if (!background) setIsLoading(false);
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const handleSaveEmployee = async (employeeData: Omit<Employee, 'id' | 'status'>) => {
        try {
            const sanitizedData = {
                ...employeeData,
                dateOfBirth: (employeeData.dateOfBirth && employeeData.dateOfBirth.trim() !== '') ? employeeData.dateOfBirth : null,
                dateOfJoining: (employeeData.dateOfJoining && employeeData.dateOfJoining.trim() !== '') ? employeeData.dateOfJoining : null,
                dateOfLeaving: (employeeData.dateOfLeaving && employeeData.dateOfLeaving.trim() !== '') ? employeeData.dateOfLeaving : null,
                status: editingEmployee ? editingEmployee.status : 'Active',
                photoUrl: employeeData.photoUrl || editingEmployee?.photoUrl || '',
            };

            if (editingEmployee && editingEmployee.employeeCode) {
                 const { error } = await supabase.from('employees').update(sanitizedData).eq('employeeCode', editingEmployee.employeeCode);
                 if (error) throw error;
            } else {
                 const { error } = await supabase.from('employees').insert([sanitizedData]);
                 if (error) throw error;
            }
           
            fetchEmployees(true);
        } catch (error: any) {
            console.error("Failed to save employee:", error.message);
            alert(`Failed to save employee: ${error.message}`);
        }
    };

    const handleDeleteEmployee = async (code: string) => {
        if (code && window.confirm('Are you sure you want to delete this employee?')) {
            setOpenActionMenuId(null);
            
            const { error } = await supabase.from('employees').delete().eq('employeeCode', code);
            if (error) console.error("Error deleting employee:", error.message);
            else fetchEmployees(true);
        }
    };

    const handleToggleStatus = async (employee: Employee) => {
        if (employee.employeeCode) {
            const newStatus = employee.status === 'Active' ? 'Inactive' : 'Active';
            
            const { error } = await supabase
                .from('employees')
                .update({ status: newStatus })
                .eq('employeeCode', employee.employeeCode);

            if (error) console.error("Error updating status:", error.message);
            else {
                fetchEmployees(true);
                setOpenActionMenuId(null);
            }
        }
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'Employee Code', 'First Name', 'Middle Name', 'Last Name', 'Gender', 'Email', 'Phone',
            'Department', 'Sub Department', 'Designation', 'Work Premises', 'Shift',
            'Contractor Name',
            'Date of Joining', 'Date of Birth', 'Father Name', 'Mother Name',
            'Permanent Address', 'Present Address',
            'Bank Name', 'Account No', 'IFSC Code', 'Payment Mode',
            'UAN No', 'ESIC No', 'Role', 'Location', 'Sub Location'
        ];
        
        const sampleData = [
            'CON001', 'Jane', '', 'Smith', 'Female', 'jane.smith@example.com', '9876543210',
            'Operations', 'Logistics', 'Helper', 'Warehouse A', 'General Shift',
            'ABC Manpower Services',
            '2023-03-01', '1995-08-15', 'John Smith', 'Alice Smith',
            '456 Lane, City', '456 Lane, City',
            'SBI', '987654321012', 'SBIN0001234', 'Bank Transfer',
            '100100100100', '200200200200', 'Employee', 'Delhi', 'Okhla'
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, sampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Import Template");
        XLSX.writeFile(wb, "Contractual_Employee_Template.xlsx");
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // 1. Fetch Shifts for Mapping
                const { data: shiftsData, error: shiftError } = await supabase
                    .from('shifts')
                    .select('id, name')
                    .eq('status', 'active');
                
                if (shiftError) throw shiftError;

                if (!shiftsData || shiftsData.length === 0) {
                    alert("No active shifts found in the system. Please create at least one shift in 'Shift Management' before importing employees.");
                    return;
                }

                const shiftMap = new Map<string, number>();
                shiftsData.forEach((s: any) => shiftMap.set(s.name.toLowerCase().trim(), s.id));
                const defaultShiftId = shiftsData[0].id; // Fallback to first active shift

                const existingCodes = new Set(employees.map(e => e.employeeCode.toLowerCase()));
                const validEmployees = [];
                const skippedCodes = [];

                for (const row of data as any[]) {
                    const getStr = (keys: string[]) => {
                        for (const k of keys) if (row[k]) return String(row[k]).trim();
                        return '';
                    };

                    const code = getStr(['Employee Code', 'Code', 'EmpCode']);
                    const firstName = getStr(['First Name', 'FirstName']);
                    const email = getStr(['Email', 'Email ID']);
                    
                    if (code && firstName) {
                        const trimmedCode = code;
                        
                        if (existingCodes.has(trimmedCode.toLowerCase())) {
                            skippedCodes.push(trimmedCode);
                        } else {
                            const doj = processExcelDate(row['Date of Joining'] || row['DOJ']) || new Date().toISOString().split('T')[0];
                            const dob = processExcelDate(row['Date of Birth'] || row['DOB']) || null;

                            // Resolve Shift
                            const shiftName = getStr(['Shift', 'Shift Name']);
                            let shiftId = defaultShiftId;
                            if (shiftName && shiftMap.has(shiftName.toLowerCase())) {
                                shiftId = shiftMap.get(shiftName.toLowerCase())!;
                            }

                            validEmployees.push({
                                employeeCode: trimmedCode,
                                firstName: firstName,
                                middleName: getStr(['Middle Name']),
                                lastName: getStr(['Last Name', 'LastName']),
                                gender: getStr(['Gender']) || 'Male',
                                email: email || `${trimmedCode.toLowerCase()}@example.com`,
                                phone: getStr(['Phone', 'Mobile', 'Contact No']),
                                
                                department: getStr(['Department']),
                                subDepartment: getStr(['Sub Department']),
                                designation: getStr(['Designation']),
                                workPremises: getStr(['Work Premises']),
                                contractorName: getStr(['Contractor Name', 'Contractor']),
                                
                                dateOfJoining: doj,
                                dateOfBirth: dob,
                                fatherName: getStr(['Father Name', 'FatherName']),
                                motherName: getStr(['Mother Name', 'MotherName']),
                                
                                permanentAddress: getStr(['Permanent Address']),
                                presentAddress: getStr(['Present Address']),
                                
                                bankName: getStr(['Bank Name']),
                                accountNo: getStr(['Account No', 'Account Number']),
                                ifscCode: getStr(['IFSC Code', 'IFSC']),
                                modeOfPayment: getStr(['Payment Mode']) || 'Bank Transfer',
                                
                                uanNo: getStr(['UAN No', 'UAN']),
                                esicNo: getStr(['ESIC No', 'ESIC']),
                                
                                userRole: getStr(['Role', 'User Role']) || 'Employee',
                                location: getStr(['Location']),
                                subLocation: getStr(['Sub Location']),
                                managerName: getStr(['Manager', 'Manager Name']),

                                shiftId: shiftId, // Add resolved Shift ID

                                userType: 'Contractual',
                                status: 'Active',
                                appLoginAccess: false,
                                attendanceViewAccess: false,
                                loginPassword: 'password123',
                                photoUrl: ''
                            });
                            existingCodes.add(trimmedCode.toLowerCase());
                        }
                    }
                }

                if (validEmployees.length === 0) {
                    alert("No valid employee data found. Please check columns.");
                    return;
                }

                const { error } = await supabase.from('employees').insert(validEmployees);
                if (error) throw error;

                alert(`Successfully imported ${validEmployees.length} employees.`);
                fetchEmployees(true);
            } catch (err: any) {
                console.error("Import error:", err);
                alert("Failed to import: " + (err.message || "Unknown error"));
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleEditClick = (emp: Employee) => {
        setEditingEmployee(emp);
        setIsAddFormOpen(true);
        setOpenActionMenuId(null);
    };

    const handleViewClick = (emp: Employee) => {
        setEditingEmployee(emp);
        setIsViewModalOpen(true);
        setOpenActionMenuId(null);
    };

    const handleCloseForm = () => {
        setIsAddFormOpen(false);
        setEditingEmployee(null);
    }

    const handleCloseViewModal = () => {
        setIsViewModalOpen(false);
        setEditingEmployee(null);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setOpenActionMenuId(null);
            }
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setShowFilter(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Filter Logic
    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = 
            searchTerm === '' || 
            emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.email.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesDept = filters.department === '' || emp.department === filters.department;
        const matchesStatus = filters.status === '' || emp.status === filters.status;

        return matchesSearch && matchesDept && matchesStatus;
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-slate-800">Contractual Employee Master</h1>
                  <p className="text-slate-600 mt-1">Manage all contractual employee profiles and information.</p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <LoaderIcon className="w-8 h-8 text-primary animate-spin" />
                    <p className="mt-2 text-slate-500">Loading employees...</p>
                </div>
            ) : (
                <div className="mt-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                        <h2 className="text-lg font-semibold text-slate-800">Contractual Employee Listing</h2>
                        <div className="flex flex-wrap items-center gap-2">
                             <div className="relative">
                                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                                <input 
                                    type="text" 
                                    placeholder="Search..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 w-48 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                                />
                            </div>
                            
                            <button 
                                onClick={handleDownloadTemplate}
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50"
                                title="Download Complete Import Template"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                <span>Template</span>
                            </button>

                            <label className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg shadow-sm hover:bg-orange-600 cursor-pointer">
                                <ImportIcon className="w-5 h-5" />
                                <span>Import</span>
                                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                            </label>

                            <button 
                                onClick={() => { setEditingEmployee(null); setIsAddFormOpen(true); }}
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">
                                <PlusIcon className="w-5 h-5" />
                                <span>Add New</span>
                            </button>
                            
                             {/* Filter Button & Popover */}
                             <div className="relative" ref={filterMenuRef}>
                                 <button 
                                    onClick={() => setShowFilter(!showFilter)}
                                    className={`p-2 border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 ${showFilter ? 'bg-slate-100 ring-2 ring-primary/20' : 'bg-white'}`}
                                >
                                   <FilterIcon className="w-5 h-5 text-primary" />
                                </button>
                                
                                {showFilter && (
                                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 p-4 z-20">
                                        <h3 className="font-semibold text-sm text-slate-700 mb-3">Filter Employees</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
                                                <select 
                                                    value={filters.department} 
                                                    onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                                                    className="w-full text-sm border border-slate-300 rounded-md p-2 focus:ring-1 focus:ring-primary"
                                                >
                                                    <option value="">All Departments</option>
                                                    {availableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                                                <select 
                                                    value={filters.status} 
                                                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                                    className="w-full text-sm border border-slate-300 rounded-md p-2 focus:ring-1 focus:ring-primary"
                                                >
                                                    <option value="">All Status</option>
                                                    <option value="Active">Active</option>
                                                    <option value="Inactive">Inactive</option>
                                                </select>
                                            </div>
                                            <div className="pt-2 flex justify-end">
                                                <button 
                                                    onClick={() => { setFilters({ department: '', status: '' }); setSearchTerm(''); }}
                                                    className="text-xs text-red-600 hover:underline"
                                                >
                                                    Clear Filters
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Employee Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                <tr>
                                    {['Photo', 'Code', 'Name', 'Role', 'Manager', 'Contractor', 'Department', 'Phone', 'Status', 'Actions'].map(header => (
                                        <th key={header} scope="col" className="px-6 py-3 font-semibold whitespace-nowrap first:rounded-l-lg last:rounded-r-lg">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.length > 0 ? filteredEmployees.map(emp => (
                                    <tr key={emp.employeeCode} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-3">
                                            {emp.photoUrl && !emp.photoUrl.includes('ui-avatars.com') ? (
                                                <img src={emp.photoUrl} alt={`${emp.firstName}`} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                                                    <UserCircleIcon className="w-8 h-8" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">{emp.employeeCode}</td>
                                        <td className="px-6 py-3 font-medium text-primary cursor-pointer hover:underline" onClick={() => handleViewClick(emp)}>{`${emp.firstName} ${emp.lastName}`}</td>
                                        <td className="px-6 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{emp.userRole || 'N/A'}</span></td>
                                        <td className="px-6 py-3">{emp.managerName || 'N/A'}</td>
                                        <td className="px-6 py-3">{emp.contractorName || 'N/A'}</td>
                                        <td className="px-6 py-3">{emp.department || 'N/A'}</td>
                                        <td className="px-6 py-3">{emp.phone}</td>
                                        <td className="px-6 py-3">
                                            <StatusBadge status={emp.status} />
                                        </td>
                                        <td className="px-6 py-3 relative">
                                            <button 
                                                onClick={() => setOpenActionMenuId(openActionMenuId === emp.employeeCode ? null : emp.employeeCode)}
                                                className="p-1.5 rounded-full hover:bg-slate-200"
                                            >
                                                <DotsVerticalIcon className="w-5 h-5 text-slate-500" />
                                            </button>
                                            {openActionMenuId === emp.employeeCode && (
                                                <div ref={actionMenuRef} className="absolute right-12 top-10 z-10 w-48 bg-white rounded-lg shadow-lg border border-slate-200 animate-fadeIn">
                                                    <ul className="py-1 text-sm text-slate-700">
                                                        <li>
                                                            <a href="#" onClick={(e) => { e.preventDefault(); handleEditClick(emp); }} className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-100"><PencilIcon className="w-4 h-4" /><span>Edit</span></a>
                                                        </li>
                                                        <li>
                                                            <a href="#" onClick={(e) => { e.preventDefault(); handleViewClick(emp); }} className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-100"><EyeIcon className="w-4 h-4" /><span>View</span></a>
                                                        </li>
                                                        <li>
                                                            <a href="#" className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-100"><AttendanceSummaryIcon className="w-4 h-4" /><span>Attendance Summary</span></a>
                                                        </li>
                                                        <li>
                                                            <a href="#" onClick={() => handleToggleStatus(emp)} className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-100 cursor-pointer">
                                                                {emp.status === 'Active' ? 
                                                                    <><XCircleIcon className="w-4 h-4 text-red-500" /><span>Deactivate</span></> : 
                                                                    <><CheckCircleIcon className="w-4 h-4 text-green-500" /><span>Activate</span></>
                                                                }
                                                            </a>
                                                        </li>
                                                        <li>
                                                            <a href="#" onClick={() => emp.employeeCode && handleDeleteEmployee(emp.employeeCode)} className="flex items-center space-x-3 px-4 py-2 text-red-600 hover:bg-red-50 cursor-pointer"><TrashIcon className="w-4 h-4" /><span>Delete</span></a>
                                                        </li>
                                                    </ul>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={10} className="text-center py-16 text-slate-500">
                                            <div className="flex flex-col items-center">
                                                {searchTerm || filters.department || filters.status ? (
                                                    <>
                                                        <SearchIcon className="w-12 h-12 text-slate-300 mb-3" />
                                                        <h3 className="text-lg font-semibold text-slate-700">No Matches Found</h3>
                                                        <p className="text-sm">Try adjusting your search or filters.</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                        </svg>
                                                        <h3 className="text-xl font-semibold text-slate-700">No Contractual Employees Yet</h3>
                                                        <p className="mt-2 max-w-md">Your contractual employee list is currently empty. Add one to start managing their details.</p>
                                                        <button 
                                                            onClick={() => setIsAddFormOpen(true)}
                                                            className="mt-6 flex items-center space-x-2 px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg shadow-md hover:bg-primary-dark transition-colors">
                                                            <PlusIcon className="w-5 h-5" />
                                                            <span>Add New Employee</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            <AddEmployeeForm 
                isOpen={isAddFormOpen} 
                onClose={handleCloseForm} 
                onSave={handleSaveEmployee} 
                userType="Contractual" 
                employeeToEdit={editingEmployee}
            />

            <ViewEmployeeModal 
                isOpen={isViewModalOpen} 
                onClose={handleCloseViewModal} 
                employee={editingEmployee} 
            />
        </div>
    );
};

export default ContractualEmployees;
