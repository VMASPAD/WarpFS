import type { FileItem } from '../contexts/FileSystemContext';

export const API_BASE_URL = import.meta.env.VITE_URL_BACKEND || 'http://localhost:9876';

interface LoginCredentials {
  user: string;
  pass: string;
}

interface CreateUserData {
  user: string;
  pass: string;
}

interface ApiResponse<T = any> {
  message: string;
  data?: T;
  error?: string;
}

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

export type { UploadProgress };

class FileSystemAPI {
  private userCredentials: LoginCredentials | null = null;
  private userId: string | null = null;

  setUserCredentials(credentials: LoginCredentials, userId: string) {
    this.userCredentials = credentials;
    this.userId = userId;
  }

  clearUserCredentials() {
    this.userCredentials = null;
    this.userId = null;
  }

  private getAuthHeaders() {
    if (!this.userCredentials || !this.userId) {
      throw new Error('User not authenticated');
    }
    return {
      'user': this.userCredentials.user,
      'pass': this.userCredentials.pass,
      'id': this.userId,
      'Content-Type': 'application/json',
    };
  }

  async createUser(userData: CreateUserData): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/createUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async loginUser(credentials: LoginCredentials): Promise<ApiResponse> {
    const response = await fetch(`${API_BASE_URL}/logInUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async getFiles(path: string = '/'): Promise<FileItem[]> {
    const response = await fetch(`${API_BASE_URL}/files?path=${encodeURIComponent(path)}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.data || [];
  }

  async createFile(name: string, path: string, content?: string): Promise<FileItem> {
    const response = await fetch(`${API_BASE_URL}/files`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        name,
        path,
        type: 'file',
        content: content || '',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  }

  async createFolder(name: string, path: string): Promise<FileItem> {
    const response = await fetch(`${API_BASE_URL}/files`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        name,
        path,
        type: 'folder',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  }

  async deleteFiles(ids: string[]): Promise<void> {
    console.log('Sending delete request for IDs:', ids);
    
    const response = await fetch(`${API_BASE_URL}/files`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ ids }),
    });

    console.log('Delete response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Delete request failed:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Delete response:', result);
  }

