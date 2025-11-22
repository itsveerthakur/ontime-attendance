
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XCircleIcon, MoneyIcon } from './icons';
import type { Employee, EarningsComponent, DeductionComponent, EmployerAdditionalComponent, SalaryStructure } from '../types';

interface AssignSalaryStructureFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (structure: Omit<SalaryStructure, 'id'>) => void;
  employee: Employee | null;
  existingStructure: SalaryStructure | null;
  earningMasters: EarningsComponent[];
  deductionMasters: DeductionComponent[];
  employerAdditionalMasters: EmployerAdditionalComponent[];
}

const AssignSalaryStructureForm: React.FC<AssignSalaryStructureFormProps> = ({ 
    isOpen, onClose, onSave, employee, existingStructure, earningMasters, deductionMasters, employerAdditionalMasters
}) => {
    // In this new logic:
    // monthlyGross state represents the "Gross Salary" input by the user.
    // ctc state represents the "Monthly CTC Salary" (Gross + Employer Additional).
    // basicSalary is auto-calculated.
    
    const [grossSalary, setGrossSalary] = useState<number>(0);
    const [basicSalary, setBasicSalary] = useState<number>(0);
    const [ctc, setCtc] = useState<number>(0);
    
    // Store calculated amounts mapped by component ID
    const [earningsAmounts, setEarningsAmounts] = useState<Record<number, number>>({});
    const [deductionsAmounts, setDeductionsAmounts] = useState<Record<number, number>>({});
    const [employerAdditionalAmounts, setEmployerAdditionalAmounts] = useState<Record<number, number>>({});

    // Initialize form when employee or existing structure changes
    useEffect(() => {
        if (isOpen) {
            if (existingStructure) {
                setGrossSalary(existingStructure.monthly_gross);
                setBasicSalary(existingStructure.basic_salary);
                setCtc(existingStructure.ctc || 0);
                
                const eAmounts: Record<number, number> = {};
                existingStructure.earnings_breakdown.forEach(e => { eAmounts[e.id] = e.amount; });
                setEarningsAmounts(eAmounts);

                const dAmounts: Record<number, number> = {};
                existingStructure.deductions_breakdown.forEach(d => { dAmounts[d.id] = d.amount; });
                setDeductionsAmounts(dAmounts);

                const eaAmounts: Record<number, number> = {};
                if (existingStructure.employer_additional_breakdown) {
                    existingStructure.employer_additional_breakdown.forEach(e => { eaAmounts[e.id] = e.amount; });
                }
                setEmployerAdditionalAmounts(eaAmounts);
            } else {
                setGrossSalary(0);
                setBasicSalary(0);
                setCtc(0);
                setEarningsAmounts({});
                setDeductionsAmounts({});
                setEmployerAdditionalAmounts({});
            }
        }
    }, [isOpen, existingStructure, employee]);

    // Main calculation driver
    const handleGrossChange = (val: number) => {
        setGrossSalary(val);
        
        const newEarningAmounts: Record<number, number> = {};
        const newDeductionAmounts: Record<number, number> = {};
        const newEmployerAdditionalAmounts: Record<number, number> = {};

        // 1. Identify Basic Component
        const basicComp = earningMasters.find(e => e.name.toLowerCase().includes('basic'));
        
        // 2. Calculate Basic Salary
        let basic = 0;
        if (basicComp) {
             const pct = parseFloat(String(basicComp.calculationPercentage || basicComp.calculation_percentage || 0));
             const maxVal = Number(basicComp.maxCalculatedValue || basicComp.max_calculated_value || 0);
             
             // Use the assigned percentage from Master
             if (pct > 0) {
                 basic = (val * pct) / 100;
                 if (maxVal > 0 && basic > maxVal) basic = maxVal;
             }
             newEarningAmounts[basicComp.id!] = basic;
        }
        setBasicSalary(basic);

        // 3. Calculate Other Earnings
        earningMasters.forEach(comp => {
            if (comp.id === basicComp?.id) return; // Skip Basic as done

            const pct = parseFloat(String(comp.calculationPercentage || comp.calculation_percentage || 0));
            const basedOn = comp.based_on?.toLowerCase();
            const maxVal = Number(comp.maxCalculatedValue || comp.max_calculated_value || 0);
            
            if (pct > 0) {
                let amt = 0;
                if (basedOn === 'basic') amt = (basic * pct) / 100;
                else if (basedOn === 'gross') amt = (val * pct) / 100;
                else if (basedOn === 'fixed') amt = pct; 
                
                if (maxVal > 0 && amt > maxVal) {
                    amt = maxVal;
                }
                
                newEarningAmounts[comp.id!] = amt;
            } else {
                // Manual component (percentage 0/null). 
                // Initialize to 0 on Gross change. User must add manually if required.
                newEarningAmounts[comp.id!] = 0;
            }
        });

        // --- DEDUCTIONS ---
        deductionMasters.forEach(comp => {
            const name = comp.name.toLowerCase();
            let amt = 0;
            const pct = parseFloat(String(comp.calculationPercentage || comp.calculation_percentage || 0));
            const basedOn = comp.based_on?.toLowerCase();
            const maxVal = Number(comp.maxCalculatedValue || comp.max_calculated_value || 0);

            // Rule for PF (Employee)
            if ((name.includes('pf') || name.includes('provident')) && !name.includes('vol')) {
                const effectivePct = pct > 0 ? pct : 12;
                amt = (basic * effectivePct) / 100;
            } 
            // Rule for ESIC (Employee)
            else if (name.includes('esi')) {
                if (val <= 21000) {
                     const effectivePct = pct > 0 ? pct : 0.75;
                     amt = (val * effectivePct) / 100;
                }
            }
            else if (pct > 0) {
                if (basedOn === 'basic') amt = (basic * pct) / 100;
                else if (basedOn === 'gross') amt = (val * pct) / 100;
            }
            
            if (maxVal > 0 && amt > maxVal) {
                amt = maxVal;
            }
            
            if (amt > 0) newDeductionAmounts[comp.id!] = Math.round(amt);
        });

        // --- EMPLOYER ADDITIONAL ---
        let totalEmployerAdd = 0;
        employerAdditionalMasters.forEach(comp => {
            const name = comp.name.toLowerCase();
            let amt = 0;
            const pct = parseFloat(String(comp.calculationPercentage || comp.calculation_percentage || 0));
            const maxVal = Number(comp.maxCalculatedValue || comp.max_calculated_value || 0);
             
            if (name.includes('pf') || name.includes('provident')) {
                 const effectivePct = pct > 0 ? pct : 13;
                 amt = (basic * effectivePct) / 100;
            }
            else if (name.includes('esi')) {
                if (val <= 21000) {
                    const effectivePct = pct > 0 ? pct : 3.25;
                    amt = (val * effectivePct) / 100;
                }
            }
            else if (pct > 0) {
                 const basedOn = comp.based_on?.toLowerCase();
                 if (basedOn === 'basic') amt = (basic * pct) / 100;
                 else if (basedOn === 'gross') amt = (val * pct) / 100;
            }
            
            if (maxVal > 0 && amt > maxVal) {
                amt = maxVal;
            }
            
            if (amt > 0) {
                const rounded = Math.round(amt);
                newEmployerAdditionalAmounts[comp.id!] = rounded;
                totalEmployerAdd += rounded;
            }
        });

        setEarningsAmounts(newEarningAmounts);
        setDeductionsAmounts(newDeductionAmounts);
        setEmployerAdditionalAmounts(newEmployerAdditionalAmounts);
        
        // Calculate CTC
        setCtc(val + totalEmployerAdd);
    };

    const handleEarningAmountChange = (id: number, val: number) => {
        setEarningsAmounts(prev => ({ ...prev, [id]: val }));
        // Note: Changing manual amounts doesn't trigger full recalc of deductions that rely on Gross/Basic.
        // If a user manually overrides an earning, they may need to check if deductions need manual override too, 
        // or we assume manual overrides are final adjustments.
    };

    const handleDeductionAmountChange = (id: number, val: number) => {
        setDeductionsAmounts(prev => ({ ...prev, [id]: val }));
    };

    const handleEmployerAdditionalChange = (id: number, val: number) => {
        setEmployerAdditionalAmounts(prev => {
            const next = { ...prev, [id]: val };
            const totalAdd = (Object.values(next) as number[]).reduce((a, b) => a + b, 0);
            setCtc(grossSalary + totalAdd);
            return next;
        });
    };

    const totalEarnings = (Object.values(earningsAmounts) as number[]).reduce((a, b) => a + b, 0);
    const totalDeductions = (Object.values(deductionsAmounts) as number[]).reduce((a, b) => a + b, 0);
    const totalEmployerAdditional = (Object.values(employerAdditionalAmounts) as number[]).reduce((a, b) => a + b, 0);
    const netPay = totalEarnings - totalDeductions;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Check for employeeCode instead of id
        if (!employee || !employee.employeeCode) return;

        const structure: Omit<SalaryStructure, 'id'> = {
            employee_code: employee.employeeCode, // Use employeeCode for linking
            monthly_gross: grossSalary,
            basic_salary: basicSalary,
            ctc: ctc,
            earnings_breakdown: earningMasters.map(m => ({
                id: m.id!,
                name: m.name,
                amount: earningsAmounts[m.id!] || 0
            })).filter(x => x.amount > 0), 
            deductions_breakdown: deductionMasters.map(m => ({
                id: m.id!,
                name: m.name,
                amount: deductionsAmounts[m.id!] || 0
            })).filter(x => x.amount > 0),
            employer_additional_breakdown: employerAdditionalMasters.map(m => ({
                id: m.id!,
                name: m.name,
                amount: employerAdditionalAmounts[m.id!] || 0
            })).filter(x => x.amount > 0),
            net_salary: netPay
        };

        // Ensure Basic is in earnings if not already (should be there if master exists, but fallback)
        const basicInBreakdown = structure.earnings_breakdown.find(e => e.name.toLowerCase().includes('basic'));
        if (!basicInBreakdown && basicSalary > 0) {
            // If basic component was deleted from masters but logic assumes it
            structure.earnings_breakdown.unshift({ id: 9999, name: 'Basic Salary', amount: basicSalary });
        }

        onSave(structure);
        onClose();
    };

    return createPortal(
        <>
             <div className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
             <div className={`fixed top-0 right-0 h-full w-full max-w-6xl bg-slate-50 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="flex justify-between items-center p-5 border-b border-slate-200 bg-white">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Salary Structure</h2>
                            <p className="text-sm text-slate-500">Assigning for: <span className="font-semibold text-primary">{employee?.firstName} {employee?.lastName}</span> ({employee?.employeeCode})</p>
                        </div>
                        <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100">
                            <XCircleIcon className="w-8 h-8" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Top Section: Inputs */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Monthly CTC Salary</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-400">₹</span>
                                    <input 
                                        type="number" 
                                        value={ctc} 
                                        readOnly
                                        className="w-full pl-8 pr-3 py-2 text-lg font-bold text-slate-600 bg-slate-100 border border-slate-300 rounded-lg focus:outline-none cursor-not-allowed"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Total of Gross Salary + Employer Additional Costs.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Gross Salary <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-400">₹</span>
                                    <input 
                                        type="number" 
                                        value={grossSalary} 
                                        onChange={(e) => handleGrossChange(parseFloat(e.target.value) || 0)} 
                                        className="w-full pl-8 pr-3 py-2 text-lg font-bold text-slate-800 bg-white border border-primary rounded-lg focus:ring-2 focus:ring-primary-light focus:outline-none"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Enter Gross. Basic, HRA & Allowances will calculate based on Master settings.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Earnings Column */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col h-full">
                                <h3 className="text-md font-bold text-slate-700 border-b pb-2 mb-4 flex items-center text-green-700">
                                    <span className="bg-green-100 p-1 rounded mr-2"><MoneyIcon className="w-5 h-5 text-green-600"/></span> 
                                    Earnings
                                </h3>
                                <div className="space-y-4 flex-1">
                                    {earningMasters.map(comp => {
                                        const isBasic = comp.name.toLowerCase().includes('basic');
                                        const maxVal = Number(comp.maxCalculatedValue || comp.max_calculated_value || 0);
                                        const pct = parseFloat(String(comp.calculationPercentage || comp.calculation_percentage || 0));
                                        
                                        return (
                                            <div key={comp.id} className="flex items-center justify-between">
                                                <div className="w-1/2">
                                                    <p className="font-medium text-sm text-slate-700">{comp.name}</p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {pct > 0 ? `${pct}% of ${comp.based_on}` : 'Manual / Flat'}
                                                        {maxVal > 0 && ` (Max: ${maxVal})`}
                                                    </p>
                                                </div>
                                                <div className="w-1/2 relative">
                                                     <span className="absolute left-3 top-1.5 text-slate-400 text-sm">₹</span>
                                                     <input 
                                                        type="number" 
                                                        value={Math.round((earningsAmounts[comp.id!] as number) || 0)} 
                                                        readOnly={isBasic} // Basic is read-only if driven by Gross
                                                        onChange={(e) => handleEarningAmountChange(comp.id!, parseFloat(e.target.value) || 0)}
                                                        className={`w-full pl-6 pr-2 py-1 text-sm text-right border border-slate-300 rounded focus:ring-1 focus:ring-primary-light focus:outline-none ${isBasic ? 'bg-slate-50 font-semibold' : ''}`}
                                                     />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {earningMasters.length === 0 && <p className="text-sm text-slate-400 italic text-center py-4">No earnings defined.</p>}
                                </div>
                                <div className="mt-6 pt-4 border-t flex justify-between items-center">
                                    <span className="font-bold text-slate-700">Total Earnings</span>
                                    <span className="font-bold text-green-600 text-lg">₹{Math.round(totalEarnings)}</span>
                                </div>
                            </div>

                            {/* Deductions Column */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col h-full">
                                <h3 className="text-md font-bold text-slate-700 border-b pb-2 mb-4 flex items-center text-red-700">
                                    <span className="bg-red-100 p-1 rounded mr-2"><MoneyIcon className="w-5 h-5 text-red-600"/></span>
                                    Deductions
                                </h3>
                                <div className="space-y-4 flex-1">
                                    {deductionMasters.map(comp => {
                                        const maxVal = Number(comp.maxCalculatedValue || comp.max_calculated_value || 0);
                                        const pct = parseFloat(String(comp.calculationPercentage || comp.calculation_percentage || 0));
                                        
                                        return (
                                            <div key={comp.id} className="flex items-center justify-between">
                                                <div className="w-1/2">
                                                    <p className="font-medium text-sm text-slate-700">{comp.name}</p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {pct > 0 ? `${pct}% of ${comp.based_on}` : 'Manual / Flat'}
                                                        {maxVal > 0 && ` (Max: ${maxVal})`}
                                                    </p>
                                                </div>
                                                <div className="w-1/2 relative">
                                                     <span className="absolute left-3 top-1.5 text-slate-400 text-sm">₹</span>
                                                     <input 
                                                        type="number" 
                                                        value={Math.round((deductionsAmounts[comp.id!] as number) || 0)} 
                                                        onChange={(e) => handleDeductionAmountChange(comp.id!, parseFloat(e.target.value) || 0)}
                                                        className="w-full pl-6 pr-2 py-1 text-sm text-right border border-slate-300 rounded focus:ring-1 focus:ring-primary-light focus:outline-none"
                                                     />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {deductionMasters.length === 0 && <p className="text-sm text-slate-400 italic text-center py-4">No deductions defined.</p>}
                                </div>
                                <div className="mt-6 pt-4 border-t flex justify-between items-center">
                                    <span className="font-bold text-slate-700">Total Deductions</span>
                                    <span className="font-bold text-red-600 text-lg">₹{Math.round(totalDeductions)}</span>
                                </div>
                            </div>

                            {/* Employer Additional Column */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col h-full">
                                <h3 className="text-md font-bold text-slate-700 border-b pb-2 mb-4 flex items-center text-blue-700">
                                    <span className="bg-blue-100 p-1 rounded mr-2"><MoneyIcon className="w-5 h-5 text-blue-600"/></span>
                                    Employer Additional
                                </h3>
                                <div className="space-y-4 flex-1">
                                    {employerAdditionalMasters.map(comp => {
                                        const maxVal = Number(comp.maxCalculatedValue || comp.max_calculated_value || 0);
                                        const pct = parseFloat(String(comp.calculationPercentage || comp.calculation_percentage || 0));

                                        return (
                                            <div key={comp.id} className="flex items-center justify-between">
                                                <div className="w-1/2">
                                                    <p className="font-medium text-sm text-slate-700">{comp.name}</p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {pct > 0 ? `${pct}% of ${comp.based_on}` : 'Manual / Flat'}
                                                        {maxVal > 0 && ` (Max: ${maxVal})`}
                                                    </p>
                                                </div>
                                                <div className="w-1/2 relative">
                                                     <span className="absolute left-3 top-1.5 text-slate-400 text-sm">₹</span>
                                                     <input 
                                                        type="number" 
                                                        value={Math.round((employerAdditionalAmounts[comp.id!] as number) || 0)} 
                                                        onChange={(e) => handleEmployerAdditionalChange(comp.id!, parseFloat(e.target.value) || 0)}
                                                        className="w-full pl-6 pr-2 py-1 text-sm text-right border border-slate-300 rounded focus:ring-1 focus:ring-primary-light focus:outline-none"
                                                     />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {employerAdditionalMasters.length === 0 && <p className="text-sm text-slate-400 italic text-center py-4">No additional components.</p>}
                                </div>
                                <div className="mt-6 pt-4 border-t flex justify-between items-center">
                                    <span className="font-bold text-slate-700">Total Additional</span>
                                    <span className="font-bold text-blue-600 text-lg">₹{Math.round(totalEmployerAdditional)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Summary */}
                    <div className="p-4 bg-slate-100 border-t border-slate-200 grid grid-cols-4 gap-4 items-center">
                        <div className="text-center">
                            <p className="text-xs text-slate-500 uppercase font-semibold">Gross Salary</p>
                            <p className="text-lg font-bold text-slate-800">₹{Math.round(grossSalary)}</p>
                        </div>
                         <div className="text-center border-l border-slate-200">
                            <p className="text-xs text-slate-500 uppercase font-semibold">Total Deductions</p>
                            <p className="text-lg font-bold text-red-600">₹{Math.round(totalDeductions)}</p>
                        </div>
                         <div className="text-center border-l border-slate-200">
                            <p className="text-xs text-slate-500 uppercase font-semibold">Net Salary</p>
                            <p className="text-xl font-bold text-primary">₹{Math.round(netPay)}</p>
                        </div>
                        <div className="text-center border-l border-slate-200 bg-blue-50 rounded py-1">
                            <p className="text-xs text-slate-500 uppercase font-semibold">CTC</p>
                            <p className="text-xl font-bold text-blue-700">₹{Math.round(ctc)}</p>
                        </div>
                    </div>
                    
                    <div className="p-4 border-t border-slate-200 bg-white flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50">Cancel</button>
                        <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">Save Structure</button>
                    </div>
                </form>
            </div>
        </>,
        document.body
    );
};

export default AssignSalaryStructureForm;
