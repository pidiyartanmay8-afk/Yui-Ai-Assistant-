/**
 * Real-Time Face Capture, Storage (localStorage), and Visual Match Service
 */

const STORAGE_KEY_FACE_BASE64 = 'tanmay_saved_face';
const STORAGE_KEY_VERIFIED_FACE = 'tanmay_verified_face';
const STORAGE_KEY_FACE_GRID = 'tanmay_saved_face_grid';
const STORAGE_KEY_FACE_TIME = 'tanmay_saved_face_time';

export interface FaceMatchResult {
  hasStoredFace: boolean;
  matched: boolean;
  score: number; // 0 to 1 scale (1 = identical)
  confidencePercent: number; // 0% to 100%
  details: string;
  savedTimestamp?: string | null;
}

/**
 * Downsample base64 image into 32x32 luminance & color grid vector for comparison
 */
async function extractImageGridVector(base64Image: string, size = 32): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        // Draw downsampled image
        ctx.drawImage(img, 0, 0, size, size);
        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;

        // Vector length = size * size * 3 (R, G, B normalized 0..1) + 1 channel for luminance
        const vector = new Float32Array(size * size * 4);

        for (let i = 0; i < size * size; i++) {
          const r = data[i * 4] / 255;
          const g = data[i * 4 + 1] / 255;
          const b = data[i * 4 + 2] / 255;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b; // Standard CIE luminance

          vector[i * 4] = r;
          vector[i * 4 + 1] = g;
          vector[i * 4 + 2] = b;
          vector[i * 4 + 3] = lum;
        }

        resolve(vector);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
  });
}

/**
 * Calculates Cosine Similarity between two image feature vectors
 */
