import React from 'react';
import { MessageSquare, Folder, Terminal, GitBranch } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

function MobileNav({ activeTab, setActiveTab, isInputFocused }) {
  const navItems = [
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'shell', icon: Terminal, label: 'Shell' },
    { id: 'files', icon: Folder, label: 'Files' },
    { id: 'git', icon: GitBranch, label: 'Git' }
  ];

  return (
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ease-in-out",
        isInputFocused ? 'translate-y-full' : 'translate-y-0'
      )}
    >
      <div className="linear-surface/95 backdrop-blur-md border-t linear-border shadow-lg">
        <div className="flex items-center justify-around py-2 ios-bottom-safe">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 h-12 rounded-none relative",
                  isActive 
                    ? "text-primary" 
                    : "linear-text-secondary hover:linear-text"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MobileNav;