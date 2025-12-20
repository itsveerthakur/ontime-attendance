
import React, { useState, useEffect } from 'react';
import FileUpload from '../components/FileUpload';
import Payslip from '../components/Payslip';
import { ChevronRightIcon, DownloadIcon, PrinterIcon, EyeIcon, XCircleIcon, CheckCircleIcon, LoaderIcon } from '../components/icons';
import type { PayslipData } from '../types';
import { supabase } from '../supabaseClient';

declare const XLSX: any;

const ExcelPayslipGenerator: React.FC = () => {
    const [payslips, setPayslips] = useState<PayslipData[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedPayslip, setSelectedPayslip] = useState<PayslipData | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [companyName, setCompanyName] = useState('My Company');
    const [logoUrl, setLogoUrl] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
            if (data) {
                setCompanyName(data.company_name);
                setLogoUrl(data.logo_url);
            }
        };
        fetchSettings();
    }, []);

    const handleFileSelect = (file: File) => {
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                const parsedPayslips: PayslipData[] = json.map((row: any) => {
                    const earningsKeys = Object.keys(row).filter(k => 
                        ['basic', 'hra', 'allowance', 'bonus', 'special', 'incentive'].some(term => k.toLowerCase().includes(term))
                    );
                    const deductionKeys = Object.keys(row).filter(k => 
                        ['pf', 'esi', 'tax', 'tds', 'loan', 'advance', 'deduction'].some(term => k.toLowerCase().includes(term))
                    );

                    const earnings = earningsKeys.map(k => ({ name: k, amount: Number(row[k]) || 0 }));
                    const deductions = deductionKeys.map(k => ({ name: k, amount: Number(row[k]) || 0 }));
                    const totalEarnings = earnings.reduce((a, b) => a + b.amount, 0);
                    const totalDeductions = deductions.reduce((a, b) => a + b.amount, 0);

                    return {
                        employeeId: String(row['Employee ID'] || row['ID'] || row['Code'] || ''),
                        employeeName: String(row['Name'] || row['Employee Name'] || ''),
                        designation: String(row['Designation'] || 'Employee'),
                        department: String(row['Department'] || ''),
                        uanNo: String(row['UAN'] || ''),
                        payPeriodStart: new Date().toISOString(),
                        payPeriodEnd: new Date().toISOString(),
                        earnings,
                        deductions,
                        totalEarnings,
                        totalDeductions,
                        netPay: totalEarnings - totalDeductions,
                        paidDays: Number(row['Paid Days'] || row['Days'] || 30),
                        workingDays: 30
                    };
                }).filter(p => p.employeeName);

                setPayslips(parsedPayslips);
            } catch (err) {
                console.error("Error parsing Excel:", err);
                alert("Failed to parse Excel file. Please ensure it follows the correct format.");
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDownloadTemplate = () => {
        const headers = [['Employee ID', 'Employee Name', 'Designation', 'Department', 'Basic Salary', 'HRA', 'Special Allowance', 'PF', 'ESIC', 'Loan', 'TDS', 'Paid Days']];
        const sampleData = [['EMP001', 'John Doe', 'Manager', 'HR', 25000, 10000, 5000, 1800, 0, 0, 0, 30]];
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "PayslipTemplate");
        XLSX.writeFile(wb, "Payslip_Import_Template.xlsx");
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Excel Payslip Generator</h1>
                    <p className="text-slate-600 mt-1">Upload calculated salary sheet to generate payslips instantly.</p>
                </div>
                <button 
                    onClick={handleDownloadTemplate}
                    className="flex items-center space-x-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium"
                >
                    <DownloadIcon className="w-4 h-4" />
                    <span>Download Template</span>
                </button>
            </div>

            {!payslips.length ? (
                <div className="mt-10">
                    <FileUpload onFileSelect={handleFileSelect} selectedFile={null} disabled={isProcessing} />
                    {isProcessing && (
                        <div className="mt-6 flex flex-col items-center justify-center text-primary animate-pulse">
                            <LoaderIcon className="w-10 h-10 animate-spin mb-2" />
                            <span className="font-bold">Processing Sheet Data...</span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden fade-in">
                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                             <CheckCircleIcon className="w-5 h-5 text-green-500" />
                             <span className="font-bold text-slate-700">{payslips.length} Employees Found</span>
                        </div>
                        <button onClick={() => setPayslips([])} className="text-sm text-red-500 hover:underline flex items-center">
                            <XCircleIcon className="w-4 h-4 mr-1" /> Start Over
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-700 uppercase text-xs font-bold">
                                <tr>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Designation</th>
                                    <th className="px-6 py-4 text-right">Gross</th>
                                    <th className="px-6 py-4 text-right">Deduction</th>
                                    <th className="px-6 py-4 text-right font-black">Net Pay</th>
                                    <th className="px-6 py-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {payslips.map((p, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-slate-500 font-mono">{p.employeeId}</td>
                                        <td className="px-6 py-4 font-bold text-slate-800">{p.employeeName}</td>
                                        <td className="px-6 py-4 text-slate-600">{p.designation}</td>
                                        <td className="px-6 py-4 text-right text-blue-600">₹{p.totalEarnings.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right text-red-500">₹{p.totalDeductions.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-black text-green-700">₹{p.netPay.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => { setSelectedPayslip(p); setShowModal(true); }}
                                                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm text-xs font-bold"
                                            >
                                                <EyeIcon className="w-3.5 h-3.5" />
                                                <span>Preview</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showModal && selectedPayslip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col my-8">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <h3 className="font-bold text-slate-800">Payslip Preview - {selectedPayslip.employeeName}</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <XCircleIcon className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto max-h-[75vh]">
                            <Payslip data={selectedPayslip} companyName={companyName} logoUrl={logoUrl} />
                        </div>
                        <div className="p-4 bg-slate-50 border-t flex justify-end rounded-b-2xl">
                             <button 
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors mr-3 font-bold text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExcelPayslipGenerator;
