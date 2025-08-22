import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';
import Shell from './Shell';
import GitPanel from './GitPanel';
import ErrorBoundary from './ErrorBoundary';
import ClaudeLogo from './ClaudeLogo';
import CursorLogo from './CursorLogo';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { 
  MessageSquare, 
  Terminal, 
  FolderOpen, 
  GitBranch, 
  Menu,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

function MainContent({ 
  selectedProject, 
  selectedSession, 
  activeTab, 
  setActiveTab, 
  ws, 
  sendMessage, 
  messages,
  isMobile,
  onMenuClick,
  isLoading,
  onInputFocusChange,
  onSessionActive,
  onSessionInactive,  
  onReplaceTemporarySession,
  onNavigateToSession,
  onShowSettings,
  autoExpandTools,
  showRawParameters,
  autoScrollToBottom,
  sendByCtrlEnter
}) {
  const [editingFile, setEditingFile] = useState(null);

  const handleFileOpen = (filePath, diffInfo = null) => {
    const file = {
      name: filePath.split('/').pop(),
      path: filePath,
      projectName: selectedProject?.name,
      diffInfo: diffInfo
    };
    setEditingFile(file);
  };

  const handleCloseEditor = () => {
    setEditingFile(null);
  };

  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, shortLabel: 'Chat' },
    { id: 'shell', label: 'Shell', icon: Terminal, shortLabel: 'Shell' },
    { id: 'files', label: 'Files', icon: FolderOpen, shortLabel: 'Files' },
    { id: 'git', label: 'Source Control', icon: GitBranch, shortLabel: 'Git' },
  ];

  if (isLoading) {
    return (
      <div className="h-full flex flex-col linear-bg">
        {isMobile && (
          <header className="flex items-center justify-between p-4 border-b linear-border">
            <Button variant="ghost" size="icon" onClick={onMenuClick}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 linear-accent" />
              <span className="font-semibold linear-text">Claude Code UI</span>
            </div>
            <div className="w-9" />
          </header>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm mx-auto px-6">
            <div className="w-12 h-12 mx-auto mb-6 linear-surface rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-semibold mb-3 linear-text">Loading Claude Code UI</h2>
            <p className="linear-text-secondary">Setting up your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="h-full flex flex-col linear-bg">
        {isMobile && (
          <header className="flex items-center justify-between p-4 border-b linear-border">
            <Button variant="ghost" size="icon" onClick={onMenuClick}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 linear-accent" />
              <span className="font-semibold linear-text">Claude Code UI</span>
            </div>
            <div className="w-9" />
          </header>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <div className="w-16 h-16 mx-auto mb-6 linear-surface rounded-xl flex items-center justify-center">
              <FolderOpen className="w-8 h-8 linear-text-secondary" />
            </div>
            <h2 className="text-2xl font-semibold mb-3 linear-text">Choose Your Project</h2>
            <p className="linear-text-secondary mb-6 leading-relaxed">
              Select a project from the sidebar to start coding with Claude. Each project contains your chat sessions and file history.
            </p>
            <div className="p-4 linear-surface rounded-lg border linear-border">
              <p className="text-sm linear-text-secondary">
                💡 <strong>Tip:</strong> {isMobile ? 'Tap the menu button above to access projects' : 'Create a new project by clicking the folder icon in the sidebar'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col linear-bg">
      {/* Header */}
      <header className="flex-shrink-0 border-b linear-border linear-surface/50 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3 min-w-0">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={onMenuClick}>
                <Menu className="h-5 w-5" />
              </Button>
            )}
            
            <div className="flex items-center gap-3 min-w-0">
              {activeTab === 'chat' && selectedSession && (
                <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                  {selectedSession.__provider === 'cursor' ? (
                    <CursorLogo className="w-5 h-5" />
                  ) : (
                    <ClaudeLogo className="w-5 h-5" />
                  )}
                </div>
              )}
              
              <div className="min-w-0">
                {activeTab === 'chat' && selectedSession ? (
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold linear-text truncate">
                      {selectedSession.__provider === 'cursor' 
                        ? (selectedSession.name || 'Untitled Session') 
                        : (selectedSession.summary || 'New Session')}
                    </h2>
                    <div className="text-xs linear-text-secondary truncate">
                      {selectedProject.displayName}
                      <span className="hidden sm:inline"> • {selectedSession.id}</span>
                    </div>
                  </div>
                ) : activeTab === 'chat' && !selectedSession ? (
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold linear-text">New Session</h2>
                    <div className="text-xs linear-text-secondary">{selectedProject.displayName}</div>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold linear-text">
                      {tabs.find(tab => tab.id === activeTab)?.label || 'Project'}
                    </h2>
                    <div className="text-xs linear-text-secondary">{selectedProject.displayName}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="hidden sm:flex items-center">
            <div className="flex items-center linear-surface rounded-lg p-1 border linear-border">
              {tabs.map((tab, index) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <React.Fragment key={tab.id}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "h-8 px-3 transition-all duration-200",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "hover:bg-accent/50"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 mr-1.5" />
                      <span className="text-xs font-medium">{tab.shortLabel}</span>
                    </Button>
                    {index < tabs.length - 1 && !isActive && tabs[index + 1].id !== activeTab && (
                      <Separator orientation="vertical" className="h-4 mx-1" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={cn("h-full", activeTab === 'chat' ? 'block' : 'hidden')}>
          <ErrorBoundary showDetails={true}>
            <ChatInterface
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              ws={ws}
              sendMessage={sendMessage}
              messages={messages}
              onFileOpen={handleFileOpen}
              onInputFocusChange={onInputFocusChange}
              onSessionActive={onSessionActive}
              onSessionInactive={onSessionInactive}
              onReplaceTemporarySession={onReplaceTemporarySession}
              onNavigateToSession={onNavigateToSession}
              onShowSettings={onShowSettings}
              autoExpandTools={autoExpandTools}
              showRawParameters={showRawParameters}
              autoScrollToBottom={autoScrollToBottom}
              sendByCtrlEnter={sendByCtrlEnter}
            />
          </ErrorBoundary>
        </div>
        
        <div className={cn("h-full", activeTab === 'shell' ? 'block' : 'hidden')}>
          <Shell 
            selectedProject={selectedProject} 
            selectedSession={selectedSession}
            isActive={activeTab === 'shell'}
          />
        </div>
        
        <div className={cn("h-full", activeTab === 'files' ? 'block' : 'hidden')}>
          <FileTree selectedProject={selectedProject} />
        </div>
        
        <div className={cn("h-full", activeTab === 'git' ? 'block' : 'hidden')}>
          <GitPanel selectedProject={selectedProject} isMobile={isMobile} />
        </div>
      </div>

      {/* Code Editor Modal */}
      {editingFile && (
        <CodeEditor
          file={editingFile}
          onClose={handleCloseEditor}
          projectPath={selectedProject?.path}
        />
      )}
    </div>
  );
}

export default React.memo(MainContent);