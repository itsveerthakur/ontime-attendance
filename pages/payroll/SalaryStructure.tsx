
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SearchIcon, ChevronRightIcon, XCircleIcon, LoaderIcon, FilterIcon, ImportIcon, DownloadIcon } from '../../components/icons';
import { supabase } from '../../supabaseClient';
import type { Employee, SalaryStructure as ISalaryStructure, EarningsComponent, DeductionComponent, EmployerAdditionalComponent } from '../../types';
import AssignSalaryStructureForm from '../../components/AssignSalaryStructureForm';

// Declare XLSX for global usage
declare const XLSX: any;

interface SalaryStructureProps {
    onBack: () => void;
}

const SalaryStructure: React.FC<SalaryStructureProps> = ({ onBack }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [salaryStructures, setSalaryStructures] = useState<ISalaryStructure[]>([]);
    const [isAssignStructureOpen, setIsAssignStructureOpen] = useState(false);
    const [selectedEmployeeForStructure, setSelectedEmployeeForStructure] = useState<Employee | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    
    // Filter States
    const [showFilter, setShowFilter] = useState(false);
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
    const filterMenuRef = useRef<HTMLDivElement>(null);
    
    // Master Data for Form & Calculations
    const [earningsComponents, setEarningsComponents] = useState<EarningsComponent[]>([]);
    const [deductionsComponents, setDeductionsComponents] = useState<DeductionComponent[]>([]);
    const [employerAdditionalComponents, setEmployerAdditionalComponents] = useState<EmployerAdditionalComponent[]>([]);
    const [showSqlModal, setShowSqlModal] = useState(false);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
             const [eRes, dRes, eaRes, empRes, structRes] = await Promise.all([
                 supabase.schema('payroll').from('earnings').select('*'),
                 supabase.schema('payroll').from('deductions').select('*'),
                 supabase.schema('payroll').from('employer_additional').select('*'),
                 supabase.from('employees').select('*').order('employeeCode'),
                 supabase.schema('payroll').from('employee_salary_structures').select('*')
             ]);
             
             const sanitize = (data: any[]) => data.map((item: any) => ({
                ...item,
                id: Number(item.id),
                calculationPercentage: item.calculationPercentage ?? item.calculation_percentage,
                maxCalculatedValue: item.maxCalculatedValue ?? item.max_calculated_value
             }));

             if (eRes.data) setEarningsComponents(sanitize(eRes.data));
             if (dRes.data) setDeductionsComponents(sanitize(dRes.data));
             if (eaRes.data) setEmployerAdditionalComponents(sanitize(eaRes.data));
             
             if (empRes.error) console.error("Error fetching employees:", empRes.error);
             else {
                 const emps = empRes.data as Employee[] || [];
                 setEmployees(emps);
                 // Extract unique departments
                 const depts = Array.from(new Set(emps.map(e => e.department).filter(Boolean))).sort();
                 setAvailableDepartments(depts);
             }
             
             if (structRes.error) {
                console.error("Error fetching salary structures:", structRes.error);
                if (structRes.error.code === '42P01' || structRes.error.message.includes('does not exist') || structRes.error.code === '42501') {
                    setShowSqlModal(true);
                }
             } else {
                setSalaryStructures(structRes.data as ISalaryStructure[] || []);
             }

        } catch (e) { console.error("Error fetching data", e); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Handle click outside filter
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setShowFilter(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSaveStructure = async (structure: Omit<ISalaryStructure, 'id'>) => {
        try {
            const existing = salaryStructures.find(s => s.employee_code === structure.employee_code);

            if (existing && existing.id) {
                const { error } = await supabase.schema('payroll').from('employee_salary_structures').update(structure).eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.schema('payroll').from('employee_salary_structures').insert([structure]);
                if (error) throw error;
            }
            fetchAllData();
        } catch (err: any) {
            console.error("Error saving structure:", err);
            alert("Failed to save salary structure: " + err.message);
        }
    };

    const handleAssignClick = (emp: Employee) => {
        setSelectedEmployeeForStructure(emp);
        setIsAssignStructureOpen(true);
    };

    // --- Bulk Import Logic ---

    const handleDownloadTemplate = () => {
        const headers = ['Employee Code', 'Monthly Gross Salary'];
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Salary Structure Template");
        XLSX.writeFile(wb, "Salary_Structure_Import_Template.xlsx");
    };

    const calculateStructureFromGross = (gross: number) => {
        let basic = 0;
        const earningsBreakdown: any[] = [];
        const deductionsBreakdown: any[] = [];
        const employerBreakdown: any[] = [];

        // 1. Basic
        const basicComp = earningsComponents.find(e => e.name.toLowerCase().includes('basic'));
        if (basicComp) {
            const pct = parseFloat(String(basicComp.calculationPercentage || 0));
            const maxVal = Number(basicComp.maxCalculatedValue || 0);
            if (pct > 0) {
                basic = (gross * pct) / 100;
                if (maxVal > 0 && basic > maxVal) basic = maxVal;
            }
            earningsBreakdown.push({ id: basicComp.id, name: basicComp.name, amount: Math.round(basic) });
        }

        // 2. Earnings
        earningsComponents.forEach(comp => {
            if (comp.id === basicComp?.id) return;
            const pct = parseFloat(String(comp.calculationPercentage || 0));
            const basedOn = comp.based_on?.toLowerCase();
            const maxVal = Number(comp.maxCalculatedValue || 0);
            let amt = 0;

            if (pct > 0) {
                if (basedOn === 'basic') amt = (basic * pct) / 100;
                else if (basedOn === 'gross') amt = (gross * pct) / 100;
                else if (basedOn === 'fixed') amt = pct;

                if (maxVal > 0 && amt > maxVal) amt = maxVal;
                if (amt > 0) earningsBreakdown.push({ id: comp.id, name: comp.name, amount: Math.round(amt) });
            }
        });

        // 3. Deductions
        deductionsComponents.forEach(comp => {
            const name = comp.name.toLowerCase();
            let amt = 0;
            const pct = parseFloat(String(comp.calculationPercentage || 0));
            const basedOn = comp.based_on?.toLowerCase();
            const maxVal = Number(comp.maxCalculatedValue || 0);

            if ((name.includes('pf') || name.includes('provident')) && !name.includes('vol')) {
                const effectivePct = pct > 0 ? pct : 12;
                amt = (basic * effectivePct) / 100;
            } else if (name.includes('esi')) {
                if (gross <= 21000) {
                    const effectivePct = pct > 0 ? pct : 0.75;
                    amt = (gross * effectivePct) / 100;
                }
            } else if (pct > 0) {
                if (basedOn === 'basic') amt = (basic * pct) / 100;
                else if (basedOn === 'gross') amt = (gross * pct) / 100;
            }

            if (maxVal > 0 && amt > maxVal) amt = maxVal;
            if (amt > 0) deductionsBreakdown.push({ id: comp.id, name: comp.name, amount: Math.round(amt) });
        });

        // 4. Employer Additional
        let totalEmployerAdd = 0;
        employerAdditionalComponents.forEach(comp => {
            const name = comp.name.toLowerCase();
            let amt = 0;
            const pct = parseFloat(String(comp.calculationPercentage || 0));
            const maxVal = Number(comp.maxCalculatedValue || 0);

            if (name.includes('pf') || name.includes('provident')) {
                const effectivePct = pct > 0 ? pct : 13;
                amt = (basic * effectivePct) / 100;
            } else if (name.includes('esi')) {
                if (gross <= 21000) {
                    const effectivePct = pct > 0 ? pct : 3.25;
                    amt = (gross * effectivePct) / 100;
                }
            } else if (pct > 0) {
                const basedOn = comp.based_on?.toLowerCase();
                if (basedOn === 'basic') amt = (basic * pct) / 100;
                else if (basedOn === 'gross') amt = (gross * pct) / 100;
            }

            if (maxVal > 0 && amt > maxVal) amt = maxVal;
            if (amt > 0) {
                const rounded = Math.round(amt);
                employerBreakdown.push({ id: comp.id, name: comp.name, amount: rounded });
                totalEmployerAdd += rounded;
            }
        });

        // Ensure total earnings match gross (handle rounding or manual components if needed, mostly Basic + HRA + Special)
        // For simplicity in auto-calc, we assume components sum up. 
        // In a real rigorous system, a 'Special Allowance' balancing component is used.
        // Here we just trust the masters.
        
        // Re-sum for accuracy
        const totalEarnings = earningsBreakdown.reduce((acc, curr) => acc + curr.amount, 0);
        
        // If calculated earnings don't match gross (e.g. manual components missing), we might have a discrepancy.
        // For this feature, we assume the user has configured masters (like Special Allowance = Balance) or accepts the calc.
        
        const totalDeductions = deductionsBreakdown.reduce((acc, curr) => acc + curr.amount, 0);
        const netSalary = totalEarnings - totalDeductions;
        const ctc = gross + totalEmployerAdd;

        return {
            monthly_gross: gross, // We keep input gross as the target
            basic_salary: Math.round(basic),
            ctc: Math.round(ctc),
            earnings_breakdown: earningsBreakdown,
            deductions_breakdown: deductionsBreakdown,
            employer_additional_breakdown: employerBreakdown,
            net_salary: Math.round(netSalary)
        };
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

                const validStructures: any[] = [];
                const errors: string[] = [];

                for (const row of data as any[]) {
                    const code = row['Employee Code'];
                    const gross = Number(row['Monthly Gross Salary']);

                    if (code && gross > 0) {
                        // Verify employee exists
                        const empExists = employees.find(e => e.employeeCode === String(code).trim());
                        if (empExists) {
                            const calc = calculateStructureFromGross(gross);
                            validStructures.push({
                                employee_code: String(code).trim(),
                                ...calc
                            });
                        } else {
                            errors.push(`Employee ${code} not found.`);
                        }
                    }
                }

                if (validStructures.length > 0) {
                    // Upsert logic
                    const { error } = await supabase.schema('payroll').from('employee_salary_structures').upsert(validStructures, { onConflict: 'employee_code' });
                    if (error) throw error;
                    
                    let msg = `Successfully imported ${validStructures.length} salary structures.`;
                    if (errors.length > 0) msg += `\n${errors.length} skipped (see console).`;
                    alert(msg);
                    if (errors.length > 0) console.warn("Import errors:", errors);
                    fetchAllData();
                } else {
                    alert("No valid data found. Please check column names: 'Employee Code', 'Monthly Gross Salary'.");
                }

            } catch (err: any) {
                console.error("Import error:", err);
                alert("Failed to import: " + (err.message || "Unknown error"));
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    // --- Search & Filter ---

    const filteredEmployees = employees.filter(e => {
        const matchesSearch = 
            e.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesDept = departmentFilter ? e.department === departmentFilter : true;

        return matchesSearch && matchesDept;
    });

     const getSetupSql = () => {
        return `
    -- 1. Create Schemas
    CREATE SCHEMA IF NOT EXISTS "salarySheet";
    CREATE SCHEMA IF NOT EXISTS "payroll";

    -- 3. Create Table for Salary Structures
    CREATE TABLE IF NOT EXISTS "payroll"."employee_salary_structures" (
        id bigint generated by default as identity primary key,
        employee_code text not null unique,
        monthly_gross numeric,
        basic_salary numeric,
        ctc numeric,
        earnings_breakdown jsonb,
        deductions_breakdown jsonb,
        employer_additional_breakdown jsonb,
        net_salary numeric,
        created_at timestamptz default now()
    );
    
    ALTER TABLE "payroll"."employee_salary_structures" ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Enable all access" ON "payroll"."employee_salary_structures" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
    
    GRANT USAGE ON SCHEMA "payroll" TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA "payroll" TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA "payroll" TO anon, authenticated, service_role;
        `.trim();
    };
    
    const copyToClipboard = () => {
        navigator.clipboard.writeText(getSetupSql());
        alert("SQL code copied!");
    };

    return (
        <div>
             <div className="flex items-center text-sm text-slate-500 mb-6">
                <span onClick={onBack} className="cursor-pointer hover:text-primary">Payroll</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Salary Structure</span>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <LoaderIcon className="w-8 h-8 text-primary animate-spin" />
                    <p className="mt-2 text-slate-500">Loading structures...</p>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                        <h2 className="text-lg font-semibold text-slate-800">Employee Salary Structures</h2>
                        
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative hidden md:block">
                                <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 w-48 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                                />
                            </div>

                            <div className="relative" ref={filterMenuRef}>
                                <button 
                                    onClick={() => setShowFilter(!showFilter)}
                                    className={`p-2 border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 ${showFilter ? 'bg-slate-100 ring-2 ring-primary/20' : 'bg-white'}`}
                                    title="Filter"
                                >
                                   <FilterIcon className="w-5 h-5 text-primary" />
                                </button>
                                {showFilter && (
                                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 p-4 z-20">
                                        <h3 className="font-semibold text-sm text-slate-700 mb-3">Filter List</h3>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
                                            <select 
                                                value={departmentFilter} 
                                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                                className="w-full text-sm border border-slate-300 rounded-md p-2 focus:ring-1 focus:ring-primary"
                                            >
                                                <option value="">All Departments</option>
                                                {availableDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                        <div className="pt-3 flex justify-end">
                                            <button 
                                                onClick={() => { setDepartmentFilter(''); setSearchTerm(''); setShowFilter(false); }}
                                                className="text-xs text-red-600 hover:underline"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleDownloadTemplate}
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50"
                                title="Download Template"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Template</span>
                            </button>

                            <label className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg shadow-sm hover:bg-orange-600 cursor-pointer">
                                <ImportIcon className="w-5 h-5" />
                                <span className="hidden sm:inline">Import</span>
                                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                            </label>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                <tr>
                                    <th className="px-6 py-3">Code</th>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Department</th>
                                    <th className="px-6 py-3">Gross Salary</th>
                                    <th className="px-6 py-3">Basic Salary</th>
                                    <th className="px-6 py-3">Net Salary</th>
                                    <th className="px-6 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.length > 0 ? (
                                    filteredEmployees.map(emp => {
                                        const struct = salaryStructures.find(s => s.employee_code === emp.employeeCode);
                                        return (
                                            <tr key={emp.id} className="bg-white border-b hover:bg-slate-50">
                                                <td className="px-6 py-4">{emp.employeeCode}</td>
                                                <td className="px-6 py-4 font-medium text-slate-900">{emp.firstName} {emp.lastName}</td>
                                                <td className="px-6 py-4">{emp.department}</td>
                                                <td className="px-6 py-4">{struct ? `₹${Math.round(struct.monthly_gross)}` : '-'}</td>
                                                <td className="px-6 py-4">{struct ? `₹${Math.round(struct.basic_salary)}` : '-'}</td>
                                                <td className="px-6 py-4 font-semibold text-green-600">{struct ? `₹${Math.round(struct.net_salary)}` : '-'}</td>
                                                <td className="px-6 py-4">
                                                    <button onClick={() => handleAssignClick(emp)} className="text-primary hover:underline font-medium">
                                                        {struct ? 'Edit Structure' : 'Assign Structure'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                            No employees found matching your criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <AssignSalaryStructureForm
                isOpen={isAssignStructureOpen}
                onClose={() => setIsAssignStructureOpen(false)}
                onSave={handleSaveStructure}
                employee={selectedEmployeeForStructure}
                existingStructure={salaryStructures.find(s => s.employee_code === selectedEmployeeForStructure?.employeeCode) || null}
                earningMasters={earningsComponents}
                deductionMasters={deductionsComponents}
                employerAdditionalMasters={employerAdditionalComponents}
            />

             {showSqlModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">Database Setup Required</h2>
                            <button onClick={() => setShowSqlModal(false)}><XCircleIcon className="w-8 h-8 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <p className="text-slate-600 mb-4">Database setup required for Payroll module.</p>
                            <div className="bg-slate-900 rounded-lg p-4 relative">
                                <button onClick={copyToClipboard} className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1 rounded transition-colors">Copy SQL</button>
                                <pre className="text-green-400 font-mono text-xs overflow-x-auto p-2">{getSetupSql()}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalaryStructure;
