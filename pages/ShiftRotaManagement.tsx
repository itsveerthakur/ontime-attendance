
import React, { useState, useEffect, useRef } from 'react';
import { PlusIcon, ChevronRightIcon, XCircleIcon, DotsVerticalIcon, LoaderIcon, ImportIcon, CheckCircleIcon, TrashIcon, PencilIcon } from '../components/icons';
import type { Shift } from '../types';
import { supabase } from '../supabaseClient';

// Declare XLSX for global usage
declare const XLSX: any;

const InputField: React.FC<{ label: string; type?: string; placeholder?: string; required?: boolean; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = ({ label, type = 'text', placeholder, required = false, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
        <input type={type === 'time' ? 'time' : type} placeholder={placeholder || label} required={required} value={value} onChange={onChange} className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent" />
    </div>
);

const SelectField: React.FC<{ label: string; children: React.ReactNode; required?: boolean; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; }> = ({ label, children, required = false, value, onChange }) => (
     <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
        <select required={required} value={value} onChange={onChange} className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent">
            {children}
        </select>
    </div>
);

interface ShiftFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveShift: (shiftData: Omit<Shift, 'id' | 'isNightShift' | 'employeeCount' | 'createdAt'>) => void;
  editingShift: Shift | null;
}

const ShiftForm: React.FC<ShiftFormProps> = ({ isOpen, onClose, onSaveShift, editingShift }) => {
    const [shiftName, setShiftName] = useState('');
    const [status, setStatus] = useState<'active' | 'inactive'>('active');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [inGrace, setInGrace] = useState(0);
    const [outGrace, setOutGrace] = useState(0);
    const [startReminder, setStartReminder] = useState(0);
    const [endReminder, setEndReminder] = useState(0);
    
    useEffect(() => {
        if (isOpen) {
            if (editingShift) {
                setShiftName(editingShift.name);
                setStatus(editingShift.status);
                setStartTime(editingShift.startTime);
                setEndTime(editingShift.endTime);
                setInGrace(editingShift.inGracePeriod);
                setOutGrace(editingShift.outGracePeriod);
                setStartReminder(editingShift.startReminder);
                setEndReminder(editingShift.endReminder);
            } else {
                setShiftName('');
                setStatus('active');
                setStartTime('');
                setEndTime('');
                setInGrace(0);
                setOutGrace(0);
                setStartReminder(0);
                setEndReminder(0);
            }
        }
    }, [isOpen, editingShift]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSaveShift({ 
            name: shiftName, 
            status, 
            startTime: startTime, 
            endTime: endTime,
            inGracePeriod: inGrace,
            outGracePeriod: outGrace,
            startReminder: startReminder,
            endReminder: endReminder,
        });
        onClose();
    };

    return (
        <>
        <div className={`fixed inset-0 bg-black/50 z-20 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
        
        <div className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-30 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
                <div className="flex justify-between items-center p-5 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">{editingShift ? 'Edit Shift' : 'Add New Shift'}</h2>
                    <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-100">
                        <XCircleIcon className="w-8 h-8" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <InputField label="Shift Name" required value={shiftName} onChange={e => setShiftName(e.target.value)} />
                    <SelectField label="Shift Status" required value={status} onChange={e => setStatus(e.target.value as 'active' | 'inactive')}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </SelectField>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Shift Start Time" type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} />
                        <InputField label="Shift End Time" type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="IN Grace Period (mins)" type="number" required value={inGrace} onChange={e => setInGrace(Number(e.target.value))} />
                        <InputField label="OUT Grace Period (mins)" type="number" required value={outGrace} onChange={e => setOutGrace(Number(e.target.value))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Reminder for shift start (mins before)" type="number" required value={startReminder} onChange={e => setStartReminder(Number(e.target.value))} />
                        <InputField label="Reminder for shift end (mins before)" type="number" required value={endReminder} onChange={e => setEndReminder(Number(e.target.value))} />
                    </div>
                </div>
                
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50">Cancel</button>
                    <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">{editingShift ? 'Update Shift' : 'Add New Shift'}</button>
                </div>
            </form>
        </div>
        </>
    );
};

const ShiftManagement: React.FC = () => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const fetchShifts = async (background = false) => {
        if (!background) setIsLoading(true);
        try {
            const [shiftsRes, empRes] = await Promise.all([
                supabase.from('shifts').select('*').order('name'),
                supabase.from('employees').select('shiftId').eq('status', 'Active')
            ]);

            if (shiftsRes.error) throw shiftsRes.error;

            const empCounts: Record<number, number> = {};
            if (empRes.data) {
                empRes.data.forEach((e: any) => {
                    if (e.shiftId) {
                        empCounts[e.shiftId] = (empCounts[e.shiftId] || 0) + 1;
                    }
                });
            }

            const dataWithCounts = (shiftsRes.data || []).map((s: any) => ({
                ...s,
                employeeCount: empCounts[s.id] || 0
            }));

            setShifts(dataWithCounts);
        } catch (error: any) {
            console.error("Error fetching shifts:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchShifts();
    }, []);

    const handleSaveShift = async (shiftData: Omit<Shift, 'id' | 'isNightShift' | 'employeeCount' | 'createdAt'>) => {
        if (!editingShift) {
            const exists = shifts.some(s => s.name.toLowerCase() === shiftData.name.toLowerCase());
            if (exists) {
                alert("A shift with this name already exists.");
                return;
            }
        }

        if (editingShift?.id) {
            const { error } = await supabase.from('shifts').update(shiftData).eq('id', editingShift.id);
            if (error) {
                console.error("Error updating shift:", error.message);
                alert(`Error updating shift: ${error.message}`);
            } else {
                fetchShifts(true);
            }
        } else {
            const newShift = {
                ...shiftData,
                isNightShift: false, // Default logic
                employeeCount: 0,
            };
            const { error } = await supabase.from('shifts').insert([newShift]);
            if (error) {
                console.error("Error adding shift:", error.message);
                alert(`Error adding shift: ${error.message}`);
            } else {
                fetchShifts(true);
            }
        }
        setEditingShift(null);
    };

    const handleDelete = async (id: number) => {
        if (id && window.confirm('Are you sure you want to delete this shift?')) {
            setOpenActionMenuId(null);
            const { error } = await supabase.from('shifts').delete().eq('id', id);
            if (error) {
                console.error("Error deleting shift:", error.message);
                alert("Failed to delete shift: " + error.message);
            } else {
                fetchShifts(true);
            }
        }
    };

    const handleToggleStatus = async (shift: Shift) => {
        if (shift.id) {
            setOpenActionMenuId(null);
            const newStatus = shift.status === 'active' ? 'inactive' : 'active';
            
            setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, status: newStatus } : s));

            const { error } = await supabase.from('shifts').update({ status: newStatus }).eq('id', shift.id);
            if (error) {
                console.error("Error updating status:", error.message);
                alert("Failed to update status. Reverting changes.");
                fetchShifts(true);
            }
        }
    };

    const handleEdit = (shift: Shift) => {
        setEditingShift(shift);
        setIsFormOpen(true);
        setOpenActionMenuId(null);
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

                const existingNames = new Set(shifts.map(s => s.name.toLowerCase()));
                const validShifts = [];
                const skippedNames = [];

                for (const row of data as any[]) {
                    const name = row['Shift Name'] || row['Name'];
                    const startTime = row['Start Time'];
                    const endTime = row['End Time'];

                    if (name && startTime && endTime) {
                        const trimmedName = name.toString().trim();
                        if (existingNames.has(trimmedName.toLowerCase())) {
                            skippedNames.push(trimmedName);
                        } else {
                            validShifts.push({
                                name: trimmedName,
                                status: (row['Status'] || 'active').toLowerCase(),
                                startTime: startTime,
                                endTime: endTime,
                                inGracePeriod: Number(row['In Grace'] || 0),
                                outGracePeriod: Number(row['Out Grace'] || 0),
                                startReminder: Number(row['Start Reminder'] || 0),
                                endReminder: Number(row['End Reminder'] || 0),
                                isNightShift: false,
                                employeeCount: 0
                            });
                            existingNames.add(trimmedName.toLowerCase());
                        }
                    }
                }

                if (validShifts.length === 0) {
                    if (skippedNames.length > 0) {
                        alert(`All ${skippedNames.length} shifts in file already exist.`);
                    } else {
                        alert("No valid shift data found. Ensure columns: 'Shift Name', 'Start Time', 'End Time'.");
                    }
                    return;
                }

                const { error } = await supabase.from('shifts').insert(validShifts);

                if (error) throw error;

                let msg = `Successfully imported ${validShifts.length} shifts.`;
                if (skippedNames.length > 0) {
                    msg += `\nSkipped ${skippedNames.length} duplicates.`;
                }
                alert(msg);
                fetchShifts(true);
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-800">Shift Management</h1>
                <p className="text-slate-600 mt-1">Manage, create, and assign employee work shifts.</p>
              </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <LoaderIcon className="w-8 h-8 text-primary animate-spin" />
                    <p className="mt-2 text-slate-500">Loading shifts...</p>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Shift Listing</h2>
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
                                onClick={() => { setEditingShift(null); setIsFormOpen(true); }}
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">
                                <PlusIcon className="w-5 h-5" />
                                <span>Add New Shift</span>
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
                                    {['S.No.', 'Shift Name', 'Timings', 'Is Night Shift', 'Grace Periods (In/Out)', 'Employees', 'Created At', 'Status', 'Actions'].map(h => 
                                        <th key={h} scope="col" className="px-6 py-3 font-semibold whitespace-nowrap first:rounded-l-lg last:rounded-r-lg">{h}</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                               {shifts.map((shift, index) => (
                                 <tr key={shift.id} className="bg-white border-b hover:bg-slate-50">
                                    <td className="px-6 py-4">{index + 1}</td>
                                    <td className="px-6 py-4 font-medium text-slate-800">{shift.name}</td>
                                    <td className="px-6 py-4">{shift.startTime} - {shift.endTime}</td>
                                    <td className="px-6 py-4">{shift.isNightShift ? 'Yes' : 'No'}</td>
                                    <td className="px-6 py-4">{shift.inGracePeriod} min / {shift.outGracePeriod} min</td>
                                    <td className="px-6 py-4"><span className="px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full">{shift.employeeCount} Members</span></td>
                                    <td className="px-6 py-4">{new Date(shift.createdAt).toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`flex items-center text-xs font-semibold ${shift.status === 'active' ? 'text-green-700' : 'text-red-700'}`}>
                                            <span className={`h-2 w-2 rounded-full ${shift.status === 'active' ? 'bg-green-500' : 'bg-red-500'} mr-2`}></span>
                                            {shift.status === 'active' ? 'Active' : 'Inactive' }
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 relative">
                                        <button 
                                            onClick={() => setOpenActionMenuId(openActionMenuId === shift.id ? null : shift.id)}
                                            className="p-1.5 rounded-full hover:bg-slate-200">
                                            <DotsVerticalIcon className="w-5 h-5 text-slate-500" />
                                        </button>
                                        {openActionMenuId === shift.id && (
                                            <div ref={actionMenuRef} className="absolute right-12 top-10 z-10 w-40 bg-white rounded-lg shadow-lg border border-slate-200 animate-fadeIn">
                                                <ul className="py-1 text-sm text-slate-700">
                                                    <li>
                                                        <a href="#" onClick={(e) => { e.preventDefault(); handleEdit(shift); }} className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-100 cursor-pointer">
                                                            <PencilIcon className="w-4 h-4 text-blue-500" />
                                                            <span>Edit</span>
                                                        </a>
                                                    </li>
                                                    <li>
                                                        <a href="#" onClick={(e) => { e.preventDefault(); handleToggleStatus(shift); }} className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-100 cursor-pointer">
                                                            {shift.status === 'active' ? <XCircleIcon className="w-4 h-4 text-red-500" /> : <CheckCircleIcon className="w-4 h-4 text-green-500" />}
                                                            <span>{shift.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                                                        </a>
                                                    </li>
                                                    <li>
                                                        <a href="#" onClick={(e) => { e.preventDefault(); if (shift.id) handleDelete(shift.id); }} className="flex items-center space-x-3 px-4 py-2 text-red-600 hover:bg-red-50 cursor-pointer"><TrashIcon className="w-4 h-4" /><span>Delete</span></a>
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

            <ShiftForm 
                isOpen={isFormOpen} 
                onClose={() => { setIsFormOpen(false); setEditingShift(null); }} 
                onSaveShift={handleSaveShift} 
                editingShift={editingShift} 
            />
        </div>
    );
};

export default ShiftManagement;
