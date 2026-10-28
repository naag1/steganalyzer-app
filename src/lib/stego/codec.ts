/**
 * Core Steganography Codec for StegAnalyzer (StegX Protocol)
 */

const STEGX_SIGNATURE = new TextEncoder().encode('StegX'); // 5 bytes

/**
 * Encodes a text message into image data using LSB steganography with StegX header.
 * Header layout: [Signature (5B)] [Length (4B big-endian)] [Message (NB)]
 */
export function encodeLSB(data: Uint8ClampedArray, message: string): Uint8ClampedArray {
  const messageBytes = new TextEncoder().encode(message);
  const totalLength = STEGX_SIGNATURE.length + 4 + messageBytes.length;

  if (totalLength * 8 > (data.length / 4) * 3) {
    throw new Error('Message too large for this image');
  }

  const buffer = new Uint8Array(totalLength);
  buffer.set(STEGX_SIGNATURE, 0);
  new DataView(buffer.buffer).setUint32(5, messageBytes.length, false); // big-endian
  buffer.set(messageBytes, 9);

  const newData = new Uint8ClampedArray(data);
  let bitIndex = 0;

  for (let i = 0; i < newData.length && bitIndex < buffer.length * 8; i += 4) {
    for (let j = 0; j < 3 && bitIndex < buffer.length * 8; j++) {
      const bit = (buffer[Math.floor(bitIndex / 8)] >> (7 - (bitIndex % 8))) & 1;
      newData[i + j] = (newData[i + j] & 0xFE) | bit;
      bitIndex++;
    }
  }

  return newData;
}

/**
 * Decodes a message from image data using StegX protocol.
 */
export function decodeLSB(data: Uint8ClampedArray): { message?: string; detected: boolean; type?: string } {
  // 1. Read 9-byte header (5B signature + 4B length = 72 bits)
  const headerBuffer = new Uint8Array(9);
  let bitIndex = 0;

  for (let i = 0; i < data.length && bitIndex < 72; i += 4) {
    for (let j = 0; j < 3 && bitIndex < 72; j++) {
      headerBuffer[Math.floor(bitIndex / 8)] |= ((data[i + j] & 1) << (7 - (bitIndex % 8)));
      bitIndex++;
    }
  }

  // 2. Verify StegX signature
  for (let i = 0; i < STEGX_SIGNATURE.length; i++) {
    if (headerBuffer[i] !== STEGX_SIGNATURE[i]) return { detected: false };
  }

  const messageLength = new DataView(headerBuffer.buffer).getUint32(5, false);

  if (messageLength === 0 || messageLength > (data.length / 4) * 3) {
    return { detected: false };
  }

  // 3. Extract message bits — skip the first 72 bits (header region)
  const messageBuffer = new Uint8Array(messageLength);
  let mBitIndex = 0;

  for (let i = 0; i < data.length && mBitIndex < messageLength * 8; i += 4) {
    for (let j = 0; j < 3 && mBitIndex < messageLength * 8; j++) {
      const globalBit = Math.floor(i / 4) * 3 + j;
      if (globalBit < 72) continue;

      messageBuffer[Math.floor(mBitIndex / 8)] |= ((data[i + j] & 1) << (7 - (mBitIndex % 8)));
      mBitIndex++;
    }
  }

  return {
    detected: true,
    message: new TextDecoder().decode(messageBuffer),
    type: 'LSB Text',
  };
}

/**
 * Image-in-Image Steganography (4-bit blending with 32-bit header).
 */
