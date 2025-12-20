
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Asset, Employee } from '../types';
import { PlusIcon, SearchIcon, FilterIcon, LoaderIcon, TrashIcon, PencilIcon, DocumentCheckIcon, XCircleIcon } from '../components/icons';

const AssetManagement: React.FC = () => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [formData, setFormData] = useState<Partial<Asset>>({
        assetName: '',
        assetType: 'Electronics',
        serialNumber: '',
        assignedTo: '',
        assignedDate: new Date().toISOString().split('T')[0],
        status: 'In-Stock'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [assetsRes, empRes] = await Promise.all([
                supabase.from('assets').select('*').order('created_at', { ascending: false }),
                supabase.from('employees').select('employeeCode, firstName, lastName').eq('status', 'Active')
            ]);
            
            if (assetsRes.data) setAssets(assetsRes.data);
            if (empRes.data) setEmployees(empRes.data as Employee[]);
        } catch (e) {
            console.error("Error fetching assets:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingAsset?.id) {
                const { error } = await supabase.from('assets').update(formData).eq('id', editingAsset.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('assets').insert([formData]);
                if (error) throw error;
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err: any) {
            alert("Save failed: " + err.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Delete this asset record?")) return;
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Allocated': return 'bg-blue-100 text-blue-800';
            case 'In-Stock': return 'bg-green-100 text-green-800';
            case 'Under-Repair': return 'bg-amber-100 text-amber-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    const filteredAssets = assets.filter(a => 
        a.assetName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        a.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.assignedTo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Asset Management</h1>
                    <p className="text-slate-600 mt-1">Track company hardware, software and furniture allocation.</p>
                </div>
                <button 
                    onClick={() => { setEditingAsset(null); setFormData({ assetType: 'Electronics', status: 'In-Stock', assignedDate: new Date().toISOString().split('T')[0] }); setIsModalOpen(true); }}
                    className="flex items-center space-x-2 bg-primary text-white px-5 py-2.5 rounded-xl hover:bg-primary-dark shadow-lg transition-all font-bold"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>Register New Asset</span>
                </button>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center space-x-4 mb-6">
                    <div className="relative flex-1">
                        <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                        <input 
                            type="text" 
                            placeholder="Search by name, serial or employee code..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-light outline-none"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20"><LoaderIcon className="w-12 h-12 text-primary animate-spin" /></div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 uppercase text-xs font-black">
                                <tr>
                                    <th className="px-6 py-4">Asset Name</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Serial No.</th>
                                    <th className="px-6 py-4">Assigned To</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredAssets.length > 0 ? filteredAssets.map(asset => (
                                    <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{asset.assetName}</td>
                                        <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold uppercase">{asset.assetType}</span></td>
                                        <td className="px-6 py-4 font-mono text-slate-500">{asset.serialNumber}</td>
                                        <td className="px-6 py-4">
                                            {asset.assignedTo ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-primary uppercase">{asset.assignedTo}</span>
                                                    <span className="text-[10px] text-slate-400">Since {new Date(asset.assignedDate).toLocaleDateString()}</span>
                                                </div>
                                            ) : <span className="text-slate-300 italic">Not Assigned</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${getStatusColor(asset.status)}`}>
                                                {asset.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center space-x-2">
                                                <button onClick={() => { setEditingAsset(asset); setFormData(asset); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><PencilIcon className="w-4 h-4" /></button>
                                                <button onClick={() => asset.id && handleDelete(asset.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><TrashIcon className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : <tr><td colSpan={6} className="text-center py-10 text-slate-400 italic">No assets found matching search.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 uppercase tracking-tight">{editingAsset ? 'Edit Asset Record' : 'Register Asset'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircleIcon className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Asset Name</label>
                                    <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" value={formData.assetName} onChange={e => setFormData({...formData, assetName: e.target.value})} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                                    <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" value={formData.assetType} onChange={e => setFormData({...formData, assetType: e.target.value as any})}>
                                        <option value="Electronics">Electronics</option>
                                        <option value="Furniture">Furniture</option>
                                        <option value="Vehicle">Vehicle</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Serial Number</label>
                                    <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                                    <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                                        <option value="In-Stock">In-Stock</option>
                                        <option value="Allocated">Allocated</option>
                                        <option value="Under-Repair">Under-Repair</option>
                                        <option value="Discarded">Discarded</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assigned To</label>
                                    <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" value={formData.assignedTo} onChange={e => setFormData({...formData, assignedTo: e.target.value})}>
                                        <option value="">Unassigned</option>
                                        {employees.map(e => <option key={e.employeeCode} value={e.employeeCode}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark shadow-md transition-all">Save Asset</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetManagement;
