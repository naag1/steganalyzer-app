/**
 * Utility for calculating image fidelity metrics (PSNR, MSE, SSIM).
 */

export interface StegoMetrics {
  mse: number;
  psnr: number;
  ssim: number;
  bpp?: number;
}

/**
 * Calculates Mean Squared Error between two RGBA image buffers (alpha skipped).
 */
export function calculateMSE(original: Uint8ClampedArray, modified: Uint8ClampedArray): number {
  if (original.length !== modified.length) {
    throw new Error('Images must have the same dimensions');
  }

  let sum = 0;
  let count = 0;

  for (let i = 0; i < original.length; i++) {
    if ((i + 1) % 4 === 0) continue; // skip alpha
    const diff = original[i] - modified[i];
    sum += diff * diff;
    count++;
  }

  return count > 0 ? sum / count : 0;
}

/**
 * Calculates Peak Signal-to-Noise Ratio from an MSE value.
 * Returns Infinity when MSE is 0 (identical images).
 */
export function calculatePSNR(mse: number): number {
  if (mse === 0) return Infinity;
  return 10 * Math.log10((255 * 255) / mse);
}

/**
 * Calculates the Structural Similarity Index (SSIM) between two RGBA buffers.
 *
 * SSIM is computed in 8×8 windows across the image (luminance channel only,
 * derived as Y = 0.299R + 0.587G + 0.114B). The final score is the mean of
 * all window SSIM values, clamped to [−1, 1].
 *
 * Constants follow the standard Wang et al. (2004) paper:
 *   C1 = (K1·L)²  K1=0.01  L=255 → C1 ≈ 6.5025
 *   C2 = (K2·L)²  K2=0.03  L=255 → C2 ≈ 58.5225
 */
export function calculateSSIM(
  original: Uint8ClampedArray,
  modified: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  if (original.length !== modified.length) {
    throw new Error('Images must have the same dimensions for SSIM');
  }

  const C1 = 6.5025;   // (0.01 * 255)^2
  const C2 = 58.5225;  // (0.03 * 255)^2
  const WINDOW = 8;

  // Build luminance planes (skip alpha)
  const lumA = new Float32Array(width * height);
  const lumB = new Float32Array(width * height);

  for (let p = 0; p < width * height; p++) {
    const base = p * 4;
    lumA[p] = 0.299 * original[base] + 0.587 * original[base + 1] + 0.114 * original[base + 2];
    lumB[p] = 0.299 * modified[base] + 0.587 * modified[base + 1] + 0.114 * modified[base + 2];
  }

  let ssimSum = 0;
  let windowCount = 0;

  for (let y = 0; y + WINDOW <= height; y += WINDOW) {
    for (let x = 0; x + WINDOW <= width; x += WINDOW) {
      let muA = 0, muB = 0;
      const n = WINDOW * WINDOW;

      for (let wy = 0; wy < WINDOW; wy++) {
        for (let wx = 0; wx < WINDOW; wx++) {
          const idx = (y + wy) * width + (x + wx);
          muA += lumA[idx];
          muB += lumB[idx];
        }
      }
      muA /= n;
      muB /= n;

      let varA = 0, varB = 0, covAB = 0;
      for (let wy = 0; wy < WINDOW; wy++) {
        for (let wx = 0; wx < WINDOW; wx++) {
          const idx = (y + wy) * width + (x + wx);
          const da = lumA[idx] - muA;
          const db = lumB[idx] - muB;
          varA  += da * da;
          varB  += db * db;
          covAB += da * db;
        }
      }
      varA  /= (n - 1);
      varB  /= (n - 1);
      covAB /= (n - 1);

      const num   = (2 * muA * muB + C1) * (2 * covAB + C2);
      const denom = (muA * muA + muB * muB + C1) * (varA + varB + C2);

      ssimSum += num / denom;
      windowCount++;
    }
  }

  return windowCount > 0 ? Math.max(-1, Math.min(1, ssimSum / windowCount)) : 1;
}

export function calculateMetrics(
  original: Uint8ClampedArray,
  modified: Uint8ClampedArray,
  width: number,
  height: number,
): StegoMetrics {
  const mse  = calculateMSE(original, modified);
  const psnr = calculatePSNR(mse);
  const ssim = calculateSSIM(original, modified, width, height);
  return { mse, psnr, ssim };
}