export function encodeImageInImage(
  coverData: Uint8ClampedArray,
  secretData: Uint8ClampedArray,
  secretWidth: number,
  secretHeight: number,
): Uint8ClampedArray {
  const newData = new Uint8ClampedArray(coverData);

  const coverRGBChannels = (coverData.length / 4) * 3;
  const secretRGBBytes   = secretWidth * secretHeight * 3;
  if (secretRGBBytes + 32 > coverRGBChannels) {
    throw new Error(
      `Secret image (${secretWidth}×${secretHeight}) is too large to fit inside the cover image. ` +
      `Try a smaller secret or a larger cover.`,
    );
  }

  const headerBytes = new Uint8Array(4);
  const hv = new DataView(headerBytes.buffer);
  hv.setUint16(0, secretWidth, false);
  hv.setUint16(2, secretHeight, false);

  let headerBitIndex = 0;
  for (let i = 0; i < newData.length && headerBitIndex < 32; i++) {
    if ((i + 1) % 4 === 0) continue;
    const bit = (headerBytes[Math.floor(headerBitIndex / 8)] >> (7 - (headerBitIndex % 8))) & 1;
    newData[i] = (newData[i] & 0xFE) | bit;
    headerBitIndex++;
  }

  let secretRGBIndex = 0;
  let coverRGBCount = 0;

  for (let i = 0; i < newData.length; i++) {
    if ((i + 1) % 4 === 0) continue;
    coverRGBCount++;
    if (coverRGBCount <= 32) continue;

    const secretPixel = Math.floor(secretRGBIndex / 3);
    const secretChannel = secretRGBIndex % 3;
    const secretByteIndex = secretPixel * 4 + secretChannel;
    if (secretByteIndex >= secretData.length) break;

    newData[i] = (coverData[i] & 0xF0) | (secretData[secretByteIndex] >> 4);
    secretRGBIndex++;
  }

  return newData;
}

export function decodeImageInImage(
  stegoData: Uint8ClampedArray,
): { data: Uint8ClampedArray; width: number; height: number } | null {
  const headerBytes = new Uint8Array(4);
  let headerBitIndex = 0;

  for (let i = 0; i < stegoData.length && headerBitIndex < 32; i++) {
    if ((i + 1) % 4 === 0) continue;
    headerBytes[Math.floor(headerBitIndex / 8)] |= ((stegoData[i] & 1) << (7 - (headerBitIndex % 8)));
    headerBitIndex++;
  }

  const hv = new DataView(headerBytes.buffer);
  const width = hv.getUint16(0, false);
  const height = hv.getUint16(2, false);

  if (width === 0 || height === 0 || width > 10000 || height > 10000) return null;

  const secretData = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < secretData.length; i += 4) secretData[i] = 255;

  let secretRGBIndex = 0;
  let coverRGBCount = 0;

  for (let i = 0; i < stegoData.length; i++) {
    if ((i + 1) % 4 === 0) continue;
    coverRGBCount++;
    if (coverRGBCount <= 32) continue;

    const secretPixel = Math.floor(secretRGBIndex / 3);
    const secretChannel = secretRGBIndex % 3;
    const secretByteIndex = secretPixel * 4 + secretChannel;
    if (secretByteIndex >= secretData.length) break;

    secretData[secretByteIndex] = (stegoData[i] & 0x0F) << 4;
    secretRGBIndex++;
  }

  return { data: secretData, width, height };
}

/**
 * Finds the actual byte offset of the WAV "data" chunk.
 * Standard PCM WAV has it at 44, but some encoders insert extra metadata
 * chunks (e.g. LIST/INFO, JUNK, bext) before the data — using hardcoded 44
 * in those cases reads into and corrupts the header during encoding, and
 * produces garbage audio on decode.
 *
 * This function walks the RIFF chunk list to find the real data offset.
 */
function findWavDataOffset(view: DataView): number {
  // Verify RIFF signature
  const riff = view.getUint32(0, false);
  if (riff !== 0x52494646) throw new Error('Not a valid RIFF/WAV file'); // 'RIFF'

  // Chunk search starts after the 12-byte RIFF header
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const chunkId   = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 0x64617461) { // 'data'
      return offset + 8; // data payload starts right after the 8-byte chunk header
    }

    // Move to next chunk (size is always even-padded in RIFF)
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  throw new Error('No "data" chunk found in WAV file');
}

