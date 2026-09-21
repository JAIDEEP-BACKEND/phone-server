'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  File,
  Upload,
  FolderPlus,
  Search,
  ArrowUp,
  Download,
  Trash2,
  Edit2,
  Move,
  Copy,
  CheckSquare,
  Square,
  RefreshCw,
  HardDrive,
  X,
  ChevronRight,
  LayoutGrid,
  List,
  Sparkles,
  ArrowRight,
  UploadCloud,
} from 'lucide-react';
import { FileItem, StorageStats } from '@android-server/shared';
import { fetchApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function cleanDisplayPath(p: string): string {
  if (!p || p === '/') return '/';
  return p.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function getFileIcon(item: FileItem) {
  if (item.isDirectory) {
    return <Folder className="h-5 w-5 text-accent-blue shrink-0" />;
  }
  const ext = item.extension.toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp'].includes(ext)) {
    return <FileImage className="h-5 w-5 text-emerald-400 shrink-0" />;
  }
  if (['.mp4', '.mkv', '.mov', '.avi', '.webm'].includes(ext)) {
    return <FileVideo className="h-5 w-5 text-purple-400 shrink-0" />;
  }
  if (['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) {
    return <FileAudio className="h-5 w-5 text-pink-400 shrink-0" />;
  }
  if (['.js', '.ts', '.tsx', '.jsx', '.json', '.html', '.css', '.py', '.sh', '.c', '.cpp', '.rs', '.go'].includes(ext)) {
    return <FileCode className="h-5 w-5 text-cyan-400 shrink-0" />;
  }
  if (['.txt', '.md', '.pdf', '.doc', '.docx', '.csv', '.xlsx'].includes(ext)) {
    return <FileText className="h-5 w-5 text-amber-400 shrink-0" />;
  }
  return <File className="h-5 w-5 text-fg-subtle shrink-0" />;
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState<string>('/');
  const currentPathRef = useRef<string>('/');
  currentPathRef.current = currentPath;

  const [parentPath, setParentPath] = useState<string | null>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isDragging, setIsDragging] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Selection
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Modals state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [renameItem, setRenameItem] = useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [moveItemTarget, setMoveItemTarget] = useState<FileItem | null>(null);
  const [destinationFolder, setDestinationFolder] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDirectory = async (path: string = '/', showSpinner: boolean = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const normalizedPath = cleanDisplayPath(path);
      const [listRes, storageRes] = await Promise.all([
        fetchApi(`/api/files/list?path=${encodeURIComponent(normalizedPath)}`),
        fetchApi('/api/files/storage-stats').catch(() => null),
      ]);
      setItems(listRes.items || []);
      setCurrentPath(cleanDisplayPath(listRes.currentPath || '/'));
      setParentPath(listRes.parentPath ? cleanDisplayPath(listRes.parentPath) : null);
      if (storageRes) setStorage(storageRes);
    } catch (err: any) {
      if (showSpinner) {
        setError(err.message || 'Failed to list directory.');
      }
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // Initial load & WebSocket real-time live sync
  useEffect(() => {
    loadDirectory('/', true);

    const socket = getSocket();

    // Listen for real-time filesystem changes (phone or server-initiated)
    const handleFilesChanged = () => {
      loadDirectory(currentPathRef.current, false);
    };

    socket.on('files:changed', handleFilesChanged);

    // Heartbeat auto-poll every 4s to catch any external phone changes silently
    const heartbeatInterval = setInterval(() => {
      loadDirectory(currentPathRef.current, false);
    }, 4000);

    return () => {
      socket.off('files:changed', handleFilesChanged);
      clearInterval(heartbeatInterval);
    };
  }, []);

  const handleFolderClick = (item: FileItem) => {
    if (item.isDirectory) {
      setSelectedPaths(new Set());
      loadDirectory(item.path, true);
    }
  };

  const handleBreadcrumbClick = (targetPath: string) => {
    setSelectedPaths(new Set());
    loadDirectory(targetPath, true);
  };

  // Drag and drop upload support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = e.dataTransfer.files;
      const formData = new FormData();
      formData.append('targetPath', currentPath);
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      setLoading(true);
      try {
        await fetchApi('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
        loadDirectory(currentPath, false);
      } catch (err: any) {
        setError(err.message || 'Upload failed.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Regular file input upload
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    formData.append('targetPath', currentPath);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setLoading(true);
    try {
      await fetchApi('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      loadDirectory(currentPath, false);
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await fetchApi('/api/files/create-folder', {
        method: 'POST',
        body: JSON.stringify({ parentPath: currentPath, name: newFolderName.trim() }),
      });
      setShowNewFolderModal(false);
      setNewFolderName('');
      loadDirectory(currentPath, false);
    } catch (err: any) {
      setError(err.message || 'Failed to create folder.');
    }
  };

  // Rename
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameItem || !renameValue.trim()) return;

    try {
      await fetchApi('/api/files/rename', {
        method: 'POST',
        body: JSON.stringify({ path: renameItem.path, newName: renameValue.trim() }),
      });
      setRenameItem(null);
      loadDirectory(currentPath, false);
    } catch (err: any) {
      setError(err.message || 'Rename failed.');
    }
  };

  // Move
  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveItemTarget || !destinationFolder.trim()) return;

    try {
      await fetchApi('/api/files/move', {
        method: 'POST',
        body: JSON.stringify({
          sourcePath: moveItemTarget.path,
          destinationFolder: cleanDisplayPath(destinationFolder.trim()),
        }),
      });
      setMoveItemTarget(null);
      loadDirectory(currentPath, false);
    } catch (err: any) {
      setError(err.message || 'Move failed.');
    }
  };

  // Delete single or bulk
  const handleDelete = async (pathsToDelete: string[]) => {
    if (!confirm(`Delete ${pathsToDelete.length} item(s)? This action cannot be undone.`)) {
      return;
    }

    for (const p of pathsToDelete) {
      try {
        await fetchApi('/api/files/delete', {
          method: 'DELETE',
          body: JSON.stringify({ path: p }),
        });
      } catch (err: any) {
        setError(`Failed to delete ${p}: ${err.message}`);
      }
    }
    loadDirectory(currentPath, false);
  };

  // Toggle selection
  const toggleSelect = (p: string) => {
    const next = new Set(selectedPaths);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setSelectedPaths(next);
  };

  const toggleSelectAll = () => {
    if (selectedPaths.size === filteredItems.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(filteredItems.map((i) => i.path)));
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Generate clean breadcrumb path segments without any double slashes
  const pathParts = cleanDisplayPath(currentPath).split('/').filter(Boolean);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative space-y-4 min-h-[calc(100vh-8rem)]"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-accent-blue bg-bg-base/95 backdrop-blur-md">
          <UploadCloud className="h-16 w-16 text-accent-blue animate-bounce" />
          <span className="mt-3 font-mono text-sm font-semibold text-fg">
            DROP FILES HERE TO UPLOAD DIRECTLY
          </span>
          <span className="font-mono text-xs text-fg-muted">
            Destination: {cleanDisplayPath(currentPath)}
          </span>
        </div>
      )}

      {/* Top Storage Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-white/10 bg-bg-panel/90 backdrop-blur-md p-3.5 shadow-lg">
        <div className="flex items-center space-x-2.5 font-mono text-xs text-fg">
          <HardDrive className="h-4 w-4 text-accent-blue" />
          <span className="font-semibold">INTERNAL STORAGE:</span>
          <span className="text-fg-muted">
            {storage
              ? `${(storage.usedBytes / 1024 ** 3).toFixed(1)} / ${(storage.totalBytes / 1024 ** 3).toFixed(1)} GB (${storage.usedPercentage}%)`
              : 'Calculating capacity...'}
          </span>
        </div>

        {storage && (
          <div className="w-full sm:w-64 h-2 rounded-full bg-white/5 overflow-hidden border border-white/10">
            <div
              className={`h-full transition-all duration-500 ${
                storage.usedPercentage > 90 ? 'bg-accent-red' : 'bg-gradient-to-r from-accent-blue to-cyan-400'
              }`}
              style={{ width: `${Math.min(100, storage.usedPercentage)}%` }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-accent-red/50 bg-accent-red-subtle p-3.5 font-mono text-xs text-accent-red">
          <span>[ERROR] {error}</span>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Breadcrumbs & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border border-white/10 bg-bg-panel/90 backdrop-blur-md p-3 shadow-md">
        {/* Breadcrumb Pills */}
        <div className="flex items-center space-x-1.5 font-mono text-xs overflow-x-auto py-1 scrollbar-none">
          {parentPath !== null && (
            <button
              onClick={() => loadDirectory(parentPath, true)}
              title="Up one level"
              className="mr-1 rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10 text-fg transition-colors"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={() => handleBreadcrumbClick('/')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              currentPath === '/'
                ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30 font-semibold'
                : 'text-fg-muted hover:text-fg hover:bg-white/5 border border-transparent'
            }`}
          >
            Storage Root
          </button>

          {pathParts.map((part, index) => {
            const accumulatedPath = '/' + pathParts.slice(0, index + 1).join('/');
            const isLast = index === pathParts.length - 1;
            return (
              <React.Fragment key={accumulatedPath}>
                <ChevronRight className="h-3.5 w-3.5 text-fg-subtle shrink-0" />
                <button
                  onClick={() => handleBreadcrumbClick(accumulatedPath)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all truncate max-w-[160px] ${
                    isLast
                      ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30 font-semibold'
                      : 'text-fg-muted hover:text-fg hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-fg-subtle" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 sm:w-44 rounded-lg border border-white/10 bg-black/40 pl-8 pr-3 py-1.5 font-mono text-xs text-fg outline-none focus:border-accent-blue"
            />
          </div>

          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleUploadFiles}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 rounded-lg border border-accent-blue/40 bg-accent-blue/15 px-3 py-1.5 font-mono text-xs font-semibold text-accent-blue hover:bg-accent-blue/25 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          <button
            onClick={() => setShowNewFolderModal(true)}
            className="flex items-center space-x-1.5 rounded-lg border border-accent-green/40 bg-accent-green/15 px-3 py-1.5 font-mono text-xs font-semibold text-accent-green hover:bg-accent-green/25 transition-colors"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Folder</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-white/10 bg-black/30 p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white/10 text-fg' : 'text-fg-subtle hover:text-fg'}`}
              title="List View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white/10 text-fg' : 'text-fg-subtle hover:text-fg'}`}
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            onClick={() => loadDirectory(currentPath, true)}
            title="Refresh"
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-fg-muted hover:bg-white/10 hover:text-fg transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {selectedPaths.size > 0 && (
            <button
              onClick={() => handleDelete(Array.from(selectedPaths))}
              className="flex items-center space-x-1.5 rounded-lg border border-accent-red/50 bg-accent-red/20 px-3 py-1.5 font-mono text-xs font-semibold text-accent-red hover:bg-accent-red hover:text-white transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete ({selectedPaths.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Files Display Container */}
      <div className="rounded-xl border border-white/10 bg-bg-panel/90 backdrop-blur-md overflow-hidden shadow-xl">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center font-mono text-xs text-fg-subtle space-y-2">
            <Folder className="h-12 w-12 text-fg-subtle/40 mb-2" />
            <p className="text-fg font-medium">This folder is empty</p>
            <p className="text-fg-muted text-[11px]">
              Drag & drop files or click &quot;Upload&quot; to transfer files to this folder.
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* List View Table */
          <div className="overflow-x-auto">
            <table className="w-full tech-table">
              <thead>
                <tr>
                  <th className="w-10 text-center">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center">
                      {selectedPaths.size > 0 && selectedPaths.size === filteredItems.length ? (
                        <CheckSquare className="h-4 w-4 text-accent-blue" />
                      ) : (
                        <Square className="h-4 w-4 text-fg-subtle" />
                      )}
                    </button>
                  </th>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Modified</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isSelected = selectedPaths.has(item.path);
                  return (
                    <tr
                      key={item.path}
                      className={`group transition-colors ${
                        isSelected ? 'bg-accent-blue/10' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className="text-center">
                        <button
                          onClick={() => toggleSelect(item.path)}
                          className="flex items-center justify-center"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-accent-blue" />
                          ) : (
                            <Square className="h-4 w-4 text-fg-subtle group-hover:text-fg-muted" />
                          )}
                        </button>
                      </td>

                      <td>
                        <div
                          onClick={() => handleFolderClick(item)}
                          className={`flex items-center space-x-2.5 ${
                            item.isDirectory
                              ? 'cursor-pointer font-semibold text-fg hover:text-accent-blue'
                              : 'text-fg-muted'
                          }`}
                        >
                          {getFileIcon(item)}
                          <span className="truncate max-w-[280px] sm:max-w-md font-mono text-xs">
                            {item.name}
                          </span>
                        </div>
                      </td>

                      <td className="font-mono text-xs text-fg-subtle">
                        {item.isDirectory ? '--' : formatBytes(item.size)}
                      </td>

                      <td className="font-mono text-xs text-fg-subtle">
                        {new Date(item.modifiedAt).toLocaleDateString()}
                      </td>

                      <td className="text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          {!item.isDirectory && (
                            <a
                              href={`/api/files/download?path=${encodeURIComponent(item.path)}`}
                              download={item.name}
                              title="Download"
                              className="rounded p-1.5 text-fg-muted hover:bg-white/10 hover:text-accent-blue transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          )}

                          <button
                            onClick={() => {
                              setRenameItem(item);
                              setRenameValue(item.name);
                            }}
                            title="Rename"
                            className="rounded p-1.5 text-fg-muted hover:bg-white/10 hover:text-fg transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setMoveItemTarget(item);
                              setDestinationFolder(currentPath);
                            }}
                            title="Move"
                            className="rounded p-1.5 text-fg-muted hover:bg-white/10 hover:text-fg transition-colors"
                          >
                            <Move className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete([item.path])}
                            title="Delete"
                            className="rounded p-1.5 text-fg-muted hover:bg-accent-red/20 hover:text-accent-red transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filteredItems.map((item) => {
              const isSelected = selectedPaths.has(item.path);
              return (
                <div
                  key={item.path}
                  onClick={() => (item.isDirectory ? handleFolderClick(item) : toggleSelect(item.path))}
                  className={`group relative flex flex-col items-center justify-between rounded-xl border p-4 text-center cursor-pointer transition-all ${
                    isSelected
                      ? 'border-accent-blue bg-accent-blue/15 shadow-lg'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(item.path);
                    }}
                    className="absolute top-2 left-2"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-3.5 w-3.5 text-accent-blue" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-transparent group-hover:text-fg-subtle" />
                    )}
                  </button>

                  <div className="my-2">{getFileIcon(item)}</div>

                  <span className="w-full truncate font-mono text-xs font-medium text-fg">
                    {item.name}
                  </span>

                  <span className="font-mono text-[10px] text-fg-subtle mt-1">
                    {item.isDirectory ? 'Folder' : formatBytes(item.size)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-bg-panel p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-2 font-mono text-xs font-semibold text-fg">
              <span>CREATE NEW DIRECTORY</span>
              <button onClick={() => setShowNewFolderModal(false)}>
                <X className="h-4 w-4 text-fg-subtle" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <input
                type="text"
                placeholder="Folder name"
                required
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-bg-base px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent-blue"
              />
              <div className="flex justify-end space-x-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="rounded-lg px-3 py-1.5 text-fg-muted hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent-blue px-4 py-1.5 text-white font-semibold hover:bg-blue-600 transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-bg-panel p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-2 font-mono text-xs font-semibold text-fg">
              <span>RENAME ITEM</span>
              <button onClick={() => setRenameItem(null)}>
                <X className="h-4 w-4 text-fg-subtle" />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <input
                type="text"
                required
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-bg-base px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent-blue"
              />
              <div className="flex justify-end space-x-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setRenameItem(null)}
                  className="rounded-lg px-3 py-1.5 text-fg-muted hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent-blue px-4 py-1.5 text-white font-semibold hover:bg-blue-600 transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {moveItemTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-bg-panel p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-2 font-mono text-xs font-semibold text-fg">
              <span>MOVE ITEM</span>
              <button onClick={() => setMoveItemTarget(null)}>
                <X className="h-4 w-4 text-fg-subtle" />
              </button>
            </div>
            <form onSubmit={handleMoveSubmit} className="space-y-4">
              <div className="font-mono text-xs text-fg-muted">
                Destination Folder (e.g. /DCIM or /Documents):
              </div>
              <input
                type="text"
                required
                autoFocus
                value={destinationFolder}
                onChange={(e) => setDestinationFolder(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-bg-base px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent-blue"
              />
              <div className="flex justify-end space-x-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setMoveItemTarget(null)}
                  className="rounded-lg px-3 py-1.5 text-fg-muted hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent-blue px-4 py-1.5 text-white font-semibold hover:bg-blue-600 transition-colors"
                >
                  Move
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
