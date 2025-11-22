
import React, { useState, useRef, useEffect } from 'react';
import type { Page } from '../App';
import type { Role } from '../types';
import { supabase } from '../supabaseClient';
import { ChevronRightIcon, PlusIcon, DotsVerticalIcon, TrashIcon, XCircleIcon, CheckCircleIcon, PencilIcon, LoaderIcon } from '../components/icons';
import AddRoleForm from '../components/AddRoleForm';

interface RoleManagementProps {
  setActivePage: (page: Page) => void;
}

const RoleManagement: React.FC<RoleManagementProps> = ({ setActivePage }) => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isAddFormOpen, setIsAddFormOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const fetchRoles = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('roles').select('*').order('id', { ascending: true });
        if (error) {
            console.error("Error fetching roles:", error.message);
            if (error.message.includes('relation "roles" does not exist')) {
                console.warn("Using mock data for Roles.");
                setRoles([]);
            }
        }
        else setRoles(data || []);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const handleSaveRole = async (roleData: Omit<Role, 'id' | 'employeeCount'>) => {
        try {
            let error;
            if (editingRole && editingRole.id) {
                const { error: updateError } = await supabase
                    .from('roles')
                    .update(roleData)
                    .eq('id', editingRole.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('roles')
                    .insert([{ ...roleData, employeeCount: 0 }]);
                error = insertError;
            }

            if (error) throw error;
            
            fetchRoles();
        } catch (err: any) {
            console.error("Error saving role:", err.message);
            alert(`Failed to save role: ${err.message}`);
        }
    };
    
    const handleDelete = async (id: number) => {
        if (id && window.confirm('Are you sure you want to delete this role?')) {
            const { error } = await supabase.from('roles').delete().eq('id', id);
            if (error) console.error("Error deleting role:", error.message);
            else fetchRoles();
        }
    };

    const handleToggleStatus = async (item: Role) => {
        if (item.id) {
            const newStatus = item.status === 'active' ? 'inactive' : 'active';
            const { error } = await supabase.from('roles').update({ status: newStatus }).eq('id', item.id);
            if (error) console.error("Error updating status:", error.message);
            else {
                fetchRoles();
                setOpenActionMenuId(null);
            }
        }
    };

    const handleEdit = (role: Role) => {
        setEditingRole(role);
        setIsAddFormOpen(true);
        setOpenActionMenuId(null);
    };

    const handleCloseForm = () => {
        setIsAddFormOpen(false);
        setEditingRole(null);
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
                <span className="font-semibold text-slate-700">Role Management</span>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <LoaderIcon className="w-8 h-8 text-primary animate-spin" />
                    <p className="mt-2 text-slate-500">Loading roles...</p>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Roles & Permissions</h2>
                        <div className="flex items-center space-x-2">
                            <button className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50">
                                Export
                            </button>
                            <button 
                                onClick={() => setIsAddFormOpen(true)}
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">
                                <PlusIcon className="w-5 h-5" />
                                <span>Add New Role</span>
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
                                    <th scope="col" className="px-6 py-3 font-semibold">Role Name</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">Assigned Users</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">Status</th>
                                    <th scope="col" className="px-6 py-3 font-semibold rounded-r-lg">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roles.length > 0 ? roles.map((item, index) => (
                                    <tr key={item.id} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-4">{index + 1}</td>
                                        <td className="px-6 py-4 font-medium text-slate-800">{item.name}</td>
                                        <td className="px-6 py-4"><span className="px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full">{item.employeeCount} Users</span></td>
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
                                                            <a href="#" onClick={() => handleEdit(item)} className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-100 cursor-pointer">
                                                                <PencilIcon className="w-4 h-4 text-slate-500" />
                                                                <span>Edit</span>
                                                            </a>
                                                        </li>
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
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12 text-slate-500">
                                            <p>No roles found. Create a new role to get started.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <AddRoleForm isOpen={isAddFormOpen} onClose={handleCloseForm} onSave={handleSaveRole} roleToEdit={editingRole} />
        </div>
    );
};

export default RoleManagement;
