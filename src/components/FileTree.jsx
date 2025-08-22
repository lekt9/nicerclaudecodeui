import React, { useState, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { 
  Folder, 
  FolderOpen, 
  File, 
  FileText, 
  FileCode, 
  Search,
  Filter,
  MoreHorizontal,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import CodeEditor from './CodeEditor';
import ImageViewer from './ImageViewer';
import { api } from '../utils/api';

function FileTree({ selectedProject }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (selectedProject) {
      fetchFiles();
    }
  }, [selectedProject]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const response = await api.getFiles(selectedProject.name);
      
      if (!response.ok) {
        console.error('File fetch failed:', response.status);
        setFiles([]);
        return;
      }
      
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error('Error fetching files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleDirectory = (path) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatRelativeTime = (date) => {
    if (!date) return '-';
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return past.toLocaleDateString();
  };

  const getFileIcon = (filename, isDirectory = false) => {
    if (isDirectory) return null;
    
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'];
    const docExtensions = ['md', 'txt', 'doc', 'pdf'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    
    if (codeExtensions.includes(ext)) {
      return <FileCode className="w-4 h-4 text-blue-500" />;
    } else if (docExtensions.includes(ext)) {
      return <FileText className="w-4 h-4 text-green-500" />;
    } else if (imageExtensions.includes(ext)) {
      return <File className="w-4 h-4 text-purple-500" />;
    } else {
      return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const isImageFile = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext);
  };

  const renderFileTree = (items, level = 0) => {
    const filteredItems = searchQuery
      ? items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : items;

    return filteredItems.map((item) => {
      const isExpanded = expandedDirs.has(item.path);
      const Icon = item.type === 'directory' ? (isExpanded ? FolderOpen : Folder) : null;
      
      return (
        <div key={item.path} className="select-none">
          <div
            className={cn(
              "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all duration-200 hover:bg-accent/50",
              level > 0 && "ml-4"
            )}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => {
              if (item.type === 'directory') {
                toggleDirectory(item.path);
              } else if (isImageFile(item.name)) {
                setSelectedImage({
                  name: item.name,
                  path: item.path,
                  projectPath: selectedProject.path,
                  projectName: selectedProject.name
                });
              } else {
                setSelectedFile({
                  name: item.name,
                  path: item.path,
                  projectPath: selectedProject.path,
                  projectName: selectedProject.name
                });
              }
            }}
          >
            {item.type === 'directory' && (
              <div className="w-4 h-4 flex items-center justify-center">
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
            )}
            
            {Icon ? (
              <Icon className={cn(
                "w-4 h-4 flex-shrink-0",
                item.type === 'directory' 
                  ? "text-blue-500" 
                  : "text-muted-foreground"
              )} />
            ) : (
              getFileIcon(item.name)
            )}
            
            <span className="text-sm linear-text truncate flex-1">
              {item.name}
            </span>
            
            {item.type === 'file' && (
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs linear-text-muted">
                  {formatFileSize(item.size)}
                </span>
              </div>
            )}
          </div>
          
          {item.type === 'directory' && isExpanded && item.children && (
            <div className="ml-2">
              {renderFileTree(item.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col linear-bg">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b linear-border linear-surface/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold linear-text">Files</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm">
              <Filter className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 linear-text-muted" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-background/20 border-border/50"
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 linear-surface rounded-xl flex items-center justify-center mb-4">
              <Folder className="w-8 h-8 linear-text-muted" />
            </div>
            <h4 className="font-medium linear-text mb-2">No files found</h4>
            <p className="text-sm linear-text-secondary">
              Check if the project path is accessible
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {renderFileTree(files)}
            </div>
          </ScrollArea>
        )}
      </div>
      
      {/* Modals */}
      {selectedFile && (
        <CodeEditor
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          projectPath={selectedFile.projectPath}
        />
      )}
      
      {selectedImage && (
        <ImageViewer
          file={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}

export default FileTree;