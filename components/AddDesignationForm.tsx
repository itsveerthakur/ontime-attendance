
import React, { useState } from 'react';
import { XCircleIcon } from './icons';
import type { Designation } from '../types';

interface AddDesignationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (designation: Omit<Designation, 'id' | 'employeeCount'>) => void;
}

const AddDesignationForm: React.FC<AddDesignationFormProps> = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [status, setStatus] = useState<'active' | 'inactive'>('active');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        onSave({ name, status });
        setName('');
        setStatus('active');
        onClose();
    };

    return (
        <>
            <div className={`fixed inset-0 bg-black/50 z-20 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-30 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="flex justify-between items-center p-5 border-b border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800">Add New Designation</h2>
                        <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100">
                            <XCircleIcon className="w-8 h-8" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Designation Name <span className="text-red-500">*</span></label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Status <span className="text-red-500">*</span></label>
                            <select value={status} onChange={e => setStatus(e.target.value as 'active' | 'inactive')} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50">Cancel</button>
                        <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">Save</button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AddDesignationForm;
