'use client';

import * as React from 'react';
import { 
  ShieldAlert, 
  Binary, 
  BarChart3, 
  FileText, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type TabType = 'analyze' | 'encode-decode' | 'metrics' | 'reports';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const navItems = [
  { id: 'analyze', label: 'Analyze', icon: ShieldAlert },
  { id: 'encode-decode', label: 'Encode/Decode', icon: Binary },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileText },
];

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <div 
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 border-r border-sidebar-border",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">Orchid Pro</span>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as TabType)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg transition-colors group",
              activeTab === item.id 
                ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className={cn("w-5 h-5 shrink-0", activeTab === item.id ? "" : "group-hover:text-sidebar-primary")} />
            {!isCollapsed && <span className="font-medium">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/80 transition-colors">
          <Settings className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="font-medium">Settings</span>}
        </button>
      </div>
    </div>
  );
}
