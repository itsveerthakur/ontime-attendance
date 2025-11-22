import React from 'react';
import { RequestIcon } from '../components/icons';

const InfoCard: React.FC<{ title: string }> = ({ title }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-lg hover:border-primary hover:-translate-y-1 transition-all duration-300 group">
        <div className="bg-primary/10 p-4 rounded-full mb-4 transition-colors group-hover:bg-primary">
             <RequestIcon className="w-8 h-8 text-primary transition-colors group-hover:text-white" />
        </div>
        <h3 className="font-semibold text-slate-700 group-hover:text-primary">{title}</h3>
    </div>
);


const Request: React.FC = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800">Requests</h1>
      <p className="text-slate-600 mt-2">Manage employee requests for various activities.</p>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
        <InfoCard title="Onduty" />
        <InfoCard title="Overtime" />
        <InfoCard title="Work From Home" />
        <InfoCard title="Work From Office" />
        <InfoCard title="Attendance Regularization" />
        <InfoCard title="Gate Pass" />
      </div>
    </div>
  );
};

export default Request;