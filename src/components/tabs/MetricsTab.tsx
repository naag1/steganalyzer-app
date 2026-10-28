'use client';

import * as React from 'react';
import { Ruler, Activity, Info, Upload, Music, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateMSE, calculatePSNR, calculateSSIM } from '@/lib/stego/metrics';

// ─── Metric description data ─────────────────────────────────────────────────

const METRIC_DESCRIPTIONS = [
  {
    key: 'mse',
    label: 'Mean Squared Error (MSE)',
    color: '#6366f1',
    summary: 'Average squared pixel-level difference between two images.',
    detail:
      'MSE measures the average of the squares of the per-channel differences between the original and modified image. ' +
      'A value of 0 means the images are pixel-perfect identical. ' +
      'For LSB steganography, expect MSE values between 0.1–1.0 since only the least-significant bit is flipped. ' +
      'Higher values indicate more aggressive embedding or visible distortion. ' +
      'MSE is sensitive to large isolated errors but blind to perceptual structure.',
    ranges: [
      { label: '0', desc: 'Identical — no embedding detected' },
      { label: '< 1.0', desc: 'Imperceptible LSB-class modification' },
      { label: '1–5', desc: 'Low-grade distortion, likely undetectable by eye' },
      { label: '> 10', desc: 'Visible degradation or high-capacity embedding' },
    ],
  },
  {
    key: 'psnr',
    label: 'Peak Signal-to-Noise Ratio (PSNR)',
    color: '#10b981',
    summary: 'Logarithmic measure of reconstruction fidelity relative to maximum signal power.',
    detail:
      'PSNR is expressed in decibels (dB) and derived from MSE. It measures how much noise (embedding) has been added ' +
      'relative to the maximum possible signal value (255 for 8-bit images). ' +
      'Higher PSNR = higher fidelity. A perfect image has PSNR = ∞. ' +
      'For steganography, PSNR > 40 dB is considered forensically safe — meaning the modification is indistinguishable ' +
      'from camera noise under typical forensic analysis. Values below 30 dB are likely detectable.',
    ranges: [
      { label: '> 50 dB', desc: 'Excellent — imperceptible, forensically safe' },
      { label: '40–50 dB', desc: 'Good — safe for most steganographic applications' },
      { label: '30–40 dB', desc: 'Acceptable — some statistical anomaly possible' },
      { label: '< 30 dB', desc: 'Poor — visible distortion, detectable by forensic tools' },
    ],
  },
  {
    key: 'ssim',
    label: 'Structural Similarity Index (SSIM)',
    color: '#f59e0b',
    summary: 'Perceptual similarity metric that models human visual system sensitivity.',
    detail:
      'SSIM compares luminance, contrast, and structural information in local 8×8 windows across the image. ' +
      'Unlike MSE/PSNR, SSIM models how the human visual system perceives changes — making it much more aligned ' +
      'with subjective image quality. A score of 1.0 is perfect; values above 0.95 are perceptually transparent. ' +
      'SSIM is the gold standard for assessing whether steganographic embedding is visually imperceptible, ' +
      'because two images can have the same MSE but very different perceptual quality.',
    ranges: [
      { label: '1.000', desc: 'Perfect structural identity' },
      { label: '> 0.99', desc: 'Imperceptible — ideal for steganography' },
      { label: '0.95–0.99', desc: 'Excellent — perceptually transparent to human observers' },
      { label: '0.80–0.95', desc: 'Good — minor perceptible differences' },
      { label: '< 0.80', desc: 'Noticeable structural degradation' },
    ],
  },
  {
    key: 'snr',
    label: 'Signal-to-Noise Ratio (SNR)',
    color: '#ec4899',
    summary: 'Ratio of original signal power to the noise introduced by embedding.',
    detail:
      'SNR expresses the ratio of the "useful" signal (original image) to the "noise" introduced by steganographic ' +
      'embedding, in decibels. Unlike PSNR which uses the peak value (255²) as the reference, SNR uses the actual ' +
      'signal variance — making it more meaningful for images with low average brightness. ' +
      'For audio steganography, SNR is the primary quality measure. ' +
      'A high SNR confirms that the embedding blends into the signal\'s natural variation.',
    ranges: [
      { label: '> 40 dB', desc: 'Inaudible / invisible — professional quality' },
      { label: '30–40 dB', desc: 'Good — typical for high-fidelity steganography' },
      { label: '20–30 dB', desc: 'Acceptable — some perceptible difference' },
      { label: '< 20 dB', desc: 'Noticeable noise — embedding may be detectable' },
    ],
  },
];

// ─── Collapsible description card ─────────────────────────────────────────────

