
import React, { useState, useRef, useEffect } from 'react';
import type { Employee } from '../types';
import { MoneyIcon, AttendanceIcon, SupportIcon, UploadIcon, LoaderIcon, CameraIcon, XCircleIcon } from '../components/icons';
import { supabase } from '../supabaseClient';
import { GoogleGenAI, Type } from '@google/genai';

interface ProfilePageProps {
  currentUser: Employee | null;
  onUpdateUser: (user: Employee) => void;
}

const DetailRow: React.FC<{ label: string; value: string | number | undefined | null }> = ({ label, value }) => (
  <div className="py-3 border-b border-slate-100 last:border-0 flex flex-col sm:flex-row sm:justify-between">
    <span className="text-sm text-slate-500 font-medium">{label}</span>
    <span className="text-sm text-slate-800 font-semibold mt-1 sm:mt-0 text-right">{value || '-'}</span>
  </div>
);

const SectionCard: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
    <div className="px-6 py-4 border-b border-slate-100 flex items-center space-x-2 bg-slate-50/50">
      {icon && <div className="text-primary">{icon}</div>}
      <h3 className="font-bold text-slate-700">{title}</h3>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

const ProfilePage: React.FC<ProfilePageProps> = ({ currentUser, onUpdateUser }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen]);

  if (!currentUser) {
    return <div className="text-center py-10 text-slate-500">No user profile data available.</div>;
  }

  const initials = `${currentUser.firstName.charAt(0)}${currentUser.lastName.charAt(0)}`;

  const handlePhotoAction = () => {
    setIsChoiceModalOpen(true);
  };

  const handleUploadClick = () => {
    setIsChoiceModalOpen(false);
    fileInputRef.current?.click();
  };

  const verifyAndSetPhoto = async (base64Str: string) => {
    setIsUploading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Clean base64 string
      const base64Data = base64Str.includes(',') ? base64Str.split(',')[1] : base64Str;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          parts: [
            { text: "Analyze the attached image. Is this a clear, centered, and identifiable photo of a human face suitable for biometric registration? Disregard the background. Respond only with JSON: { 'valid': boolean, 'reason': string }" },
            { inlineData: { mimeType: 'image/jpeg', data: base64Data.trim() } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              valid: { type: Type.BOOLEAN },
              reason: { type: Type.STRING }
            },
            required: ["valid", "reason"]
          }
        }
      });

      const result = JSON.parse(response.text || '{"valid": false, "reason": "No response"}');

      if (!result.valid) {
        alert(`Face Registration Rejected: ${result.reason}`);
        setIsUploading(false);
        return;
      }
      
      await compressAndSetPhoto(base64Str);
    } catch (err: any) {
      console.error("Setup Verification Error:", err);
      // Fallback if AI service is blocked or down
      const confirmSave = window.confirm("The AI face-validator is currently unavailable. Would you like to save this photo anyway? (Ensure your face is clearly visible)");
      if (confirmSave) {
        await compressAndSetPhoto(base64Str);
      } else {
        setIsUploading(false);
      }
    }
  };

  const compressAndSetPhoto = (base64Str: string) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const SIZE = 400; // Standard size for biometric reference
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Calculate centering
          const scale = Math.max(SIZE / img.width, SIZE / img.height);
          const x = (SIZE / 2) - (img.width / 2) * scale;
          const y = (SIZE / 2) - (img.height / 2) * scale;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          
          const finalBase64 = canvas.toDataURL('image/jpeg', 0.85);
          
          try {
            const { error } = await supabase
              .from('employees')
              .update({ photoUrl: finalBase64 })
              .eq('employeeCode', currentUser.employeeCode);

            if (error) throw error;

            onUpdateUser({ ...currentUser, photoUrl: finalBase64 });
            alert("Face ID registered successfully!");
          } catch (err: any) {
            alert("Database Error: " + err.message);
          } finally {
            setIsUploading(false);
            resolve();
          }
        }
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => verifyAndSetPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    setIsChoiceModalOpen(false);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1080 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      alert("Camera access denied.");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const size = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = 600;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, 600, 600);
          const data = canvas.toDataURL('image/jpeg', 0.9);
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          setIsCameraOpen(false);
          verifyAndSetPhoto(data);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

      <div className="relative bg-gradient-to-r from-primary to-blue-600 h-48 rounded-2xl shadow-md overflow-hidden">
        <div className="absolute inset-0 bg-white/10 pattern-grid-lg opacity-30"></div>
        <div className="absolute bottom-0 left-0 w-full p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-end space-y-4 sm:space-y-0 sm:space-x-6">
          <div className="relative group cursor-pointer" onClick={handlePhotoAction}>
            {currentUser.photoUrl ? (
              <img src={currentUser.photoUrl} alt="Profile" className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg object-cover bg-white" />
            ) : (
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg bg-white flex items-center justify-center text-4xl font-bold text-primary">
                {initials}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {isUploading ? <LoaderIcon className="w-8 h-8 text-white animate-spin" /> : <CameraIcon className="w-8 h-8 text-white" />}
            </div>
            <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white ${currentUser.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
          <div className="text-center sm:text-left text-white mb-2 flex-1">
            <h1 className="text-3xl font-bold">{currentUser.firstName} {currentUser.lastName}</h1>
            <p className="text-blue-100 font-medium mt-1">{currentUser.designation} &bull; {currentUser.department}</p>
            <p className="text-xs text-blue-200 mt-1 opacity-80">{currentUser.employeeCode}</p>
          </div>
          <div className="pb-2">
             <button onClick={handlePhotoAction} disabled={isUploading} className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all">
                {isUploading ? <LoaderIcon className="w-3 h-3 animate-spin" /> : <CameraIcon className="w-3 h-3" />}
                {isUploading ? 'Registering...' : 'Update Face ID'}
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-16">
        <div className="space-y-6">
          <SectionCard title="Contact Information" icon={<SupportIcon className="w-5 h-5" />}>
            <DetailRow label="Email" value={currentUser.email} />
            <DetailRow label="Phone" value={currentUser.phone} />
            <DetailRow label="Present Address" value={currentUser.presentAddress} />
            <DetailRow label="Permanent Address" value={currentUser.permanentAddress} />
          </SectionCard>
        </div>
        <div className="space-y-6">
          <SectionCard title="Personal Details" icon={<AttendanceIcon className="w-5 h-5" />}>
            <DetailRow label="Date of Birth" value={currentUser.dateOfBirth} />
            <DetailRow label="Gender" value={currentUser.gender} />
            <DetailRow label="Father's Name" value={currentUser.fatherName} />
            <DetailRow label="Mother's Name" value={currentUser.motherName} />
          </SectionCard>
          <SectionCard title="Official Info" icon={<SupportIcon className="w-5 h-5" />}>
            <DetailRow label="Employee Code" value={currentUser.employeeCode} />
            <DetailRow label="Date of Joining" value={currentUser.dateOfJoining} />
            <DetailRow label="Location" value={currentUser.location} />
            <DetailRow label="Manager" value={currentUser.managerName} />
          </SectionCard>
        </div>
        <div className="space-y-6">
           <SectionCard title="Statutory Info" icon={<MoneyIcon className="w-5 h-5" />}>
            <DetailRow label="UAN No" value={currentUser.uanNo} />
            <DetailRow label="ESIC No" value={currentUser.esicNo} />
            <DetailRow label="User Type" value={currentUser.userType} />
            <DetailRow label="Role" value={currentUser.userRole} />
          </SectionCard>
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-100 text-center shadow-sm">
             <h3 className="text-primary font-bold mb-2">Face ID Enrollment</h3>
             <p className="text-sm text-slate-600 mb-4">Your registered photo is used as your digital signature for clocking in via the mobile app.</p>
             <button onClick={handlePhotoAction} className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors shadow-sm w-full">
                Register New Photo
             </button>
          </div>
        </div>
      </div>

      {isChoiceModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Enroll Face ID</h3>
              <button onClick={() => setIsChoiceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <button onClick={handleUploadClick} className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-primary transition-all group">
                <div className="p-3 bg-white rounded-full shadow-sm mb-3 text-slate-400 group-hover:text-primary transition-colors">
                  <UploadIcon className="w-8 h-8" />
                </div>
                <span className="text-sm font-bold text-slate-700">From File</span>
              </button>
              <button onClick={startCamera} className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-primary transition-all group">
                <div className="p-3 bg-white rounded-full shadow-sm mb-3 text-slate-400 group-hover:text-primary transition-colors">
                  <CameraIcon className="w-8 h-8" />
                </div>
                <span className="text-sm font-bold text-slate-700">Take Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Camera Enrollment</h3>
              <button onClick={() => setIsCameraOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="relative aspect-square bg-slate-900 overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />
              <div className="absolute inset-0 border-2 border-white/20 rounded-full m-8 pointer-events-none"></div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-center">
              <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-primary flex items-center justify-center shadow-lg transform active:scale-95 transition-all">
                <div className="w-10 h-10 rounded-full bg-primary"></div>
              </button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
