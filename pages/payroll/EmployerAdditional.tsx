
import React, { useState, useEffect, useCallback } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, ChevronRightIcon, LoaderIcon } from '../../components/icons';
import { supabase } from '../../supabaseClient';
import type { EmployerAdditionalComponent } from '../../types';
import AddEmployerAdditionalForm from '../../components/AddEmployerAdditionalForm';

interface EmployerAdditionalProps {
    onBack: () => void;
}

const EmployerAdditional: React.FC<EmployerAdditionalProps> = ({ onBack }) => {
    const [employerAdditionalComponents, setEmployerAdditionalComponents] = useState<EmployerAdditionalComponent[]>([]);
    const [isAddEmployerAdditionalOpen, setIsAddEmployerAdditionalOpen] = useState(false);
    const [editingEmployerAdditional, setEditingEmployerAdditional] = useState<EmployerAdditionalComponent | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchEmployerAdditionalComponents = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .schema('payroll')
                .from('employer_additional')
                .select('*')
                .order('id');

            if (error) {
                console.error('Error fetching employer additional components:', error);
            } else {
                const sanitizedData = (data || []).map((item: any) => ({
                    ...item,
                    id: Number(item.id),
                    calculationPercentage: item.calculationPercentage ?? item.calculation_percentage,
                    maxCalculatedValue: item.maxCalculatedValue ?? item.max_calculated_value
                }));
                setEmployerAdditionalComponents(sanitizedData);
            }
        } catch (err: any) {
            console.error('Unexpected error:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEmployerAdditionalComponents();
    }, [fetchEmployerAdditionalComponents]);

    const handleAddEmployerAdditional = async (component: Omit<EmployerAdditionalComponent, 'id'>) => {
        try {
            const payload = {
                name: component.name,
                based_on: component.based_on,
                calculation_percentage: component.calculationPercentage === '' ? null : Number(component.calculationPercentage),
                max_calculated_value: component.maxCalculatedValue === undefined || component.maxCalculatedValue === null ? null : Number(component.maxCalculatedValue)
            };

            if (editingEmployerAdditional && editingEmployerAdditional.id) {
                const { error } = await supabase.schema('payroll').from('employer_additional').update(payload).eq('id', editingEmployerAdditional.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.schema('payroll').from('employer_additional').insert([payload]);
                if (error) throw error;
            }

            fetchEmployerAdditionalComponents();
            setIsAddEmployerAdditionalOpen(false);
            setEditingEmployerAdditional(null);
        } catch (err: any) {
            console.error("Error saving employer additional component:", err);
            alert("Failed to save component: " + err.message);
        }
    };

    const handleDeleteEmployerAdditional = async (id: number | undefined) => {
        if (id === undefined || id === null) return;
        if (!window.confirm("Are you sure you want to delete this component?")) return;
        try {
            const { error } = await supabase.schema('payroll').from('employer_additional').delete().eq('id', id);
            if (error) throw error;
            fetchEmployerAdditionalComponents();
        } catch (err: any) {
            console.error("Error deleting employer additional component:", err);
            alert("Failed to delete component: " + err.message);
        }
    };

    return (
        <div>
            <div className="flex items-center text-sm text-slate-500 mb-6">
                <span onClick={onBack} className="cursor-pointer hover:text-primary">Payroll</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Employer Additional</span>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <LoaderIcon className="w-8 h-8 text-primary animate-spin" />
                    <p className="mt-2 text-slate-500">Loading employer additional components...</p>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Employer Additional Components</h2>
                        <button onClick={() => { setEditingEmployerAdditional(null); setIsAddEmployerAdditionalOpen(true); }} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">
                            <PlusIcon className="w-5 h-5" /> <span>Add Component</span>
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                <tr>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Calculation %</th>
                                    <th className="px-6 py-3">Based On</th>
                                    <th className="px-6 py-3">Max Value</th>
                                    <th className="px-6 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employerAdditionalComponents.map(item => (
                                    <tr key={item.id} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                                        <td className="px-6 py-4">{item.calculationPercentage || 'Manual'}</td>
                                        <td className="px-6 py-4">{item.based_on}</td>
                                        <td className="px-6 py-4">{item.maxCalculatedValue || '-'}</td>
                                        <td className="px-6 py-4 flex space-x-2">
                                            <button onClick={() => { setEditingEmployerAdditional(item); setIsAddEmployerAdditionalOpen(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><PencilIcon className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteEmployerAdditional(item.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><TrashIcon className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <AddEmployerAdditionalForm
                isOpen={isAddEmployerAdditionalOpen}
                onClose={() => { setIsAddEmployerAdditionalOpen(false); setEditingEmployerAdditional(null); }}
                onSave={handleAddEmployerAdditional}
                editingComponent={editingEmployerAdditional}
            />
        </div>
    );
};

export default EmployerAdditional;
