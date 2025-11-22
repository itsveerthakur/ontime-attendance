
import React from 'react';
import { ComplianceIcon, ChevronRightIcon } from '../../components/icons';

interface CompliancesProps {
    onBack: () => void;
}

const Compliances: React.FC<CompliancesProps> = ({ onBack }) => {
    return (
        <div>
             <div className="flex items-center text-sm text-slate-500 mb-6">
                <span onClick={onBack} className="cursor-pointer hover:text-primary">Payroll</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Compliances</span>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="bg-primary/10 p-6 rounded-full mb-4">
                    <ComplianceIcon className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Compliance Management</h3>
                <p className="text-slate-600 max-w-md">
                    Manage statutory compliances like PF, ESIC, PT, and TDS. Configure rules, generate challans, and track filing status here.
                </p>
                <button className="mt-6 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                    Configure Rules
                </button>
            </div>
        </div>
    );
};

export default Compliances;
