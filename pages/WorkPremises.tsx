
import React, { useState, useRef, useEffect } from 'react';
import type { Page } from '../App';
import type { WorkPremise } from '../types';
import { supabase } from '../supabaseClient';
import { ChevronRightIcon, PlusIcon, DotsVerticalIcon, TrashIcon, XCircleIcon, CheckCircleIcon, LoaderIcon } from '../components/icons';
import AddWorkPremiseForm from '../components/AddWorkPremiseForm';

interface WorkPremisesProps {
  setActivePage: (page: Page) => void;
}

const WorkPremises: React.FC<WorkPremisesProps> = ({ setActivePage }) => {
    const [premises, setPremises] = useState<WorkPremise[]>([]);
    const [isAddFormOpen, setIsAddFormOpen] = useState(false);
    const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const fetchPremises = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('work_premises').select('*');
        if (error) console.error("Error fetching work premises:", error.message);
        else setPremises(data || []);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchPremises();
    }, []);

    const handleSave = async (data: Omit<WorkPremise, 'id' | 'employeeCount'>) => {
        const { error } = await supabase.from('work_premises').insert([{ ...data, employeeCount: 0 }]);
        if (error) console.error("Error saving work premise:", error.message);
        else fetchPremises();
    };
    
    const handleDelete = async (id: number) => {
        if (id && window.confirm('Are you sure you want to delete this work premise?')) {
            const { error } = await supabase.from('work_premises').delete().eq('id', id);
            if (error) console.error("Error deleting work premise:", error.message);
            else fetchPremises();
        }
    };

    const handleToggleStatus = async (item: WorkPremise) => {
        if (item.id) {
            const newStatus = item.status === 'active' ? 'inactive' : 'active';
            const { error } = await supabase.from('work_premises').update({ status: newStatus }).eq('id', item.id);
            if (error) console.error("Error updating status:", error.message);
            else {
                fetchPremises();
                setOpenActionMenuId(null);
            }
        }
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
                <span className="font-semibold text-slate-700">Work Premises</span>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <LoaderIcon className="w-8 h-8 text-primary animate-spin" />
                    <p className="mt-2 text-slate-500">Loading work premises...</p>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Work Premises Listing</h2>
                        <div className="flex items-center space-x-2">
                            <button 
                                onClick={() => setIsAddFormOpen(true)}
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">
                                <PlusIcon className="w-5 h-5" />
                                <span>Add New Work Premises</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                <tr>
                                    <th scope="col" className="px-6 py-3 font-semibold rounded-l-lg">ID</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">Work Premises</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">No. of Employees</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">Status</th>
                                    <th scope="col" className="px-6 py-3 font-semibold rounded-r-lg">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {premises.map((item, index) => (
                                    <tr key={item.id} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-4">{index + 1}</td>
                                        <td className="px-6 py-4 font-medium text-slate-800">{item.name}</td>
                                        <td className="px-6 py-4"><span className="px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full">{item.employeeCount} Members</span></td>
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
                                                            <a href="#" onClick={() => handleToggleStatus(item)} className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-100 cursor-pointer">
                                                                {item.status === 'active' ? <XCircleIcon className="w-4 h-4 text-red-500" /> : <CheckCircleIcon className="w-4 h-4 text-green-500" />}
                                                                <span>{item.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                                                            </a>
                                                        </li>
                                                        <li>
                                                            <a href="#" onClick={() => item.id && handleDelete(item.id)} className="flex items-center space-x-3 px-4 py-2 text-red-600 hover:bg-red-50 cursor-pointer"><TrashIcon className="w-4 h-4" /><span>Delete</span></a>
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
            <AddWorkPremiseForm isOpen={isAddFormOpen} onClose={() => setIsAddFormOpen(false)} onSave={handleSave} />
        </div>
    );
};

export default WorkPremises;
