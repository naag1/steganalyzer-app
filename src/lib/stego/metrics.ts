/**
 * Utility for calculating image fidelity metrics (PSNR, MSE).
 */

export interface StegoMetrics {
  mse: number;
  psnr: number;
  bpp?: number;
}

export function calculateMSE(original: Uint8ClampedArray, modified: Uint8ClampedArray): number {
  if (original.length !== modified.length) {
    throw new Error('Images must have the same dimensions');
  }

  let sum = 0;
  for (let i = 0; i < original.length; i++) {
    if ((i + 1) % 4 === 0) continue; // Skip alpha
    const diff = original[i] - modified[i];
    sum += diff * diff;
  }

  return sum / (original.length / 4 * 3);
}

export function calculatePSNR(mse: number): number {
  if (mse === 0) return Infinity;
  const maxI = 255;
  return 10 * Math.log10((maxI * maxI) / mse);
}

export function calculateMetrics(original: Uint8ClampedArray, modified: Uint8ClampedArray): StegoMetrics {
  const mse = calculateMSE(original, modified);
  const psnr = calculatePSNR(mse);
  return { mse, psnr };
}
