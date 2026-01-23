/**
 * Core Steganography Codec for StegAnalyzer (StegX Protocol)
 */

const STEGX_SIGNATURE = new TextEncoder().encode('StegX'); // 5 bytes

/**
 * Encodes a text message into image data using LSB steganography with StegX header.
 */
export function encodeLSB(data: Uint8ClampedArray, message: string): Uint8ClampedArray {
  const messageBytes = new TextEncoder().encode(message);
  const totalLength = STEGX_SIGNATURE.length + 4 + messageBytes.length; // Signature + 32-bit length + message

  if (totalLength * 8 > (data.length / 4) * 3) {
    throw new Error('Message too large for this image');
  }

  // Prepare buffer: [Signature (5B)][Length (4B)][Message (NB)]
  const buffer = new Uint8Array(totalLength);
  buffer.set(STEGX_SIGNATURE, 0);
  const lengthView = new DataView(buffer.buffer);
  lengthView.setUint32(5, messageBytes.length, false); // Big endian
  buffer.set(messageBytes, 9);

  const newData = new Uint8ClampedArray(data);
  let bitIndex = 0;

  for (let i = 0; i < newData.length && bitIndex < buffer.length * 8; i += 4) {
    for (let j = 0; j < 3 && bitIndex < buffer.length * 8; j++) {
      const byteIndex = Math.floor(bitIndex / 8);
      const bitInByte = 7 - (bitIndex % 8);
      const bit = (buffer[byteIndex] >> bitInByte) & 1;
      
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
  // Extract first 9 bytes to check signature and length
  const headerBuffer = new Uint8Array(9);
  let bitIndex = 0;

  for (let i = 0; i < data.length && bitIndex < 9 * 8; i += 4) {
    for (let j = 0; j < 3 && bitIndex < 9 * 8; j++) {
      const byteIndex = Math.floor(bitIndex / 8);
      const bitInByte = 7 - (bitIndex % 8);
      const bit = (data[i + j] & 1);
      
      headerBuffer[byteIndex] |= (bit << bitInByte);
      bitIndex++;
    }
  }

  // Check signature
  for (let i = 0; i < STEGX_SIGNATURE.length; i++) {
    if (headerBuffer[i] !== STEGX_SIGNATURE[i]) {
      return { detected: false };
    }
  }

  const lengthView = new DataView(headerBuffer.buffer);
  const messageLength = lengthView.getUint32(5, false);

  if (messageLength > (data.length / 4) * 3) {
    return { detected: false }; // Likely false positive or corrupted
  }

  // Extract message
  const messageBuffer = new Uint8Array(messageLength);
  bitIndex = 9 * 8; // Start after header

  for (let i = 0; i < data.length && (bitIndex - 72) < messageLength * 8; i += 4) {
    for (let j = 0; j < 3 && (bitIndex - 72) < messageLength * 8; j++) {
      if (bitIndex < 72) {
        bitIndex++;
        continue;
      }
      const mBitIndex = bitIndex - 72;
      const byteIndex = Math.floor(mBitIndex / 8);
      const bitInByte = 7 - (mBitIndex % 8);
      const bit = (data[i + j] & 1);
      
      messageBuffer[byteIndex] |= (bit << bitInByte);
      bitIndex++;
    }
  }

  return { 
    detected: true, 
    message: new TextDecoder().decode(messageBuffer),
    type: 'LSB Text'
  };
}

/**
 * Image-in-Image Steganography (4-bit blending with StegX header)
 * Header: 16-bit Width, 16-bit Height (32 bits total)
 */
export function encodeImageInImage(coverData: Uint8ClampedArray, secretData: Uint8ClampedArray, secretWidth: number, secretHeight: number): Uint8ClampedArray {
  const newData = new Uint8ClampedArray(coverData);
  
  // Embed dimensions in first 32 channels (1 bit each for header)
  const header = new Uint32Array(1);
  const view = new DataView(header.buffer);
  view.setUint16(0, secretWidth, false);
  view.setUint16(2, secretHeight, false);
  
  const headerBits = header[0];
  
  // Header embedding (LSB 1-bit)
  for (let i = 0; i < 32; i++) {
    const bit = (headerBits >> (31 - i)) & 1;
    newData[i] = (newData[i] & 0xFE) | bit;
  }

  // Content embedding (4-bit LSB substitution) starting after header
  // Each channel can store 4 bits. 
  let secretChannelIndex = 0;
  for (let i = 32; i < newData.length && secretChannelIndex < secretData.length; i++) {
    if ((i + 1) % 4 === 0) {
      newData[i] = coverData[i]; // Keep alpha
      continue;
    }
    // Take top 4 bits of secret and put in bottom 4 bits of cover
    newData[i] = (coverData[i] & 0xF0) | (secretData[secretChannelIndex] >> 4);
    secretChannelIndex++;
  }
  
  return newData;
}

export function decodeImageInImage(stegoData: Uint8ClampedArray): { data: Uint8ClampedArray, width: number, height: number } | null {
  // Extract dimensions (first 32 bits)
  let headerBits = 0;
  for (let i = 0; i < 32; i++) {
    const bit = stegoData[i] & 1;
    headerBits = (headerBits << 1) | bit;
  }

  const width = (headerBits >> 16) & 0xFFFF;
  const height = headerBits & 0xFFFF;

  if (width === 0 || height === 0 || width > 10000 || height > 10000) {
    return null;
  }

  const secretData = new Uint8ClampedArray(width * height * 4);
  let secretChannelIndex = 0;
  
  for (let i = 32; i < stegoData.length && secretChannelIndex < secretData.length; i++) {
    if ((i + 1) % 4 === 0) {
      secretData[secretChannelIndex] = 255; // Full alpha
      secretChannelIndex++;
      continue;
    }
    // Extract lower 4 bits and shift left
    secretData[secretChannelIndex] = (stegoData[i] & 0x0F) << 4;
    secretChannelIndex++;
  }

  return { data: secretData, width, height };
}

/**
 * Audio Steganography (16-bit PCM LSB)
 */
export async function encodeAudioLSB(audioBuffer: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const view = new DataView(audioBuffer);
  // Simple WAV check
  const format = view.getUint16(20, true);
  if (format !== 1) throw new Error('Only PCM WAV supported');
  
  const channels = view.getUint16(22, true);
  const bitDepth = view.getUint16(34, true);
  if (bitDepth !== 16) throw new Error('Only 16-bit depth supported');

  const dataOffset = 44; // Standard WAV data offset
  const messageBytes = new TextEncoder().encode(message);
  const totalLength = STEGX_SIGNATURE.length + 4 + messageBytes.length;

  const bufferToHide = new Uint8Array(totalLength);
  bufferToHide.set(STEGX_SIGNATURE, 0);
  new DataView(bufferToHide.buffer).setUint32(5, messageBytes.length, false);
  bufferToHide.set(messageBytes, 9);

  const samplesCount = (audioBuffer.byteLength - dataOffset) / 2;
  if (totalLength * 8 > samplesCount) {
    throw new Error('Audio too short for this message');
  }

  const resultBuffer = audioBuffer.slice(0);
  const resultView = new DataView(resultBuffer);
  let bitIndex = 0;

  for (let i = 0; i < samplesCount && bitIndex < bufferToHide.length * 8; i++) {
    const byteIndex = Math.floor(bitIndex / 8);
    const bitInByte = 7 - (bitIndex % 8);
    const bit = (bufferToHide[byteIndex] >> bitInByte) & 1;

    const offset = dataOffset + i * 2;
    let sample = resultView.getInt16(offset, true);
    sample = (sample & 0xFFFE) | bit;
    resultView.setInt16(offset, sample, true);
    bitIndex++;
  }

  return resultBuffer;
}

export function decodeAudioLSB(audioBuffer: ArrayBuffer): { message?: string; detected: boolean; type?: string } {
  const view = new DataView(audioBuffer);
  const dataOffset = 44;
  const samplesCount = (audioBuffer.byteLength - dataOffset) / 2;

  const headerBuffer = new Uint8Array(9);
  let bitIndex = 0;

  for (let i = 0; i < Math.min(samplesCount, 9 * 8); i++) {
    const offset = dataOffset + i * 2;
    const sample = view.getInt16(offset, true);
    const bit = sample & 1;

    const byteIndex = Math.floor(bitIndex / 8);
    const bitInByte = 7 - (bitIndex % 8);
    headerBuffer[byteIndex] |= (bit << bitInByte);
    bitIndex++;
  }

  // Check signature
  for (let i = 0; i < STEGX_SIGNATURE.length; i++) {
    if (headerBuffer[i] !== STEGX_SIGNATURE[i]) {
      return { detected: false };
    }
  }

  const messageLength = new DataView(headerBuffer.buffer).getUint32(5, false);
  const messageBuffer = new Uint8Array(messageLength);
  bitIndex = 0;

  for (let i = 72; i < samplesCount && bitIndex < messageLength * 8; i++) {
    const offset = dataOffset + i * 2;
    const sample = view.getInt16(offset, true);
    const bit = sample & 1;

    const byteIndex = Math.floor(bitIndex / 8);
    const bitInByte = 7 - (bitIndex % 8);
    messageBuffer[byteIndex] |= (bit << bitInByte);
    bitIndex++;
  }

  return {
    detected: true,
    message: new TextDecoder().decode(messageBuffer),
    type: 'Audio LSB'
  };
}
