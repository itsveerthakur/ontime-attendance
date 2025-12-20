
import React, { useState, useRef, useEffect } from 'react';
import type { Page } from '../App';
import type { Location } from '../types';
import { supabase } from '../supabaseClient';
import { ChevronRightIcon, PlusIcon, DotsVerticalIcon, TrashIcon, XCircleIcon, CheckCircleIcon, PencilIcon, SearchIcon, LoaderIcon } from '../components/icons';

// Add google to window type to resolve errors from Google Maps API script.
declare global {
  interface Window {
    google: any;
  }
}

interface LocationProps {
  setActivePage: (page: Page) => void;
}

interface AddEditLocationViewProps {
    setActivePage: (page: Page) => void;
    locationId: number | null;
    onCancel: () => void;
    onSaveSuccess: () => void;
}

const AddEditLocationView: React.FC<AddEditLocationViewProps> = ({ setActivePage, locationId, onCancel, onSaveSuccess }) => {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<Omit<Location, 'id' | 'employeeCount' | 'subLocationCount'>>({
        name: '',
        status: 'active',
        parentLocation: '',
        radius: 65,
        latitude: 0,
        longitude: 0,
        address: ''
    });
    const [mapError, setMapError] = useState<string | null>(null);

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markerInstance = useRef<any>(null);
    const circleInstance = useRef<any>(null);
    const addressInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (locationId) {
            const fetchLocation = async () => {
                setIsLoading(true);
                const { data, error } = await supabase.from('locations').select('*').eq('id', locationId).single();
                if (error) console.error("Error fetching location:", error.message);
                else if (data) {
                    const locationData = data as Location;
                    setFormData({
                        name: locationData.name,
                        status: locationData.status,
                        parentLocation: locationData.parentLocation || '',
                        radius: locationData.radius,
                        latitude: parseFloat(String(locationData.latitude)) || 0,
                        longitude: parseFloat(String(locationData.longitude)) || 0,
                        address: locationData.address || ''
                    });
                }
                setIsLoading(false);
            }
            fetchLocation();
        }
    }, [locationId]);
    
    const initMap = () => {
        if (!mapRef.current || !window.google || !window.google.maps) {
             console.error("Attempted to initialize map before Google Maps script was ready.");
             return;
        }

        // Try to get user's current location, fallback to default
        let initialCenter = { lat: 0, lng: 0 };
        
        if (formData.latitude && formData.longitude) {
            initialCenter = { lat: Number(formData.latitude), lng: Number(formData.longitude) };
        } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    if (mapInstance.current) {
                        mapInstance.current.setCenter(userLocation);
                    }
                    if (markerInstance.current) {
                        markerInstance.current.setPosition(userLocation);
                    }
                    if (circleInstance.current) {
                        circleInstance.current.setCenter(userLocation);
                    }
                    setFormData(prev => ({
                        ...prev,
                        latitude: userLocation.lat,
                        longitude: userLocation.lng
                    }));
                    
                    try {
                        const geocoder = new window.google.maps.Geocoder();
                        geocoder.geocode({ location: userLocation }, (results: any, status: any) => {
                            if (status === 'OK' && results[0]) {
                                setFormData(prev => ({ ...prev, address: results[0].formatted_address }));
                            } else if (status === "REQUEST_DENIED") {
                                setMapError("Geocoding Service is not authorized for this API key. Please check your Google Cloud project restrictions.");
                            }
                        });
                    } catch (e) {
                        console.error("Geocoding error:", e);
                    }
                },
                (error) => {
                    console.warn('Geolocation failed:', error);
                    initialCenter = { lat: 28.6139, lng: 77.2090 }; // New Delhi
                    if (mapInstance.current) mapInstance.current.setCenter(initialCenter);
                }
            );
        } else {
            initialCenter = { lat: 28.6139, lng: 77.2090 }; // New Delhi
        }

        const map = new window.google.maps.Map(mapRef.current, {
            center: initialCenter,
            zoom: formData.latitude && formData.longitude ? 15 : 10,
            mapTypeControl: false,
        });
        mapInstance.current = map;

        const marker = new window.google.maps.Marker({
            position: initialCenter,
            map,
            draggable: true,
        });
        markerInstance.current = marker;

        const circle = new window.google.maps.Circle({
            strokeColor: '#3b82f6',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#3b82f6',
            fillOpacity: 0.25,
            map,
            center: initialCenter,
            radius: Number(formData.radius),
        });
        circleInstance.current = circle;
        
        const updateFormFromLatLng = (latLng: any) => {
            setFormData(prev => ({
                ...prev,
                latitude: latLng.lat(),
                longitude: latLng.lng(),
            }));

            try {
                const geocoder = new window.google.maps.Geocoder();
                geocoder.geocode({ location: latLng }, (results: any, status: any) => {
                    if (status === 'OK' && results[0]) {
                        setFormData(prev => ({ ...prev, address: results[0].formatted_address }));
                    } else if (status === 'REQUEST_DENIED') {
                        setMapError("Geocoding service access denied. Please verify your API Key permissions and enabled services.");
                    }
                });
            } catch (e) {
                console.error("Geocoding failed:", e);
            }
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
                    setFormData(prev => ({
                        ...prev,
                        address: place.formatted_address || '',
                        latitude: place.geometry.location.lat(),
                        longitude: place.geometry.location.lng(),
                    }));
                }
            });
        }
    };
    
    useEffect(() => {
        if (step === 2) {
             let attempts = 0;
            const maxAttempts = 15;
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
                            "Google Maps API could not be initialized. This might be due to an invalid key or restricted access. Check your console for details."
                        );
                    }
                }
            };
            tryInitMap();
        }
    }, [step]);

     useEffect(() => {
        if (circleInstance.current) {
            circleInstance.current.setRadius(Number(formData.radius));
        }
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
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: (name === 'radius' || name === 'latitude' || name === 'longitude') ? parseFloat(value) || 0 : value }));
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        let error;
        if (locationId) {
            const updateData = {
                ...formData,
                latitude: Number(formData.latitude),
                longitude: Number(formData.longitude),
                radius: Number(formData.radius),
            };
            ({ error } = await supabase.from('locations').update(updateData as any).eq('id', locationId));
        } else {
            const insertData = { 
                ...formData, 
                latitude: Number(formData.latitude),
                longitude: Number(formData.longitude),
                radius: Number(formData.radius),
                employeeCount: 0, 
                subLocationCount: 0 
            };
            ({ error } = await supabase.from('locations').insert([insertData] as any));
        }

        if (error) {
            console.error("Error saving location:", error.message);
            alert("Error saving location: " + error.message);
        }
        else onSaveSuccess();
    };

    const isStep2Valid = formData.address && formData.latitude && formData.longitude;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-white rounded-xl shadow-sm border border-slate-200">
                <LoaderIcon className="w-10 h-10 text-primary animate-spin" />
                <p className="mt-3 text-slate-500 font-medium">Loading location details...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="flex items-center text-sm text-slate-500 mb-6">
                <span onClick={() => setActivePage('Dashboards')} className="cursor-pointer hover:text-primary">Home</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span onClick={() => setActivePage('Master Management')} className="cursor-pointer hover:text-primary">Master Management</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span onClick={() => onCancel()} className="cursor-pointer hover:text-primary">Location</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">{locationId ? 'Edit Location' : 'Add Location'}</span>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex">
                    {/* Stepper */}
                    <div className="w-1/4 pr-8 border-r">
                        <ol className="space-y-4">
                            <li>
                                <div className={`group flex items-start ${step === 1 ? 'text-primary' : 'text-slate-500'}`}>
                                    <div className={`flex h-9 flex-shrink-0 items-center justify-center w-9 rounded-full border-2 ${step === 1 ? 'border-primary' : 'border-slate-300'}`}>
                                        <span className="text-lg font-bold">1</span>
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-md font-semibold">Location Details</h3>
                                        <p className="text-sm">Add Location Details</p>
                                    </div>
                                </div>
                            </li>
                            <li>
                                <div className={`group flex items-start ${step === 2 ? 'text-primary' : 'text-slate-500'}`}>
                                    <div className={`flex h-9 flex-shrink-0 items-center justify-center w-9 rounded-full border-2 ${step === 2 ? 'border-primary' : 'border-slate-300'}`}>
                                        <span className="text-lg font-bold">2</span>
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-md font-semibold">Address Details</h3>
                                        <p className="text-sm">Add Address Details</p>
                                    </div>
                                </div>
                            </li>
                        </ol>
                    </div>

                    {/* Form Content */}
                    <div className="w-3/4 pl-8">
                        {step === 1 && (
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Location Details</h2>
                                <p className="text-sm text-slate-500 mb-4">Enter Location Details</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Parent Location</label>
                                        <select name="parentLocation" value={formData.parentLocation} onChange={handleChange} className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light">
                                            <option value="">Select</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Name <span className="text-red-500">*</span></label>
                                            <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Status <span className="text-red-500">*</span></label>
                                            <select name="status" value={formData.status} onChange={handleChange} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light">
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Radius In Meter <span className="text-red-500">*</span></label>
                                        <input type="number" name="radius" value={formData.radius} onChange={handleChange} required className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light" />
                                    </div>
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
                                             <input
                                                 type="text"
                                                 ref={addressInputRef}
                                                 name="address"
                                                 value={formData.address}
                                                 onChange={handleChange}
                                                 required
                                                 placeholder="Search Google Maps..."
                                                 className="w-full pl-10 pr-3 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-light" />
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

                {/* Navigation Buttons */}
                <div className="pt-6 mt-6 border-t flex justify-between">
                    <button type="button" onClick={step === 1 ? onCancel : () => setStep(1)} className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50">
                        {step === 1 ? 'Cancel' : 'Previous'}
                    </button>
                    {step === 1 ? (
                        <button type="button" onClick={() => setStep(2)} disabled={!formData.name} className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark disabled:bg-slate-400">
                            Next
                        </button>
                    ) : (
                        <button type="submit" disabled={!isStep2Valid || !!mapError} className="px-5 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 disabled:bg-slate-400">
                            {locationId ? 'Update Location' : 'Submit'}
                        </button>
                    )}
                </div>
            </div>
        </form>
    );
};

