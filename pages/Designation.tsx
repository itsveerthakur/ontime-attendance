
import React, { useState, useRef, useEffect } from 'react';
import type { Page } from '../App';
import type { Designation } from '../types';
import { supabase } from '../supabaseClient';
import { ChevronRightIcon, PlusIcon, DotsVerticalIcon, TrashIcon, XCircleIcon, CheckCircleIcon, LoaderIcon, ImportIcon } from '../components/icons';
import AddDesignationForm from '../components/AddDesignationForm';

// Declare XLSX for global usage
declare const XLSX: any;

interface DesignationProps {
  setActivePage: (page: Page) => void;
}

const Designation: React.FC<DesignationProps> = ({ setActivePage }) => {
    const [designations, setDesignations] = useState<Designation[]>([]);
    const [isAddFormOpen, setIsAddFormOpen] = useState(false);
    const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const fetchDesignations = async (background = false) => {
        if (!background) setIsLoading(true);
        try {
            const [desigRes, empRes] = await Promise.all([
                supabase.from('designations').select('*').order('name'),
                supabase.from('employees').select('designation').eq('status', 'Active')
            ]);

            if (desigRes.error) throw desigRes.error;

            const empCounts: Record<string, number> = {};
            if (empRes.data) {
                empRes.data.forEach((e: any) => {
                    const dName = e.designation ? e.designation.trim() : null;
                    if (dName) {
                        empCounts[dName] = (empCounts[dName] || 0) + 1;
                    }
                });
            }

            const dataWithCounts = (desigRes.data || []).map((d: any) => ({
                ...d,
                employeeCount: empCounts[d.name ? d.name.trim() : ''] || 0
            }));

            setDesignations(dataWithCounts);
        } catch (error: any) {
            console.error("Error fetching designations:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDesignations();
    }, []);

    const handleSave = async (data: Omit<Designation, 'id' | 'employeeCount'>) => {
        // Check uniqueness locally
        const exists = designations.some(d => d.name.toLowerCase() === data.name.toLowerCase());
        if (exists) {
            alert("A designation with this name already exists.");
            return;
        }

        const { error } = await supabase.from('designations').insert([{ ...data, employeeCount: 0 }]);
        if (error) {
            console.error("Error saving designation:", error.message);
            alert(`Error saving designation: ${error.message}`);
        } else {
            fetchDesignations(true);
        }
    };
    
    const handleDelete = async (id: number) => {
        if (id && window.confirm('Are you sure you want to delete this designation?')) {
            setOpenActionMenuId(null);
            const { error } = await supabase.from('designations').delete().eq('id', id);
            if (error) {
                console.error("Error deleting designation:", error.message);
                alert("Failed to delete designation: " + error.message);
            } else {
                fetchDesignations(true);
            }
        }
    };

    const handleToggleStatus = async (item: Designation) => {
        if (item.id) {
            setOpenActionMenuId(null);
            const newStatus = item.status === 'active' ? 'inactive' : 'active';
            
            // Optimistic Update
            setDesignations(prev => prev.map(d => d.id === item.id ? { ...d, status: newStatus } : d));

            const { error } = await supabase.from('designations').update({ status: newStatus }).eq('id', item.id);
            if (error) {
                console.error("Error updating status:", error.message);
                alert("Failed to update status. Reverting changes.");
                fetchDesignations(true); // Revert
            }
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const existingNames = new Set(designations.map(d => d.name.toLowerCase()));
                const validDesignations = [];
                const skippedNames = [];

                for (const row of data as any[]) {
                    const name = row['Designation Name'] || row['Designation'] || row['name'];
                    if (name) {
                        const trimmedName = name.trim();
                        if (existingNames.has(trimmedName.toLowerCase())) {
                            skippedNames.push(trimmedName);
                        } else {
                            validDesignations.push({
                                name: trimmedName,
                                status: (row['Status'] || 'active').toLowerCase(),
                                employeeCount: 0
                            });
                            existingNames.add(trimmedName.toLowerCase()); // Prevent duplicates within import
                        }
                    }
                }

                if (validDesignations.length === 0) {
                    if (skippedNames.length > 0) {
                        alert(`All ${skippedNames.length} designations in file already exist.`);
                    } else {
                        alert("No valid designation data found. Ensure columns are 'Designation Name' and 'Status'.");
                    }
                    return;
                }

                const { error } = await supabase.from('designations').insert(validDesignations);

                if (error) throw error;

                let msg = `Successfully imported ${validDesignations.length} designations.`;
                if (skippedNames.length > 0) {
                    msg += `\nSkipped ${skippedNames.length} duplicates.`;
                }
                alert(msg);
                fetchDesignations(true);
            } catch (err: any) {
                console.error("Import error:", err);
                alert("Failed to import: " + (err.message || "Unknown error"));
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setOpenActionMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div>
            <div className="flex items-center text-sm text-slate-500 mb-6">
                <span onClick={() => setActivePage('Dashboards')} className="cursor-pointer hover:text-primary">Home</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span onClick={() => setActivePage('Master Management')} className="cursor-pointer hover:text-primary">Master Management</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Designation</span>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <LoaderIcon className="w-8 h-8 text-primary animate-spin" />
                    <p className="mt-2 text-slate-500">Loading designations...</p>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Designation Listing</h2>
                        <div className="flex items-center space-x-2">
                            <button className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50">
                                Export
                            </button>
                            <label className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg shadow-sm hover:bg-orange-600 cursor-pointer">
                                <ImportIcon className="w-5 h-5" />
                                <span>Import</span>
                                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                            </label>
                            <button 
                                onClick={() => setIsAddFormOpen(true)}
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">
                                <PlusIcon className="w-5 h-5" />
                                <span>Add New Designation</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-4">
                         <div className="text-sm">
                            <label htmlFor="entries" className="text-slate-600">Show </label>
                            <select id="entries" className="mx-1.5 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light">
                                <option>10</option>
                                <option>25</option>
                                <option>50</option>
                            </select>
                            <span className="text-slate-600">entries</span>
                        </div>
                         <div className="relative">
                             <label htmlFor="search" className="text-sm text-slate-600 mr-2">Search:</label>
                             <input type="text" id="search" className="w-48 border border-slate-300 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-light"/>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                <tr>
                                    <th scope="col" className="px-6 py-3 font-semibold rounded-l-lg">ID</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">Designation</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">No. of Employees</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">Status</th>
                                    <th scope="col" className="px-6 py-3 font-semibold rounded-r-lg">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {designations.map((item, index) => (
                                    <tr key={item.id} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-4">{index + 1}</td>
                                        <td className="px-6 py-4 font-medium text-slate-800">{item.name}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full">
                                                {item.employeeCount} Active
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center text-xs font-semibold ${item.status === 'active' ? 'text-green-800' : 'text-red-800'}`}>
                                                <span className={`h-2 w-2 rounded-full ${item.status === 'active' ? 'bg-green-500' : 'bg-red-500'} mr-2`}></span>
                                                {item.status === 'active' ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 relative">
                                             <button 
                                                onClick={() => setOpenActionMenuId(openActionMenuId === item.id ? null : item.id)}
                                                className="p-1.5 rounded-full hover:bg-slate-200"
                                            >
                                                <DotsVerticalIcon className="w-5 h-5 text-slate-500" />
                                            </button>
                                            {openActionMenuId === item.id && (
                                                <div ref={actionMenuRef} className="absolute right-12 top-10 z-10 w-40 bg-white rounded-lg shadow-lg border border-slate-200">
                                                    <ul className="py-1 text-sm text-slate-700">
                                                        <li>
                                                            <a href="#" onClick={(e) => { e.preventDefault(); handleToggleStatus(item); }} className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-100 cursor-pointer">
                                                                {item.status === 'active' ? <XCircleIcon className="w-4 h-4 text-red-500" /> : <CheckCircleIcon className="w-4 h-4 text-green-500" />}
                                                                <span>{item.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                                                            </a>
                                                        </li>
                                                        <li>
                                                            <a href="#" onClick={(e) => { e.preventDefault(); item.id && handleDelete(item.id); }} className="flex items-center space-x-3 px-4 py-2 text-red-600 hover:bg-red-50 cursor-pointer"><TrashIcon className="w-4 h-4" /><span>Delete</span></a>
                                                        </li>
                                                    </ul>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <AddDesignationForm isOpen={isAddFormOpen} onClose={() => setIsAddFormOpen(false)} onSave={handleSave} />
        </div>
    );
};

export default Designation;
