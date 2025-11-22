
import React, { useState, useEffect } from 'react';
import { XCircleIcon } from './icons';
import type { Role } from '../types';

interface AddRoleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (role: Omit<Role, 'id' | 'employeeCount'>) => void;
  roleToEdit?: Role | null;
}

const MODULES = [
    'Dashboards',
    'Master Management',
    'Attendance Management',
    'Shift Management',
    'Leave Management',
    'Request',
    'Payroll',
    'Reports',
    'Compliance Management',
    'Support'
];

// Helper to create a fresh permissions object to avoid reference issues
const getInitialPermissions = () => {
    const perms: Record<string, { view: boolean; add: boolean; edit: boolean; delete: boolean }> = {};
    MODULES.forEach(mod => {
        perms[mod] = { view: false, add: false, edit: false, delete: false };
    });
    return perms;
};

const AddRoleForm: React.FC<AddRoleFormProps> = ({ isOpen, onClose, onSave, roleToEdit }) => {
    const [name, setName] = useState('');
    const [status, setStatus] = useState<'active' | 'inactive'>('active');
    const [permissions, setPermissions] = useState(getInitialPermissions());

    useEffect(() => {
        if (isOpen) {
            if (roleToEdit) {
                setName(roleToEdit.name);
                setStatus(roleToEdit.status);
                
                // Deep copy existing permissions to ensure no shared references
                const freshPerms = getInitialPermissions();
                Object.keys(roleToEdit.permissions).forEach(key => {
                    if (freshPerms[key]) {
                        freshPerms[key] = { ...roleToEdit.permissions[key] };
                    }
                });
                setPermissions(freshPerms);
            } else {
                // Reset form for new entry
                setName('');
                setStatus('active');
                setPermissions(getInitialPermissions());
            }
        }
    }, [isOpen, roleToEdit]);

    const handlePermissionChange = (moduleName: string, type: 'view' | 'add' | 'edit' | 'delete') => {
        setPermissions(prev => ({
            ...prev,
            [moduleName]: {
                ...prev[moduleName],
                [type]: !prev[moduleName][type]
            }
        }));
    };

    const handleRowToggle = (moduleName: string, checked: boolean) => {
        setPermissions(prev => ({
            ...prev,
            [moduleName]: {
                view: checked,
                add: checked,
                edit: checked,
                delete: checked
            }
        }));
    };
    
    const handleSelectAll = (checked: boolean) => {
        const newPerms = { ...permissions };
        Object.keys(newPerms).forEach(key => {
            newPerms[key] = {
                view: checked,
                add: checked,
                edit: checked,
                delete: checked
            };
        });
        setPermissions(newPerms);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        onSave({ name, status, permissions });
        onClose();
    };

    return (
        <>
            <div className={`fixed inset-0 bg-black/50 z-20 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full w-full max-w-3xl bg-white shadow-2xl z-30 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="flex justify-between items-center p-5 border-b border-slate-200 bg-white">
                        <h2 className="text-xl font-bold text-slate-800">{roleToEdit ? 'Edit Role' : 'Add New Role'}</h2>
                        <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100">
                            <XCircleIcon className="w-8 h-8" />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Role Name <span className="text-red-500">*</span></label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. HR Manager" className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Status <span className="text-red-500">*</span></label>
                                <select value={status} onChange={e => setStatus(e.target.value as 'active' | 'inactive')} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent">
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-slate-800">Permissions</h3>
                                <div className="flex items-center space-x-2">
                                     <input type="checkbox" id="selectAll" onChange={(e) => handleSelectAll(e.target.checked)} className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary-light" />
                                     <label htmlFor="selectAll" className="text-sm font-medium text-slate-700 select-none cursor-pointer">Select All Access</label>
                                </div>
                            </div>
                            
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left text-slate-600">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 font-semibold">Module Name</th>
                                            <th scope="col" className="px-6 py-3 font-semibold text-center">View</th>
                                            <th scope="col" className="px-6 py-3 font-semibold text-center">Add</th>
                                            <th scope="col" className="px-6 py-3 font-semibold text-center">Edit</th>
                                            <th scope="col" className="px-6 py-3 font-semibold text-center">Delete</th>
                                            <th scope="col" className="px-6 py-3 font-semibold text-center">All</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {MODULES.map(module => (
                                            <tr key={module} className="bg-white hover:bg-slate-50">
                                                <td className="px-6 py-3 font-medium text-slate-800">{module}</td>
                                                <td className="px-6 py-3 text-center">
                                                    <input type="checkbox" checked={permissions[module]?.view} onChange={() => handlePermissionChange(module, 'view')} className="w-4 h-4 text-primary rounded focus:ring-primary-light" />
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <input type="checkbox" checked={permissions[module]?.add} onChange={() => handlePermissionChange(module, 'add')} className="w-4 h-4 text-primary rounded focus:ring-primary-light" />
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <input type="checkbox" checked={permissions[module]?.edit} onChange={() => handlePermissionChange(module, 'edit')} className="w-4 h-4 text-primary rounded focus:ring-primary-light" />
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <input type="checkbox" checked={permissions[module]?.delete} onChange={() => handlePermissionChange(module, 'delete')} className="w-4 h-4 text-primary rounded focus:ring-primary-light" />
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={permissions[module]?.view && permissions[module]?.add && permissions[module]?.edit && permissions[module]?.delete} 
                                                        onChange={(e) => handleRowToggle(module, e.target.checked)} 
                                                        className="w-4 h-4 text-primary rounded focus:ring-primary-light" 
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50">Cancel</button>
                        <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">{roleToEdit ? 'Update Role' : 'Save Role'}</button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AddRoleForm;
    