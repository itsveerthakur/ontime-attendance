

export interface PayslipItem {
  name: string;
  amount: number;
}

export interface PayslipData {
  employeeId: string;
  employeeName: string;
  designation: string;
  department?: string;
  dateOfJoining?: string;
  uanNo?: string;
  esicNo?: string;
  pfNo?: string;
  bankName?: string;
  bankAccount?: string;
  ifscCode?: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  earnings: PayslipItem[];
  deductions: PayslipItem[];
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  workingDays?: number;
  paidDays?: number;
  lopDays?: number;
}

export interface Employee {
  id?: number;
  userType: 'On-Roll' | 'Contractual';
  userRole: string;
  photoUrl: string;
  employeeCode: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  fatherName: string;
  motherName: string;
  gender: string;
  email: string;
  phone: string;
  department: string;
  subDepartment: string;
  designation: string;
  workPremises: string;
  /* Fixed duplicate identifier 'dateOfJoining' on lines 50-51 */
  dateOfJoining: string;
  dateOfLeaving: string;
  managerName: string;
  contractorName?: string;
  permanentAddress: string;
  presentAddress: string;
  location: string;
  subLocation: string;
  shiftId: number | null;
  appLoginAccess: boolean;
  attendanceViewAccess: boolean;
  loginPassword?: string;
  bankName: string;
  ifscCode: string;
  accountNo: string;
  modeOfPayment: string;
  uanNo: string;
  esicNo: string;
  status: 'Active' | 'Inactive';
}

export interface Shift {
  id?: number;
  name: string;
  status: 'active' | 'inactive';
  startTime: string;
  endTime: string;
  inGracePeriod: number;
  outGracePeriod: number;
  startReminder: number;
  endReminder: number;
  isNightShift: boolean;
  employeeCount: number;
  createdAt: string;
}

export interface Department {
  id?: number;
  name: string;
  status: 'active' | 'inactive';
  employeeCount: number;
}

export interface Designation {
  id?: number;
  name: string;
  status: 'active' | 'inactive';
  employeeCount: number;
}

export interface SubDepartment {
  id?: number;
  name: string;
  departmentName: string;
  status: 'active' | 'inactive';
  employeeCount: number;
}

export interface Location {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  parentLocation?: string;
  subLocationCount: number;
  employeeCount: number;
  radius: number;
  status: 'active' | 'inactive';
}

export interface WorkPremise {
  id?: number;
  name: string;
  status: 'active' | 'inactive';
  employeeCount: number;
}

export interface SubLocation {
  id?: number;
  name: string; 
  locationName: string; 
  parentSubLocation?: string;
  shift?: string;
  address?: string;
  latitude: number;
  longitude: number;
  deviceInstalled: number;
  employeeCount: number;
  radius: number;
  isMaster: boolean; 
  status: 'active' | 'inactive';
}

export interface Role {
  id?: number;
  name: string;
  permissions: Record<string, { view: boolean; add: boolean; edit: boolean; delete: boolean }>;
  status: 'active' | 'inactive';
  employeeCount: number;
}

export interface EarningsComponent {
  id?: number;
  name: string;
  calculationPercentage: string | number;
  calculation_percentage?: string | number;
  based_on: string;
  maxCalculatedValue?: number;
  max_calculated_value?: number;
}

export interface DeductionComponent {
  id?: number;
  name: string;
  calculationPercentage: string | number;
  calculation_percentage?: string | number;
  based_on: string;
  maxCalculatedValue?: number;
  max_calculated_value?: number;
}

export interface EmployerAdditionalComponent {
  id?: number;
  name: string;
  calculationPercentage: string | number;
  calculation_percentage?: string | number;
  based_on: string;
  maxCalculatedValue?: number;
  max_calculated_value?: number;
}

export interface SalaryStructure {
  id?: number;
  employee_code: string;
  monthly_gross: number;
  basic_salary: number;
  ctc?: number;
  earnings_breakdown: { id: number; name: string; amount: number }[];
  deductions_breakdown: { id: number; name: string; amount: number }[];
  employer_additional_breakdown?: { id: number; name: string; amount: number }[];
  net_salary: number;
}

export interface Asset {
  id?: number;
  assetName: string;
  assetType: 'Electronics' | 'Furniture' | 'Vehicle' | 'Other';
  serialNumber: string;
  assignedTo: string;
  assignedDate: string;
  status: 'In-Stock' | 'Allocated' | 'Under-Repair' | 'Discarded';
  created_at?: string;
}

export interface ExpenseClaim {
  id?: number;
  employeeCode: string;
  employeeName: string;
  category: 'Travel' | 'Food' | 'Stationary' | 'Client Meeting' | 'Other';
  amount: number;
  claimDate: string;
  description: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Paid';
  created_at?: string;
}

// Leave Management Types
export interface LeaveType {
  id?: number;
  name: string;
  code: string;
  description?: string;
  gender_applicability: 'All' | 'Male' | 'Female';
  frequency: 'Monthly' | 'Quarterly' | 'Yearly' | 'One Time';
  carry_forward: boolean;
  encashable: boolean;
  is_comp_off: boolean;
  status: 'active' | 'inactive';
}

export interface LeaveRequest {
  id?: number;
  employee_code: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at?: string;
}

export interface LeaveRule {
  id?: number;
  leave_type_code: string;
  eligibility_days: number;
  /* Fix: Added 'Work on Weekly Off' to allocation_type union to fix unintentional comparison errors in LeaveRules.tsx */
  allocation_type: 'Fixed' | 'Working Days Based' | 'Work on Weekly Off';
  min_working_days: number;
  auto_add_frequency: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | 'None';
  auto_remove_frequency: 'Yearly' | 'Cycle End' | 'Never';
  eligibility_scope: 'Global' | 'Department' | 'Specific Employees';
  scope_value: string;
  allocated_count: number;
  status: 'active' | 'inactive';
  updated_at?: string;
}

export interface LeaveBalance {
  employee_code: string;
  employee_name: string;
  leave_type: string;
  opening: number;
  used: number;
  remaining: number;
}

export interface CompoundingRule {
  in_status: string;
  out_status: string;
  result_status: string;
}

export interface AttendanceRules {
  id?: number;
  in_grace_period: number;
  out_grace_period: number;
  late_threshold: number;
  in_short_leave_threshold: number;
  out_short_leave_threshold: number;
  in_half_day_threshold: number;
  out_half_day_threshold: number;
  compounding_rules: CompoundingRule[];
  updated_at?: string;
}