/**
 * Audio Steganography (16-bit PCM WAV LSB).
 *
 * FIX: The original code hardcoded dataOffset = 44. Many real-world WAV files
 * (exported from Audacity, Logic, FL Studio, etc.) include extra RIFF chunks
 * before the data chunk, pushing the audio payload well past byte 44.
 * Writing LSBs into those metadata bytes corrupts the RIFF structure, making
 * the output unplayable in every media player.
 *
 * Fix: use findWavDataOffset() to locate the actual audio payload start.
 */
export async function encodeAudioLSB(audioBuffer: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const view = new DataView(audioBuffer);

  // Validate PCM format from the fmt chunk (always at offset 20/34 for standard WAV)
  if (view.getUint16(20, true) !== 1) throw new Error('Only PCM WAV supported');
  if (view.getUint16(34, true) !== 16) throw new Error('Only 16-bit depth supported');

  const dataOffset   = findWavDataOffset(view);
  const messageBytes = new TextEncoder().encode(message);
  const totalLength  = STEGX_SIGNATURE.length + 4 + messageBytes.length;

  const bufferToHide = new Uint8Array(totalLength);
  bufferToHide.set(STEGX_SIGNATURE, 0);
  new DataView(bufferToHide.buffer).setUint32(5, messageBytes.length, false);
  bufferToHide.set(messageBytes, 9);

  const samplesCount = (audioBuffer.byteLength - dataOffset) / 2;
  if (totalLength * 8 > samplesCount) {
    throw new Error('Audio too short for this message');
  }

  const resultBuffer = audioBuffer.slice(0);
  const resultView   = new DataView(resultBuffer);
  let bitIndex = 0;

  for (let i = 0; i < samplesCount && bitIndex < bufferToHide.length * 8; i++) {
    const bit    = (bufferToHide[Math.floor(bitIndex / 8)] >> (7 - (bitIndex % 8))) & 1;
    const offset = dataOffset + i * 2;
    // Use unsigned read → mask → write to avoid sign-extension issues
    const sample = (resultView.getUint16(offset, true) & 0xFFFE) | bit;
    resultView.setUint16(offset, sample, true);
    bitIndex++;
  }

  return resultBuffer;
}

/**
 * Decodes a message from a PCM WAV file using StegX protocol.
 *
 * FIX: Uses findWavDataOffset() for the same reason as encodeAudioLSB.
 * FIX: Uses getUint16 (unsigned) instead of getInt16 for consistent bit extraction.
 */
export function decodeAudioLSB(audioBuffer: ArrayBuffer): { message?: string; detected: boolean; type?: string } {
  const view        = new DataView(audioBuffer);
  const dataOffset  = findWavDataOffset(view);
  const samplesCount = (audioBuffer.byteLength - dataOffset) / 2;

  // 1. Read 9-byte header (72 bits)
  const headerBuffer = new Uint8Array(9);
  let bitIndex = 0;

  for (let i = 0; i < Math.min(samplesCount, 72); i++) {
    const bit = view.getUint16(dataOffset + i * 2, true) & 1;
    headerBuffer[Math.floor(bitIndex / 8)] |= (bit << (7 - (bitIndex % 8)));
    bitIndex++;
  }

  // 2. Verify signature
  for (let i = 0; i < STEGX_SIGNATURE.length; i++) {
    if (headerBuffer[i] !== STEGX_SIGNATURE[i]) return { detected: false };
  }

  const messageLength = new DataView(headerBuffer.buffer).getUint32(5, false);

  if (messageLength === 0 || messageLength * 8 > samplesCount - 72) {
    return { detected: false };
  }

  // 3. Extract message from samples[72..]
  const messageBuffer = new Uint8Array(messageLength);
  let mBitIndex = 0;

  for (let i = 72; i < samplesCount && mBitIndex < messageLength * 8; i++) {
    const bit = view.getUint16(dataOffset + i * 2, true) & 1;
    messageBuffer[Math.floor(mBitIndex / 8)] |= (bit << (7 - (mBitIndex % 8)));
    mBitIndex++;
  }

  return {
    detected: true,
    message: new TextDecoder().decode(messageBuffer),
    type: 'Audio LSB',
  };
}
