
import React, { useState, useRef, useEffect } from 'react';
import type { Employee } from '../types';
import { MoneyIcon, AttendanceIcon, SupportIcon, UploadIcon, LoaderIcon, CameraIcon, XCircleIcon } from '../components/icons';
import { supabase } from '../supabaseClient';
import { GoogleGenAI } from '@google/genai';

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
    // Cleanup camera stream when camera UI closes
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
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      alert("Face verification not configured. Photo uploaded without verification.");
      return compressAndSetPhoto(base64Str);
    }

    try {
      const genAI = new GoogleGenAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const base64Data = base64Str.split(',')[1];
      const result = await model.generateContent([
        "Analyze this image and return JSON: {hasFace: boolean, isHuman: boolean, reason: string}. Check if it contains a clear human face.",
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        }
      ]);

      const response = JSON.parse(result.response.text());
      if (!response.hasFace || !response.isHuman) {
        alert(`Photo verification failed: ${response.reason}. Please upload a clear photo of your face.`);
        setIsUploading(false);
        return;
      }
      
      compressAndSetPhoto(base64Str);
    } catch (err) {
      console.error("Face verification error:", err);
      alert("Face verification failed. Photo uploaded without verification.");
      compressAndSetPhoto(base64Str);
    }
  };

  const compressAndSetPhoto = (base64Str: string) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 400;
      const MAX_HEIGHT = 400;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
      
      try {
        const { error } = await supabase
          .from('employees')
          .update({ photoUrl: compressedBase64 })
          .eq('employeeCode', currentUser.employeeCode);

        if (error) throw error;

        const updatedUser = { ...currentUser, photoUrl: compressedBase64 };
        onUpdateUser(updatedUser);
        
        setIsUploading(false);
      } catch (err: any) {
        console.error("Error updating profile photo:", err);
        alert("Failed to update photo: " + (err.message || "Unknown error"));
        setIsUploading(false);
      }
    };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      verifyAndSetPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    setIsChoiceModalOpen(false);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const photoData = canvas.toDataURL('image/jpeg');
      
      // Stop camera
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      
      setIsCameraOpen(false);
      setIsUploading(true);
      verifyAndSetPhoto(photoData);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Header Banner */}
      <div className="relative bg-gradient-to-r from-primary to-blue-600 h-48 rounded-2xl shadow-md overflow-hidden">
        <div className="absolute inset-0 bg-white/10 pattern-grid-lg opacity-30"></div>
        <div className="absolute bottom-0 left-0 w-full p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-end space-y-4 sm:space-y-0 sm:space-x-6">
          <div className="relative group cursor-pointer" onClick={handlePhotoAction}>
            {currentUser.photoUrl ? (
              <img 
                src={currentUser.photoUrl} 
                alt="Profile" 
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg object-cover bg-white transition-opacity group-hover:opacity-80"
              />
            ) : (
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg bg-white flex items-center justify-center text-4xl font-bold text-primary group-hover:bg-slate-50 transition-colors">
                {initials}
              </div>
            )}
            
            {/* Overlay for interaction */}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {isUploading ? (
                <LoaderIcon className="w-8 h-8 text-white animate-spin" />
              ) : (
                <div className="text-white flex flex-col items-center">
                  <CameraIcon className="w-6 h-6" />
                  <span className="text-[10px] font-bold uppercase mt-1">Change</span>
                </div>
              )}
            </div>

            <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white ${currentUser.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`} title={currentUser.status}></div>
          </div>
          
          <div className="text-center sm:text-left text-white mb-2 flex-1">
            <h1 className="text-3xl font-bold">{currentUser.firstName} {currentUser.lastName}</h1>
            <p className="text-blue-100 font-medium mt-1">{currentUser.designation} &bull; {currentUser.department}</p>
            <p className="text-xs text-blue-200 mt-1 opacity-80">{currentUser.employeeCode}</p>
          </div>

          <div className="pb-2">
             <button 
                onClick={handlePhotoAction}
                disabled={isUploading}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all"
             >
                {isUploading ? <LoaderIcon className="w-3 h-3 animate-spin" /> : <CameraIcon className="w-3 h-3" />}
                Change Photo
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-16">
        
        {/* Left Column */}
        <div className="space-y-6">
          <SectionCard title="Contact Information" icon={<SupportIcon className="w-5 h-5" />}>
            <DetailRow label="Email" value={currentUser.email} />
            <DetailRow label="Phone" value={currentUser.phone} />
            <DetailRow label="Present Address" value={currentUser.presentAddress} />
            <DetailRow label="Permanent Address" value={currentUser.permanentAddress} />
          </SectionCard>

          <SectionCard title="Bank Details" icon={<MoneyIcon className="w-5 h-5" />}>
            <DetailRow label="Bank Name" value={currentUser.bankName} />
            <DetailRow label="Account No" value={currentUser.accountNo} />
            <DetailRow label="IFSC Code" value={currentUser.ifscCode} />
            <DetailRow label="Payment Mode" value={currentUser.modeOfPayment} />
          </SectionCard>
        </div>

        {/* Middle Column */}
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
            <DetailRow label="Work Premises" value={currentUser.workPremises} />
            <DetailRow label="Sub Department" value={currentUser.subDepartment} />
            <DetailRow label="Location" value={currentUser.location} />
            <DetailRow label="Sub Location" value={currentUser.subLocation} />
            <DetailRow label="Manager" value={currentUser.managerName} />
            {currentUser.contractorName && <DetailRow label="Contractor" value={currentUser.contractorName} />}
          </SectionCard>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
           <SectionCard title="Statutory Info" icon={<MoneyIcon className="w-5 h-5" />}>
            <DetailRow label="UAN No" value={currentUser.uanNo} />
            <DetailRow label="ESIC No" value={currentUser.esicNo} />
            <DetailRow label="User Type" value={currentUser.userType} />
            <DetailRow label="Role" value={currentUser.userRole} />
          </SectionCard>

          <div className="bg-blue-50 rounded-xl p-6 border border-blue-100 text-center shadow-sm">
             <h3 className="text-primary font-bold mb-2">Need to update info?</h3>
             <p className="text-sm text-slate-600 mb-4">Contact the HR department to request changes to your profile details.</p>
             <button className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors shadow-sm w-full">
                Request Update
             </button>
          </div>
        </div>

      </div>

      {/* Choice Modal */}
      {isChoiceModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Update Photo</h3>
              <button onClick={() => setIsChoiceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <button 
                onClick={handleUploadClick}
                className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-primary transition-all group"
              >
                <div className="p-3 bg-white rounded-full shadow-sm mb-3 text-slate-400 group-hover:text-primary transition-colors">
                  <UploadIcon className="w-8 h-8" />
                </div>
                <span className="text-sm font-bold text-slate-700">Upload Photo</span>
              </button>
              <button 
                onClick={startCamera}
                className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-primary transition-all group"
              >
                <div className="p-3 bg-white rounded-full shadow-sm mb-3 text-slate-400 group-hover:text-primary transition-colors">
                  <CameraIcon className="w-8 h-8" />
                </div>
                <span className="text-sm font-bold text-slate-700">Click Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Take a Photo</h3>
              <button 
                onClick={() => setIsCameraOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="relative aspect-square bg-slate-900 overflow-hidden">
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover scale-x-[-1]" 
                playsInline 
                muted 
              />
              <div className="absolute inset-0 border-2 border-white/20 rounded-full m-8 pointer-events-none"></div>
            </div>

            <div className="p-6 bg-slate-50 flex justify-center">
              <button 
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white border-4 border-primary flex items-center justify-center shadow-lg transform active:scale-95 transition-all"
              >
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
