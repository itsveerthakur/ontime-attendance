
import React, { useState, useRef, useEffect } from 'react';
import type { Page } from '../App';
import type { SubLocation, Location, Shift } from '../types';
import { supabase } from '../supabaseClient';
import { ChevronRightIcon, PlusIcon, DotsVerticalIcon, TrashIcon, XCircleIcon, CheckCircleIcon, PencilIcon, SearchIcon, LoaderIcon } from '../components/icons';

// Add google to window type to resolve errors from Google Maps API script.
declare global {
  interface Window {
    google: any;
  }
}

interface SubLocationProps {
  setActivePage: (page: Page) => void;
}

interface AddEditSubLocationViewProps {
    setActivePage: (page: Page) => void;
    subLocationId: number | null;
    onCancel: () => void;
    onSaveSuccess: () => void;
    locations: Location[];
    shifts: Shift[];
}

const AddEditSubLocationView: React.FC<AddEditSubLocationViewProps> = ({ setActivePage, subLocationId, onCancel, onSaveSuccess, locations, shifts }) => {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<Omit<SubLocation, 'id' | 'employeeCount' | 'deviceInstalled'>>({
        name: '',
        locationName: locations.length > 0 ? locations[0].name : '',
        parentSubLocation: '',
        status: 'active',
        isMaster: false,
        radius: 65.00,
        shift: '',
        latitude: 28.5035264,
        longitude: 77.3750784,
        address: '',
    });
    const [mapError, setMapError] = useState<string | null>(null);

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markerInstance = useRef<any>(null);
    const circleInstance = useRef<any>(null);
    const addressInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (subLocationId) {
            const fetchSubLocation = async () => {
                setIsLoading(true);
                const { data, error } = await supabase.from('sub_locations').select('*').eq('id', subLocationId).single();
                if (error) console.error("Error fetching sub-location:", error.message);
                else if (data) {
                    const subLocationData = data as any;
                    setFormData({
                        name: subLocationData.name,
                        locationName: subLocationData.locationName,
                        parentSubLocation: subLocationData.parentSubLocation || '',
                        status: subLocationData.status,
                        isMaster: subLocationData.isMaster,
                        radius: subLocationData.radius,
                        shift: subLocationData.shift || '',
                        latitude: parseFloat(String(subLocationData.latitude)) || 0,
                        longitude: parseFloat(String(subLocationData.longitude)) || 0,
                        address: subLocationData.address || '',
                    });
                }
                setIsLoading(false);
            };
            fetchSubLocation();
        }
    }, [subLocationId]);

    const initMap = () => {
        if (!mapRef.current || !window.google || !window.google.maps) {
            console.error("Attempted to initialize map before Google Maps script was ready.");
            return;
        }

        const initialCenter = (formData.latitude && formData.longitude)
            ? { lat: Number(formData.latitude), lng: Number(formData.longitude) }
            : { lat: 28.5035264, lng: 77.3750784 };

        const map = new window.google.maps.Map(mapRef.current, { center: initialCenter, zoom: 15, mapTypeControl: false });
        mapInstance.current = map;

        const marker = new window.google.maps.Marker({ position: initialCenter, map, draggable: true });
        markerInstance.current = marker;

        const circle = new window.google.maps.Circle({
            strokeColor: '#3b82f6', strokeOpacity: 0.8, strokeWeight: 2, fillColor: '#3b82f6',
            fillOpacity: 0.25, map, center: initialCenter, radius: Number(formData.radius),
        });
        circleInstance.current = circle;
        
        const geocoder = new window.google.maps.Geocoder();

        const updateFormFromLatLng = (latLng: any) => {
            setFormData(prev => ({
                ...prev,
                latitude: latLng.lat(),
                longitude: latLng.lng(),
            }));
            geocoder.geocode({ location: latLng }, (results: any, status: any) => {
                if (status === 'OK' && results[0]) {
                    setFormData(prev => ({ ...prev, address: results[0].formatted_address }));
                } else {
                    console.error('Geocoder failed due to: ' + status);
                }
            });
        };
        
        map.addListener('click', (e: any) => {
            const latLng = e.latLng;
            marker.setPosition(latLng);
            circle.setCenter(latLng);
            updateFormFromLatLng(latLng);
        });
        
        marker.addListener('dragend', () => {
            const pos = marker.getPosition();
            circle.setCenter(pos);
            updateFormFromLatLng(pos);
        });

        if (addressInputRef.current) {
            const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current);
            autocomplete.bindTo('bounds', map);
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.geometry && place.geometry.location) {
                    map.setCenter(place.geometry.location);
                    map.setZoom(17);
                    marker.setPosition(place.geometry.location);
                    circle.setCenter(place.geometry.location);
                    setFormData(prev => ({ ...prev, address: place.formatted_address || '',
                        latitude: place.geometry.location.lat(), longitude: place.geometry.location.lng(),
                    }));
                }
            });
        }
    };
     
    useEffect(() => {
        if (step === 2) {
            let attempts = 0;
            const maxAttempts = 15; // try for 3 seconds
            const interval = 200;

            const tryInitMap = () => {
                if (window.google && window.google.maps) {
                    if (!mapInstance.current) {
                        initMap();
                    }
                } else {
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(tryInitMap, interval);
                    } else {
                        setMapError(
                            "This is often an API key configuration issue. Please check the following in your Google Cloud project:\n\n1. Billing is enabled.\n2. The website URL is an allowed referrer."
                        );
                    }
                }
            };
            tryInitMap();
        }
    }, [step]);

    useEffect(() => {
        if (circleInstance.current) circleInstance.current.setRadius(Number(formData.radius));
    }, [formData.radius]);

    useEffect(() => {
        if (mapInstance.current && markerInstance.current && circleInstance.current && formData.latitude && formData.longitude) {
            const newLat = Number(formData.latitude);
            const newLng = Number(formData.longitude);
            if (!isNaN(newLat) && !isNaN(newLng)) {
                const newLatLng = new window.google.maps.LatLng(newLat, newLng);
                mapInstance.current.setCenter(newLatLng);
                markerInstance.current.setPosition(newLatLng);
                circleInstance.current.setCenter(newLatLng);
            }
        }
    }, [formData.latitude, formData.longitude]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
             setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
             setFormData(prev => ({ ...prev, [name]: (name === 'radius' || name === 'latitude' || name === 'longitude') ? parseFloat(value) || 0 : value }));
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const dbData = {
            name: formData.name,
            locationName: formData.locationName,
            parentSubLocation: formData.parentSubLocation,
            status: formData.status,
            isMaster: formData.isMaster,
            radius: Number(formData.radius),
            shift: formData.shift,
            latitude: Number(formData.latitude),
            longitude: Number(formData.longitude),
            address: formData.address,
        };

        let error;
        if (subLocationId) {
            ({ error } = await supabase.from('sub_locations').update(dbData).eq('id', subLocationId));
        } else {
            const insertData = { 
                ...dbData,
                employeeCount: 0, 
                deviceInstalled: 0 
            };
            ({ error } = await supabase.from('sub_locations').insert([insertData]));
        }

        if (error) {
            console.error("Error saving sub-location:", error.message);
            alert("Error saving sub-location: " + error.message);
        }
        else onSaveSuccess();
    };

    const isStep1Valid = formData.name && formData.locationName;
    const isStep2Valid = formData.address && formData.latitude && formData.longitude;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-white rounded-xl shadow-sm border border-slate-200">
                <LoaderIcon className="w-10 h-10 text-primary animate-spin" />
                <p className="mt-3 text-slate-500 font-medium">Loading sub-location details...</p>
            </div>
        );
    }

    return (
         <form onSubmit={handleSubmit}>
            <div className="flex items-center text-sm text-slate-500 mb-6">
                <span onClick={() => setActivePage('Dashboards')} className="cursor-pointer hover:text-primary">Home</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span onClick={() => onCancel()} className="cursor-pointer hover:text-primary">Sub Location</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">{subLocationId ? 'Edit Sub Location' : 'Add Sub Location'}</span>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex">
                     <div className="w-1/4 pr-8 border-r">
                         <ol className="space-y-4">
                            <li>
                                <div className={`group flex items-start ${step === 1 ? 'text-primary' : 'text-slate-500'}`}>
                                    <div className={`flex h-9 flex-shrink-0 items-center justify-center w-9 rounded-full border-2 ${step === 1 ? 'border-primary' : 'border-slate-300'}`}><span className="text-lg font-bold">1</span></div>
                                    <div className="ml-4"><h3 className="text-md font-semibold">Sub Location Details</h3><p className="text-sm">Add Sub Location Details</p></div>
                                </div>
                            </li>
                            <li>
                                <div className={`group flex items-start ${step === 2 ? 'text-primary' : 'text-slate-500'}`}>
                                    <div className={`flex h-9 flex-shrink-0 items-center justify-center w-9 rounded-full border-2 ${step === 2 ? 'border-primary' : 'border-slate-300'}`}><span className="text-lg font-bold">2</span></div>
                                    <div className="ml-4"><h3 className="text-md font-semibold">Address Details</h3><p className="text-sm">Add Address Details</p></div>
                                </div>
                            </li>
                        </ol>
                    </div>
                    <div className="w-3/4 pl-8">
                        {step === 1 && (
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Sub Location Details</h2>
                                <p className="text-sm text-slate-500 mb-4">Enter Sub Location Details</p>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1.5">Name <span className="text-red-500">*</span></label><input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light" /></div>
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1.5">Location <span className="text-red-500">*</span></label><select name="locationName" value={formData.locationName} onChange={handleChange} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light"><option value="">Select value</option>{locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
                                    </div>
                                     <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1.5">Parent Sub Location</label><select name="parentSubLocation" value={formData.parentSubLocation} onChange={handleChange} className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light"><option value="">Select</option></select></div>
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1.5">Status <span className="text-red-500">*</span></label><select name="status" value={formData.status} onChange={handleChange} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Master <span className="text-red-500">*</span></label>
                                            <select name="isMaster" value={String(formData.isMaster)} onChange={e => setFormData(p => ({...p, isMaster: e.target.value === 'true'}))} className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light"><option value="false">No</option><option value="true">Yes</option></select>
                                        </div>
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1.5">Radius In Meter <span className="text-red-500">*</span></label><input type="number" name="radius" value={formData.radius} onChange={handleChange} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light" /></div>
                                    </div>
                                    <div><label className="block text-sm font-medium text-slate-600 mb-1.5">Shift</label><select name="shift" value={formData.shift} onChange={handleChange} className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light"><option value="">Select value</option>{shifts.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                                </div>
                            </div>
                        )}
                        {step === 2 && (
                             <div>
                                <h2 className="text-lg font-bold text-slate-800">Set Location on Map</h2>
                                <p className="text-sm text-slate-500 mb-4">Use the search box, click on the map, or drag the marker to pinpoint the exact location.</p>
                                <div className="space-y-4">
                                     <div>
                                         <label className="block text-sm font-medium text-slate-600 mb-1.5">Address <span className="text-red-500">*</span></label>
                                         <div className="relative">
                                             <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none" />
                                             <input type="text" ref={addressInputRef} name="address" value={formData.address} onChange={handleChange}
                                                 required
                                                 placeholder="Search Google Maps..."
                                                 className="w-full pl-10 pr-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                                             />
                                         </div>
                                     </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Latitude <span className="text-red-500">*</span></label>
                                            <input type="number" step="any" name="latitude" value={formData.latitude} onChange={handleChange} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Longitude <span className="text-red-500">*</span></label>
                                            <input type="number" step="any" name="longitude" value={formData.longitude} onChange={handleChange} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light" />
                                        </div>
                                    </div>
                                    <div ref={mapRef} style={{ height: '300px', width: '100%' }} className="rounded-lg border border-slate-300 relative overflow-hidden bg-slate-100">
                                        {mapError && (
                                            <div className="absolute inset-0 bg-red-50/90 flex flex-col items-center justify-center p-4 z-10 text-center">
                                                <XCircleIcon className="w-10 h-10 text-red-400 mb-2" />
                                                <h3 className="text-base font-semibold text-red-800">Map Loading Error</h3>
                                                <p className="text-xs text-red-700 whitespace-pre-wrap">{mapError}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="pt-6 mt-6 border-t flex justify-between">
                    <button type="button" onClick={step === 1 ? onCancel : () => setStep(1)} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50">{step === 1 ? 'Cancel' : 'Previous'}</button>
                    {step === 1 ? (
                        <button type="button" onClick={() => setStep(2)} disabled={!isStep1Valid} className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark disabled:bg-slate-400">Next</button>
                    ) : (
                        <button type="submit" disabled={!isStep2Valid || !!mapError} className="px-5 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 disabled:bg-slate-400">{subLocationId ? 'Update Sub Location' : 'Submit'}</button>
                    )}
                </div>
            </div>
        </form>
    );
};

const SubLocation: React.FC<SubLocationProps> = ({ setActivePage }) => {
    const [subLocations, setSubLocations] = useState<SubLocation[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        setIsLoading(true);
        const [subLocsRes, locsRes, shiftsRes] = await Promise.all([
            supabase.from('sub_locations').select('*'),
            supabase.from('locations').select('*'),
            supabase.from('shifts').select('*')
        ]);
        
        if (subLocsRes.error) console.error("Error fetching sub-locations:", subLocsRes.error.message);
        else {
            setSubLocations(subLocsRes.data as SubLocation[] || []);
        }

        if (locsRes.error) console.error("Error fetching locations:", locsRes.error.message);
        else setLocations(locsRes.data as Location[] || []);
        
        if (shiftsRes.error) console.error("Error fetching shifts:", shiftsRes.error.message);
        else setShifts(shiftsRes.data as Shift[] || []);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    const handleDelete = async (id: number) => {
        if (id && window.confirm('Are you sure you want to delete this sub-location?')) {
            const { error } = await supabase.from('sub_locations').delete().eq('id', id);
            if (error) console.error("Error deleting sub-location:", error.message);
            else fetchData();
        }
    };

    const handleToggleStatus = async (item: SubLocation) => {
        if (item.id) {
            const newStatus = item.status === 'active' ? 'inactive' : 'active';
            const { error } = await supabase.from('sub_locations').update({ status: newStatus }).eq('id', item.id);
            if (error) console.error("Error updating status:", error.message);
            else {
                fetchData();
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

    if (view === 'form') {
        return <AddEditSubLocationView 
            setActivePage={setActivePage}
            subLocationId={editingId}
            onCancel={() => { setView('list'); setEditingId(null); }}
            onSaveSuccess={() => { fetchData(); setView('list'); setEditingId(null); }}
            locations={locations}
            shifts={shifts}
        />
    }

    return (
        <div>
            <div className="flex items-center text-sm text-slate-500 mb-6">
                <span onClick={() => setActivePage('Dashboards')} className="cursor-pointer hover:text-primary">Home</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span onClick={() => setActivePage('Master Management')} className="cursor-pointer hover:text-primary">Master Management</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Sub Location</span>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <LoaderIcon className="w-8 h-8 text-primary animate-spin" />
                    <p className="mt-2 text-slate-500">Loading sub locations...</p>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Sub Location Listing</h2>
                        <div className="flex items-center space-x-2">
                             <button 
                                onClick={() => { setEditingId(null); setView('form'); }}
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">
                                <PlusIcon className="w-5 h-5" />
                                <span>Add New Sub Location</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                 <tr>
                                    {['ID', 'Sub Location', 'Location', 'Address', 'Employees', 'Radius (m)', 'Status', 'Actions'].map(header => (
                                        <th key={header} scope="col" className="px-6 py-3 font-semibold whitespace-nowrap first:rounded-l-lg last:rounded-r-lg">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {subLocations.map((item, index) => (
                                    <tr key={item.id} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-4">{index + 1}</td>
                                        <td className="px-6 py-4 font-medium text-slate-800">{item.name}</td>
                                        <td className="px-6 py-4">{item.locationName}</td>
                                        <td className="px-6 py-4 text-xs max-w-xs truncate">{item.address}</td>
                                        <td className="px-6 py-4">{item.employeeCount}</td>
                                        <td className="px-6 py-4">{item.radius.toFixed(2)}</td>
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
                                                        <li><a href="#" onClick={() => { if(item.id) {setEditingId(item.id);} setView('form'); setOpenActionMenuId(null);}} className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-100 cursor-pointer"><PencilIcon className="w-4 h-4 text-slate-500" /><span>Edit</span></a></li>
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
        </div>
    );
};

export default SubLocation;
