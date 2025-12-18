import React from 'react';
import type { PayslipData } from '../types';

interface PayslipProps {
  data: PayslipData;
  companyName: string;
  logoUrl?: string;
  companyDetails?: any;
}

const Payslip: React.FC<PayslipProps> = ({ data, companyName, logoUrl, companyDetails }) => {
  const openPrintWindow = () => {
    const payslipContent = document.querySelector('.payslip-container')?.outerHTML;
    const monthYear = new Date(data.payPeriodEnd).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const newWindow = window.open('', '_blank');
    if (newWindow && payslipContent) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payslip - ${data.employeeId} - ${monthYear}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              @page { size: A4; margin: 12mm; }
              body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
            }
            /* keep some minimal styling for print preview window buttons */
            body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
          </style>
        </head>
        <body class="bg-white p-4">
          ${payslipContent}
          <div class="mt-6 text-center no-print">
            <button onclick="window.print()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 mr-4">Print</button>
            <button onclick="window.close()" class="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700">Close</button>
          </div>
        </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    if (typeof dateString === 'number') {
        return new Date(Math.round((dateString - 25569) * 86400 * 1000)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);
  };

  const numberToWords = (num: number): string => {
    const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

    if ((num = num.toString() as any).length > 9) return 'Overflow';
    const n: any = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; 
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only' : 'Only';
    return str;
  };

  const fullAddress = [
      companyDetails?.address_line_1,
      companyDetails?.address_line_2,
      companyDetails?.city,
      companyDetails?.state,
      companyDetails?.zip_code,
      companyDetails?.country
  ].filter(Boolean).join(', ');

  return (
    <div>
      {/* Print Button */}
      <div className="flex justify-end mb-4 no-print">
        <button 
          onClick={openPrintWindow}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <span>Print/Download</span>
        </button>
      </div>

      {/* Payslip container: includes print-specific styles inline so outerHTML contains them for the print window */}
      <div className="payslip-container bg-white p-8 max-w-[210mm] mx-auto border border-gray-300 shadow-sm text-slate-800 text-sm font-sans leading-normal box-border">
        {/* Inline style that will be included in outerHTML for the print window */}
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
            /* Print & PDF specific rules included in the DOM so new window has them */
            .payslip-container { box-sizing: border-box; width: 210mm; max-width: 210mm; padding: 20px; background: #ffffff; }
            .payslip-container * { box-sizing: border-box; }
            /* Reduce visual chrome for print */
            .payslip-container { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            /* Remove shadows/rounded corners in print */
            @media print {
              .payslip-container { box-shadow: none !important; border: none !important; background: #fff !important; }
              .no-print { display: none !important; }
            }
            /* Ensure tables don't collapse or split mid-row */
            .salary-table, .salary-table tbody, .salary-table tr { page-break-inside: avoid; }
            .salary-table th, .salary-table td { vertical-align: middle; }
            /* Force fixed layout so columns keep their widths when rendering to PDF */
            .salary-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .salary-table .desc { width: 65%; padding: 10px; word-wrap: break-word; }
            .salary-table .amt { width: 35%; text-align: right; padding: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace; }
            /* Small helper to avoid line-height causing extra page growth */
            .payslip-container p, .payslip-container span { line-height: 1.15; }
            /* Prevent header/footer from moving to next page */
            .header-block, .employee-block, .totals-block, .netpay-block { page-break-inside: avoid; }
            /* Reduce borders and use hairline for PDF */
            .thin-border { border: 1px solid #d6d9de; }
            .dashed-row { border-bottom: 1px dashed #e6e9ec; }
            /* Ensure long description doesn't stretch row height excessively */
            .truncate-1 { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          `,
          }}
        />
      
      {/* Header */}
      <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-4 header-block">
        <div className="flex items-center space-x-4">
            {logoUrl && (
                <img src={logoUrl} alt="Company Logo" className="h-16 w-auto object-contain max-w-[120px]" />
            )}
            <div>
                <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900">{companyName}</h1>
                <p className="text-xs text-slate-600 max-w-md leading-snug">{fullAddress}</p>
            </div>
        </div>
        <div className="text-right">
            <h2 className="text-xl font-bold text-slate-700 uppercase">Payslip</h2>
            <p className="text-sm font-medium text-slate-600">{new Date(data.payPeriodEnd).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Employee Details Grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 thin-border p-4 rounded-lg bg-slate-50/50 employee-block" style={{ background: '#fbfcfd' }}>
        <div className="grid grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-600">Name:</span>
            <span className="font-bold text-slate-900 uppercase">{data.employeeName}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-600">Employee ID:</span>
            <span className="text-slate-900">{data.employeeId}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-600">Designation:</span>
            <span className="text-slate-900">{data.designation}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-600">Department:</span>
            <span className="text-slate-900">{data.department || '-'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-600">Date of Joining:</span>
            <span className="text-slate-900">{formatDate(data.dateOfJoining || '')}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-600">Bank Name:</span>
            <span className="text-slate-900">{data.bankName || '-'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-600">Account No:</span>
            <span className="text-slate-900">{data.bankAccount || '-'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-600">UAN No:</span>
            <span className="text-slate-900">{data.uanNo || '-'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-600">PF No:</span>
            <span className="text-slate-900">{data.pfNo || '-'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-600">ESIC No:</span>
            <span className="text-slate-900">{data.esicNo || '-'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-600">Paid Days:</span>
            <span className="text-slate-900">{data.paidDays} / {data.workingDays}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
            <span className="font-semibold text-slate-600">LWP Days:</span>
            <span className="text-slate-900">{data.lopDays}</span>
        </div>
      </div>

      {/* Salary Table */}
      <div className="border border-slate-800 mb-6 salary-block thin-border">
        <div className="grid grid-cols-2 bg-slate-100 border-b border-slate-800 font-bold text-slate-800">
            <div className="p-2 border-r border-slate-800 text-center uppercase">Earnings</div>
            <div className="p-2 text-center uppercase">Deductions</div>
        </div>

        <div className="grid grid-cols-2">
            {/* Earnings Column */}
            <div className="border-r border-slate-800">
                <table className="salary-table" role="table" aria-label="earnings">
                  <thead>
                    <tr className="font-semibold text-slate-700 border-b border-slate-300 bg-slate-50/50">
                      <th className="desc" style={{ textAlign: 'left', borderRight: '1px solid #e6e9ec' }}>Description</th>
                      <th className="amt" style={{ textAlign: 'right' }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                  {data.earnings.map((item, i) => (
                    <tr key={i} className="dashed-row">
                      <td className="desc">{item.name}</td>
                      <td className="amt">{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  </tbody>
                </table>
            </div>

            {/* Deductions Column */}
            <div>
              <table className="salary-table" role="table" aria-label="deductions">
                <thead>
                  <tr className="font-semibold text-slate-700 border-b border-slate-300 bg-slate-50/50">
                    <th className="desc" style={{ textAlign: 'left', borderRight: '1px solid #e6e9ec' }}>Description</th>
                    <th className="amt" style={{ textAlign: 'right' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                {data.deductions.map((item, i) => (
                  <tr key={i} className="dashed-row">
                    <td className="desc">{item.name}</td>
                    <td className="amt">{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
        </div>

        {/* Total Row */}
        <div className="grid grid-cols-2 border-t border-slate-800 bg-slate-100 font-bold text-slate-900 totals-block">
            <div className="grid grid-cols-[1fr_160px] border-r border-slate-800">
                <div className="p-2 text-right border-r border-slate-300">Total Earnings</div>
                <div className="p-2 text-right">{formatCurrency(data.totalEarnings)}</div>
            </div>
            <div className="grid grid-cols-[1fr_160px]">
                <div className="p-2 text-right border-r border-slate-300">Total Deductions</div>
                <div className="p-2 text-right">{formatCurrency(data.totalDeductions)}</div>
            </div>
        </div>
      </div>

      {/* Net Pay Section */}
      <div className="flex justify-between items-end border-2 border-slate-800 p-4 mb-8 bg-slate-50 netpay-block">
        <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Net Salary In Words</p>
            <p className="font-bold text-slate-800 italic capitalize">{numberToWords(Math.round(data.netPay))}</p>
        </div>
        <div className="text-right">
            <p className="text-sm font-bold text-slate-600 uppercase mb-1">Net Payable</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(data.netPay)}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-slate-500 mt-8 pt-4 border-t border-slate-200 footer-block">
        <p>This is a computer-generated document and does not require a signature.</p>
        <p>&copy; {new Date().getFullYear()} {companyName}. All Rights Reserved.</p>
      </div>
    </div>
    </div>
  );
};

export default Payslip;
// export default Payslip