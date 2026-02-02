import { useState, useRef } from 'react';
import { uploadDocumentWithProgress } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Upload, FileIcon, Clock, Loader2, CheckCircle, XCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileUploaded: () => void;
}

type FileStatus = 'pending' | 'uploading' | 'success' | 'error';

export default function FileUpload({ onFileUploaded }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<Record<string, FileStatus>>({});
  const [fileProgress, setFileProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validExtensions = ['.html', '.htm', '.md', '.markdown'];

    const validFiles = files.filter(file => {
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      return validExtensions.includes(fileExtension);
    });

    const invalidCount = files.length - validFiles.length;
    if (invalidCount > 0) {
      toast.error('Invalid file type', {
        description: `${invalidCount} file(s) skipped. Only HTML and Markdown files are supported`,
      });
    }

    if (validFiles.length === 0) return;

    setSelectedFiles(validFiles);

    const initialStatus: Record<string, FileStatus> = {};
    const initialProgress: Record<string, number> = {};
    validFiles.forEach(file => {
      initialStatus[file.name] = 'pending';
      initialProgress[file.name] = 0;
    });
    setUploadStatus(initialStatus);
    setFileProgress(initialProgress);
  };

  const removeFile = (filename: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== filename));
    setUploadStatus(prev => {
      const updated = { ...prev };
      delete updated[filename];
      return updated;
    });
    setFileProgress(prev => {
      const updated = { ...prev };
      delete updated[filename];
      return updated;
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);

    try {
      const uploadPromises = selectedFiles.map(async (file) => {
        try {
          setUploadStatus(prev => ({ ...prev, [file.name]: 'uploading' }));

          const result = await uploadDocumentWithProgress(
            file,
            (progress) => setFileProgress(prev => ({ ...prev, [file.name]: progress }))
          );

          setUploadStatus(prev => ({ ...prev, [file.name]: 'success' }));
          return { success: true, filename: file.name, result };
        } catch (error: any) {
          setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
          return { success: false, filename: file.name, error: error.message };
        }
      });

      const results = await Promise.allSettled(uploadPromises);

      const successCount = results.filter(
        r => r.status === 'fulfilled' && r.value.success
      ).length;
      const errorCount = results.filter(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      ).length;

      if (successCount > 0) {
        toast.success('Upload complete', {
          description: `${successCount} file(s) uploaded successfully`,
        });
        onFileUploaded();
      }

      if (errorCount > 0) {
        toast.error('Upload errors', {
          description: `${errorCount} file(s) failed to upload`,
        });
      }

      setTimeout(() => {
        setSelectedFiles([]);
        setUploadStatus({});
        setFileProgress({});
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Upload failed', {
        description: 'An unexpected error occurred',
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

    if (files.length === 0) return;

    // Validate file types
    const validTypes = ['.html', '.htm', '.md', '.markdown'];

    const validFiles = files.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return validTypes.includes(extension);
    });

    const invalidCount = files.length - validFiles.length;
    if (invalidCount > 0) {
      toast.error('Invalid file type', {
        description: `${invalidCount} file(s) skipped. Only HTML and Markdown files are supported`,
      });
    }

    if (validFiles.length === 0) return;

    setSelectedFiles(validFiles);

    const initialStatus: Record<string, FileStatus> = {};
    const initialProgress: Record<string, number> = {};
    validFiles.forEach(file => {
      initialStatus[file.name] = 'pending';
      initialProgress[file.name] = 0;
    });
    setUploadStatus(initialStatus);
    setFileProgress(initialProgress);
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
              <p className="text-sm text-primary font-medium">Drop files here</p>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <div className="text-center">
                <label htmlFor="file-upload" className="cursor-pointer text-sm">
                  <span className="text-primary hover:underline">Choose files</span>
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
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">
              {selectedFiles.length} file(s) selected
            </p>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload All'}
            </Button>
          </div>

          <div className="space-y-2">
            {selectedFiles.map(file => {
              const status = uploadStatus[file.name];
              const progress = fileProgress[file.name] || 0;

              return (
                <div
                  key={file.name}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {status === 'pending' && (
                      <>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <button
                          onClick={() => removeFile(file.name)}
                          disabled={uploading}
                          className="text-destructive hover:text-destructive/80 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {status === 'uploading' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {progress}%
                        </span>
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      </div>
                    )}
                    {status === 'success' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {status === 'error' && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
