/**
 * Bulls Traking — Secure Image Upload Processor & Validator
 * Enforces magic byte signatures, rejects unsafe SVGs/scripts, and caps payload sizes.
 */

const MAX_LOGO_BYTES = 2 * 1024 * 1024;    // 2MB for logos
const MAX_BANNER_BYTES = 4 * 1024 * 1024;  // 4MB for banners

/**
 * Detect image format from binary magic bytes (first few bytes of the buffer)
 */
function detectImageFormat(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { format: 'png', ext: 'png', mime: 'image/png' };
  }

  // JPEG / JPG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { format: 'jpg', ext: 'jpg', mime: 'image/jpeg' };
  }

  // GIF: 47 49 46 38 ('GIF8')
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { format: 'gif', ext: 'gif', mime: 'image/gif' };
  }

  // WebP: 'RIFF' .... 'WEBP'
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // RIFF
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50   // WEBP
  ) {
    return { format: 'webp', ext: 'webp', mime: 'image/webp' };
  }

  return null;
}

/**
 * Validates and decodes base64 image data URL
 */
function validateAndDecodeImage(imageBase64, { isBanner = false } = {}) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new Error('Image data must be a non-empty string.');
  }

  const trimmed = imageBase64.trim();
  const maxBytes = isBanner ? MAX_BANNER_BYTES : MAX_LOGO_BYTES;
  const maxLabel = isBanner ? '4MB for banners' : '2MB for logos';

  // 1. Check data URL MIME type prefix if present
  let base64Content = trimmed;
  let declaredMime = null;
  const dataUrlMatch = trimmed.match(/^data:([a-zA-Z0-9+\/.-]+);base64,(.+)$/s);

  if (dataUrlMatch) {
    declaredMime = dataUrlMatch[1].toLowerCase();
    base64Content = dataUrlMatch[2];

    // Explicitly reject SVG or XML or HTML MIME types
    if (declaredMime.includes('svg') || declaredMime.includes('xml') || declaredMime.includes('html')) {
      throw new Error('SVG, XML, and HTML uploads are not permitted for security reasons. Allowed formats: PNG, JPEG, WebP, GIF.');
    }
  }

  // 2. Decode base64 bytes
  let buffer;
  try {
    buffer = Buffer.from(base64Content.replace(/\s+/g, ''), 'base64');
  } catch (err) {
    throw new Error('Malformed base64 image payload.');
  }

  if (!buffer || buffer.length === 0) {
    throw new Error('Decoded image buffer is empty.');
  }

  // 3. Size limit check
  if (buffer.length > maxBytes) {
    throw new Error(`Image size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds platform limit of ${maxLabel}.`);
  }

  // 4. Magic bytes validation (Strict raster format enforcement)
  const detected = detectImageFormat(buffer);
  if (!detected) {
    throw new Error('Invalid or unsupported image file signature. Allowed formats: PNG, JPEG, WebP, GIF.');
  }

  // 5. Scan buffer for malicious script tags / active markup (polyglot / injection prevention)
  const headerSlice = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8', 0).toLowerCase();
  if (
    headerSlice.includes('<script') ||
    headerSlice.includes('javascript:') ||
    headerSlice.includes('<svg') ||
    headerSlice.includes('onload=') ||
    headerSlice.includes('onerror=') ||
    headerSlice.includes('<iframe')
  ) {
    throw new Error('Active markup or embedded script detected in image payload.');
  }

  return {
    buffer,
    format: detected.format,
    ext: detected.ext,
    mimeType: detected.mime,
    size: buffer.length
  };
}

module.exports = {
  detectImageFormat,
  validateAndDecodeImage,
  MAX_LOGO_BYTES,
  MAX_BANNER_BYTES
};
