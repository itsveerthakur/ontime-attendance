import React from 'react';

const Reports: React.FC = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800">Reports</h1>
      <p className="text-slate-600 mt-1">Generate and view detailed HR analytics.</p>
      <div className="mt-6 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
        <p className="text-slate-600">
          This area will provide various reporting and analytics tools, allowing you to generate reports on attendance, payroll, employee demographics, and more.
        </p>
      </div>
    </div>
  );
};

export default Reports;