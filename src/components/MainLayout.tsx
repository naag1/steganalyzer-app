'use client';

import * as React from 'react';
import { Sidebar, TabType } from './Sidebar';
import { EncodeDecodeTab } from './tabs/EncodeDecodeTab';
import { MetricsTab } from './tabs/MetricsTab';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';

export function MainLayout() {
  const [activeTab, setActiveTab] = React.useState<TabType>('encode-decode');

  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Branding Title - Top Center */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            StegAnalyzer
          </h1>
        </div>

        {/* Forensic Badge - Top Right */}
        <div className="absolute top-4 right-6 z-10">
          <Badge variant="outline" className="bg-white/50 backdrop-blur-sm border-[#e1e4e8] text-slate-600 px-3 py-1 flex items-center gap-2 shadow-sm">
            <Lock size={12} className="text-[#6366f1]" />
            <span>Client-side Forensic Analysis</span>
          </Badge>
        </div>

        {/* Header Spacer (since title is absolute) */}
        <header className="h-24 flex items-center px-6" />

        <div className="flex-1 overflow-y-auto p-8 pt-4">
          <div className="max-w-6xl mx-auto w-full">
            {activeTab === 'encode-decode' && <EncodeDecodeTab />}
            {activeTab === 'metrics' && <MetricsTab />}
          </div>

        </div>
      </main>
    </div>
  );
}