function calculateVectorSimilarity(vecA: Float32Array, vecB: Float32Array): number {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Saves Tanmay's face image snapshot permanently in browser localStorage
 */
export async function saveTanmayFaceSnapshot(base64Image: string): Promise<{
  success: boolean;
  timestamp: string;
  details: string;
}> {
  try {
    const fullDataUrl = base64Image.startsWith('data:')
      ? base64Image
      : `data:image/jpeg;base64,${base64Image}`;

    // Extract vector grid
    const vector = await extractImageGridVector(fullDataUrl, 32);
    const vectorArray = Array.from(vector);

    const nowStr = new Date().toLocaleString();

    localStorage.setItem(STORAGE_KEY_FACE_BASE64, fullDataUrl);
    localStorage.setItem(STORAGE_KEY_VERIFIED_FACE, fullDataUrl);
    localStorage.setItem(STORAGE_KEY_FACE_GRID, JSON.stringify(vectorArray));
    localStorage.setItem(STORAGE_KEY_FACE_TIME, nowStr);

    return {
      success: true,
      timestamp: nowStr,
      details: 'Tanmay face snapshot successfully recorded and saved in browser storage.',
    };
  } catch (err: any) {
    console.error('Failed to save face snapshot:', err);
    return {
      success: false,
      timestamp: new Date().toLocaleString(),
      details: `Error saving face snapshot: ${err?.message || 'Storage error'}`,
    };
  }
}

/**
 * Checks if a reference face is saved in browser localStorage
 */
export function hasSavedTanmayFace(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return Boolean(
    localStorage.getItem(STORAGE_KEY_VERIFIED_FACE) ||
      localStorage.getItem(STORAGE_KEY_FACE_BASE64)
  );
}

/**
 * Returns saved face details or null
 */
export function getSavedTanmayFaceInfo(): { base64: string; timestamp: string } | null {
  if (typeof localStorage === 'undefined') return null;
  const base64 =
    localStorage.getItem(STORAGE_KEY_VERIFIED_FACE) ||
    localStorage.getItem(STORAGE_KEY_FACE_BASE64);
  const timestamp = localStorage.getItem(STORAGE_KEY_FACE_TIME) || '';
  if (!base64) return null;
  return { base64, timestamp };
}

/**
 * Compares live video frame Base64 image against saved Tanmay face in localStorage
 */
export async function compareLiveFrameToStoredFace(liveBase64: string): Promise<FaceMatchResult> {
  if (!hasSavedTanmayFace()) {
    return {
      hasStoredFace: false,
      matched: false,
      score: 0,
      confidencePercent: 0,
      details: 'No reference face saved in localStorage for Tanmay yet.',
    };
  }

  try {
    const storedGridJson = localStorage.getItem(STORAGE_KEY_FACE_GRID);
    const savedTimestamp = localStorage.getItem(STORAGE_KEY_FACE_TIME);
    const storedBase64 =
      localStorage.getItem(STORAGE_KEY_VERIFIED_FACE) ||
      localStorage.getItem(STORAGE_KEY_FACE_BASE64);

    if (!storedGridJson && !storedBase64) {
      return {
        hasStoredFace: false,
        matched: false,
        score: 0,
        confidencePercent: 0,
        details: 'Stored face image missing.',
        savedTimestamp,
      };
    }

    let storedVector: Float32Array;
    if (storedGridJson) {
      const storedVectorArray: number[] = JSON.parse(storedGridJson);
      storedVector = new Float32Array(storedVectorArray);
    } else if (storedBase64) {
      storedVector = await extractImageGridVector(storedBase64, 32);
    } else {
      return {
        hasStoredFace: false,
        matched: false,
        score: 0,
        confidencePercent: 0,
        details: 'Unable to load stored face vector.',
      };
    }

    const fullLiveUrl = liveBase64.startsWith('data:')
      ? liveBase64
      : `data:image/jpeg;base64,${liveBase64}`;

    const liveVector = await extractImageGridVector(fullLiveUrl, 32);

    const similarity = calculateVectorSimilarity(storedVector, liveVector);
    const confidencePercent = Math.round(similarity * 100);

    // Threshold for facial visual structure match (e.g. >= 70% similarity)
    const isMatched = similarity >= 0.70;

    return {
      hasStoredFace: true,
      matched: isMatched,
      score: Math.min(1, Math.max(0, similarity)),
      confidencePercent,
      details: isMatched
        ? `Visual face features matched saved Tanmay face with ${confidencePercent}% structural confidence.`
        : `Visual face features did not match stored face. Similarity score: ${confidencePercent}% (threshold: 70%).`,
      savedTimestamp,
    };
  } catch (err: any) {
    console.warn('Face match comparison warning:', err);
    return {
      hasStoredFace: true,
      matched: false,
      score: 0,
      confidencePercent: 0,
      details: `Failed to compare live frame with stored face: ${err?.message || 'Comparison error'}`,
    };
  }
}

/**
 * Accesses device camera via navigator.mediaDevices.getUserMedia(), captures a single snapshot frame onto a <canvas>, and returns Base64 data URL.
 */
export async function captureLiveCameraSnapshot(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    console.warn('getUserMedia is not supported in this environment');
    return null;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    });
    const video = document.createElement('video');
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    video.srcObject = stream;
    await video.play();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    stream.getTracks().forEach((track) => track.stop());
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return dataUrl;
  } catch (err) {
    console.warn('Error capturing camera snapshot:', err);
    return null;
  }
}

/**
 * Standalone registration: captures a live camera frame and permanently stores it in localStorage under 'tanmay_verified_face'
 */
export async function registerTanmayFaceFromCamera(): Promise<{
  success: boolean;
  timestamp: string;
  details: string;
  base64?: string;
}> {
  const snapshot = await captureLiveCameraSnapshot();
  if (!snapshot) {
    return {
      success: false,
      timestamp: new Date().toLocaleString(),
      details: 'Could not capture camera frame. Please ensure camera permissions are allowed.',
    };
  }
  const result = await saveTanmayFaceSnapshot(snapshot);
  return {
    ...result,
    base64: snapshot,
  };
}

/**
 * Standalone startup/real-time verification: captures a live camera frame and checks against 'tanmay_verified_face' in localStorage
 */
export async function verifyTanmayFaceFromCamera(): Promise<FaceMatchResult> {
  if (!hasSavedTanmayFace()) {
    return {
      hasStoredFace: false,
      matched: false,
      score: 0,
      confidencePercent: 0,
      details: 'No reference face saved in localStorage for Tanmay yet.',
    };
  }
  const snapshot = await captureLiveCameraSnapshot();
  if (!snapshot) {
    return {
      hasStoredFace: true,
      matched: false,
      score: 0,
      confidencePercent: 0,
      details: 'Could not access camera for startup face verification.',
    };
  }
  return compareLiveFrameToStoredFace(snapshot);
}
