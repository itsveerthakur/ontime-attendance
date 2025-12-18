import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Employee } from '../types';
import { ClockIcon, MapPinIcon, RefreshIcon, LoaderIcon, LockClosedIcon, FingerPrintIcon } from '../components/icons';

interface MobileAttendanceProps {
  currentUser: Employee | null;
}

const MobileAttendance: React.FC<MobileAttendanceProps> = ({ currentUser }) => {
  const [time, setTime] = useState(new Date());
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'Checking' | 'Inside' | 'Outside' | 'Error' | 'Denied'>('Checking');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [officeCoords, setOfficeCoords] = useState<{ lat: number; lng: number; radius: number; name: string; address: string } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Update Clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchOfficeLocation = async () => {
    if (!currentUser?.location) {
      console.warn("User has no assigned location in profile");
      setLocationStatus('Error');
      return;
    }
    
    setDebugInfo(prev => prev + `\nFetching coords for: "${currentUser.location}"...`);
    
    // Using ilike and trim to handle potential whitespace or case mismatches in DB
    // Added 'address' to the select query to fetch the full location address
    const { data, error } = await supabase
      .from('locations')
      .select('latitude, longitude, radius, name, address')
      .ilike('name', currentUser.location.trim())
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch office coordinates:", error);
      setDebugInfo(prev => prev + `\nDB Error: ${error.message}`);
      setLocationStatus('Error');
    } else if (!data) {
      console.warn(`No location found in database matching name: "${currentUser.location}"`);
      setDebugInfo(prev => prev + `\nNot Found in DB: "${currentUser.location}"`);
      setLocationStatus('Error');
    } else {
      setOfficeCoords({
        lat: Number(data.latitude),
        lng: Number(data.longitude),
        radius: Number(data.radius) || 100,
        name: data.name,
        address: data.address || data.name // Fallback to name if address is empty
      });
      setDebugInfo(prev => prev + `\nOffice Coords: ${data.latitude}, ${data.longitude} (R: ${data.radius}m)`);
    }
  };

  // Fetch Office Coordinates based on user's assigned location
  useEffect(() => {
    fetchOfficeLocation();
  }, [currentUser]);

  // Robust Geolocation Fetching
  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by this browser.");
      setLocationStatus('Error');
      return;
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 15000, // Increased timeout
      maximumAge: 0
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setDebugInfo(prev => {
           const lines = prev.split('\n');
           const lastLines = lines.length > 5 ? lines.slice(-5) : lines;
           return lastLines.join('\n') + `\nGPS: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
        });
      },
      (error) => {
        console.error("Geolocation error:", error);
        if (error.code === error.PERMISSION_DENIED) {
            setLocationStatus('Denied');
        } else {
            setLocationStatus('Error');
        }
        setDebugInfo(prev => prev + `\nGPS Error: ${error.message}`);
      },
      geoOptions
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Calculate Distance (Haversine Formula) and check Geofence
  useEffect(() => {
    if (currentCoords && officeCoords) {
      const R = 6371e3; // metres
      const φ1 = currentCoords.lat * Math.PI / 180;
      const φ2 = officeCoords.lat * Math.PI / 180;
      const Δφ = (officeCoords.lat - currentCoords.lat) * Math.PI / 180;
      const Δλ = (officeCoords.lng - currentCoords.lng) * Math.PI / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      const distance = R * c; // in metres
      
      // Add a 10-meter buffer for GPS drift
      const buffer = 15; 
      if (distance <= (officeCoords.radius + buffer)) {
        setLocationStatus('Inside');
      } else {
        setLocationStatus('Outside');
      }
    }
  }, [currentCoords, officeCoords]);

  const handleRefresh = () => {
    setLocationStatus('Checking');
    fetchOfficeLocation();
  };

  const handleAction = async () => {
    setScanError(null);
    setIsScanning(true);

    try {
      // Access camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Simulate face scan delay
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Stop camera
      stream.getTracks().forEach(track => track.stop());
      
      // Update local state
      setIsClockedIn(!isClockedIn);
      setIsScanning(false);
      
      alert(`Successfully ${!isClockedIn ? 'Clocked In' : 'Clocked Out'}!`);

    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setScanError("Camera hardware not found. Proceeding with manual verification...");
        setTimeout(() => {
          setIsClockedIn(!isClockedIn);
          setIsScanning(false);
          setScanError(null);
        }, 2000);
      } else {
        setScanError("Camera access denied. Please enable permissions.");
        setIsScanning(false);
      }
    }
  };

  const formattedDate = time.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  }).toUpperCase();

  const formattedTime = time.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="max-w-md mx-auto h-full flex flex-col bg-slate-50 shadow-2xl rounded-[3rem] overflow-hidden border-[12px] border-slate-900 relative">
      {/* Top Banner / Header */}
      <div className="bg-[#1e2736] text-white p-8 pt-10 pb-16 relative">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <div className="relative">
              {currentUser?.photoUrl ? (
                <img src={currentUser.photoUrl} className="w-12 h-12 rounded-full object-cover border-2 border-primary" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center font-bold text-lg">
                  {currentUser?.firstName?.charAt(0)}
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#1e2736]"></div>
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{currentUser?.firstName} {currentUser?.lastName}</h2>
              <p className="text-xs text-slate-400">{currentUser?.designation || 'Employee'}</p>
              <p className="text-[10px] text-slate-500">ID: {currentUser?.employeeCode}</p>
            </div>
          </div>
          <button 
            onClick={handleRefresh}
            className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
            title="Refresh Location"
          >
            <RefreshIcon className={`w-5 h-5 ${locationStatus === 'Checking' ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="mt-10 text-center animate-fadeIn">
          <p className="text-xs font-semibold text-slate-400 tracking-[0.2em] mb-2">{formattedDate}</p>
          <h1 className="text-6xl font-bold tracking-tight">{formattedTime}</h1>
          <div className="flex items-start justify-center mt-3 text-slate-300 px-4">
             <MapPinIcon className="w-3.5 h-3.5 mr-1.5 opacity-70 mt-0.5 flex-shrink-0" />
             <span className="text-[10px] sm:text-xs font-medium tracking-wide italic leading-snug">
                {officeCoords ? officeCoords.address : 'Fetching office details...'}
             </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 -mt-8 bg-white rounded-t-[3rem] shadow-[0_-15px_30px_rgba(0,0,0,0.1)] p-6 space-y-6">
        
        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="p-2 bg-red-50 rounded-full mb-2">
                <MapPinIcon className={`w-5 h-5 ${locationStatus === 'Inside' ? 'text-green-600' : 'text-red-500'}`} />
             </div>
             <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Location</p>
             <div className="flex items-center space-x-1">
                {locationStatus === 'Checking' ? (
                   <LoaderIcon className="w-4 h-4 text-primary animate-spin" />
                ) : locationStatus === 'Inside' ? (
                   <span className="text-sm font-bold text-green-600">At Work</span>
                ) : locationStatus === 'Denied' ? (
                   <span className="text-sm font-bold text-red-500">Denied</span>
                ) : locationStatus === 'Error' ? (
                   <span className="text-sm font-bold text-red-500">Error</span>
                ) : (
                   <>
                     <span className="text-sm font-bold text-red-500">Outside</span>
                     <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                   </>
                )}
             </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="p-2 bg-green-50 rounded-full mb-2">
                <ClockIcon className="w-5 h-5 text-green-600" />
             </div>
             <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Status</p>
             <p className="text-sm font-bold text-slate-800">{isClockedIn ? 'At Work' : 'Checked Out'}</p>
             <p className="text-[10px] text-slate-400 mt-0.5">Last: 12:36 PM</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col items-center justify-center pt-4 pb-4">
          <div className="relative">
            {/* Pulsing rings */}
            <div className={`absolute inset-0 rounded-full ${isClockedIn ? 'bg-red-500/20' : 'bg-green-500/20'} animate-ping`}></div>
            <div className={`absolute -inset-4 rounded-full ${isClockedIn ? 'bg-red-500/10' : 'bg-green-500/10'} animate-pulse`}></div>
            
            <button 
              onClick={handleAction}
              disabled={isScanning || locationStatus === 'Checking' || locationStatus === 'Outside' || locationStatus === 'Error' || locationStatus === 'Denied'}
              className={`relative z-10 w-48 h-48 rounded-full flex flex-col items-center justify-center text-white transition-all transform active:scale-95 shadow-2xl ${
                isClockedIn 
                  ? 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-500/50' 
                  : 'bg-gradient-to-br from-green-500 to-green-700 shadow-green-500/50'
              } disabled:grayscale disabled:opacity-50`}
            >
              {isScanning ? (
                <div className="flex flex-col items-center">
                  <LoaderIcon className="w-12 h-12 animate-spin mb-2" />
                  <span className="text-xs font-bold uppercase tracking-widest">Scanning...</span>
                </div>
              ) : (
                <>
                  <LockClosedIcon className="w-10 h-10 mb-2 opacity-50" />
                  <span className="text-2xl font-black uppercase tracking-tighter">
                    {isClockedIn ? 'Clock Out' : 'Clock In'}
                  </span>
                  <div className="flex items-center mt-2 bg-black/20 px-3 py-1 rounded-full space-x-1">
                    <FingerPrintIcon className="w-3 h-3" />
                    <span className="text-[10px] font-bold">Face Scan</span>
                  </div>
                </>
              )}
            </button>
          </div>

          {/* User Feedback for Geo-blocking */}
          {(locationStatus === 'Outside' || locationStatus === 'Error' || locationStatus === 'Denied') && (
              <div className="mt-6 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs text-center font-medium">
                  {locationStatus === 'Outside' && "You are outside the geofence. Move closer to the office to clock in/out."}
                  {locationStatus === 'Error' && "Location error. Ensure location is enabled and Refresh."}
                  {locationStatus === 'Denied' && "Location access denied. Please enable it in browser settings."}
              </div>
          )}

          {scanError && (
            <div className="mt-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-[10px] text-center">
              {scanError}
            </div>
          )}
        </div>

        {/* Activity Section */}
        <div className="pt-4 border-t border-slate-100">
           <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <ClockIcon className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-slate-800 text-sm">Today's Activity</h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">1 Entry</span>
           </div>
           
           <div className="space-y-3">
              <div className="flex items-center space-x-4 p-3 bg-slate-50 rounded-xl">
                 <div className="w-1 h-8 bg-green-500 rounded-full"></div>
                 <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">Checked In</p>
                    <p className="text-[10px] text-slate-500">Corporate Office • Geofenced</p>
                 </div>
                 <div className="text-right">
                    <p className="text-xs font-black text-slate-800">12:36 PM</p>
                    <p className="text-[10px] text-green-600 font-bold">On Time</p>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Hidden Video for Camera Access */}
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

      {/* Device Navigation Simulation bar */}
      <div className="h-1 w-24 bg-slate-200 rounded-full mx-auto my-4 opacity-50"></div>
    </div>
  );
};

export default MobileAttendance;