
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
    const [companyName, setCompanyName] = useState('My Organization');
    const [logoUrl, setLogoUrl] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
                if (data) {
                    setCompanyName(data.company_name || 'My Organization');
                    setLogoUrl(data.logo_url || '');
                }
            } catch (e) {
                console.warn("Settings fetch failed, using defaults.");
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
                        ['basic', 'hra', 'allowance', 'bonus', 'special', 'incentive', 'arrear', 'da', 'ma'].some(term => k.toLowerCase().includes(term))
                    );
                    const deductionKeys = Object.keys(row).filter(k => 
                        ['pf', 'esi', 'tax', 'tds', 'loan', 'advance', 'deduction', 'pt', 'lwf'].some(term => k.toLowerCase().includes(term))
                    );

                    const earnings = earningsKeys.map(k => ({ name: k, amount: parseFloat(row[k]) || 0 }));
                    const deductions = deductionKeys.map(k => ({ name: k, amount: parseFloat(row[k]) || 0 }));
                    const totalEarnings = earnings.reduce((a, b) => a + b.amount, 0);
                    const totalDeductions = deductions.reduce((a, b) => a + b.amount, 0);

                    return {
                        employeeId: String(row['Employee ID'] || row['ID'] || row['Code'] || row['EmployeeCode'] || ''),
                        employeeName: String(row['Name'] || row['Employee Name'] || row['FirstName'] || ''),
                        designation: String(row['Designation'] || 'Employee'),
                        department: String(row['Department'] || ''),
                        uanNo: String(row['UAN'] || row['UAN NO'] || ''),
                        pfNo: String(row['PF NO'] || row['PF'] || ''),
                        esicNo: String(row['ESIC NO'] || row['ESIC'] || ''),
                        bankName: String(row['Bank'] || row['Bank Name'] || ''),
                        bankAccount: String(row['Account'] || row['A/C NO'] || ''),
                        payPeriodStart: new Date().toISOString(),
                        payPeriodEnd: new Date().toISOString(),
                        earnings,
                        deductions,
                        totalEarnings,
                        totalDeductions,
                        netPay: totalEarnings - totalDeductions,
                        paidDays: Number(row['Paid Days'] || row['Days'] || row['Present'] || 30),
                        workingDays: 30
                    };
                }).filter(p => p.employeeName && p.employeeName !== 'undefined');

                setPayslips(parsedPayslips);
            } catch (err) {
                console.error("Error parsing Excel:", err);
                alert("Failed to parse Excel file. Ensure columns like 'Name' and 'Basic' exist.");
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDownloadTemplate = () => {
        const headers = [['Employee ID', 'Name', 'Designation', 'Department', 'Basic', 'HRA', 'Allowance', 'PF', 'ESIC', 'Loan', 'TDS', 'Paid Days']];
        const sampleData = [['EMP101', 'Sample User', 'Staff', 'Operations', 20000, 8000, 2000, 1800, 150, 0, 0, 30]];
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Payslip_Generator_Template.xlsx");
    };

    return (
        <div className="max-w-6xl mx-auto animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase leading-none">Instant Payslip Generator</h1>
                    <p className="text-slate-500 mt-2 text-lg">Convert any Excel sheet into professional payslips in seconds.</p>
                </div>
                <button 
                    onClick={handleDownloadTemplate}
                    className="flex items-center space-x-2 bg-white border-2 border-slate-200 text-slate-700 px-6 py-3 rounded-2xl hover:bg-slate-50 transition-all shadow-sm font-black uppercase text-xs tracking-widest"
                >
                    <DownloadIcon className="w-5 h-5 text-primary" />
                    <span>Download Template</span>
                </button>
            </div>

            {!payslips.length ? (
                <div className="mt-12">
                    <FileUpload onFileSelect={handleFileSelect} selectedFile={null} disabled={isProcessing} />
                    {isProcessing && (
                        <div className="mt-10 flex flex-col items-center justify-center">
                            <LoaderIcon className="w-16 h-16 text-primary animate-spin mb-4" />
                            <span className="font-black text-slate-800 uppercase tracking-widest">Compiling Records...</span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b bg-slate-50/50 flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                             <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600">
                                <CheckCircleIcon className="w-6 h-6" />
                             </div>
                             <div>
                                <span className="font-black text-slate-800 uppercase tracking-tight block leading-none">{payslips.length} Employees Found</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ready for generation</span>
                             </div>
                        </div>
                        <button onClick={() => setPayslips([])} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-colors">
                            Discard & Start Over
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                                <tr>
                                    <th className="px-8 py-4">EMP Code</th>
                                    <th className="px-4 py-4">Employee Name</th>
                                    <th className="px-4 py-4 text-right">Gross Earnings</th>
                                    <th className="px-4 py-4 text-right">Deductions</th>
                                    <th className="px-4 py-4 text-right font-black text-primary">Net Payable</th>
                                    <th className="px-8 py-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {payslips.map((p, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-4 text-slate-400 font-mono font-bold uppercase">{p.employeeId}</td>
                                        <td className="px-4 py-4 font-black text-slate-800 uppercase tracking-tight">{p.employeeName}</td>
                                        <td className="px-4 py-4 text-right text-blue-600 font-bold">₹{p.totalEarnings.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-right text-red-500 font-bold">₹{p.totalDeductions.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-right font-black text-green-700 text-lg">₹{p.netPay.toLocaleString()}</td>
                                        <td className="px-8 py-4 text-center">
                                            <button 
                                                onClick={() => { setSelectedPayslip(p); setShowModal(true); }}
                                                className="inline-flex items-center space-x-2 px-5 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-all shadow-md text-xs font-black uppercase tracking-widest"
                                            >
                                                <EyeIcon className="w-4 h-4" />
                                                <span>View Slip</span>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-5xl rounded-[32px] shadow-2xl flex flex-col my-8 animate-fadeIn overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 uppercase tracking-tight">Payslip Preview - {selectedPayslip.employeeName}</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                                <XCircleIcon className="w-8 h-8" />
                            </button>
                        </div>
                        <div className="p-10 overflow-y-auto bg-slate-200/30">
                            <Payslip data={selectedPayslip} companyName={companyName} logoUrl={logoUrl} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExcelPayslipGenerator;
