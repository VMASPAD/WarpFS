import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  File,
  Folder,
  ArrowUp,
  MoreVertical,
  Trash2,
  Edit2,
  Move,
  LogOut,
  User,
  RefreshCw,
  Search,
  Eye,
  Info,
  Globe,
  Lock,
  Copy
} from "lucide-react"
import { useFileSystemOperations } from '@/hooks/useFileSystemOperations';
import { FileViewer } from '@/components/FileViewer';
import { UploadZone } from '@/components/UploadZone';
import { FileOperations } from '@/components/FileOperations';
import { useFileSystem } from '@/contexts/FileSystemContext';
import type { FileItem } from '@/contexts/FileSystemContext';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/fileSystemAPI';

interface FileSystemProps { }

function FileSystem({ }: FileSystemProps) {
  const {
    currentPath,
    items,
    selectedItems,
    loading,
    error,
    user,
    loadFiles,
    createFile,
    createFolder,
    deleteSelectedFiles,
    navigateToFolder,
    navigateUp,
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    logout,
    toggleFilePublic,
  } = useFileSystemOperations();
  
  // Get the dispatch function for optimistic updates
  const { dispatch } = useFileSystem();

  const [createFileDialog, setCreateFileDialog] = useState(false);
  const [createFolderDialog, setCreateFolderDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // File operations state
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileOperation, setFileOperation] = useState<'rename' | 'delete' | 'move' | null>(null);
  const [viewerFile, setViewerFile] = useState<FileItem | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  const tableRef = useRef<HTMLTableElement>(null);
  const actionButtonsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadFiles('/');
    } 
  }, [user, loadFiles]);

  // Add effect to reload files when current path changes to ensure public status is fresh
  useEffect(() => {
    if (user && currentPath) {
      loadFiles(currentPath);
    }
  }, [currentPath, user, loadFiles]);

  // GSAP Animations
  useEffect(() => {
    if (items.length > 0 && tableRef.current) {
      const rows = tableRef.current.querySelectorAll('tbody tr');
      gsap.fromTo(rows,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: "power2.out" }
      );
    }
  }, [items]);

  useEffect(() => {
    if (actionButtonsRef.current) {
      const buttons = actionButtonsRef.current.querySelectorAll('button');
      gsap.fromTo(buttons,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.4, stagger: 0.1, ease: "back.out(1.7)" }
      );
    }
  }, []);

  const handleCreateFile = async () => {
    if (newFileName.trim()) {
      await createFile(newFileName.trim());
      setNewFileName('');
      setCreateFileDialog(false);
    }
  };

  const handleCreateFolder = async () => {
    if (newFolderName.trim()) {
      await createFolder(newFolderName.trim());
      setNewFolderName('');
      setCreateFolderDialog(false);
    }
  };

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.type === 'folder') {
      navigateToFolder(item.path);
    } else {
      // Open file viewer for files
      setViewerFile(item);
      setShowViewer(true);
    }
  };

  const handleFileOperation = (operation: 'rename' | 'delete' | 'move', item?: FileItem) => {
    setSelectedFile(item || null);
    setFileOperation(operation);
  };

  const getBreadcrumbItems = () => {
    const parts = currentPath.split('/').filter(part => part !== '');
    const breadcrumbs = [{ name: 'Home', path: '/' }];

    let currentBreadcrumbPath = '';
    parts.forEach(part => {
      currentBreadcrumbPath += `/${part}`;
      breadcrumbs.push({ name: part, path: currentBreadcrumbPath });
    });

    return breadcrumbs;
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatFileSize = (size?: number) => {
    if (!size) return '-';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <Card className="m-3 border-chart-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              WarpFS - {user?.user}
            </CardTitle>
            <CardDescription>
              <Breadcrumb>
                <BreadcrumbList>
                  {getBreadcrumbItems().map((crumb, index, array) => (
                    <div key={crumb.path} className="flex items-center">
                      <BreadcrumbItem>
                        {index === array.length - 1 ? (
                          <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              navigateToFolder(crumb.path);
                            }}
                          >
                            {crumb.name}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {index < array.length - 1 && <BreadcrumbSeparator />}
                    </div>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </CardDescription>
          </div>
          <CardAction className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => loadFiles(currentPath)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </CardAction>
        </div>
      </CardHeader>
      <CardContent>
        <ResizablePanelGroup
          direction="horizontal"
          className="h-screen rounded-lg border md:min-w-full"
        >
          <ResizablePanel defaultSize={30} className="min-w-3xs">
            <div className="flex flex-col gap-4 items-center justify-start p-6">
              <div ref={actionButtonsRef} className="w-full space-y-3">
                <Dialog open={createFileDialog} onOpenChange={setCreateFileDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      Create File <File className="ml-2 h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New File</DialogTitle>
                      <DialogDescription>
                        Enter a name for your new file
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="fileName">File Name</Label>
                        <Input
                          id="fileName"
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          placeholder="Enter file name (e.g., document.txt)"
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateFileDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateFile} disabled={!newFileName.trim()}>
                        Create File
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={createFolderDialog} onOpenChange={setCreateFolderDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      Create Folder <Folder className="ml-2 h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Folder</DialogTitle>
                      <DialogDescription>
                        Enter a name for your new folder
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="folderName">Folder Name</Label>
                        <Input
                          id="folderName"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Enter folder name"
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateFolderDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                        Create Folder
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={navigateUp}
                  disabled={currentPath === '/'}
                >
                  <ArrowUp className="mr-2 h-4 w-4" /> Go Up
                </Button>

                {selectedItems.length > 0 && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={deleteSelectedFiles}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Selected ({selectedItems.length})
                  </Button>
                )}
              </div>

              <div className="w-full">
                <Label htmlFor="search">Search Files</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search files and folders..."
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Upload Zone */}
              <div className="w-full">
                <UploadZone className="border-dashed border-2 border-muted-foreground/25" />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={70} className="min-w-xl">
            <div className="flex h-full flex-col p-6">
              {error && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="flex-1 overflow-auto">
                <Table ref={tableRef}>
                  <TableCaption>
                    {filteredItems.length === 0
                      ? 'No files found'
                      : `${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''} in current directory (reload to see changes)`
                    }
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedItems.length === items.length && items.length > 0}
                          onCheckedChange={() => {
                            if (selectedItems.length === items.length) {
                              clearSelection();
                            } else {
                              selectAllItems();
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Modified</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Loading files...
                        </TableCell>
                      </TableRow>
                    ) : filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {searchTerm ? 'No files match your search' : 'This folder is empty'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className={`cursor-pointer hover:bg-muted/50 ${selectedItems.includes(item.id) ? 'bg-muted' : ''}`}
                          onDoubleClick={() => handleItemDoubleClick(item)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedItems.includes(item.id)}
                              onCheckedChange={() => toggleItemSelection(item.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {item.type === 'folder' ? (
                                <Folder className="h-4 w-4 text-blue-500" />
                              ) : (
                                <File className="h-4 w-4 text-gray-500" />
                              )}
                              {item.name}
                              {item.type === 'file' && item.isPublic && (
                                <Globe className="h-3 w-3 text-green-600" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">
                            {item.type === 'folder' ? 'Folder' : item.extension || 'File'}
                          </TableCell>
                          <TableCell>{formatFileSize(item.size)}</TableCell>
                          <TableCell>{formatDate(item.modified)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setViewerFile(item);
                                  setShowViewer(true);
                                }}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleFileOperation('rename', item)}>
                                  <Edit2 className="mr-2 h-4 w-4" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleFileOperation('move', item)}>
                                  <Move className="mr-2 h-4 w-4" />
                                  Move
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {item.type === 'file' && (
                                  <>
                                    <DropdownMenuItem 
                                      onClick={async () => {
                                        try {
                                          console.log('Toggling file public status:', item.id, 'from', item.isPublic, 'to', !item.isPublic);
                                          console.log('File path:', item.path, 'File type:', item.type);
                                          const newPublicStatus = !item.isPublic;
                                          
                                          // Apply the update optimistically
                                          dispatch({ 
                                            type: 'UPDATE_ITEM', 
                                            payload: { ...item, isPublic: newPublicStatus } 
                                          });
                                          
                                          const updatedFile = await toggleFilePublic(item.id, newPublicStatus);
                                          console.log('Toggle result:', updatedFile);
                                          
                                          // Reload files to ensure data consistency
                                          await loadFiles(currentPath);
                                          console.log('Files reloaded successfully');
                                        } catch (error) {
                                          console.error('Error toggling file public status:', error);
                                          // Reload on error to revert any optimistic updates
                                          await loadFiles(currentPath);
                                          toast.error('Failed to update file public status', {
                                            description: error instanceof Error ? error.message : 'Unknown error'
                                          });
                                        }
                                      }}
                                    >
                                      {item.isPublic ? (
                                        <>
                                          <Lock className="mr-2 h-4 w-4" />
                                          Make Private
                                        </>
                                      ) : (
                                        <>
                                          <Globe className="mr-2 h-4 w-4" />
                                          Make Public
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    {item.isPublic && (
                                      <DropdownMenuItem 
                                        onClick={() => {
                                          const publicUrl = `${import.meta.env.VITE_URL_BACKEND}/public/${item.id}`;
                                          navigator.clipboard.writeText(publicUrl);
                                          // Add visual feedback for copy action
                                          const button = document.activeElement as HTMLElement;
                                          const originalText = button.textContent;
                                          button.textContent = 'Copied!';
                                          setTimeout(() => {
                                            if (button && button.textContent === 'Copied!') {
                                              button.textContent = originalText;
                                            }
                                          }, 2000);
                                        }}
                                      >
                                        <Copy className="mr-2 h-4 w-4" />
                                        Copy Public Link
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                                <Dialog>
                                  <DialogTrigger className="w-32 focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
                                    <Info className="mr-2 h-4 w-4 inline-block" />
                                    Info
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>{item.name} <Badge variant={"outline"}>{item.type}</Badge></DialogTitle>
                                      <DialogDescription>
                                        <Card>
                                          <CardHeader>
                                            <CardTitle>Raw Archive</CardTitle>
                                            <CardDescription>How to access the raw archive</CardDescription>
                                            <CardAction><Badge variant={"outline"} className='text-xl text-green-600 font-bold font-mono'>GET</Badge></CardAction>
                                          </CardHeader>
                                          <CardContent>
                                            <div className="space-y-2">
                                              <Label className="text-sm font-semibold">Endpoint</Label>
                                              <div className="bg-muted p-3 rounded-md border">
                                                <code className="text-sm font-mono">{API_BASE_URL}/archive</code>
                                              </div>
                                            </div>

                                            <div className="space-y-2">
                                              <Label className="text-sm font-semibold">Headers</Label>
                                              <div className="bg-muted p-3 rounded-md border space-y-2">
                                                <div className="flex items-center gap-2">
                                                  <Badge variant="secondary">Content-Type</Badge>
                                                  <code className="text-sm">application/json</code>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Badge variant="secondary">user</Badge>
                                                  <code className="text-sm">{user?.user}</code>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Badge variant="secondary">pass</Badge>
                                                  <code className="text-sm text-muted-foreground">YOUR_PASSWORD</code>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Badge variant="secondary">id</Badge>
                                                  <code className="text-sm">{user?.id}</code>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Badge variant="secondary">file-id</Badge>
                                                  <code className="text-sm">{item.id}</code>
                                                </div>
                                                {item.isPublic && (
                                                  <div className="flex items-center gap-2">
                                                    <Badge variant="secondary">Public URL</Badge>
                                                    <code className="text-sm text-green-600">{`${import.meta.env.VITE_URL_BACKEND}/public/${item.id}`}</code>
                                                  </div>
                                                )}
                                              </div>
                                            </div>

                                            <div className="space-y-2">
                                              <Label className="text-sm font-semibold">Body</Label>
                                              <div className="bg-muted p-3 rounded-md border">
                                                <pre className="text-sm font-mono">
                                          {`{"path": "${item.path}"}`}
                                                </pre>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </DialogDescription>
                                    </DialogHeader>
                                  </DialogContent>
                                </Dialog>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    if (!selectedItems.includes(item.id)) {
                                      toggleItemSelection(item.id);
                                    }
                                    handleFileOperation('delete', item);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </CardContent>

      {/* File Viewer Dialog */}
      <FileViewer
        file={viewerFile}
        isOpen={showViewer}
        onClose={() => {
          setShowViewer(false);
          setViewerFile(null);
        }}
      />

      {/* File Operations Dialogs */}
      <FileOperations
        operation={fileOperation}
        file={selectedFile}
        selectedFiles={selectedItems}
        onClose={() => {
          setFileOperation(null);
          setSelectedFile(null);
        }}
      />
    </Card>
  )
}

export default FileSystem
