
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XCircleIcon } from './icons';
import type { EarningsComponent } from '../types';

interface AddEarningsComponentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (component: Omit<EarningsComponent, 'id'>) => void;
  editingComponent?: EarningsComponent | null;
}

const AddEarningsComponentForm: React.FC<AddEarningsComponentFormProps> = ({ isOpen, onClose, onSave, editingComponent }) => {
    const [name, setName] = useState('');
    const [calculationPercentage, setCalculationPercentage] = useState('');
    const [basedOn, setBasedOn] = useState('Basic');
    const [maxCalculatedValue, setMaxCalculatedValue] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (editingComponent) {
                setName(editingComponent.name);
                // Handle both property names just in case, ensure 0 is handled correctly
                const pct = editingComponent.calculationPercentage ?? editingComponent.calculation_percentage;
                setCalculationPercentage(pct !== undefined && pct !== null ? String(pct) : '');
                setBasedOn(editingComponent.based_on || 'Basic');
                
                const maxVal = editingComponent.maxCalculatedValue ?? editingComponent.max_calculated_value;
                setMaxCalculatedValue(maxVal !== undefined && maxVal !== null ? String(maxVal) : '');
            } else {
                setName('');
                setCalculationPercentage('');
                setBasedOn('Basic');
                setMaxCalculatedValue('');
            }
        }
    }, [isOpen, editingComponent]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        
        onSave({ 
            name, 
            calculationPercentage: calculationPercentage,
            based_on: basedOn,
            maxCalculatedValue: maxCalculatedValue === '' ? undefined : Number(maxCalculatedValue)
        });
    };

    return createPortal(
        <>
            <div className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="flex justify-between items-center p-5 border-b border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800">{editingComponent ? 'Edit' : 'Add'} Earning Component</h2>
                        <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100">
                            <XCircleIcon className="w-8 h-8" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Component Name <span className="text-red-500">*</span></label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Calculation Percentage</label>
                            <input type="number" step="0.01" placeholder="e.g. 50 or 12.5" value={calculationPercentage} onChange={e => setCalculationPercentage(e.target.value)} className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Max Calculated Value</label>
                            <input type="number" placeholder="Optional max limit amount" value={maxCalculatedValue} onChange={e => setMaxCalculatedValue(e.target.value)} className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent" />
                            <p className="text-xs text-slate-500 mt-1">Limits the final calculated amount to this value.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Based On <span className="text-red-500">*</span></label>
                            <select value={basedOn} onChange={e => setBasedOn(e.target.value)} className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent">
                                <option value="Basic">Basic</option>
                                <option value="Gross">Gross</option>
                                <option value="Fixed">Fixed Amount</option>
                                <option value="HRA">HRA</option>
                            </select>
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50">Cancel</button>
                        <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">{editingComponent ? 'Update' : 'Save'}</button>
                    </div>
                </form>
            </div>
        </>,
        document.body
    );
};

export default AddEarningsComponentForm;