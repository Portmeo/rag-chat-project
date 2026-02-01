import { useState, useRef } from 'react';
import { uploadDocumentWithProgress } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileUploaded: () => void;
}

export default function FileUpload({ onFileUploaded }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.html', '.htm', '.md', '.markdown'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      toast.error('Invalid file type', {
        description: 'Only HTML and Markdown files are supported',
      });
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadDocumentWithProgress(
        selectedFile,
        (progress) => setUploadProgress(progress)
      );

      toast.success('Document uploaded', {
        description: `${result.filename} (${result.chunksCount} chunks)`,
      });
      setSelectedFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onFileUploaded();
    } catch (err: any) {
      toast.error('Upload failed', {
        description: err.message || 'Failed to upload file',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const file = files[0];

    if (!file) return;

    // Validate file type
    const validTypes = ['.html', '.htm', '.md', '.markdown'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!validTypes.includes(extension)) {
      toast.error('Invalid file type', {
        description: 'Only HTML and Markdown files are supported',
      });
      return;
    }

    setSelectedFile(file);
  };

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-4 transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border',
          uploading && 'opacity-50 pointer-events-none'
        )}
      >
        <div className="flex flex-col items-center gap-2">
          {isDragging ? (
            <>
              <Upload className="h-6 w-6 text-primary" />
              <p className="text-sm text-primary font-medium">Drop file here</p>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <div className="text-center">
                <label htmlFor="file-upload" className="cursor-pointer text-sm">
                  <span className="text-primary hover:underline">Choose a file</span>
                  {' or drag and drop'}
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  HTML or Markdown files only
                </p>
              </div>
              <input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                accept=".html,.htm,.md,.markdown"
                onChange={handleFileSelect}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>

      {selectedFile && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <span className="text-sm">{selectedFile.name}</span>
            <Button
              onClick={handleUpload}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
