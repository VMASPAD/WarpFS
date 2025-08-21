import { useState } from 'react';
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
import { useFileSystemOperations } from '@/hooks/useFileSystemOperations';
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
  const { renameFile, deleteSelectedFiles, moveFiles, loading } = useFileSystemOperations();

  const handleRename = async () => {
    if (file && newName.trim()) {
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

  const renderRenameDialog = () => (
    <Dialog open={operation === 'rename'} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename File</DialogTitle>
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
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleRename} disabled={!newName.trim() || loading}>
            {loading ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const renderDeleteDialog = () => (
    <AlertDialog open={operation === 'delete'} onOpenChange={onClose}>
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
    <Dialog open={operation === 'move'} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Files</DialogTitle>
          <DialogDescription>
            Enter the destination path for {selectedFiles.length > 1 
              ? `${selectedFiles.length} selected items`
              : `"${file?.name}"`
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="destinationPath">Destination Path</Label>
            <Input
              id="destinationPath"
              value={destinationPath}
              onChange={(e) => setDestinationPath(e.target.value)}
              placeholder="/destination/folder"
              onKeyDown={(e) => e.key === 'Enter' && handleMove()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
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