const Location: React.FC<LocationProps> = ({ setActivePage }) => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const fetchLocations = async () => {
        setIsLoading(true);
        
        // Fetch locations
        const { data: locationsData, error: locationsError } = await supabase.from('locations').select('*');
        if (locationsError) {
            console.error("Error fetching locations:", locationsError.message);
            setIsLoading(false);
            return;
        }
        
        // Fetch employee counts for each location
        const { data: employeesData, error: employeesError } = await supabase
            .from('employees')
            .select('location')
            .eq('status', 'Active');
            
        // Fetch sub-location counts for each location
        const { data: subLocationsData, error: subLocationsError } = await supabase
            .from('sub_locations')
            .select('locationName')
            .eq('status', 'active');
            
        if (employeesError) console.error("Error fetching employees:", employeesError.message);
        if (subLocationsError) console.error("Error fetching sub-locations:", subLocationsError.message);
        
        // Count employees per location
        const employeeCounts: Record<string, number> = {};
        if (employeesData) {
            employeesData.forEach(emp => {
                if (emp.location) {
                    employeeCounts[emp.location] = (employeeCounts[emp.location] || 0) + 1;
                }
            });
        }
        
        // Count sub-locations per location
        const subLocationCounts: Record<string, number> = {};
        if (subLocationsData) {
            subLocationsData.forEach(subLoc => {
                if (subLoc.locationName) {
                    subLocationCounts[subLoc.locationName] = (subLocationCounts[subLoc.locationName] || 0) + 1;
                }
            });
        }
        
        // Update locations with counts
        const updatedLocations = (locationsData || []).map(location => ({
            ...location,
            employeeCount: employeeCounts[location.name] || 0,
            subLocationCount: subLocationCounts[location.name] || 0
        }));
        
        setLocations(updatedLocations as Location[]);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchLocations();
    }, []);
    
    const handleDelete = async (id: number) => {
        if (id && window.confirm('Are you sure you want to delete this location?')) {
            const { error } = await supabase.from('locations').delete().eq('id', id);
            if (error) console.error("Error deleting location:", error.message);
            else fetchLocations();
        }
    };

    const handleToggleStatus = async (item: Location) => {
        if (item.id) {
            const newStatus = item.status === 'active' ? 'inactive' : 'active';
            const { error } = await supabase.from('locations').update({ status: newStatus } as any).eq('id', item.id);
            if (error) console.error("Error updating status:", error.message);
            else {
                fetchLocations();
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
        return <AddEditLocationView 
            setActivePage={setActivePage}
            locationId={editingId}
            onCancel={() => { setView('list'); setEditingId(null); }}
            onSaveSuccess={() => {
                fetchLocations();
                setView('list');
                setEditingId(null);
            }}
        />
    }

    return (
        <div>
            <div className="flex items-center text-sm text-slate-500 mb-6">
                <span onClick={() => setActivePage('Dashboards')} className="cursor-pointer hover:text-primary">Home</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span onClick={() => setActivePage('Master Management')} className="cursor-pointer hover:text-primary">Master Management</span>
                <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
                <span className="font-semibold text-slate-700">Location</span>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <LoaderIcon className="w-8 h-8 text-primary animate-spin" />
                    <p className="mt-2 text-slate-500">Loading locations...</p>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Location Listing</h2>
                        <div className="flex items-center space-x-2">
                            <button className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50">
                                Export
                            </button>
                             <button className="px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg shadow-sm hover:bg-slate-800">
                                Bulk Upload
                            </button>
                            <button 
                                onClick={() => { setEditingId(null); setView('form'); }}
                                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg shadow-sm hover:bg-primary-dark">
                                <PlusIcon className="w-5 h-5" />
                                <span>Add New Location</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                                <tr>
                                    <th scope="col" className="px-6 py-3 font-semibold rounded-l-lg">ID</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">Location</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">Address</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">Sub Locations</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">Employees</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">Radius (m)</th>
                                    <th scope="col" className="px-6 py-3 font-semibold">Status</th>
                                    <th scope="col" className="px-6 py-3 font-semibold rounded-r-lg">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {locations.map((item, index) => (
                                    <tr key={item.id} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-4">{index + 1}</td>
                                        <td className="px-6 py-4 font-medium text-slate-800">{item.name}</td>
                                        <td className="px-6 py-4 text-xs max-w-xs truncate">{item.address}</td>
                                        <td className="px-6 py-4">{item.subLocationCount}</td>
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

export default Location;
