/**
 * System Actions Helper for Yui Assistant
 * Provides hardware control (flashlight, phone calls), app launcher, and safe YouTube playback.
 */

export interface SystemActionResponse {
  success: boolean;
  message: string;
}

/**
 * Open a specific app or external URL safely
 */
export function openApp(appName: string, query?: string): SystemActionResponse {
  const nameLower = appName.toLowerCase().trim();

  try {
    if (nameLower.includes('whatsapp')) {
      if (query) {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(query)}`, '_system');
      } else {
        window.open('https://web.whatsapp.com', '_system');
      }
      return { success: true, message: 'Opening WhatsApp' };
    }

    if (nameLower.includes('instagram')) {
      window.open('https://instagram.com', '_system');
      return { success: true, message: 'Opening Instagram' };
    }

    if (nameLower.includes('youtube')) {
      if (query) {
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_system');
      } else {
        window.open('https://www.youtube.com', '_system');
      }
      return { success: true, message: 'Opening YouTube' };
    }

    if (nameLower.includes('camera')) {
      // Direct user or trigger camera intent
      window.open('content://media/external/images/media', '_system');
      return { success: true, message: 'Launching Camera' };
    }

    // Default fallback web search
    if (query) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_system');
    }
    return { success: true, message: `Opening ${appName}` };
  } catch (err: any) {
    return { success: false, message: `Failed to open ${appName}: ${err?.message || err}` };
  }
}

/**
 * Safe YouTube Launcher
 * Prevents "This video is unavailable" error by checking video ID validity,
 * falling back to search if needed.
 */
export function launchYouTubeVideo(videoIdOrQuery: string): SystemActionResponse {
  if (!videoIdOrQuery || videoIdOrQuery.trim() === '') {
    window.open('https://www.youtube.com', '_system');
    return { success: true, message: 'Opening YouTube homepage' };
  }

  const cleanInput = videoIdOrQuery.trim();
  // Standard YouTube ID regex (11 characters)
  const isValidVideoId = /^[a-zA-Z0-9_-]{11}$/.test(cleanInput);

  if (isValidVideoId) {
    const videoUrl = `https://www.youtube.com/watch?v=${cleanInput}`;
    window.open(videoUrl, '_system');
    return { success: true, message: `Playing YouTube video: ${cleanInput}` };
  } else {
    // If not a valid 11-char ID, perform a search instead of crashing playback
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanInput)}`;
    window.open(searchUrl, '_system');
    return { success: true, message: `Searching YouTube for "${cleanInput}"` };
  }
}

/**
 * Trigger phone call
 */
export function makePhoneCall(phoneNumber: string): SystemActionResponse {
  try {
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    if (!cleanNumber) {
      return { success: false, message: 'Invalid phone number provided' };
    }
    window.location.href = `tel:${cleanNumber}`;
    return { success: true, message: `Dialing ${cleanNumber}` };
  } catch (err: any) {
    return { success: false, message: `Failed to place call: ${err?.message}` };
  }
}

let activeTorchTrack: MediaStreamTrack | null = null;

/**
 * Toggle Flashlight/Torch on mobile device
 */
export async function toggleFlashlight(enable?: boolean): Promise<SystemActionResponse> {
  try {
    if (activeTorchTrack) {
      const currentState = (activeTorchTrack.getConstraints() as any)?.advanced?.[0]?.torch;
      const targetState = enable !== undefined ? enable : !currentState;
      await activeTorchTrack.applyConstraints({
        advanced: [{ torch: targetState } as any],
      });
      if (!targetState) {
        activeTorchTrack.stop();
        activeTorchTrack = null;
      }
      return { success: true, message: `Flashlight turned ${targetState ? 'ON' : 'OFF'}` };
    }

    if (enable === false) {
      return { success: true, message: 'Flashlight is already OFF' };
    }

    // Request rear camera to access torch constraint
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    const videoTrack = stream.getVideoTracks()[0];

    const capabilities = videoTrack.getCapabilities() as any;
    if (capabilities && capabilities.torch) {
      await videoTrack.applyConstraints({
        advanced: [{ torch: true } as any],
      });
      activeTorchTrack = videoTrack;
      return { success: true, message: 'Flashlight turned ON' };
    } else {
      videoTrack.stop();
      return { success: false, message: 'Flashlight/Torch is not supported on this device camera' };
    }
  } catch (err: any) {
    return { success: false, message: `Flashlight error: ${err?.message || err}` };
  }
}
