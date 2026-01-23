export interface StegoMetrics {
  mse: number;
  psnr: number;
  bpp: number;
}

/**
 * Calculates the Mean Squared Error (MSE) between two images.
 * @param original Data of the original (cover) image
 * @param modified Data of the modified (stego) image
 */
export function calculateMSE(original: Uint8ClampedArray, modified: Uint8ClampedArray): number {
  if (original.length !== modified.length) {
    throw new Error('Images must have the same dimensions');
  }

  let sum = 0;
  for (let i = 0; i < original.length; i++) {
    // Only compare RGB, ignore Alpha channel if needed, 
    // but usually we compare all channels present.
    const diff = original[i] - modified[i];
    sum += diff * diff;
  }

  return sum / (original.length / 4 * 3); // Average over RGB pixels (ignoring alpha for MSE usually)
}

/**
 * Calculates the Peak Signal-to-Noise Ratio (PSNR) based on MSE.
 * @param mse Mean Squared Error
 */
export function calculatePSNR(mse: number): number {
  if (mse === 0) return Infinity;
  const maxI = 255;
  return 10 * Math.log10((maxI * maxI) / mse);
}

/**
 * Calculates Bits Per Pixel (BPP) or embedding rate.
 * @param payloadSize Size of the hidden payload in bits
 * @param totalPixels Total number of pixels in the image
 */
export function calculateBPP(payloadSize: number, totalPixels: number): number {
  return payloadSize / totalPixels;
}
