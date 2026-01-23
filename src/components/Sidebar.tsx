'use client';

import * as React from 'react';
import { 
  ShieldAlert, 
  Binary, 
  BarChart3, 
  FileText, 
  ChevronLeft,
  ChevronRight,
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
  { id: 'encode-decode', label: 'Encode / Extraction', icon: Binary },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
];

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <div 
      className={cn(
        "flex flex-col h-screen bg-white transition-all duration-300 border-r border-[#e1e4e8]",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-[#e1e4e8]">
        {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#6366f1] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight text-slate-900">StegAnalyzer</span>
            </div>

        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-slate-500 hover:bg-slate-100"
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
                ? "bg-slate-100 text-[#6366f1]" 
                : "text-slate-600 hover:bg-slate-50 hover:text-[#6366f1]"
            )}
          >
            <item.icon className={cn("w-5 h-5 shrink-0", activeTab === item.id ? "text-[#6366f1]" : "text-[#6366f1]")} />
            {!isCollapsed && <span className="font-medium">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-[#e1e4e8]">
        <div className="flex items-center gap-2 px-2 text-xs text-slate-400">
          {!isCollapsed && <span>v2.0.0</span>}
        </div>
      </div>
    </div>
  );
}
