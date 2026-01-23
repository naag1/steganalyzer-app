'use client';

import * as React from 'react';
import { Upload, Binary, Download, Eye, Music, FileText, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  encodeLSB, 
  decodeLSB, 
  encodeAudioLSB, 
  decodeAudioLSB 
} from '@/lib/stego/codec';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';

export function EncodeDecodeTab() {
  const [activeTab, setActiveTab] = React.useState<'encode' | 'extract'>('encode');
  const [fileType, setFileType] = React.useState<'image' | 'audio'>('image');
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState('');
  const [resultUrl, setResultUrl] = React.useState<string | null>(null);
  const [extractedData, setExtractedData] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setResultUrl(null);
    setExtractedData(null);

    if (uploadedFile.type.startsWith('image/')) {
      setFileType('image');
      const reader = new FileReader();
      reader.onload = (event) => setPreview(event.target?.result as string);
      reader.readAsDataURL(uploadedFile);
    } else if (uploadedFile.type === 'audio/wav') {
      setFileType('audio');
      setPreview(null);
    }
  };

  const handleAction = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      if (activeTab === 'encode') {
        if (!message) throw new Error('Message is required');
        
        if (fileType === 'image') {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const encoded = encodeLSB(imageData.data, message);
            ctx.putImageData(new ImageData(encoded, img.width, img.height), 0, 0);
            setResultUrl(canvas.toDataURL('image/png'));
          };
          img.src = preview!;
        } else {
          const buffer = await file.arrayBuffer();
          const encodedBuffer = await encodeAudioLSB(buffer, message);
          const blob = new Blob([encodedBuffer], { type: 'audio/wav' });
          setResultUrl(URL.createObjectURL(blob));
        }
      } else {
        if (fileType === 'image') {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height).data;
            const result = decodeLSB(imageData);
            setExtractedData(result.detected ? result.message || 'No message' : 'No StegX signature detected.');
          };
          img.src = preview!;
        } else {
          const buffer = await file.arrayBuffer();
          const result = decodeAudioLSB(buffer);
          setExtractedData(result.detected ? result.message || 'No message' : 'No StegX signature detected.');
        }
      }
    } catch (err) {
      const error = err as Error;
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex justify-center">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'encode' | 'extract')} className="w-[400px]">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl h-12">
            <TabsTrigger value="encode" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#6366f1] data-[state=active]:shadow-sm font-bold transition-all">
              Encoding
            </TabsTrigger>
            <TabsTrigger value="extract" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#6366f1] data-[state=active]:shadow-sm font-bold transition-all">
              Extraction
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Card */}
        <Card className="p-8 border-[#e1e4e8] shadow-sm bg-white space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#6366f1]" />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#6366f1]" />
                Source Content
              </h3>
              {file && (
                <Badge variant="secondary" className="bg-slate-50 text-slate-500 border-[#e1e4e8]">
                  {fileType === 'image' ? 'Image Mode' : 'Audio Mode'}
                </Badge>
              )}
            </div>

            <div className="group relative aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-[#e1e4e8] hover:border-[#6366f1]/50 transition-all overflow-hidden flex flex-col items-center justify-center text-center p-6">
              {preview ? (
                <img src={preview} className="absolute inset-0 w-full h-full object-contain p-2" alt="Preview" />
              ) : fileType === 'audio' && file ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto">
                    <Music className="w-8 h-8 text-[#6366f1]" />
                  </div>
                  <p className="font-bold text-slate-700">{file.name}</p>
                  <p className="text-xs text-slate-400">16-bit PCM WAV loaded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto text-slate-300 group-hover:text-[#6366f1] transition-colors">
                    <Binary className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Drop your file here</p>
                    <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, or WAV</p>
                  </div>
                </div>
              )}
              <input type="file" onChange={onFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*,audio/wav" />
            </div>
          </div>

          {activeTab === 'encode' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Secret Message</h3>
                <Sparkles className="w-4 h-4 text-[#6366f1]" />
              </div>
              <Textarea 
                placeholder="Enter the sensitive information you wish to mask..." 
                className="min-h-[150px] rounded-xl border-[#e1e4e8] focus-visible:ring-[#6366f1] resize-none p-4"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button 
                onClick={handleAction}
                disabled={!file || !message || isProcessing}
                className="w-full h-14 bg-[#6366f1] hover:bg-[#4f46e5] rounded-xl font-bold text-lg shadow-lg shadow-indigo-100 transition-all hover:scale-[1.01]"
              >
                {isProcessing ? 'Encoding...' : 'Execute StegX Encoding'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6 pt-4">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#6366f1]" />
                  Extraction Protocol
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Orchid Pro will perform a signature-aware scan for StegX headers. If found, the 32-bit payload will be reconstructed.
                </p>
              </div>
              <Button 
                onClick={handleAction}
                disabled={!file || isProcessing}
                className="w-full h-14 bg-[#6366f1] hover:bg-[#4f46e5] rounded-xl font-bold text-lg shadow-lg shadow-indigo-100"
              >
                {isProcessing ? 'Extracting...' : 'Run Extraction'}
              </Button>
            </div>
          )}
        </Card>

        {/* Output Card */}
        <Card className="p-8 border-[#e1e4e8] shadow-sm bg-white space-y-6 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            {activeTab === 'encode' ? (
              <><ImageIcon className="w-5 h-5 text-[#6366f1]" /> Stego-Output</>
            ) : (
              <><Eye className="w-5 h-5 text-[#6366f1]" /> Extracted Payload</>
            )}
          </h3>

          <div className="flex-1 bg-slate-50 rounded-2xl border border-[#e1e4e8] border-dashed flex flex-col items-center justify-center p-8 relative min-h-[400px]">
            {activeTab === 'encode' ? (
              resultUrl ? (
                <div className="w-full h-full flex flex-col items-center gap-6">
                  {fileType === 'image' ? (
                    <img src={resultUrl} className="max-h-[300px] object-contain rounded-lg shadow-xl" alt="Result" />
                  ) : (
                    <div className="p-10 rounded-full bg-white shadow-xl">
                      <Music className="w-16 h-16 text-[#6366f1]" />
                    </div>
                  )}
                  <Button asChild className="bg-[#6366f1] hover:bg-[#4f46e5] px-8 py-6 rounded-xl font-bold shadow-lg shadow-indigo-100">
                    <a href={resultUrl} download={`steg_output_${file?.name}`}>
                      <Download className="w-5 h-5 mr-2" />
                      Download Forensically Prepared File
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-2 opacity-30">
                  <Sparkles className="w-12 h-12 mx-auto mb-4" />
                  <p className="font-bold text-slate-900">Awaiting Execution</p>
                  <p className="text-xs text-slate-500">The processed output will appear here</p>
                </div>
              )
            ) : (
              <div className="w-full h-full">
                {extractedData ? (
                  <div className="w-full h-full bg-white rounded-xl border border-[#e1e4e8] p-6 font-mono text-sm overflow-y-auto whitespace-pre-wrap text-slate-700 shadow-inner">
                    {extractedData}
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-2 opacity-30">
                    <Eye className="w-12 h-12 mx-auto mb-4" />
                    <p className="font-bold text-slate-900">No Data Recovered</p>
                    <p className="text-xs text-slate-500">Extracted information will be displayed here</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {activeTab === 'encode' && resultUrl && (
            <div className="p-4 bg-[#6366f1]/5 rounded-xl border border-[#6366f1]/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#6366f1] flex items-center justify-center text-white">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <p className="text-[11px] text-[#6366f1] font-medium leading-tight">
                This file has been modified using the StegX protocol. It is recommended to verify its integrity using the Analyze tab before distribution.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ShieldAlert({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
