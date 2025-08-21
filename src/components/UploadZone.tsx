import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileText, 
  FolderOpen, 
  X, 
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useFileSystemOperations } from '@/hooks/useFileSystemOperations';
import { UploadProgressComponent } from '@/components/UploadProgress';
import type { UploadProgress } from '@/services/fileSystemAPI';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UploadZoneProps {
  className?: string;
}

export function UploadZone({ className }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [realTimeProgress, setRealTimeProgress] = useState<UploadProgress | null>(null);
//  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<{
    uploading: boolean;
    success: boolean;
    error: string | null;
    fileCount: number;
    fileName: string;
  }>({
    uploading: false,
    success: false,
    error: null,
    fileCount: 0,
    fileName: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { uploadFiles, uploadFolder, loading } = useFileSystemOperations();

  const resetUploadState = useCallback(() => {
    setUploadState({
      uploading: false,
      success: false,
      error: null,
      fileCount: 0,
      fileName: '',
    });
    setRealTimeProgress(null);
  }, []);

  const handleProgressUpdate = useCallback((progress: UploadProgress) => {
    setRealTimeProgress(progress);
    
    // Update upload state based on progress
    if (progress.status === 'completed') {
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        success: true,
      }));
      setTimeout(resetUploadState, 5000);
    } else if (progress.status === 'error') {
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        error: progress.error || 'Upload failed',
      }));
    }
  }, [resetUploadState]);

  const cancelUpload = useCallback(async () => {
    if (realTimeProgress?.sessionId) {
      try {
        // Import the API to cancel the upload
        const { fileSystemAPI } = await import('@/services/fileSystemAPI');
        await fileSystemAPI.cancelUpload(realTimeProgress.sessionId);
        
        setUploadState(prev => ({
          ...prev,
          uploading: false,
          error: 'Upload cancelled',
        }));
        setRealTimeProgress(null);
        toast.info('Upload cancelled');
      } catch (error) {
        console.error('Failed to cancel upload:', error);
        toast.error('Failed to cancel upload');
      }
    }
  }, [realTimeProgress?.sessionId]);

  const handleFileUpload = useCallback(async (files: FileList, isFolder = false) => {
    console.log('handleFileUpload called with:', files, 'isFolder:', isFolder);
    console.log('Files length:', files.length);
    
    if (files.length === 0) {
      console.log('No files to upload - returning early');
      return;
    }

    // Convert FileList to Array IMMEDIATELY to preserve files
    const filesArray: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) {
        filesArray.push(file);
      }
    }
    
    console.log('Files array created immediately:', filesArray.length);

    // Log each file
    filesArray.forEach((file, index) => {
      console.log(`File ${index}:`, file.name, file.size, file.type);
    });

    const fileName = filesArray.length === 1 ? filesArray[0].name : `${filesArray.length} files`;
    
    setUploadState({
      uploading: true,
      success: false,
      error: null,
      fileCount: filesArray.length,
      fileName,
    });

    try {
      if (isFolder) {
        const folderStructure: string[] = [];
        filesArray.forEach(file => {
          const filePath = (file as any).webkitRelativePath || file.name;
          folderStructure.push(filePath);
        });
        
        // Convert back to FileList for uploadFolder (it expects FileList)
        const dataTransfer = new DataTransfer();
        filesArray.forEach(file => dataTransfer.items.add(file));
        
        await uploadFolder(dataTransfer.files, folderStructure);
        toast.success('Folder uploaded successfully', {
          description: `Uploaded ${filesArray.length} files`
        });
      } else {
        console.log('About to upload files array:', filesArray);
        await uploadFiles(filesArray, handleProgressUpdate);
        toast.success('Files uploaded successfully', {
          description: `Uploaded ${filesArray.length} file${filesArray.length > 1 ? 's' : ''}`
        });
      }

      setUploadState(prev => ({
        ...prev,
        uploading: false,
        success: true,
      }));

      setTimeout(resetUploadState, 3000);
    } catch (error) {
      if (error instanceof Error && error.message === 'Upload cancelled') {
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        error: errorMessage,
      }));
      
      toast.error('Upload failed', {
        description: errorMessage
      });
    }
  }, [uploadFiles, uploadFolder, resetUploadState, handleProgressUpdate]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];
    const folderStructure: string[] = [];
    let isFolder = false;

    // Process dropped items
    const processItems = async () => {
      for (const item of items) {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            if (entry.isDirectory) {
              isFolder = true;
              await processDirectory(entry as FileSystemDirectoryEntry, '', files, folderStructure);
            } else {
              const file = item.getAsFile();
              if (file) {
                files.push(file);
                folderStructure.push(file.name);
              }
            }
          }
        }
      }

      if (files.length > 0) {
        const fileList = new DataTransfer();
        files.forEach(file => fileList.items.add(file));
        
        if (isFolder) {
          await handleFileUpload(fileList.files, true);
        } else {
          await handleFileUpload(fileList.files, false);
        }
      }
    };

    processItems();
  }, [handleFileUpload]);

  const processDirectory = async (
    dirEntry: FileSystemDirectoryEntry,
    path: string,
    files: File[],
    folderStructure: string[]
  ): Promise<void> => {
    return new Promise((resolve) => {
      const dirReader = dirEntry.createReader();
      
      dirReader.readEntries((entries) => {
        let pendingEntries = entries.length;
        
        if (pendingEntries === 0) {
          resolve();
          return;
        }

        entries.forEach((entry) => {
          const entryPath = path + entry.name;
          
          if (entry.isFile) {
            (entry as FileSystemFileEntry).file((file) => {
              files.push(file);
              folderStructure.push(path + entry.name);
              
              pendingEntries--;
              if (pendingEntries === 0) resolve();
            });
          } else if (entry.isDirectory) {
            processDirectory(
              entry as FileSystemDirectoryEntry,
              entryPath + '/',
              files,
              folderStructure
            ).then(() => {
              pendingEntries--;
              if (pendingEntries === 0) resolve();
            });
          }
        });
      });
    });
  };

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFolderSelect = useCallback(() => {
    folderInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log('File input change - files:', files);
    console.log('File input change - files length:', files?.length);
    if (files && files.length > 0) {
      console.log('Files selected via button:');
      Array.from(files).forEach((file, index) => {
        console.log(`File ${index}:`, file.name, file.size, file.type);
      });
      handleFileUpload(files, false);
    }
    e.target.value = ''; // Reset input
  }, [handleFileUpload]);

  const handleFolderInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Check if files have webkitRelativePath property (folder upload)
      const hasWebkitRelativePath = Array.from(files).some(file => {
        const relativePath = (file as any).webkitRelativePath;
        return relativePath && relativePath !== file.name;
      });
      handleFileUpload(files, hasWebkitRelativePath);
    }
    e.target.value = '';
  }, [handleFileUpload]);

  return (
    <Card className={cn("relative", className)}>
      <CardContent className="p-6">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            uploadState.uploading && "pointer-events-none opacity-50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Show detailed progress if we have real-time data */}
          {realTimeProgress && realTimeProgress.status !== 'completed' && (
            <UploadProgressComponent 
              progress={realTimeProgress}
              fileName={uploadState.fileName}
              onCancel={uploadState.uploading ? cancelUpload : undefined}
            />
          )}
          
          {/* Fallback to simple progress display */}
          {!realTimeProgress && uploadState.uploading ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-lg font-medium">Uploading...</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelUpload}
                  className="h-8 w-8 p-0 hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{uploadState.fileName}</span>
                  <span className="font-medium">Processing...</span>
                </div>
                <Progress value={100} className="w-full animate-pulse" />
                <p className="text-xs text-muted-foreground text-center">
                  {uploadState.fileCount} file{uploadState.fileCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          ) : uploadState.success ? (
            <div className="space-y-4 text-green-600">
              <CheckCircle className="h-12 w-12 mx-auto" />
              <div>
                <p className="text-lg font-medium">Upload Successful!</p>
                <p className="text-sm">
                  {uploadState.fileCount} file{uploadState.fileCount !== 1 ? 's' : ''} uploaded
                </p>
              </div>
            </div>
          ) : uploadState.error ? (
            <div className="space-y-4 text-destructive">
              <AlertCircle className="h-12 w-12 mx-auto" />
              <div>
                <p className="text-lg font-medium">Upload Failed</p>
                <p className="text-sm">{uploadState.error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetUploadState}
                  className="mt-2"
                >
                  <X className="h-4 w-4 mr-2" />
                  Dismiss
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">
                  Drag & drop files or folders here
                </p>
                <p className="text-sm text-muted-foreground">
                  Or click the buttons below to select files
                </p>
              </div>

              <div className="flex gap-4 justify-center flex-col">
                <Button
                  variant="outline"
                  onClick={handleFileSelect}
                  disabled={loading}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Select Files
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleFolderSelect}
                  disabled={loading}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Select Folder
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
        
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleFolderInputChange}
        />
      </CardContent>
    </Card>
  );
}