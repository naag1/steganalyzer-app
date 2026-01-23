'use client';

import * as React from 'react';
import { Sidebar, TabType } from './Sidebar';
import { AnalyzeTab } from './tabs/AnalyzeTab';
import { EncodeDecodeTab } from './tabs/EncodeDecodeTab';
import { MetricsTab } from './tabs/MetricsTab';
import { ReportsTab } from './tabs/ReportsTab';

export function MainLayout() {
  const [activeTab, setActiveTab] = React.useState<TabType>('analyze');

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border flex items-center px-6 bg-card/50 backdrop-blur-sm">
          <h1 className="text-xl font-semibold capitalize">
            {activeTab.replace('-', ' / ')}
          </h1>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'analyze' && <AnalyzeTab />}
          {activeTab === 'encode-decode' && <EncodeDecodeTab />}
          {activeTab === 'metrics' && <MetricsTab />}
          {activeTab === 'reports' && <ReportsTab />}
        </div>
      </main>
    </div>
  );
}
