import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Folder, Home } from "lucide-react";
import { useFileSystemOperations } from '@/hooks/useFileSystemOperations';
import { fileSystemAPI } from '@/services/fileSystemAPI';
import type { FileItem } from '@/contexts/FileSystemContext';

interface FileOperationsProps {
  operation: 'rename' | 'delete' | 'move' | null;
  file: FileItem | null;
  selectedFiles: string[];
  onClose: () => void;
}

export function FileOperations({ operation, file, selectedFiles, onClose }: FileOperationsProps) {
  const [newName, setNewName] = useState('');
  const [destinationPath, setDestinationPath] = useState('');
  const [availableFolders, setAvailableFolders] = useState<FileItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const { renameFile, deleteSelectedFiles, moveFiles, loading, currentPath } = useFileSystemOperations();

  // Load available folders when move dialog opens
  useEffect(() => {
    if (operation === 'move') {
      loadAvailableFolders();
    }
  }, [operation]);

  // Set default name for rename
  useEffect(() => {
    if (operation === 'rename' && file) {
      setNewName(file.name);
    }
  }, [operation, file]);

  const loadAvailableFolders = async () => {
    setLoadingFolders(true);
    try {
      // Get all folders from root and current directory
      const rootFolders = await fileSystemAPI.getFiles('/');
      const currentFolders = currentPath !== '/' ? await fileSystemAPI.getFiles(currentPath) : [];
      
      // Filter only folders and combine
      const allFolders = [
        ...rootFolders.filter(item => item.type === 'folder'),
        ...currentFolders.filter(item => item.type === 'folder' && !rootFolders.find(rf => rf.id === item.id))
      ];

      setAvailableFolders(allFolders);
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleRename = async () => {
    if (file && newName.trim() && newName.trim() !== file.name) {
      await renameFile(file.id, newName.trim());
      onClose();
    }
  };

  const handleDelete = async () => {
    await deleteSelectedFiles();
    onClose();
  };

  const handleMove = async () => {
    if (destinationPath.trim()) {
      await moveFiles(destinationPath.trim());
      onClose();
    }
  };

  const handleDialogClose = () => {
    setNewName('');
    setDestinationPath('');
    setAvailableFolders([]);
    onClose();
  };

  const renderRenameDialog = () => (
    <Dialog open={operation === 'rename'} onOpenChange={handleDialogClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {file?.type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
          <DialogDescription>
            Enter a new name for "{file?.name}"
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="newName">New Name</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={file?.name}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleDialogClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleRename} 
            disabled={!newName.trim() || newName.trim() === file?.name || loading}
          >
            {loading ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const renderDeleteDialog = () => (
    <AlertDialog open={operation === 'delete'} onOpenChange={handleDialogClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            {selectedFiles.length > 1
              ? `This will permanently delete ${selectedFiles.length} selected items.`
              : `This will permanently delete "${file?.name}".`
            } This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const renderMoveDialog = () => (
    <Dialog open={operation === 'move'} onOpenChange={handleDialogClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {selectedFiles.length > 1 ? 'Files' : file?.type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
          <DialogDescription>
            Select the destination folder for {selectedFiles.length > 1 
              ? `${selectedFiles.length} selected items`
              : `"${file?.name}"`
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="destinationSelect">Destination Folder</Label>
            {loadingFolders ? (
              <div className="p-2 text-sm text-muted-foreground">Loading folders...</div>
            ) : (
              <Select value={destinationPath} onValueChange={setDestinationPath}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a destination folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="/">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Root Folder (/)
                    </div>
                  </SelectItem>
                  {availableFolders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.path}>
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-blue-500" />
                        {folder.path === '/' ? folder.name : `${folder.path.replace(/\/$/, '')}/${folder.name}`.replace(/\/+/g, '/')}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div>
            <Label htmlFor="customPath">Or enter custom path</Label>
            <Input
              id="customPath"
              value={destinationPath}
              onChange={(e) => setDestinationPath(e.target.value)}
              placeholder="/custom/destination/path"
              onKeyDown={(e) => e.key === 'Enter' && handleMove()}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter a custom path (will be created if it doesn't exist)
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleDialogClose}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={!destinationPath.trim() || loading}>
            {loading ? 'Moving...' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  switch (operation) {
    case 'rename':
      return renderRenameDialog();
    case 'delete':
      return renderDeleteDialog();
    case 'move':
      return renderMoveDialog();
    default:
      return null;
  }
}