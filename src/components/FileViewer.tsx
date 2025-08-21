import { useState, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  FileText, 
  Image as ImageIcon,
  Film,
  Volume2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { fileSystemAPI } from '@/services/fileSystemAPI';
import type { FileItem } from '@/contexts/FileSystemContext';

interface FileViewerProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
}

interface RawFileResponse {
  path: string;
  contentType: string;
  size: number;
  content: string;
  encoding: string;
}

export function FileViewer({ file, isOpen, onClose }: FileViewerProps) {
  const [fileContent, setFileContent] = useState<RawFileResponse | null>(null);
  const [binaryUrl, setBinaryUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (file && isOpen) {
      loadFileContent();
    } else {
      setFileContent(null);
      setBinaryUrl(null);
      setError(null);
    }
  }, [file, isOpen]);

  const loadFileContent = async () => {
    if (!file) return;
    
    setLoading(true);
    setError(null);
    setFileContent(null);
    setBinaryUrl(null);

    try {
      // Use the fileSystemAPI's getRawFile method which handles auth internally
      const result = await fileSystemAPI.getRawFile(file.path);
      
      if (result instanceof Blob) {
        // Binary file - create blob URL
        const url = URL.createObjectURL(result);
        setBinaryUrl(url);
      } else {
        // Text-based file (JSON response)
        setFileContent(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async () => {
    if (!file) return;
    
    try {
      const blob = await fileSystemAPI.getFile(file.path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      alert(`Failed to download file: ${errorMessage}`);
    }
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getLanguageFromExtension = (extension?: string): string => {
    if (!extension) return 'plaintext';
    
    const languages: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'sql': 'sql',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sh': 'shell',
      'bat': 'bat',
      'dockerfile': 'dockerfile',
    };
    
    return languages[extension.toLowerCase()] || 'plaintext';
  };

  const isTextFile = (extension?: string): boolean => {
    if (!extension) return true;
    const textExtensions = [
      'txt', 'js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'scss',
      'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'sql',
      'xml', 'yaml', 'yml', 'md', 'sh', 'bat', 'dockerfile', 'log',
      'csv', 'ini', 'cfg', 'conf'
    ];
    return textExtensions.includes(extension.toLowerCase());
  };

  const isImageFile = (extension?: string): boolean => {
    if (!extension) return false;
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    return imageExtensions.includes(extension.toLowerCase());
  };

  const isVideoFile = (extension?: string): boolean => {
    if (!extension) return false;
    const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv'];
    return videoExtensions.includes(extension.toLowerCase());
  };

  const isAudioFile = (extension?: string): boolean => {
    if (!extension) return false;
    const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];
    return audioExtensions.includes(extension.toLowerCase());
  };

  const renderFileContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mr-3" />
          <span>Loading file content...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center py-12 text-destructive">
          <AlertCircle className="h-8 w-8 mr-3" />
          <div className="text-center">
            <p className="font-medium">Failed to load file</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      );
    }

    if (!file) return null;

    // Text files with Monaco Editor
    if (fileContent && isTextFile(file.extension)) {
      return (
        <div className="h-[60vh] border rounded-lg overflow-hidden">
          <Editor
            height="100%"
            language={getLanguageFromExtension(file.extension)}
            value={fileContent.content}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              lineNumbers: 'on',
            }}
          />
        </div>
      );
    }

    // Images
    if (isImageFile(file.extension) && binaryUrl) {
      return (
        <div className="text-center">
          <img
            src={binaryUrl}
            alt={file.name}
            className="max-w-full max-h-[60vh] object-contain mx-auto rounded-lg border"
          />
        </div>
      );
    }

    // Videos
    if (isVideoFile(file.extension) && binaryUrl) {
      return (
        <div className="text-center">
          <video
            controls
            className="max-w-full max-h-[60vh] mx-auto rounded-lg border"
          >
            <source src={binaryUrl} type={`video/${file.extension}`} />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    // Audio
    if (isAudioFile(file.extension) && binaryUrl) {
      return (
        <div className="text-center py-8">
          <Volume2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <audio
            controls
            className="w-full max-w-md mx-auto"
          >
            <source src={binaryUrl} type={`audio/${file.extension}`} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }

    // PDF and other files
    if (file.extension === 'pdf' && binaryUrl) {
      return (
        <iframe
          src={binaryUrl}
          className="w-full h-[60vh] border rounded-lg"
          title={file.name}
        />
      );
    }

    // Fallback for unsupported file types
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">Preview not available</p>
        <p className="text-muted-foreground mb-4">
          This file type cannot be previewed in the browser
        </p>
        <Button onClick={downloadFile} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download File
        </Button>
      </div>
    );
  };

  const getFileIcon = () => {
    if (isImageFile(file?.extension)) return <ImageIcon className="h-4 w-4" />;
    if (isVideoFile(file?.extension)) return <Film className="h-4 w-4" />;
    if (isAudioFile(file?.extension)) return <Volume2 className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl! max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getFileIcon()}
            {file?.name}
          </DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
              {file?.extension?.toUpperCase() || 'FILE'}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-border text-foreground">
              {file ? formatFileSize(file.size || 0) : '0 B'}
            </span>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={downloadFile}
              disabled={!file}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4">
          {renderFileContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}