'use client';

import * as React from 'react';
import { FileText, Download, Search, Filter, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Report {
  id: string;
  date: string;
  fileName: string;
  type: 'Analysis' | 'Encoding' | 'Metrics';
  riskScore: number;
  status: 'Clean' | 'Suspicious' | 'Embedded';
}

const mockReports: Report[] = [
  { id: '1', date: '2026-01-23 14:20', fileName: 'forensic_sample_01.png', type: 'Analysis', riskScore: 0.82, status: 'Suspicious' },
  { id: '2', date: '2026-01-23 12:45', fileName: 'cover_image_v2.jpg', type: 'Metrics', riskScore: 0.02, status: 'Clean' },
  { id: '3', date: '2026-01-22 18:10', fileName: 'secret_payload.png', type: 'Encoding', riskScore: 0.45, status: 'Embedded' },
  { id: '4', date: '2026-01-22 15:30', fileName: 'random_noise.png', type: 'Analysis', riskScore: 0.12, status: 'Clean' },
];

export function ReportsTab() {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredReports = mockReports.filter(r => 
    r.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadJSON = (report: Report) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `report_${report.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search forensic logs..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" className="flex-1 md:flex-none gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="flex-1 md:flex-none gap-2">
            <Download className="w-4 h-4" />
            Export All
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
            <tr>
              <th className="px-6 py-4">Forensic ID</th>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Resource Name</th>
              <th className="px-6 py-4">Operation</th>
              <th className="px-6 py-4">Risk Score</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredReports.map((report) => (
              <tr key={report.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-sidebar-primary">#{report.id.padStart(4, '0')}</td>
                <td className="px-6 py-4 text-muted-foreground">{report.date}</td>
                <td className="px-6 py-4 font-medium">{report.fileName}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded-full bg-sidebar-primary/10 text-sidebar-primary text-[10px] font-bold uppercase">
                    {report.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {report.riskScore > 0.5 ? (
                      <ShieldAlert className="w-4 h-4 text-destructive" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-green-500" />
                    )}
                    <span className={report.riskScore > 0.5 ? 'text-destructive font-bold' : 'text-green-500'}>
                      {Math.round(report.riskScore * 100)}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" onClick={() => downloadJSON(report)}>
                    <Download className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredReports.length === 0 && (
          <div className="py-20 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No records found matching your criteria.</p>
          </div>
        )}
      </div>

      <div className="p-6 bg-sidebar-primary/5 border border-sidebar-primary/10 rounded-xl">
        <h4 className="font-bold text-sidebar-primary mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Audit Log Template (JSON)
        </h4>
        <pre className="text-[10px] font-mono bg-background/50 p-4 rounded border overflow-x-auto">
{`{
  "report_id": "ORCHID-PRO-2026-001",
  "analyst": "SYSTEM_AUTO_FORENSICS",
  "methods": ["CHI_SQUARE", "BPCS_COMPLEXITY", "LSB_SCAN"],
  "findings": {
    "probability_of_stego": 0.824,
    "anomalies": ["HIGH_COMPLEXITY_BITPLANE_0", "POV_EQUILIBRIUM"],
    "verdict": "SUSPICIOUS"
  },
  "metadata": {
    "software": "Orchid Pro StegAnalysis",
    "version": "1.0.0-PRO"
  }
}`}
        </pre>
      </div>
    </div>
  );
}
