import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Upload, Clock, Zap, HardDrive, X } from 'lucide-react';

interface UploadProgress {
  sessionId: string;
  totalSize: number;
  uploadedSize: number;
  startTime: number;
  lastUpdateTime: number;
  speed: number;
  estimatedTimeLeft: number;
  percentage: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  totalSizeMB: string;
  uploadedSizeMB: string;
  speedMBps: string;
  estimatedTimeLeftFormatted: string;
}

interface UploadProgressProps {
  progress: UploadProgress | null;
  fileName?: string;
  onCancel?: () => void;
}

export function UploadProgressComponent({ progress, fileName, onCancel }: UploadProgressProps) {
  if (!progress) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading':
        return 'bg-blue-500 text-white';
      case 'processing':
        return 'bg-yellow-500 text-white';
      case 'completed':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Upload className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">Upload Progress</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge 
              variant="outline" 
              className={getStatusColor(progress.status)}
            >
              {getStatusText(progress.status)}
            </Badge>
            {progress.status === 'uploading' && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-6 w-6 p-0 hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
        {fileName && (
          <p className="text-sm text-muted-foreground truncate" title={fileName}>
            {fileName}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span className="font-medium">{progress.percentage.toFixed(1)}%</span>
          </div>
          <Progress 
            value={progress.percentage} 
            className={`h-3 ${progress.status === 'error' ? 'bg-red-100' : ''}`}
          />
        </div>

        {/* Statistics - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Speed */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg min-w-0">
            <Zap className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Speed</p>
              <p className="text-sm font-medium truncate">
                {progress.speedMBps} MB/s
              </p>
            </div>
          </div>

          {/* Time Remaining */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg min-w-0">
            <Clock className="h-4 w-4 text-orange-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Time Left</p>
              <p className="text-sm font-medium truncate">
                {progress.estimatedTimeLeftFormatted}
              </p>
            </div>
          </div>

          {/* Data Transferred - Full width on all screens */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg sm:col-span-2 min-w-0">
            <HardDrive className="h-4 w-4 text-green-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Data Transferred</p>
              <p className="text-sm font-medium truncate">
                {progress.uploadedSizeMB} MB / {progress.totalSizeMB} MB
              </p>
              {/* Progress bar for data transferred */}
              <div className="mt-1">
                <Progress 
                  value={progress.percentage} 
                  className="h-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {progress.status === 'error' && progress.error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400 break-words">
              {progress.error}
            </p>
          </div>
        )}

        {/* Session ID for debugging - Hidden on small screens */}
        <div className="text-xs text-muted-foreground font-mono truncate hidden sm:block">
          Session: {progress.sessionId.substring(0, 12)}...
        </div>

        {/* Full-width cancel button for mobile */}
        {progress.status === 'uploading' && onCancel && (
          <div className="sm:hidden">
            <Button
              onClick={onCancel}
              variant="destructive"
              size="sm"
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel Upload
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}