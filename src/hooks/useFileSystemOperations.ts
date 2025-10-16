import { useCallback } from 'react';
import { useFileSystem } from '../contexts/FileSystemContext';
import { fileSystemAPI } from '../services/fileSystemAPI';
import { toast } from 'sonner';

export function useFileSystemOperations() {
  const { state, dispatch } = useFileSystem();

  const loadFiles = useCallback(async (path: string = '/') => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    // Show loading toast for long operations
    const loadingToast = toast.loading('Loading files...', {
      description: 'Please wait, this may take a moment if the network is slow'
    });

    try {
      const files = await fileSystemAPI.getFiles(path);
      dispatch({ type: 'SET_ITEMS', payload: files });
      dispatch({ type: 'SET_CURRENT_PATH', payload: path });
      toast.dismiss(loadingToast);
    } catch (error) {
      toast.dismiss(loadingToast);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load files';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      if (errorMessage.includes('timeout')) {
        toast.error('Operation timed out', {
          description: 'The operation may have completed. Try refreshing to see the latest files.',
          duration: 5000
        });
      } else {
        toast.error('Failed to load files', {
          description: errorMessage
        });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  const createFile = useCallback(async (name: string, content?: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const loadingToast = toast.loading('Creating file...', {
      description: 'Please wait...'
    });

    try {
      const newFile = await fileSystemAPI.createFile(name, state.currentPath, content);
      dispatch({ type: 'ADD_ITEM', payload: newFile });
      toast.dismiss(loadingToast);
      toast.success('File created successfully', {
        description: `Created "${name}" in ${state.currentPath}`
      });
    } catch (error) {
      toast.dismiss(loadingToast);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create file';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      if (errorMessage.includes('timeout')) {
        toast.error('Operation timed out', {
          description: 'The file may have been created. Refresh to verify.',
          duration: 5000
        });
        // Reload files to check if operation completed
        await loadFiles(state.currentPath);
      } else {
        toast.error('Failed to create file', {
          description: errorMessage
        });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch, state.currentPath]);

  const createFolder = useCallback(async (name: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const loadingToast = toast.loading('Creating folder...', {
      description: 'Please wait...'
    });

    try {
      const newFolder = await fileSystemAPI.createFolder(name, state.currentPath);
      dispatch({ type: 'ADD_ITEM', payload: newFolder });
      toast.dismiss(loadingToast);
      toast.success('Folder created successfully', {
        description: `Created "${name}" in ${state.currentPath}`
      });
    } catch (error) {
      toast.dismiss(loadingToast);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create folder';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      if (errorMessage.includes('timeout')) {
        toast.error('Operation timed out', {
          description: 'The folder may have been created. Refresh to verify.',
          duration: 5000
        });
        // Reload files to check if operation completed
        await loadFiles(state.currentPath);
      } else {
        toast.error('Failed to create folder', {
          description: errorMessage
        });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch, state.currentPath]);

  const deleteSelectedFiles = useCallback(async () => {
    if (state.selectedItems.length === 0) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const itemCount = state.selectedItems.length;
    const loadingToast = toast.loading(`Deleting ${itemCount} item${itemCount > 1 ? 's' : ''}...`, {
      description: 'Please wait, this may take a moment...'
    });

    try {
      console.log('Deleting files with IDs:', state.selectedItems);
      await fileSystemAPI.deleteFiles(state.selectedItems);
      
      // Update local state first
      state.selectedItems.forEach(id => {
        dispatch({ type: 'DELETE_ITEM', payload: id });
      });
      dispatch({ type: 'CLEAR_SELECTION' });
      
      // Reload files to ensure consistency with backend
      await loadFiles(state.currentPath);
      console.log('Files deleted and list refreshed');
      
      toast.dismiss(loadingToast);
      toast.success('Files deleted successfully', {
        description: `Deleted ${itemCount} item${itemCount > 1 ? 's' : ''}`
      });
      
    } catch (error) {
      console.error('Error deleting files:', error);
      toast.dismiss(loadingToast);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete files';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      if (errorMessage.includes('timeout')) {
        toast.error('Operation timed out', {
          description: 'The files may have been deleted. Refreshing to verify...',
          duration: 5000
        });
      } else {
        toast.error('Failed to delete files', {
          description: errorMessage
        });
      }
      // Reload files even on error to ensure UI consistency
      await loadFiles(state.currentPath);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch, state.selectedItems, state.currentPath, loadFiles]);

  const moveFiles = useCallback(async (destinationPath: string) => {
    if (state.selectedItems.length === 0) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const itemCount = state.selectedItems.length;
    const loadingToast = toast.loading(`Moving ${itemCount} item${itemCount > 1 ? 's' : ''}...`, {
      description: 'Please wait, this may take a moment...'
    });

    try {
      // Gather metadata for selected files
      const fileMetadata: Record<string, { name: string; type: string; path: string }> = {};
      state.selectedItems.forEach(id => {
        const item = state.items.find(item => item.id === id);
        if (item) {
          fileMetadata[id] = {
            name: item.name,
            type: item.type,
            path: item.path
          };
        }
      });

      console.log('Moving files with metadata:', { selectedItems: state.selectedItems, fileMetadata, destinationPath });
      
      await fileSystemAPI.moveFiles(state.selectedItems, destinationPath, fileMetadata);
      console.log("move")
      // Reload files to reflect the changes
      await loadFiles(state.currentPath);
      dispatch({ type: 'CLEAR_SELECTION' });
      
      toast.dismiss(loadingToast);
      toast.success('Files moved successfully', {
        description: `Moved ${itemCount} item${itemCount > 1 ? 's' : ''} to ${destinationPath}`
      });
    } catch (error) {
      console.error('Error moving files:', error);
      toast.dismiss(loadingToast);
      const errorMessage = error instanceof Error ? error.message : 'Failed to move files';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      if (errorMessage.includes('timeout')) {
        toast.error('Operation timed out', {
          description: 'The files may have been moved. Refreshing to verify...',
          duration: 5000
        });
        await loadFiles(state.currentPath);
      } else {
        toast.error('Failed to move files', {
          description: errorMessage
        });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch, state.selectedItems, state.currentPath, state.items, loadFiles]);

  const renameFile = useCallback(async (id: string, newName: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const loadingToast = toast.loading('Renaming file...', {
      description: 'Please wait...'
    });

    try {
      const updatedFile = await fileSystemAPI.renameFile(id, newName);
      dispatch({ type: 'UPDATE_ITEM', payload: updatedFile });
      toast.dismiss(loadingToast);
      toast.success('File renamed successfully', {
        description: `Renamed to "${newName}"`
      });
    } catch (error) {
      toast.dismiss(loadingToast);
      const errorMessage = error instanceof Error ? error.message : 'Failed to rename file';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      if (errorMessage.includes('timeout')) {
        toast.error('Operation timed out', {
          description: 'The file may have been renamed. Refresh to verify.',
          duration: 5000
        });
        await loadFiles(state.currentPath);
      } else {
        toast.error('Failed to rename file', {
          description: errorMessage
        });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch, state.currentPath, loadFiles]);

  const toggleFilePublic = useCallback(async (id: string, isPublic: boolean) => {
    console.log('Hook toggleFilePublic called with:', id, isPublic);
    
    const loadingToast = toast.loading(`Making file ${isPublic ? 'public' : 'private'}...`, {
      description: 'Please wait...'
    });
    
    try {
      const updatedFile = await fileSystemAPI.toggleFilePublic(id, isPublic);
      console.log('Hook toggleFilePublic result:', updatedFile);
      dispatch({ type: 'UPDATE_ITEM', payload: updatedFile });
      toast.dismiss(loadingToast);
      toast.success(`File ${isPublic ? 'made public' : 'made private'}`, {
        description: isPublic ? 'File can now be accessed without credentials' : 'File is now private'
      });
      return updatedFile;
    } catch (error) {
      console.error('Hook toggleFilePublic error:', error);
      toast.dismiss(loadingToast);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update file';
      
      if (errorMessage.includes('timeout')) {
        toast.error('Operation timed out', {
          description: 'The file status may have been updated. Refresh to verify.',
          duration: 5000
        });
        await loadFiles(state.currentPath);
      } else {
        toast.error('Failed to update file', {
          description: errorMessage
        });
      }
      throw error;
    }
  }, [dispatch, state.currentPath, loadFiles]);

  const navigateToFolder = useCallback(async (folderPath: string) => {
    await loadFiles(folderPath);
  }, [loadFiles]);

  const navigateUp = useCallback(async () => {
    const currentParts = state.currentPath.split('/').filter(part => part !== '');
    if (currentParts.length > 0) {
      currentParts.pop();
      const parentPath = currentParts.length > 0 ? `/${currentParts.join('/')}` : '/';
      await loadFiles(parentPath);
    }
  }, [state.currentPath, loadFiles]);

  const toggleItemSelection = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_ITEM_SELECTION', payload: id });
  }, [dispatch]);

  const selectAllItems = useCallback(() => {
    const allIds = state.items.map(item => item.id);
    dispatch({ type: 'SET_SELECTED_ITEMS', payload: allIds });
  }, [dispatch, state.items]);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, [dispatch]);

  const loginUser = useCallback(async (user: string, pass: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const loadingToast = toast.loading('Logging in...', {
      description: 'Please wait, verifying credentials...'
    });

    try {
      const response = await fileSystemAPI.loginUser({ user, pass });
      // Get the user ID from the database (would be returned in a real API)
      const userId = (response as any).userId || user; // Fallback to username for now
      fileSystemAPI.setUserCredentials({ user, pass }, userId);
      dispatch({ type: 'SET_USER', payload: { id: userId, user } });
      await loadFiles('/');
      toast.dismiss(loadingToast);
      toast.success('Logged in successfully', {
        description: `Welcome back, ${user}!`
      });
    } catch (error) {
      toast.dismiss(loadingToast);
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      if (errorMessage.includes('timeout')) {
        toast.error('Login timed out', {
          description: 'Please check your network connection and try again.',
          duration: 5000
        });
      } else {
        toast.error('Login failed', {
          description: errorMessage
        });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch, loadFiles]);

  const createUser = useCallback(async (user: string, pass: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const loadingToast = toast.loading('Creating account...', {
      description: 'Please wait, setting up your workspace...'
    });

    try {
      await fileSystemAPI.createUser({ user, pass });
      toast.dismiss(loadingToast);
      // Auto-login after creation
      await loginUser(user, pass);
      toast.success('Account created successfully', {
        description: `Welcome to WarpFS, ${user}!`
      });
    } catch (error) {
      toast.dismiss(loadingToast);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      
      if (errorMessage.includes('timeout')) {
        toast.error('Account creation timed out', {
          description: 'Your account may have been created. Try logging in.',
          duration: 5000
        });
      } else {
        toast.error('Failed to create account', {
          description: errorMessage
        });
      }
    }
  }, [dispatch, loginUser]);

  const logout = useCallback(() => {
    fileSystemAPI.clearUserCredentials();
    dispatch({ type: 'SET_USER', payload: null });
    dispatch({ type: 'SET_ITEMS', payload: [] });
    dispatch({ type: 'SET_CURRENT_PATH', payload: '/' });
    dispatch({ type: 'CLEAR_SELECTION' });
  }, [dispatch]);

  const uploadFiles = useCallback(async (files: FileList | File[], onProgress?: (progress: any) => void, onCancel?: () => Promise<void>) => {
    console.log('Hook uploadFiles called with:', files);
    console.log('Hook files length:', files.length);
    console.log('Current path:', state.currentPath);
    
    // Store session ID for potential cancellation
    let currentSessionId: string | null = null;
    
    // Wrapped progress handler to capture session ID
    const wrappedProgress = (progress: any) => {
      if (progress.sessionId && !currentSessionId) {
        currentSessionId = progress.sessionId;
      }
      if (onProgress) {
        onProgress(progress);
      }
    };
    
    // Set up cancellation handler
    if (onCancel) {
      onCancel = async () => {
        if (currentSessionId) {
          try {
            await fileSystemAPI.cancelUpload(currentSessionId);
          } catch (error) {
            console.error('Failed to cancel upload:', error);
          }
        }
      };
    }
    
    try {
      const uploadedFiles = await fileSystemAPI.uploadFiles(files, state.currentPath, wrappedProgress);
      uploadedFiles.forEach(file => {
        dispatch({ type: 'ADD_ITEM', payload: file });
      });
      return uploadedFiles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload files';
      throw new Error(errorMessage);
    }
  }, [state.currentPath, dispatch]);

  const uploadFolder = useCallback(async (files: FileList, folderStructure: string[]) => {
    try {
      const uploadedFiles = await fileSystemAPI.uploadFolder(files, folderStructure, state.currentPath);
      uploadedFiles.forEach(file => {
        dispatch({ type: 'ADD_ITEM', payload: file });
      });
      await loadFiles(state.currentPath);
      return uploadedFiles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload folder';
      throw new Error(errorMessage);
    }
  }, [state.currentPath, loadFiles]);

  return {
    // State
    ...state,
    
    // Operations
    loadFiles,
    createFile,
    createFolder,
    deleteSelectedFiles,
    moveFiles,
    renameFile,
    navigateToFolder,
    navigateUp,
    
    // Upload operations
    uploadFiles,
    uploadFolder,
    
    // Selection
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    
    // Authentication
    loginUser,
    createUser,
    logout,
    
    // Public/Private
    toggleFilePublic,
  };
}