function MetricDescription({
  metric,
}: {
  metric: (typeof METRIC_DESCRIPTIONS)[number];
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div
      className="rounded-2xl border border-slate-100 overflow-hidden"
      style={{ borderLeft: `3px solid ${metric.color}` }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div>
          <p className="font-bold text-sm text-slate-900">{metric.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{metric.summary}</p>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 ml-4" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-4" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 bg-slate-50">
          <p className="text-xs text-slate-600 leading-relaxed">{metric.detail}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {metric.ranges.map((r) => (
              <div
                key={r.label}
                className="flex items-start gap-2 bg-white rounded-lg p-3 border border-slate-100"
              >
                <span
                  className="text-xs font-mono font-bold shrink-0"
                  style={{ color: metric.color }}
                >
                  {r.label}
                </span>
                <span className="text-xs text-slate-500">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SNR calculation (signal power based) ─────────────────────────────────────

function calculateSNR(
  original: Uint8ClampedArray,
  modified: Uint8ClampedArray,
): number {
  let signalPower = 0;
  let noisePower = 0;
  let count = 0;

  for (let i = 0; i < original.length; i++) {
    if ((i + 1) % 4 === 0) continue;
    signalPower += original[i] * original[i];
    const diff = original[i] - modified[i];
    noisePower += diff * diff;
    count++;
  }

  if (noisePower === 0) return Infinity;
  return 10 * Math.log10(signalPower / noisePower);
}

// ─── Audio SNR (operates on Int16 PCM samples) ────────────────────────────────

function findWavDataOffset(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const chunkId   = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 0x64617461) return offset + 8; // 'data'
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  throw new Error('No "data" chunk found in WAV file');
}

function calculateAudioSNR(original: ArrayBuffer, modified: ArrayBuffer): number {
  const origOffset = findWavDataOffset(original);
  const modOffset  = findWavDataOffset(modified);
  const origView   = new DataView(original);
  const modView    = new DataView(modified);

  const samples = Math.min(
    (original.byteLength - origOffset) / 2,
    (modified.byteLength - modOffset) / 2,
  );

  let signalPower = 0;
  let noisePower  = 0;

  for (let i = 0; i < samples; i++) {
    const s = origView.getInt16(origOffset + i * 2, true);
    const m = modView.getInt16(modOffset + i * 2, true);
    signalPower += s * s;
    noisePower  += (s - m) ** 2;
  }

  if (noisePower === 0) return Infinity;
  return 10 * Math.log10(signalPower / noisePower);
}

// ─── Metric value display ────────────────────────────────────────────────────

function MetricCard({
  icon,
  value,
  label,
  color,
  quality,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
  quality?: { text: string; ok: boolean };
}) {
  return (
    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-2 relative overflow-hidden">
      <div
        className="absolute inset-x-0 bottom-0 h-1 rounded-b-2xl"
        style={{ background: color }}
      />
      <div className="flex justify-center mb-2" style={{ color }}>
        {icon}
      </div>
      <p className="text-2xl font-black text-slate-900 tabular-nums">{value}</p>
      <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">{label}</p>
      {quality && (
        <span
          className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            quality.ok
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-600'
          }`}
        >
          {quality.text}
        </span>
      )}
    </div>
  );
}

// ─── Image upload zone ────────────────────────────────────────────────────────

function ImageUploadZone({
  label,
  src,
  onChange,
}: {
  label: string;
  src: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex-1 space-y-3">
      <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400">{label}</h3>
      <div className="aspect-square bg-slate-50 rounded-2xl border-2 border-dashed border-[#e1e4e8] flex items-center justify-center overflow-hidden relative group hover:border-[#6366f1]/50 transition-all">
        {src ? (
          <img src={src} className="w-full h-full object-cover" alt={label} />
        ) : (
          <div className="text-center p-4">
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2 group-hover:text-[#6366f1] transition-colors" />
            <p className="text-[10px] text-slate-400 font-bold uppercase">Upload Image</p>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={onChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

// ─── Audio upload zone ────────────────────────────────────────────────────────

function AudioUploadZone({
  label,
  file,
  url,
  onChange,
}: {
  label: string;
  file: File | null;
  url: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex-1 space-y-3">
      <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400">{label}</h3>
      <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-[#e1e4e8] flex flex-col items-center justify-center overflow-hidden relative group hover:border-[#6366f1]/50 transition-all p-6 min-h-[120px] gap-3">
        {file ? (
          <>
            <div className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center">
              <Music className="w-6 h-6 text-[#6366f1]" />
            </div>
            <p className="text-xs font-bold text-slate-700 text-center truncate max-w-full px-2">
              {file.name}
            </p>
            {url && (
              <audio controls className="w-full mt-2" src={url}>
                Your browser does not support audio.
              </audio>
            )}
          </>
        ) : (
          <div className="text-center">
            <Music className="w-8 h-8 text-slate-300 mx-auto mb-2 group-hover:text-[#6366f1] transition-colors" />
            <p className="text-[10px] text-slate-400 font-bold uppercase">Upload WAV</p>
          </div>
        )}
        <input
          type="file"
          accept="audio/wav"
          onChange={onChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

// ─── Main MetricsTab ──────────────────────────────────────────────────────────

export function MetricsTab() {
  const [mode, setMode] = React.useState<'image' | 'audio'>('image');

  // Image state
  const [coverImage, setCoverImage] = React.useState<string | null>(null);
  const [stegoImage, setStegoImage] = React.useState<string | null>(null);
  const [coverData, setCoverData]   = React.useState<{ px: Uint8ClampedArray; w: number; h: number } | null>(null);
  const [stegoData, setStegoData]   = React.useState<{ px: Uint8ClampedArray; w: number; h: number } | null>(null);

  // Audio state
  const [coverAudioFile, setCoverAudioFile]   = React.useState<File | null>(null);
  const [stegoAudioFile, setStegoAudioFile]   = React.useState<File | null>(null);
  const [coverAudioUrl, setCoverAudioUrl]     = React.useState<string | null>(null);
  const [stegoAudioUrl, setStegoAudioUrl]     = React.useState<string | null>(null);
  const [coverAudioBuf, setCoverAudioBuf]     = React.useState<ArrayBuffer | null>(null);
  const [stegoAudioBuf, setStegoAudioBuf]     = React.useState<ArrayBuffer | null>(null);

  const [imageMetrics, setImageMetrics] = React.useState<{
    mse: number; psnr: number; ssim: number; snr: number;
  } | null>(null);
  const [audioMetrics, setAudioMetrics] = React.useState<{ snr: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'stego') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImageMetrics(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const px = ctx.getImageData(0, 0, img.width, img.height).data;
        const entry = { px, w: img.width, h: img.height };

        if (type === 'cover') {
          setCoverImage(ev.target?.result as string);
          setCoverData(entry);
        } else {
          setStegoImage(ev.target?.result as string);
          setStegoData(entry);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'stego') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setAudioMetrics(null);

    const url = URL.createObjectURL(file);
    file.arrayBuffer().then((buf) => {
      if (type === 'cover') {
        setCoverAudioFile(file);
        setCoverAudioUrl(url);
        setCoverAudioBuf(buf);
      } else {
        setStegoAudioFile(file);
        setStegoAudioUrl(url);
        setStegoAudioBuf(buf);
      }
    });
    e.target.value = '';
  };

  const runImageMetrics = () => {
    if (!coverData || !stegoData) return;
    try {
      if (coverData.w !== stegoData.w || coverData.h !== stegoData.h) {
        throw new Error(
          `Image dimensions must match. Cover: ${coverData.w}×${coverData.h}, Stego: ${stegoData.w}×${stegoData.h}`,
        );
      }
      const mse  = calculateMSE(coverData.px, stegoData.px);
      const psnr = calculatePSNR(mse);
      const ssim = calculateSSIM(coverData.px, stegoData.px, coverData.w, coverData.h);
      const snr  = calculateSNR(coverData.px, stegoData.px);
      setImageMetrics({ mse, psnr, ssim, snr });
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const runAudioMetrics = () => {
    if (!coverAudioBuf || !stegoAudioBuf) return;
    try {
      const snr = calculateAudioSNR(coverAudioBuf, stegoAudioBuf);
      setAudioMetrics({ snr });
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const fmtDb = (v: number) => (isFinite(v) ? `${v.toFixed(2)} dB` : '∞ dB');

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">

      {/* Mode selector */}
      <div className="flex justify-center">
        <Tabs value={mode} onValueChange={(v) => { setMode(v as 'image' | 'audio'); setError(null); }} className="w-[320px]">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl h-11">
            <TabsTrigger
              value="image"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#6366f1] data-[state=active]:shadow-sm font-bold transition-all"
            >
              Image Metrics
            </TabsTrigger>
            <TabsTrigger
              value="audio"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#6366f1] data-[state=active]:shadow-sm font-bold transition-all"
            >
              Audio Metrics
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2">
          <span className="text-red-500">✕</span> {error}
        </div>
      )}

      {/* ── Image Mode ──────────────────────────────────────────────────────── */}
      {mode === 'image' && (
        <Card className="p-8 border-[#e1e4e8] shadow-sm bg-white space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#6366f1]" />

          <div className="flex flex-col md:flex-row gap-8">
            <ImageUploadZone
              label="Cover Image (Original)"
              src={coverImage}
              onChange={(e) => handleImageUpload(e, 'cover')}
            />
            <div className="flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[#6366f1]/10 flex items-center justify-center text-[#6366f1]">
                <Ruler className="w-6 h-6" />
              </div>
            </div>
            <ImageUploadZone
              label="Stego Image (Modified)"
              src={stegoImage}
              onChange={(e) => handleImageUpload(e, 'stego')}
            />
          </div>

          <div className="flex justify-center">
            <Button
              onClick={runImageMetrics}
              disabled={!coverData || !stegoData}
              className="bg-[#6366f1] hover:bg-[#4f46e5] px-12 h-14 rounded-xl font-bold text-lg shadow-lg shadow-indigo-100"
            >
              Calculate Fidelity Metrics
            </Button>
          </div>

          {imageMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in zoom-in-95 duration-300">
              <MetricCard
                icon={<Activity className="w-5 h-5" />}
                value={imageMetrics.mse.toFixed(4)}
                label="MSE"
                color="#6366f1"
                quality={imageMetrics.mse < 1 ? { text: 'Imperceptible', ok: true } : { text: 'Detectable', ok: false }}
              />
              <MetricCard
                icon={<Activity className="w-5 h-5" />}
                value={fmtDb(imageMetrics.psnr)}
                label="PSNR"
                color="#10b981"
                quality={imageMetrics.psnr > 40 ? { text: 'Forensically Safe', ok: true } : { text: 'Risk of Detection', ok: false }}
              />
              <MetricCard
                icon={<Activity className="w-5 h-5" />}
                value={imageMetrics.ssim.toFixed(5)}
                label="SSIM"
                color="#f59e0b"
                quality={imageMetrics.ssim > 0.99 ? { text: 'Perceptually Transparent', ok: true } : { text: 'Perceptible Diff', ok: false }}
              />
              <MetricCard
                icon={<Activity className="w-5 h-5" />}
                value={fmtDb(imageMetrics.snr)}
                label="SNR"
                color="#ec4899"
                quality={imageMetrics.snr > 40 ? { text: 'Excellent', ok: true } : { text: 'Noticeable', ok: false }}
              />
            </div>
          )}

          <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <Info className="w-5 h-5 text-[#6366f1] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-900 block mb-1">Comparison Protocol:</strong>
              Both images must have identical dimensions. PSNR &gt; 40 dB and SSIM &gt; 0.99 indicate
              forensically safe, perceptually transparent steganographic embedding.
            </div>
          </div>
        </Card>
      )}

      {/* ── Audio Mode ──────────────────────────────────────────────────────── */}
      {mode === 'audio' && (
        <Card className="p-8 border-[#e1e4e8] shadow-sm bg-white space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#6366f1]" />

          <div className="flex flex-col md:flex-row gap-8">
            <AudioUploadZone
              label="Cover Audio (Original WAV)"
              file={coverAudioFile}
              url={coverAudioUrl}
              onChange={(e) => handleAudioUpload(e, 'cover')}
            />
            <div className="flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[#6366f1]/10 flex items-center justify-center text-[#6366f1]">
                <Music className="w-6 h-6" />
              </div>
            </div>
            <AudioUploadZone
              label="Stego Audio (Modified WAV)"
              file={stegoAudioFile}
              url={stegoAudioUrl}
              onChange={(e) => handleAudioUpload(e, 'stego')}
            />
          </div>

          <div className="flex justify-center">
            <Button
              onClick={runAudioMetrics}
              disabled={!coverAudioBuf || !stegoAudioBuf}
              className="bg-[#6366f1] hover:bg-[#4f46e5] px-12 h-14 rounded-xl font-bold text-lg shadow-lg shadow-indigo-100"
            >
              Calculate Audio SNR
            </Button>
          </div>

          {audioMetrics && (
            <div className="flex justify-center animate-in zoom-in-95 duration-300">
              <div className="w-64">
                <MetricCard
                  icon={<Activity className="w-5 h-5" />}
                  value={fmtDb(audioMetrics.snr)}
                  label="Signal-to-Noise Ratio"
                  color="#ec4899"
                  quality={
                    audioMetrics.snr > 40
                      ? { text: 'Inaudible Embedding', ok: true }
                      : { text: 'Audible Distortion', ok: false }
                  }
                />
              </div>
            </div>
          )}

          <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <Info className="w-5 h-5 text-[#6366f1] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-900 block mb-1">Audio Comparison Protocol:</strong>
              Upload the original (cover) and stego-encoded WAV files to compare them side-by-side
              using the built-in audio players. SNR quantifies how much noise the embedding introduced
              relative to the original signal power. Both files must be 16-bit PCM WAV format.
            </div>
          </div>
        </Card>
      )}

      {/* ── Metric Descriptions ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 px-1">
          Metric Reference Guide
        </h2>
        <div className="space-y-3">
          {METRIC_DESCRIPTIONS.map((m) => (
            <MetricDescription key={m.key} metric={m} />
          ))}
        </div>
      </div>
    </div>
  );
}
