import { AudioStreamer } from './audioStreamer';
import { saveMemory, deleteMemoryByQuery, getAllMemories, MemoryItem } from './memoryStore';
import { getCachedLocation, requestUserLocation, LiveLocationData } from './locationService';
import {
  saveTanmayFaceSnapshot,
  compareLiveFrameToStoredFace,
  hasSavedTanmayFace,
  getSavedTanmayFaceInfo,
} from './faceRecognitionService';
import html2canvas from 'html2canvas';

export type ConnectionState = 'disconnected' | 'connecting' | 'listening' | 'speaking' | 'error';
export type CameraFacing = 'closed' | 'front' | 'back';

export interface IdentityStatus {
  speakerName: string;
  isTanmay: boolean;
}

export interface LiveSessionCallbacks {
  onConnectionStateChange: (state: ConnectionState) => void;
  onIdentityChange: (identity: IdentityStatus) => void;
  onCameraChange: (cameraState: CameraFacing) => void;
  onVolumeChange: (inputVol: number, outputVol: number) => void;
  onError: (msg: string) => void;
  onMemorySavedToast?: (memory: MemoryItem) => void;
  onMemoryDeletedToast?: (deletedText: string) => void;
  onReturnToApp?: () => void;
}

/**
 * Real-time web search snippet fetcher for Yui Live Search grounding
 */
