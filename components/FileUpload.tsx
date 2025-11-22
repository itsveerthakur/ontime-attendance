
import React, { useRef } from 'react';
import { UploadIcon } from './icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  disabled: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, selectedFile, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <label
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        htmlFor="file-upload"
        className={`flex flex-col items-center justify-center w-full h-40 px-4 transition bg-white border-2 border-slate-300 border-dashed rounded-xl appearance-none cursor-pointer hover:border-primary-light focus:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <UploadIcon className="w-6 h-6 text-primary" />
        </div>
        <span className="flex items-center space-x-2">
          <span className="font-medium text-slate-600">
            {selectedFile ? selectedFile.name : 'Drop files to Attach, or '}
            <span className="text-primary font-semibold">{selectedFile ? '' : 'browse'}</span>
          </span>
        </span>
         <span className="text-xs text-slate-500 mt-1">Supports: .xlsx, .xls</span>
        <input
          id="file-upload"
          name="file-upload"
          type="file"
          className="hidden"
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          ref={fileInputRef}
          disabled={disabled}
        />
      </label>
    </div>
  );
};

export default FileUpload;