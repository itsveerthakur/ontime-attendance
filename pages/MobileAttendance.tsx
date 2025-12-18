
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Employee } from '../types';
import { ClockIcon, MapPinIcon, RefreshIcon, LoaderIcon, LockClosedIcon, FingerPrintIcon, XCircleIcon, CheckCircleIcon } from '../components/icons';
import { GoogleGenAI, Type } from "@google/genai";

interface MobileAttendanceProps {
  currentUser: Employee | null;
}

const MobileAttendance: React.FC<MobileAttendanceProps> = ({ currentUser }) => {
  const [time, setTime] = useState(new Date());
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'Checking' | 'Inside' | 'Outside' | 'Error' | 'Denied'>('Checking');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [officeCoords, setOfficeCoords] = useState<{ lat: number; lng: number; radius: number; name: string; address: string } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
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
    
    const { data, error } = await supabase
      .from('locations')
      .select('latitude, longitude, radius, name, address')
      .ilike('name', currentUser.location.trim())
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch office coordinates:", error);
      setLocationStatus('Error');
    } else if (!data) {
      setLocationStatus('Error');
    } else {
      setOfficeCoords({
        lat: Number(data.latitude),
        lng: Number(data.longitude),
        radius: Number(data.radius) || 100,
        name: data.name,
        address: data.address || data.name
      });
    }
  };

  useEffect(() => {
    fetchOfficeLocation();
  }, [currentUser]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Error');
      return;
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.error("Geolocation error:", error);
        if (error.code === error.PERMISSION_DENIED) {
            setLocationStatus('Denied');
        } else {
            setLocationStatus('Error');
        }
      },
      geoOptions
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (currentCoords && window.google && window.google.maps) {
      setIsGeocoding(true);
      const geocoder = new window.google.maps.Geocoder();
      const latlng = { lat: currentCoords.lat, lng: currentCoords.lng };
      
      geocoder.geocode({ location: latlng }, (results: any, status: any) => {
        setIsGeocoding(false);
        if (status === "OK" && results[0]) {
          setCurrentAddress(results[0].formatted_address);
        } else {
          setCurrentAddress(`Location: ${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}`);
        }
      });
    }
  }, [currentCoords]);

  useEffect(() => {
    if (currentCoords && officeCoords) {
      const R = 6371e3; 
      const φ1 = currentCoords.lat * Math.PI / 180;
      const φ2 = officeCoords.lat * Math.PI / 180;
      const Δφ = (officeCoords.lat - currentCoords.lat) * Math.PI / 180;
      const Δλ = (officeCoords.lng - currentCoords.lng) * Math.PI / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; 
      
      if (distance <= (officeCoords.radius + 20)) {
        setLocationStatus('Inside');
      } else {
        setLocationStatus('Outside');
      }
    }
  }, [currentCoords, officeCoords]);

  const handleRefresh = () => {
    setLocationStatus('Checking');
    setCurrentAddress(null);
    fetchOfficeLocation();
  };

  const captureFrame = (): string | null => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      // Capture at a standard manageable resolution
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Using lower quality (0.5) to ensure payload is within reliable limits
        return canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
      }
    }
    return null;
  };

  const verifyFace = async (capturedBase64: string): Promise<boolean> => {
    if (!currentUser?.photoUrl) {
      setScanError("No profile photo found. Please upload a photo to your profile first.");
      return false;
    }

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        setScanError("Face verification not configured. Contact admin.");
        return false;
      }

      const genAI = new GoogleGenAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      let profileBase64 = '';
      if (currentUser.photoUrl.startsWith('data:')) {
        profileBase64 = currentUser.photoUrl.split(',')[1];
      } else {
        const res = await fetch(currentUser.photoUrl);
        const blob = await res.blob();
        profileBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
      }

      const result = await model.generateContent([
        "Compare these faces and return JSON: {isMatch: boolean, reason: string}",
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: profileBase64
          }
        },
        {
          inlineData: {
            mimeType: "image/jpeg", 
            data: capturedBase64
          }
        }
      ]);

      const response = JSON.parse(result.response.text());
      if (!response.isMatch) {
        setScanError(`Verification failed: ${response.reason}`);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error("Face verification error:", err);
      setScanError("Face verification failed. Check internet connection.");
      return false;
    }
  };

  const handleAction = async () => {
    if (locationStatus !== 'Inside') {
      alert("Unauthorized: You are outside the office geofence.");
      return;
    }

    setScanError(null);
    setIsScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Small delay to let user position face
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const capturedBase64 = captureFrame();
      
      // Stop camera immediately
      stream.getTracks().forEach(track => track.stop());
      
      if (!capturedBase64) throw new Error("Failed to capture photo from camera.");

      setIsScanning(false);
      setIsVerifying(true);

      const isVerified = await verifyFace(capturedBase64);

      if (isVerified) {
        setIsClockedIn(!isClockedIn);
        // Note: Success state could be logged to Supabase here
      }
      
      setIsVerifying(false);
    } catch (err: any) {
      setIsScanning(false);
      setIsVerifying(false);
      console.error("Capture process error:", err);
      setScanError(err.message || "Face scanning failed.");
    }
  };

  return (
    <div className="max-w-md mx-auto h-full flex flex-col bg-slate-50 shadow-2xl rounded-[3rem] overflow-hidden border-[12px] border-slate-900 relative">
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
            </div>
          </div>
          <button onClick={handleRefresh} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
            <RefreshIcon className={`w-5 h-5 ${(locationStatus === 'Checking' || isGeocoding) ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="mt-10 text-center animate-fadeIn">
          <p className="text-xs font-semibold text-slate-400 tracking-[0.2em] mb-2">{time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</p>
          <h1 className="text-6xl font-bold tracking-tight">{time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</h1>
          <div className="flex items-start justify-center mt-4 text-slate-300 px-4 min-h-[40px]">
             {currentAddress ? (
               <><MapPinIcon className="w-3.5 h-3.5 mr-2 opacity-70 mt-0.5 flex-shrink-0" /><span className="text-[10px] sm:text-xs font-medium tracking-wide italic leading-snug">{currentAddress}</span></>
             ) : (
               <div className="flex items-center space-x-2 text-slate-400"><LoaderIcon className="w-3.5 h-3.5 animate-spin" /><span className="text-[10px] sm:text-xs italic tracking-wide">Syncing GPS...</span></div>
             )}
          </div>
        </div>
      </div>

      <div className="flex-1 -mt-8 bg-white rounded-t-[3rem] shadow-[0_-15px_30px_rgba(0,0,0,0.1)] p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="p-2 bg-red-50 rounded-full mb-2"><MapPinIcon className={`w-5 h-5 ${locationStatus === 'Inside' ? 'text-green-600' : 'text-red-500'}`} /></div>
             <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Office</p>
             <div className="flex items-center space-x-1">
                {locationStatus === 'Checking' ? <LoaderIcon className="w-4 h-4 text-primary animate-spin" /> : <span className={`text-sm font-bold ${locationStatus === 'Inside' ? 'text-green-600' : 'text-red-500'}`}>{locationStatus}</span>}
             </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="p-2 bg-green-50 rounded-full mb-2"><ClockIcon className="w-5 h-5 text-green-600" /></div>
             <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Status</p>
             <p className="text-sm font-bold text-slate-800">{isClockedIn ? 'Working' : 'Out'}</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center pt-4">
          <button 
            onClick={handleAction}
            disabled={isScanning || isVerifying || locationStatus !== 'Inside'}
            className={`relative z-10 w-48 h-48 rounded-full flex flex-col items-center justify-center text-white transition-all transform active:scale-95 shadow-2xl ${isClockedIn ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-gradient-to-br from-green-500 to-green-700'} disabled:grayscale disabled:opacity-50 overflow-hidden`}
          >
            {isScanning ? (
              <><LoaderIcon className="w-12 h-12 animate-spin mb-2" /><span className="text-xs font-bold uppercase tracking-widest">Scanning...</span></>
            ) : isVerifying ? (
              <><LoaderIcon className="w-12 h-12 animate-pulse mb-2" /><span className="text-xs font-bold uppercase tracking-widest">Verifying...</span></>
            ) : (
              <><LockClosedIcon className="w-10 h-10 mb-2 opacity-50" /><span className="text-2xl font-black uppercase tracking-tighter">{isClockedIn ? 'Clock Out' : 'Clock In'}</span><div className="flex items-center mt-2 bg-black/20 px-3 py-1 rounded-full space-x-1"><FingerPrintIcon className="w-3 h-3" /><span className="text-[10px] font-bold">Face ID</span></div></>
            )}
            {isScanning && (
              <div className="absolute inset-0 z-20">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <div className="absolute inset-0 border-4 border-white/50 rounded-full animate-pulse pointer-events-none"></div>
              </div>
            )}
          </button>

          {locationStatus !== 'Inside' && locationStatus !== 'Checking' && (
            <div className="mt-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold flex items-center gap-2">
              <XCircleIcon className="w-4 h-4" /> <span>Move inside Office Geofence</span>
            </div>
          )}
          {scanError && (
            <div className="mt-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold flex flex-col items-center gap-1 shadow-sm text-center">
              <XCircleIcon className="w-5 h-5 text-red-500" />
              <span>{scanError}</span>
            </div>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default MobileAttendance;