  async moveFiles(ids: string[], destinationPath: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/files/move`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        ids,
        destinationPath,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  async renameFile(id: string, newName: string): Promise<FileItem> {
    const response = await fetch(`${API_BASE_URL}/files/${id}/rename`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name: newName }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  }

  async toggleFilePublic(id: string, isPublic: boolean): Promise<FileItem> {
    console.log('API toggleFilePublic called with:', id, isPublic);
    
    const response = await fetch(`${API_BASE_URL}/files/${id}/public`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ isPublic }),
    });

    console.log('API toggleFilePublic response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API toggleFilePublic error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('API toggleFilePublic result:', result);
    return result.data;
  }

  getPublicFileUrl(fileId: string): string {
    return `${API_BASE_URL}/public/${fileId}`;
  }

  async getFile(path: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/archive${path}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  }

  async getRawFile(path: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/raw-file`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    } else {
      return await response.blob();
    }
  }

  // Cancel upload session
  async cancelUpload(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/upload-chunked/cancel/${sessionId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cancel upload error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      console.log(`Upload session ${sessionId} cancelled successfully`);
    } catch (error) {
      console.error('Failed to cancel upload:', error);
      throw error;
    }
  }

  // Optimized chunked upload with parallel processing
  async uploadFiles(files: FileList | File[], path: string = '/', onProgress?: (progress: UploadProgress) => void): Promise<FileItem[]> {
    console.log('uploadFiles called with:', files, 'path:', path);
    
    const filesArray = Array.from(files);
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for optimal speed
   // const MAX_PARALLEL_CHUNKS = 4; // Parallel chunk uploads for 30MB connection
    
    // Determine upload strategy based on file sizes
    const largeFiles = filesArray.filter(file => file.size > CHUNK_SIZE * 2);
    const smallFiles = filesArray.filter(file => file.size <= CHUNK_SIZE * 2);
    
    let allUploadedFiles: FileItem[] = [];
    
    // Upload small files normally (faster for small files)
    if (smallFiles.length > 0) {
      console.log(`Uploading ${smallFiles.length} small files normally`);
      const smallFileResults = await this.uploadFilesTraditional(smallFiles, path, onProgress);
      allUploadedFiles.push(...smallFileResults);
    }
    
    // Upload large files with chunking
    for (const file of largeFiles) {
      console.log(`Uploading large file with chunking: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      const largeFileResult = await this.uploadFileChunked(file, path, onProgress);
      if (largeFileResult) {
        allUploadedFiles.push(largeFileResult);
      }
    }
    
    return allUploadedFiles;
  }

  // Traditional upload for small files
  private async uploadFilesTraditional(files: File[], path: string, onProgress?: (progress: UploadProgress) => void): Promise<FileItem[]> {
    const sessionId = crypto.randomUUID();
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('path', path);

    // Start progress monitoring
    let progressInterval: NodeJS.Timeout | null = null;
    if (onProgress) {
      progressInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(`${API_BASE_URL}/api/upload-progress/${sessionId}`, {
            headers: this.getAuthHeaders(),
          });
          
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            onProgress(progressData);
          }
        } catch (error) {
          console.error('Error fetching upload progress:', error);
        }
      }, 1000);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          'user': this.userCredentials!.user,
          'pass': this.userCredentials!.pass,
          'id': this.userId!,
          'upload-session-id': sessionId,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return result.data || [];
    } finally {
      if (progressInterval) clearInterval(progressInterval);
    }
  }

  // Chunked upload for large files
  private async uploadFileChunked(file: File, path: string, onProgress?: (progress: UploadProgress) => void): Promise<FileItem | null> {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const MAX_PARALLEL_CHUNKS = 4;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const sessionId = crypto.randomUUID();
    
    console.log(`Chunked upload: ${file.name}, ${totalChunks} chunks of ${CHUNK_SIZE / 1024 / 1024}MB`);

    try {
      // Initialize chunked upload session
      await fetch(`${API_BASE_URL}/upload-chunked/init`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          totalChunks,
          chunkSize: CHUNK_SIZE,
          sessionId,
          path
        }),
      });

      // Upload chunks in parallel batches
      let uploadedChunks = 0;
      const startTime = Date.now();
      
      for (let i = 0; i < totalChunks; i += MAX_PARALLEL_CHUNKS) {
        const batch = [];
        const batchEnd = Math.min(i + MAX_PARALLEL_CHUNKS, totalChunks);
        
        // Create batch of parallel chunk uploads
        for (let chunkIndex = i; chunkIndex < batchEnd; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          const uploadPromise = this.uploadChunk(chunk, chunkIndex, sessionId, file.name);
          batch.push(uploadPromise);
        }
        
        // Wait for batch to complete
        await Promise.all(batch);
        uploadedChunks += batch.length;
        
        // Update progress
        if (onProgress) {
          const currentTime = Date.now();
          const elapsedTime = (currentTime - startTime) / 1000;
          const uploadedSize = uploadedChunks * CHUNK_SIZE;
          const speed = uploadedSize / elapsedTime / (1024 * 1024); // MB/s
          const remainingBytes = file.size - uploadedSize;
          const estimatedTimeLeft = remainingBytes / (speed * 1024 * 1024);
          
          onProgress({
            sessionId,
            totalSize: file.size,
            uploadedSize: Math.min(uploadedSize, file.size),
            startTime,
            lastUpdateTime: currentTime,
            speed,
            estimatedTimeLeft,
            percentage: (uploadedChunks / totalChunks) * 100,
            status: 'uploading',
            totalSizeMB: (file.size / (1024 * 1024)).toFixed(2),
            uploadedSizeMB: (Math.min(uploadedSize, file.size) / (1024 * 1024)).toFixed(2),
            speedMBps: speed.toFixed(2),
            estimatedTimeLeftFormatted: this.formatTime(estimatedTimeLeft)
          });
        }
        
        console.log(`Batch ${Math.floor(i / MAX_PARALLEL_CHUNKS) + 1}/${Math.ceil(totalChunks / MAX_PARALLEL_CHUNKS)} completed`);
      }

      // Finalize upload
      const response = await fetch(`${API_BASE_URL}/upload-chunked/finalize`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          sessionId,
          fileName: file.name,
          totalChunks
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to finalize chunked upload: ${response.status}`);
      }

      const result = await response.json();
      
      // Final progress update
      if (onProgress) {
        onProgress({
          sessionId,
          totalSize: file.size,
          uploadedSize: file.size,
          startTime,
          lastUpdateTime: Date.now(),
          speed: 0,
          estimatedTimeLeft: 0,
          percentage: 100,
          status: 'completed',
          totalSizeMB: (file.size / (1024 * 1024)).toFixed(2),
          uploadedSizeMB: (file.size / (1024 * 1024)).toFixed(2),
          speedMBps: '0',
          estimatedTimeLeftFormatted: 'Completed'
        });
      }
      
      return result.data;
    } catch (error) {
      console.error('Chunked upload failed:', error);
      
      // Cancel the session on error
      try {
        await this.cancelUpload(sessionId);
      } catch (cancelError) {
        console.error('Failed to cancel upload session:', cancelError);
      }
      
      if (onProgress) {
        onProgress({
          sessionId,
          totalSize: file.size,
          uploadedSize: 0,
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          speed: 0,
          estimatedTimeLeft: 0,
          percentage: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Chunked upload failed',
          totalSizeMB: (file.size / (1024 * 1024)).toFixed(2),
          uploadedSizeMB: '0',
          speedMBps: '0',
          estimatedTimeLeftFormatted: 'Error'
        });
      }
      throw error;
    }
  }

  private async uploadChunk(chunk: Blob, chunkIndex: number, sessionId: string, fileName: string): Promise<void> {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('sessionId', sessionId);
    formData.append('fileName', fileName);

    const response = await fetch(`${API_BASE_URL}/upload-chunked/chunk`, {
      method: 'POST',
      headers: {
        'user': this.userCredentials!.user,
        'pass': this.userCredentials!.pass,
        'id': this.userId!,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload chunk ${chunkIndex}: ${response.status}`);
    }
  }

  private formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds === Infinity || seconds < 0) {
      return 'Calculating...';
    }
    
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  async uploadFolder(files: FileList, folderStructure: string[], path: string = '/'): Promise<FileItem[]> {
    const formData = new FormData();
    
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    
    formData.append('path', path);
    formData.append('folderStructure', JSON.stringify(folderStructure));

    const response = await fetch(`${API_BASE_URL}/upload-folder`, {
      method: 'POST',
      headers: {
        'user': this.userCredentials!.user,
        'pass': this.userCredentials!.pass,
        'id': this.userId!,
        // Don't set Content-Type for FormData, let browser set it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload folder error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.data || [];
  }
}

export const fileSystemAPI = new FileSystemAPI();