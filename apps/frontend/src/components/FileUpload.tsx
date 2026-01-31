import { useState, useRef } from 'react';
import { uploadDocument } from '../services/api';

interface FileUploadProps {
  onFileUploaded: () => void;
}

export default function FileUpload({ onFileUploaded }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.html', '.htm', '.md', '.markdown'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      setError('Only HTML and Markdown files are supported');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setSuccess(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadDocument(selectedFile);
      setSuccess(`${result.filename} uploaded successfully (${result.chunksCount} chunks)`);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onFileUploaded();
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-upload">
      <div className="upload-controls">
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm,.md,.markdown"
          onChange={handleFileSelect}
          disabled={uploading}
          className="file-input-visible"
        />
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="upload-button"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
      {success && <p className="success">{success}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