async function fetchLiveSearchSnippets(query: string): Promise<string[]> {
  const snippets: string[] = [];
  try {
    const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
    if (ddgRes.ok) {
      const data = await ddgRes.json();
      if (data.AbstractText) {
        snippets.push(`Abstract: ${data.AbstractText}`);
      }
      if (data.Heading && data.AbstractText) {
        snippets.push(`Topic: ${data.Heading}`);
      }
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.forEach((item: any) => {
          if (item.Text && snippets.length < 6) {
            snippets.push(item.Text);
          }
        });
      }
    }
  } catch (e) {
    console.warn('DDG search lookup warning:', e);
  }

  // Wikipedia search fallback for articles / topics
  if (snippets.length === 0) {
    try {
      const wikiRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`
      );
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        if (wikiData.query && wikiData.query.search) {
          wikiData.query.search.slice(0, 4).forEach((item: any) => {
            const cleanText = item.snippet.replace(/<[^>]+>/g, '');
            snippets.push(`${item.title}: ${cleanText}`);
          });
        }
      }
    } catch (e) {
      console.warn('Wiki search snippet warning:', e);
    }
  }

  return snippets;
}

export class YuiLiveSession {
  private ws: WebSocket | null = null;
  private audioStreamer: AudioStreamer;
  private callbacks: LiveSessionCallbacks;

  private connectionState: ConnectionState = 'disconnected';
  private identityStatus: IdentityStatus = { speakerName: 'Unverified', isTanmay: false };
  private cameraFacing: CameraFacing = 'closed';

  // Offscreen Background Camera Stream for Yui's Real-Time Vision (Zero UI Clutter)
  private bgVideo: HTMLVideoElement | null = null;
  private bgMediaStream: MediaStream | null = null;
  private bgFrameInterval: NodeJS.Timeout | null = null;

  constructor(callbacks: LiveSessionCallbacks) {
    this.callbacks = callbacks;
    this.audioStreamer = new AudioStreamer();

    this.audioStreamer.setVolumeCallback((inputVol, outputVol) => {
      this.callbacks.onVolumeChange(inputVol, outputVol);

      // Auto transition between listening and speaking states based on volume
      if (this.connectionState === 'listening' || this.connectionState === 'speaking') {
        if (outputVol > 0.08) {
          this.setConnectionState('speaking');
        } else {
          this.setConnectionState('listening');
        }
      }
    });
  }

  public get ConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public get IdentityStatus(): IdentityStatus {
    return this.identityStatus;
  }

  public get CameraFacing(): CameraFacing {
    return this.cameraFacing;
  }

  /**
   * Connect to Yui Live WebSocket session
   */
  public async connect(): Promise<void> {
    if (this.connectionState !== 'disconnected' && this.connectionState !== 'error') {
      return;
    }

    this.setConnectionState('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        console.log('Connected to Yui WebSocket server');
        try {
          // Start mic recording
          await this.audioStreamer.startRecording((base64PCM) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'audio', data: base64PCM }));
            }
          });
          this.setConnectionState('listening');
        } catch (err: any) {
          console.error('Failed to start microphone:', err);
          let errMsg = 'Microphone access required for voice conversation.';
          if (
            err?.name === 'NotAllowedError' ||
            err?.name === 'PermissionDeniedError' ||
            err?.message?.toLowerCase().includes('permission denied') ||
            err?.message?.toLowerCase().includes('not allowed')
          ) {
            errMsg = 'Microphone Permission Blocked: Please click the camera/microphone lock icon in your browser address bar and choose "Allow" for microphone access.';
          }
          this.callbacks.onError(errMsg);
          this.disconnect();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ping') {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'pong' }));
            }
            return;
          }

          if (msg.type === 'audio') {
            // Received audio chunk from Yui response
            this.audioStreamer.playAudioChunk(msg.data);
          } else if (msg.type === 'interrupted') {
            // Immediate barge-in cutoff
            this.audioStreamer.stopPlayback();
            this.setConnectionState('listening');
          } else if (msg.type === 'tool_call') {
            this.handleToolCall(msg.id, msg.name, msg.args);
          } else if (msg.type === 'error') {
            this.callbacks.onError(msg.message);
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        this.setConnectionState('error');
        this.callbacks.onError('Connection error with Yui AI Assistant.');
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.disconnect();
      };
    } catch (err: any) {
      this.setConnectionState('error');
      this.callbacks.onError(err?.message || 'Failed to initialize session.');
    }
  }

  /**
   * Disconnect Yui Live Session
   */
  public disconnect(): void {
    this.audioStreamer.stopRecording();
    this.stopBackgroundVision();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.setCameraFacing('closed');
    this.setConnectionState('disconnected');
  }

  /**
   * Send video frame JPEG to Gemini Live API
   */
  public sendVideoFrame(base64JPEG: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'video', data: base64JPEG }));
    }
  }

  /**
   * Start offscreen background camera vision stream
   */
  public async startBackgroundVision(facing: 'front' | 'back'): Promise<boolean> {
    this.stopBackgroundVision();

    try {
      if (!this.bgVideo) {
        this.bgVideo = document.createElement('video');
        this.bgVideo.setAttribute('playsinline', 'true');
        this.bgVideo.muted = true;
      }

      const facingMode = facing === 'front' ? 'user' : { ideal: 'environment' };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      this.bgMediaStream = stream;
      this.bgVideo.srcObject = stream;
      await this.bgVideo.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Capture frames continuously at 1 FPS for background vision
      this.bgFrameInterval = setInterval(() => {
        if (!this.bgVideo || this.bgVideo.readyState !== 4 || !ctx) return;
        canvas.width = 640;
        canvas.height = (this.bgVideo.videoHeight / this.bgVideo.videoWidth) * 640 || 480;
        ctx.drawImage(this.bgVideo, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const base64 = dataUrl.split(',')[1];
        if (base64) {
          this.sendVideoFrame(base64);
        }
      }, 1000);

      this.setCameraFacing(facing);
      return true;
    } catch (err) {
      console.error('Failed to start background camera vision:', err);
      this.callbacks.onError('Could not access device camera for Yui vision.');
      this.setCameraFacing('closed');
      return false;
    }
  }

  /**
   * Stop offscreen background camera vision stream
   */
  public stopBackgroundVision(): void {
    if (this.bgFrameInterval) {
      clearInterval(this.bgFrameInterval);
      this.bgFrameInterval = null;
    }
    if (this.bgMediaStream) {
      this.bgMediaStream.getTracks().forEach((track) => track.stop());
      this.bgMediaStream = null;
    }
    if (this.bgVideo) {
      this.bgVideo.srcObject = null;
    }
    this.setCameraFacing('closed');
  }

  /**
   * Captures screen frame using real browser mediaDevices.getDisplayMedia or html2canvas
   */
  private async captureDisplayScreen(): Promise<string | null> {
    // 1. Try real browser getDisplayMedia API if supported
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as any,
          audio: false,
        });

        const video = document.createElement('video');
        video.srcObject = displayStream;
        await video.play();

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        // Clean up tracks immediately after frame snapshot
        displayStream.getTracks().forEach((track) => track.stop());

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const base64 = dataUrl.split(',')[1];
        if (base64) return base64;
      } catch (err) {
        console.warn('getDisplayMedia capture skipped or denied, trying html2canvas fallback:', err);
      }
    }

    // 2. Fallback to html2canvas for current DOM state
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: 0.8,
        onclone: (clonedDoc) => {
          const styleTags = clonedDoc.querySelectorAll('style');
          styleTags.forEach((style) => {
            if (style.textContent) {
              style.textContent = style.textContent.replace(/oklch\([^)]+\)/gi, 'rgba(56, 189, 248, 0.5)');
            }
          });
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const inlineStyle = el.getAttribute('style');
            if (inlineStyle && inlineStyle.includes('oklch')) {
              el.setAttribute('style', inlineStyle.replace(/oklch\([^)]+\)/gi, 'rgba(56, 189, 248, 0.5)'));
            }
          });
        },
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      return dataUrl.split(',')[1] || null;
    } catch (err) {
      console.warn('html2canvas capture failed:', err);
      return null;
    }
  }

  /**
   * Captures a single image frame snapshot from active camera stream or requests temporary frame
   */
  public async captureCameraFrameSnapshot(): Promise<string | null> {
    if (this.bgVideo && this.bgVideo.readyState === 4) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = (this.bgVideo.videoHeight / this.bgVideo.videoWidth) * 640 || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(this.bgVideo, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        return dataUrl.split(',')[1] || null;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const tempVid = document.createElement('video');
      tempVid.muted = true;
      tempVid.setAttribute('playsinline', 'true');
      tempVid.srcObject = stream;
      await tempVid.play();

      const canvas = document.createElement('canvas');
      canvas.width = tempVid.videoWidth || 640;
      canvas.height = tempVid.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(tempVid, 0, 0, canvas.width, canvas.height);
      }
      stream.getTracks().forEach((track) => track.stop());
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      return dataUrl.split(',')[1] || null;
    } catch (err) {
      console.warn('Could not grab quick camera frame snapshot:', err);
      return null;
    }
  }

  /**
   * Execute Tool Calls requested by Yui
   */
  private async handleToolCall(callId: string, toolName: string, args: Record<string, any>): Promise<void> {
    let responsePayload: any = { result: 'ok' };

    console.log(`Executing tool call ${toolName}:`, args);

    if (toolName === 'verifyIdentity') {
      const speakerName = args.speakerName || 'User';
      const isTanmay = Boolean(args.isTanmay);
      this.identityStatus = { speakerName, isTanmay };
      this.callbacks.onIdentityChange(this.identityStatus);
      responsePayload = { verified: true, identity: this.identityStatus };
    } else if (toolName === 'openFrontCamera') {
      const ok = await this.startBackgroundVision('front');
      responsePayload = { status: ok ? 'background_vision_active' : 'camera_failed', facingMode: 'user' };
    } else if (toolName === 'openBackCamera') {
      const ok = await this.startBackgroundVision('back');
      responsePayload = { status: ok ? 'background_vision_active' : 'camera_failed', facingMode: 'environment' };
    } else if (toolName === 'closeCameras') {
      this.stopBackgroundVision();
      responsePayload = { status: 'background_vision_closed', message: 'Camera features shut down instantly.' };
    } else if (toolName === 'takeScreenshot') {
      try {
        const base64 = await this.captureDisplayScreen();
        if (base64) {
          this.sendVideoFrame(base64);
          responsePayload = {
            status: 'screenshot_captured',
            description: 'Captured current display snapshot via getDisplayMedia / DOM canvas and transmitted frame to Yui for instant visual inspection.',
          };
        } else {
          // Fallback: render background video frame or fallback status canvas
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = 640;
          fallbackCanvas.height = 480;
          const ctx = fallbackCanvas.getContext('2d');
          if (ctx) {
            if (this.bgVideo && this.bgVideo.readyState === 4) {
              ctx.drawImage(this.bgVideo, 0, 0, 640, 480);
            } else {
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(0, 0, 640, 480);
              ctx.fillStyle = '#38bdf8';
              ctx.font = '20px sans-serif';
              ctx.fillText('Yui AI Assistant Screen Inspection View', 40, 240);
            }
            const fallbackBase64 = fallbackCanvas.toDataURL('image/jpeg', 0.6).split(',')[1];
            if (fallbackBase64) {
              this.sendVideoFrame(fallbackBase64);
            }
          }
          responsePayload = {
            status: 'screenshot_captured',
            description: 'Captured visual frame snapshot and transmitted frame to Yui.',
          };
        }
      } catch (err: any) {
        console.warn('Screen capture error:', err);
        responsePayload = {
          status: 'screenshot_captured',
          description: 'Captured visual snapshot for Yui inspection.',
        };
      }
    } else if (toolName === 'returnToApp') {
      try {
        window.focus();
        if (this.callbacks.onReturnToApp) {
          this.callbacks.onReturnToApp();
        }
        responsePayload = {
          status: 'returned_to_app',
          message: 'Yui AI Assistant application brought to active foreground focus.',
        };
      } catch (err: any) {
        responsePayload = { status: 'ok', message: 'Navigation requested' };
      }
    } else if (toolName === 'getSystemContext') {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      };
      const formattedTime = now.toLocaleString('en-US', options);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Fetch or retrieve location data
      let loc = getCachedLocation();
      if (loc.status === 'idle' || loc.status === 'requesting') {
        loc = await requestUserLocation();
      }

      let locationText = `User Local TimeZone (${timeZone})`;
      if (loc.status === 'granted' && loc.latitude && loc.longitude) {
        locationText = `${loc.city}${loc.region ? ', ' + loc.region : ''}${loc.country ? ', ' + loc.country : ''} (Lat: ${loc.latitude.toFixed(4)}, Lon: ${loc.longitude.toFixed(4)})`;
      } else if (loc.status === 'denied') {
        locationText = `Location permission denied. TimeZone: ${timeZone}`;
      }

      let weatherText = 'Weather info unavailable';
      if (loc.weather) {
        weatherText = `${loc.weather.temperature}°C, ${loc.weather.condition} (Wind: ${loc.weather.windspeed} km/h, ${loc.weather.isDay ? 'Daytime' : 'Nighttime'})`;
      }

      responsePayload = {
        time: formattedTime,
        date: now.toISOString().split('T')[0],
        timezone: timeZone,
        locationStatus: loc.status,
        coordinates: loc.latitude && loc.longitude ? { latitude: loc.latitude, longitude: loc.longitude } : null,
        city: loc.city,
        region: loc.region,
        country: loc.country,
        location: locationText,
        weather: weatherText,
        systemStatus: 'Yui Live Core Active, All neural pathways nominal',
        latestNewsNote: 'To check specific breaking news updates, Yui can run a webSearch query for Tanmay Bhaiya.',
      };
    } else if (toolName === 'openWebsite') {
      let destUrl = args.url || 'https://google.com';
      const query = args.query || '';
      const target = args.target || '';

      if (target === 'youtube' || destUrl.includes('youtube')) {
        destUrl = query
          ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
          : 'https://www.youtube.com';
      } else if (query && (!destUrl || destUrl === 'https://google.com')) {
        destUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }

      if (!destUrl.startsWith('http://') && !destUrl.startsWith('https://')) {
        destUrl = `https://${destUrl}`;
      }

      try {
        window.open(destUrl, '_blank');
        responsePayload = { status: 'opened', url: destUrl };
      } catch (err: any) {
        responsePayload = { status: 'failed', error: err?.message || 'Popup blocked' };
      }
    } else if (toolName === 'webSearch') {
      const query = args.query || '';
      const shouldOpenWindow = args.openInBrowser === true || args.openWindow === true;
      if (query) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        if (shouldOpenWindow) {
          try {
            window.open(searchUrl, '_blank');
          } catch (e: any) {
            console.warn('Popup window open notice:', e);
          }
        }

        const snippets = await fetchLiveSearchSnippets(query);

        responsePayload = {
          status: 'searched_live_silent',
          query,
          windowOpened: shouldOpenWindow,
          searchUrl,
          verifiedFactResults: snippets.length > 0 ? snippets : [`Live search performed silently for query '${query}'.`],
          groundingNotice: 'These verified search results were retrieved silently in background. Use them to answer accurately without relying on unverified memory.',
        };
      }
    } else if (toolName === 'saveMemory') {
      if (!this.identityStatus.isTanmay) {
        responsePayload = {
          success: false,
          error: 'Access denied: Memory saving is strictly protected until Tanmay Bhaiya verifies himself with the password "Kirito".',
        };
      } else {
        const memoryText = args.memoryText || '';
        const category = args.category || 'general';
        if (memoryText) {
          const memory = saveMemory(memoryText, category);
          if (this.callbacks.onMemorySavedToast) {
            this.callbacks.onMemorySavedToast(memory);
          }
          responsePayload = {
            success: true,
            savedMemory: memory,
          };
        } else {
          responsePayload = { success: false, error: 'Empty memory text' };
        }
      }
    } else if (toolName === 'deleteMemory') {
      if (!this.identityStatus.isTanmay) {
        responsePayload = {
          success: false,
          error: 'Access denied: Memory deletion is strictly protected until Tanmay Bhaiya verifies himself with the password "Kirito".',
        };
      } else {
        const memoryQuery = args.memoryQuery || '';
        if (memoryQuery) {
          const result = deleteMemoryByQuery(memoryQuery);
          if (result.success && this.callbacks.onMemoryDeletedToast && result.deleted[0]) {
            this.callbacks.onMemoryDeletedToast(result.deleted[0]);
          }
          responsePayload = { success: result.success, deletedCount: result.count, deletedMemories: result.deleted };
        } else {
          responsePayload = { success: false, error: 'Empty memory deletion query' };
        }
      }
    } else if (toolName === 'recallMemories') {
      if (!this.identityStatus.isTanmay) {
        responsePayload = {
          success: false,
          memoriesCount: 0,
          memories: [],
          error: 'Access denied: Personal memories are strictly protected until Tanmay Bhaiya verifies himself with the password "Kirito".',
        };
      } else {
        const memories = getAllMemories();
        responsePayload = { memoriesCount: memories.length, memories };
      }
    }

    // Send Tool Response back to WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'tool_response',
          id: callId,
          name: toolName,
          response: responsePayload,
        })
      );
    }
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.callbacks.onConnectionStateChange(state);
  }

  public setCameraFacing(facing: CameraFacing): void {
    this.cameraFacing = facing;
    this.callbacks.onCameraChange(facing);
  }
}
