import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { supabase } from '../supabaseClient';
import type { Employee, Location } from '../types';
import { MapPinIcon, ClockIcon, FingerPrintIcon, CheckCircleIcon, XCircleIcon, RefreshIcon } from '../components/icons';

interface MobileAttendanceProps {
    currentUser: Employee | null;
}

interface AttendanceLog {
    id: number;
    punch_time: string;
    punch_type: 'IN' | 'OUT';
    location_name: string;
    is_verified: boolean;
}

const MobileAttendance: React.FC<MobileAttendanceProps> = ({ currentUser }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [assignedLocation, setAssignedLocation] = useState<Location | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [isWithinRange, setIsWithinRange] = useState<boolean>(false);
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [status, setStatus] = useState<'IN' | 'OUT'>('OUT');
    const [isLoading, setIsLoading] = useState(true);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isPunching, setIsPunching] = useState(false);
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [showFaceScanner, setShowFaceScanner] = useState(false);
    const [faceVerified, setFaceVerified] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Digital Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch Logs & Assigned Location
    useEffect(() => {
        if (currentUser) {
            fetchInitialData();
        }
    }, [currentUser]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            if (currentUser?.location) {
                const { data: locData, error: locError } = await supabase
                    .from('locations')
                    .select('*')
                    .eq('name', currentUser.location)
                    .limit(1) 
                    .maybeSingle();
                
                if (locError) console.error("Location fetch error:", locError.message);
                else setAssignedLocation(locData as Location);
            }

            const today = new Date().toISOString().split('T')[0];
            const { data: logData, error: logError } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('employee_code', currentUser?.employeeCode)
                .gte('punch_time', `${today}T00:00:00`)
                .order('punch_time', { ascending: false });

            if (logError) {
                console.error("Log fetch error:", logError.message);
                if (logError.code === '42P01' || logError.message.includes('does not exist')) {
                    setShowSqlModal(true);
                }
            } else {
                const fetchedLogs = logData as AttendanceLog[];
                setLogs(fetchedLogs);
                if (fetchedLogs.length > 0) {
                    setStatus(fetchedLogs[0].punch_type === 'IN' ? 'IN' : 'OUT');
                }
            }
        } catch (err) {
            console.error("Error loading data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Geolocation Watcher
    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by this browser.");
            return;
        }

        if (location.protocol === 'http:' && !location.hostname.includes('localhost') && !location.hostname.includes('127.0.0.1')) {
            setLocationError("Location access requires HTTPS when accessing from network IP. Please use localhost or enable HTTPS.");
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCurrentLocation({ lat: latitude, lng: longitude });
                setLocationError(null);

                if (assignedLocation) {
                    const dist = calculateDistance(latitude, longitude, Number(assignedLocation.latitude), Number(assignedLocation.longitude));
                    setDistance(dist);
                    setIsWithinRange(dist <= (assignedLocation.radius || 100));
                }
            },
            (error) => {
                console.error("Location error:", error);
                let msg = "Unable to retrieve location.";
                if (error.code === 1) msg = "Location denied. Please enable permissions.";
                else if (error.code === 2) msg = "Location unavailable. Check GPS.";
                else if (error.code === 3) msg = "Location request timed out.";
                setLocationError(msg);
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [assignedLocation]);

    const handleRetryLocation = async () => {
        setLocationError(null);
        setIsLoading(true);
        
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by this browser.");
            setIsLoading(false);
            return;
        }

        if (location.protocol === 'http:' && !location.hostname.includes('localhost') && !location.hostname.includes('127.0.0.1')) {
            setLocationError("Location access requires HTTPS when accessing from network IP (192.168.x.x). Please use localhost or enable HTTPS.");
            setIsLoading(false);
            return;
        }

        if ('permissions' in navigator) {
            try {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                
                if (permission.state === 'denied') {
                    setLocationError("Location permission denied. Please enable location access in your browser settings and refresh the page.");
                    setIsLoading(false);
                    return;
                }
                
                if (permission.state === 'prompt') {
                    setLocationError("Please allow location access when prompted.");
                }
            } catch (err) {
                console.warn('Permissions API not fully supported:', err);
            }
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCurrentLocation({ lat: latitude, lng: longitude });
                setLocationError(null);
                
                if (assignedLocation) {
                    const dist = calculateDistance(latitude, longitude, Number(assignedLocation.latitude), Number(assignedLocation.longitude));
                    setDistance(dist);
                    setIsWithinRange(dist <= (assignedLocation.radius || 100));
                }
                setIsLoading(false);
            },
            (error) => {
                console.error("Location error:", error);
                setIsLoading(false);
                
                let msg = "Unable to retrieve location.";
                
                switch (error.code) {
                    case 1:
                        msg = "Location access denied. Please enable location permissions in your browser settings.";
                        break;
                    case 2:
                        msg = "Location unavailable. Please check your GPS/WiFi connection.";
                        break;
                    case 3:
                        msg = "Location request timed out. Please try again.";
                        break;
                    default:
                        msg = "Location error occurred. Please try again.";
                }
                
                setLocationError(msg);
            },
            { 
                enableHighAccuracy: true, 
                maximumAge: 0, 
                timeout: 15000
            }
        );
    };

    const showLocationGuide = () => {
        if (location.protocol === 'http:' && !location.hostname.includes('localhost') && !location.hostname.includes('127.0.0.1')) {
            alert(`HTTPS Required for Location Access\n\nWhen accessing from mobile devices using network IP (${location.hostname}), browsers require HTTPS for location access.\n\nSolutions:\n• Use localhost on the same device\n• Set up HTTPS/SSL certificate\n• Use ngrok or similar tunneling service\n• Access from desktop browser for testing`);
            return;
        }
        
        const userAgent = navigator.userAgent;
        let instructions = "";
        
        if (userAgent.includes('Chrome')) {
            instructions = "Chrome: Click the location icon in the address bar > Allow location access > Refresh page";
        } else if (userAgent.includes('Firefox')) {
            instructions = "Firefox: Click the shield icon > Permissions > Allow location > Refresh page";
        } else if (userAgent.includes('Safari')) {
            instructions = "Safari: Safari menu > Settings > Websites > Location > Allow > Refresh page";
        } else {
            instructions = "Please enable location access in your browser settings and refresh the page.";
        }
        
        alert(`Location Permission Guide:\n\n${instructions}\n\nIf the issue persists, try:\n• Refresh the page\n• Clear browser cache\n• Check if location services are enabled on your device`);
    };

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    const startFaceAuth = () => {
        setShowFaceScanner(true);
        startCamera();
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            alert('Camera access denied. Please enable camera permissions.');
            setShowFaceScanner(false);
        }
    };

    const captureAndVerifyFace = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx?.drawImage(video, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Compare with stored face data
        const isVerified = await compareFaces(imageData, currentUser?.photoUrl || '');
        
        if (isVerified) {
            setFaceVerified(true);
            setShowFaceScanner(false);
            handlePunch(true);
        } else {
            alert('Face verification failed. Please try again.');
        }
        
        // Stop camera
        const stream = video.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
    };

    const compareFaces = async (capturedImage: string, masterImage: string): Promise<boolean> => {
        // Simulate face comparison - replace with actual API
        return new Promise((resolve) => {
            setTimeout(() => resolve(Math.random() > 0.2), 1500);
        });
    };

    const handlePunch = async (faceVerified = false) => {
        if (!currentUser || !currentLocation) return;

        setIsPunching(true);
        const newType = status === 'IN' ? 'OUT' : 'IN';
        const timestamp = new Date().toISOString();

        try {
            const payload = {
                employee_code: currentUser.employeeCode,
                punch_time: timestamp,
                punch_type: newType,
                latitude: currentLocation?.lat || null,
                longitude: currentLocation?.lng || null,
                location_name: assignedLocation?.name || 'Unknown',
                is_verified: faceVerified && isWithinRange,
                distance_from_base: distance ? Math.round(distance) : null
            };

            const { error } = await supabase.from('attendance_logs').insert([payload]);

            if (error) throw error;

            const newLog: AttendanceLog = {
                id: Date.now(),
                punch_time: timestamp,
                punch_type: newType,
                location_name: assignedLocation?.name || 'Unknown',
                is_verified: faceVerified && isWithinRange
            };
            
            setLogs([newLog, ...logs]);
            setStatus(newType);
            
        } catch (err: any) {
            console.error("Punch failed:", err);
            alert("Punch failed: " + err.message);
        } finally {
            setIsPunching(false);
        }
    };

    const copySql = () => {
        const sql = `
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    employee_code text NOT NULL,
    punch_time timestamptz NOT NULL,
    punch_type text NOT NULL, -- 'IN' or 'OUT'
    latitude float,
    longitude float,
    location_name text,
    is_verified boolean DEFAULT false,
    distance_from_base int,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access" ON public.attendance_logs
    FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.attendance_logs TO anon, authenticated, service_role;
        `.trim();
        navigator.clipboard.writeText(sql);
        alert("SQL copied to clipboard!");
    };

    if (!currentUser) return <div className="p-8 text-center">Please log in to access Mobile Attendance.</div>;

    return (
        <div className="max-w-md mx-auto bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen shadow-2xl overflow-hidden relative flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 pb-16 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-green-500/10 rounded-full -ml-12 -mb-12 blur-2xl animate-pulse delay-1000"></div>
                
                <div className="flex items-center justify-between relative z-10 mb-8">
                    <div className="flex items-center space-x-4">
                        {currentUser.photoUrl ? (
                            <div className="relative">
                                <img src={currentUser.photoUrl} className="w-12 h-12 rounded-full border-3 border-white/30 shadow-lg" alt="Profile" />
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-lg shadow-lg">{currentUser.firstName[0]}</div>
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                            </div>
                        )}
                        <div>
                            <h2 className="font-bold text-xl leading-none text-white">{currentUser.firstName} {currentUser.lastName}</h2>
                            <p className="text-sm text-blue-200 mt-1 font-medium">{currentUser.designation}</p>
                            <p className="text-xs text-slate-400 mt-0.5">ID: {currentUser.employeeCode}</p>
                        </div>
                    </div>
                    <button onClick={fetchInitialData} className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all duration-300 backdrop-blur-sm border border-white/10 hover:scale-105">
                        <RefreshIcon className="w-5 h-5 text-white" />
                    </button>
                </div>
                
                {/* Date & Time Display */}
                <div className="text-center relative z-10">
                    <p className="text-blue-200 text-sm font-semibold uppercase tracking-[0.2em] mb-2">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                    <div className="relative">
                        <h1 className="text-6xl font-black font-mono tracking-tight text-white drop-shadow-2xl">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</h1>
                        <div className="absolute inset-0 text-6xl font-black font-mono tracking-tight text-white/20 blur-sm">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    </div>
                    <p className="text-slate-300 text-sm mt-2 font-medium">{currentTime.toLocaleTimeString('en-US', { second: '2-digit', hour12: true }).split(' ')[1]}</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative -mt-8 bg-white rounded-t-[2rem] px-6 pt-8 pb-6 flex flex-col shadow-2xl">
                
                {/* Status Cards */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    {/* Location Status */}
                    <div className="bg-gradient-to-br from-white to-slate-50 p-4 rounded-2xl shadow-lg border border-slate-100/50 backdrop-blur-sm">
                        <div className="flex items-center space-x-2 mb-2">
                            <div className={`p-2 rounded-xl ${isWithinRange ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                                <MapPinIcon className="w-4 h-4" />
                            </div>
                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Location</p>
                        </div>
                        {isLoading ? (
                            <div className="h-4 w-20 bg-slate-200 animate-pulse rounded"></div>
                        ) : locationError ? (
                            <p className="text-sm font-bold text-red-500">GPS Error</p>
                        ) : (
                            <div>
                                <p className="text-sm font-bold text-slate-800">
                                    {isWithinRange ? "✓ Verified" : "⚠ Outside"}
                                </p>
                                {distance !== null && <p className="text-xs text-slate-400 mt-1">{Math.round(distance)}m away</p>}
                            </div>
                        )}
                    </div>
                    
                    {/* Status Card */}
                    <div className="bg-gradient-to-br from-white to-slate-50 p-4 rounded-2xl shadow-lg border border-slate-100/50">
                        <div className="flex items-center space-x-2 mb-2">
                            <div className={`p-2 rounded-xl ${status === 'IN' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'}`}>
                                <ClockIcon className="w-4 h-4" />
                            </div>
                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Status</p>
                        </div>
                        <p className="text-sm font-bold text-slate-800">
                            {status === 'IN' ? '🏢 At Work' : '🏠 Available'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            {logs.length > 0 ? `Last: ${new Date(logs[0].punch_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'No activity'}
                        </p>
                    </div>
                </div>

                {/* Punch Button */}
                <div className="flex justify-center mb-8">
                    <div className="relative">
                        <button 
                            onClick={startFaceAuth}
                            disabled={isLoading || isPunching}
                            className={`
                                relative w-56 h-56 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 group
                                ${status === 'OUT' 
                                    ? 'bg-gradient-to-br from-emerald-400 via-green-500 to-emerald-600 shadow-emerald-200/50' 
                                    : 'bg-gradient-to-br from-rose-400 via-red-500 to-rose-600 shadow-rose-200/50'}
                                ${isLoading ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-3xl'}
                            `}
                        >
                            {/* Animated rings */}
                            <div className="absolute inset-0 rounded-full border-2 border-white/30"></div>
                            <div className="absolute inset-2 rounded-full border border-white/20"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-white/10 animate-ping opacity-30"></div>
                            
                            {/* Pulse effect */}
                            <div className={`absolute inset-0 rounded-full animate-pulse ${status === 'OUT' ? 'bg-green-400/20' : 'bg-red-400/20'}`}></div>
                            
                            {/* Icon */}
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="p-4 bg-white/20 rounded-full mb-3 group-hover:bg-white/30 transition-all duration-300">
                                    <div className="w-12 h-12 text-white drop-shadow-lg flex items-center justify-center text-2xl">
                                        {status === 'OUT' ? '🔓' : '🔒'}
                                    </div>
                                </div>
                                <span className="text-white font-black text-2xl tracking-wider drop-shadow-lg">
                                    {status === 'OUT' ? 'CLOCK IN' : 'CLOCK OUT'}
                                </span>
                                <span className="text-white/90 text-sm mt-2 font-semibold">
                                    {isPunching ? '⏳ Processing...' : '📷 Face Scan'}
                                </span>
                            </div>
                        </button>
                        
                        {/* Outer glow effect */}
                        <div className={`absolute inset-0 rounded-full blur-xl opacity-30 ${status === 'OUT' ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                    </div>
                </div>

                {/* Activity Timeline */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-700 flex items-center">
                            <ClockIcon className="w-5 h-5 mr-2 text-blue-500" />
                            Today's Activity
                        </h3>
                        <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full font-semibold">
                            {logs.length} {logs.length === 1 ? 'Entry' : 'Entries'}
                        </span>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 space-y-3 pr-1">
                        {logs.length > 0 ? (
                            logs.map((log, index) => (
                                <div key={log.id} className="bg-gradient-to-r from-white to-slate-50 p-4 rounded-2xl border border-slate-100/50 shadow-sm hover:shadow-md transition-all duration-300 group">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center space-x-4">
                                            <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm text-white shadow-lg ${
                                                log.punch_type === 'IN' 
                                                    ? 'bg-gradient-to-br from-green-400 to-green-600' 
                                                    : 'bg-gradient-to-br from-red-400 to-red-600'
                                            }`}>
                                                {log.punch_type === 'IN' ? '🚪➡️' : '🚪⬅️'}
                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center text-xs font-black text-slate-600">
                                                    {index + 1}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <p className="text-lg font-bold text-slate-800">{new Date(log.punch_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                        log.punch_type === 'IN' 
                                                            ? 'bg-green-100 text-green-700' 
                                                            : 'bg-red-100 text-red-700'
                                                    }`}>
                                                        {log.punch_type}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-500 mt-1 flex items-center">
                                                    <MapPinIcon className="w-3 h-3 mr-1" />
                                                    {log.location_name}
                                                </p>
                                            </div>
                                        </div>
                                        {log.is_verified && (
                                            <div className="flex items-center text-xs text-green-600 bg-green-50 px-3 py-2 rounded-xl border border-green-100 shadow-sm">
                                                <CheckCircleIcon className="w-4 h-4 mr-1" /> 
                                                <span className="font-semibold">Verified</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 text-slate-400">
                                <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                                    <ClockIcon className="w-10 h-10 opacity-50" />
                                </div>
                                <h4 className="text-lg font-semibold text-slate-600 mb-2">No Activity Today</h4>
                                <p className="text-sm text-slate-400">Your attendance records will appear here</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Alert */}
            {locationError && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 border-t border-red-100/50 backdrop-blur-sm">
                    <div className="flex items-start space-x-3">
                        <div className="p-2 bg-red-100 rounded-xl">
                            <MapPinIcon className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-red-800 mb-1">Location Access Required</h4>
                            <p className="text-xs text-red-600 mb-3">{locationError}</p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={locationError?.includes('HTTPS') ? showLocationGuide : (locationError?.includes('denied') || locationError?.includes('Permission') ? showLocationGuide : handleRetryLocation)} 
                                    className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-red-700 transition-all duration-300 hover:scale-105"
                                >
                                    {locationError?.includes('HTTPS') ? '⚙️ HTTPS Guide' : (locationError?.includes('denied') || locationError?.includes('Permission') ? '⚙️ Settings Guide' : '🔄 Retry Location')}
                                </button>
                                {(locationError?.includes('denied') || locationError?.includes('Permission')) && (
                                    <button 
                                        onClick={() => window.location.reload()} 
                                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-105"
                                    >
                                        🔄 Refresh
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Face Scanner Modal */}
            {showFaceScanner && (
                <div className="absolute inset-0 z-50 bg-black flex items-center justify-center">
                    <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    <div className="relative z-10 text-center">
                        <div className="w-64 h-64 mx-auto mb-6 rounded-full border-2 border-white/50 shadow-[0_0_0_1000px_rgba(0,0,0,0.7)]">
                            <div className="w-full h-1 bg-blue-500 animate-pulse"></div>
                        </div>
                        
                        <h3 className="text-xl font-bold text-white mb-4">Face Authentication</h3>
                        
                        <div className="flex gap-3 justify-center">
                            <button onClick={captureAndVerifyFace} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">
                                📷 Verify
                            </button>
                            <button onClick={() => setShowFaceScanner(false)} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold">
                                ✕ Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SQL Setup Modal */}
            {showSqlModal && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <h3 className="font-bold text-xl text-slate-800 mb-2">Database Setup Required</h3>
                            <p className="text-sm text-slate-600">The attendance_logs table is missing. Please run this SQL in Supabase:</p>
                        </div>
                        <div className="bg-slate-900 text-green-400 p-4 rounded-2xl text-xs font-mono overflow-x-auto mb-6 border">
                            CREATE TABLE IF NOT EXISTS attendance_logs...
                        </div>
                        <div className="flex space-x-3">
                            <button onClick={copySql} className="flex-1 bg-blue-600 text-white py-3 rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all duration-300 shadow-lg">📋 Copy SQL</button>
                            <button onClick={() => setShowSqlModal(false)} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-2xl text-sm font-bold hover:bg-slate-300 transition-all duration-300">✕ Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileAttendance;