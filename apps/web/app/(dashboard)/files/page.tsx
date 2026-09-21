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
} from 'lucide-react';
import { FileItem, StorageStats } from '@android-server/shared';
import { fetchApi } from '@/lib/api';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(item: FileItem) {
  if (item.isDirectory) return <Folder className="h-4 w-4 text-accent-blue" />;
  const ext = item.extension.toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) {
    return <FileImage className="h-4 w-4 text-fg-muted" />;
  }
  if (['.mp4', '.mkv', '.mov', '.avi'].includes(ext)) {
    return <FileVideo className="h-4 w-4 text-fg-muted" />;
  }
  if (['.mp3', '.flac', '.wav', '.ogg', '.m4a'].includes(ext)) {
    return <FileAudio className="h-4 w-4 text-fg-muted" />;
  }
  if (['.js', '.ts', '.json', '.html', '.css', '.py', '.sh'].includes(ext)) {
    return <FileCode className="h-4 w-4 text-accent-green" />;
  }
  if (['.txt', '.md', '.pdf', '.doc', '.docx'].includes(ext)) {
    return <FileText className="h-4 w-4 text-fg-muted" />;
  }
  return <File className="h-4 w-4 text-fg-subtle" />;
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadDirectory = async (path: string = '/') => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, storageRes] = await Promise.all([
        fetchApi(`/api/files/list?path=${encodeURIComponent(path)}`),
        fetchApi('/api/files/storage-stats').catch(() => null),
      ]);
      setItems(listRes.items || []);
      setCurrentPath(listRes.currentPath || '/');
      setParentPath(listRes.parentPath);
      setSelectedPaths(new Set());
      if (storageRes) setStorage(storageRes);
    } catch (err: any) {
      setError(err.message || 'Failed to list directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory('/');
  }, []);

  const handleFolderClick = (item: FileItem) => {
    if (item.isDirectory) {
      loadDirectory(item.path);
    }
  };

  const handleBreadcrumbClick = (targetPath: string) => {
    loadDirectory(targetPath);
  };

  // Upload handler
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
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
      setLoading(false);
    } finally {
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
      loadDirectory(currentPath);
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
      loadDirectory(currentPath);
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
        body: JSON.stringify({ sourcePath: moveItemTarget.path, destinationFolder: destinationFolder.trim() }),
      });
      setMoveItemTarget(null);
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || 'Move failed.');
    }
  };

  // Delete single or bulk
  const handleDelete = async (pathsToDelete: string[]) => {
    if (!confirm(`Are you sure you want to delete ${pathsToDelete.length} item(s)? This action cannot be undone.`)) {
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
    loadDirectory(currentPath);
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

  // Generate breadcrumb path segments
  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Top Header & Storage Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded border border-border bg-bg-panel p-3">
        <div className="flex items-center space-x-2 font-mono text-xs text-fg">
          <HardDrive className="h-4 w-4 text-accent-blue" />
          <span>STORAGE:</span>
          <span className="text-fg-muted">
            {storage ? `${(storage.usedBytes / 1024 ** 3).toFixed(1)} / ${(storage.totalBytes / 1024 ** 3).toFixed(1)} GB (${storage.usedPercentage}%)` : '...'}
          </span>
        </div>

        {storage && (
          <div className="w-full sm:w-64 h-1.5 rounded bg-bg-base overflow-hidden border border-border">
            <div
              className={`h-full ${storage.usedPercentage > 90 ? 'bg-accent-red' : 'bg-accent-blue'}`}
              style={{ width: `${Math.min(100, storage.usedPercentage)}%` }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between rounded border border-accent-red/50 bg-accent-red-subtle p-3 font-mono text-xs text-accent-red">
          <span>[ERROR] {error}</span>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation and Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-bg-panel p-2">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-1 font-mono text-xs text-fg-muted overflow-x-auto py-1">
          {parentPath !== null && (
            <button
              onClick={() => loadDirectory(parentPath)}
              title="Up one level"
              className="mr-1 rounded p-1 hover:bg-bg-hover text-fg"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => handleBreadcrumbClick('/')}
            className={`hover:text-accent-blue ${currentPath === '/' ? 'text-fg font-semibold' : ''}`}
          >
            Home
          </button>
          {pathParts.map((part, index) => {
            const accumulatedPath = '/' + pathParts.slice(0, index + 1).join('/');
            const isLast = index === pathParts.length - 1;
            return (
              <React.Fragment key={accumulatedPath}>
                <span className="text-fg-subtle">/</span>
                <button
                  onClick={() => handleBreadcrumbClick(accumulatedPath)}
                  className={`hover:text-accent-blue truncate max-w-[120px] ${
                    isLast ? 'text-fg font-semibold' : ''
                  }`}
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-fg-subtle" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 sm:w-48 rounded border border-border bg-bg-base pl-8 pr-3 py-1 font-mono text-xs text-fg outline-none focus:border-accent-blue"
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
            className="flex items-center space-x-1.5 rounded border border-border bg-bg-base px-2.5 py-1 font-mono text-xs text-fg hover:bg-bg-hover hover:border-accent-blue transition-colors"
          >
            <Upload className="h-3.5 w-3.5 text-accent-blue" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          <button
            onClick={() => setShowNewFolderModal(true)}
            className="flex items-center space-x-1.5 rounded border border-border bg-bg-base px-2.5 py-1 font-mono text-xs text-fg hover:bg-bg-hover hover:border-accent-blue transition-colors"
          >
            <FolderPlus className="h-3.5 w-3.5 text-accent-green" />
            <span className="hidden sm:inline">New Folder</span>
          </button>

          <button
            onClick={() => loadDirectory(currentPath)}
            title="Refresh"
            className="rounded border border-border bg-bg-base p-1.5 text-fg-muted hover:bg-bg-hover transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {selectedPaths.size > 0 && (
            <button
              onClick={() => handleDelete(Array.from(selectedPaths))}
              className="flex items-center space-x-1 rounded border border-accent-red/50 bg-accent-red-subtle px-2 py-1 font-mono text-xs text-accent-red hover:bg-accent-red hover:text-white transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete ({selectedPaths.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Files Table */}
      <div className="rounded border border-border bg-bg-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full tech-table">
            <thead>
              <tr>
                <th className="w-8">
                  <button onClick={toggleSelectAll} className="flex items-center">
                    {selectedPaths.size > 0 && selectedPaths.size === filteredItems.length ? (
                      <CheckSquare className="h-3.5 w-3.5 text-accent-blue" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-fg-subtle" />
                    )}
                  </button>
                </th>
                <th>NAME</th>
                <th>TYPE</th>
                <th>SIZE</th>
                <th>MODIFIED</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-mono text-xs text-fg-muted">
                    READING FILESYSTEM...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-mono text-xs text-fg-subtle">
                    {searchQuery ? 'No matching files found.' : 'Directory is empty.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedPaths.has(item.path);
                  return (
                    <tr
                      key={item.path}
                      className={isSelected ? 'bg-accent-blue-subtle/40' : ''}
                      onDoubleClick={() => handleFolderClick(item)}
                    >
                      <td>
                        <button onClick={() => toggleSelect(item.path)} className="flex items-center">
                          {isSelected ? (
                            <CheckSquare className="h-3.5 w-3.5 text-accent-blue" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-fg-subtle" />
                          )}
                        </button>
                      </td>
                      <td>
                        <div
                          onClick={() => handleFolderClick(item)}
                          className={`flex items-center space-x-2 font-mono text-xs cursor-pointer select-none ${
                            item.isDirectory ? 'text-fg font-medium hover:text-accent-blue' : 'text-fg'
                          }`}
                        >
                          {getFileIcon(item)}
                          <span className="truncate max-w-sm">{item.name}</span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-fg-muted uppercase">
                        {item.isDirectory ? 'DIR' : item.extension || 'FILE'}
                      </td>
                      <td className="font-mono text-xs text-fg-muted">
                        {item.isDirectory ? '—' : formatBytes(item.size)}
                      </td>
                      <td className="font-mono text-xs text-fg-subtle whitespace-nowrap">
                        {new Date(item.modifiedAt).toLocaleString()}
                      </td>
                      <td>
                        <div className="flex items-center justify-end space-x-1">
                          {!item.isDirectory && (
                            <a
                              href={`/api/files/download?path=${encodeURIComponent(item.path)}`}
                              title="Download"
                              className="rounded p-1 text-fg-muted hover:text-accent-blue"
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
                            className="rounded p-1 text-fg-muted hover:text-fg"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setMoveItemTarget(item);
                              setDestinationFolder(currentPath);
                            }}
                            title="Move"
                            className="rounded p-1 text-fg-muted hover:text-fg"
                          >
                            <Move className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete([item.path])}
                            title="Delete"
                            className="rounded p-1 text-fg-muted hover:text-accent-red"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm rounded border border-border bg-bg-panel p-5">
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
                className="w-full rounded border border-border bg-bg-base px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent-blue"
              />
              <div className="flex justify-end space-x-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="rounded px-3 py-1.5 text-fg-muted hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-accent-blue px-4 py-1.5 text-white font-medium hover:bg-blue-600"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm rounded border border-border bg-bg-panel p-5">
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
                className="w-full rounded border border-border bg-bg-base px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent-blue"
              />
              <div className="flex justify-end space-x-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setRenameItem(null)}
                  className="rounded px-3 py-1.5 text-fg-muted hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-accent-blue px-4 py-1.5 text-white font-medium hover:bg-blue-600"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm rounded border border-border bg-bg-panel p-5">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-2 font-mono text-xs font-semibold text-fg">
              <span>MOVE ITEM</span>
              <button onClick={() => setMoveItemTarget(null)}>
                <X className="h-4 w-4 text-fg-subtle" />
              </button>
            </div>
            <form onSubmit={handleMoveSubmit} className="space-y-4">
              <div className="font-mono text-xs text-fg-muted">
                Target Folder Path (e.g. /DCIM or /Documents):
              </div>
              <input
                type="text"
                required
                autoFocus
                value={destinationFolder}
                onChange={(e) => setDestinationFolder(e.target.value)}
                className="w-full rounded border border-border bg-bg-base px-3 py-2 font-mono text-xs text-fg outline-none focus:border-accent-blue"
              />
              <div className="flex justify-end space-x-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setMoveItemTarget(null)}
                  className="rounded px-3 py-1.5 text-fg-muted hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-accent-blue px-4 py-1.5 text-white font-medium hover:bg-blue-600"
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
