/**
 * AudioStreamer handles:
 * 1. 16kHz PCM audio recording from microphone
 * 2. 24kHz PCM audio playback from Gemini Live API
 * 3. Audio volume analysis for aura ripple visualizations
 * 4. Ultra-fast barge-in interruption handling
 */

export class AudioStreamer {
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;

  private nextStartTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private onInputPCM: ((base64PCM: string) => void) | null = null;
  
  private inputVolume: number = 0;
  private outputVolume: number = 0;
  private volumeAnimationId: number | null = null;
  private onVolumeChange: ((inputVol: number, outputVol: number) => void) | null = null;

  constructor() {}

  public setVolumeCallback(cb: (inputVol: number, outputVol: number) => void) {
    this.onVolumeChange = cb;
  }

  /**
   * Initialize and start recording audio at 16kHz PCM 16-bit Little Endian
   */
  public async startRecording(onInputPCM: (base64PCM: string) => void): Promise<void> {
    this.onInputPCM = onInputPCM;

    try {
      // Primary attempt with preferred audio constraints
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 16000,
          },
        });
      } catch (constraintErr: any) {
        const isPermissionError =
          constraintErr?.name === 'NotAllowedError' ||
          constraintErr?.name === 'PermissionDeniedError' ||
          constraintErr?.message?.toLowerCase().includes('permission') ||
          constraintErr?.message?.toLowerCase().includes('denied') ||
          constraintErr?.message?.toLowerCase().includes('not allowed');

        if (isPermissionError) {
          throw constraintErr;
        }

        console.warn('Fallback: Initializing default getUserMedia without 16kHz constraint', constraintErr);
        // Fallback attempt with standard audio request
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }

      // Try creating AudioContext with 16kHz target sample rate
      try {
        this.inputAudioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
          sampleRate: 16000,
        });
      } catch (ctxErr) {
        console.warn('Fallback: AudioContext without sampleRate constraint', ctxErr);
        this.inputAudioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }

      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      const source = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.micAnalyser = this.inputAudioCtx.createAnalyser();
      this.micAnalyser.fftSize = 256;

      // ScriptProcessorNode for raw PCM extraction
      const bufferSize = 2048;
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(bufferSize, 1, 1);

      source.connect(this.micAnalyser);
      this.micAnalyser.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);

      const nativeSampleRate = this.inputAudioCtx.sampleRate;

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.onInputPCM) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        let pcmData = inputData;
        if (nativeSampleRate !== 16000) {
          pcmData = this.downsampleBuffer(inputData, nativeSampleRate, 16000);
        }

        // Convert Float32Array (-1.0 to 1.0) to 16-bit PCM ArrayBuffer
        const pcm16 = this.floatTo16BitPCM(pcmData);
        const base64 = this.arrayBufferToBase64(pcm16);
        this.onInputPCM(base64);
      };

      // Ensure output AudioContext is ready for 24kHz response playback
      this.initOutputAudioContext();
      this.startVolumeMonitoring();
    } catch (err) {
      this.stopRecording();
      console.warn('Microphone recording notice:', err?.message || err);
      throw err;
    }
  }

  /**
   * Stop recording microphone audio
   */
  public stopRecording(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close();
      this.inputAudioCtx = null;
    }
    this.stopPlayback();
  }

  /**
   * Initialize output audio context at 24kHz for Gemini Live audio responses
   */
  private initOutputAudioContext(): void {
    if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
      this.outputAudioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        sampleRate: 24000,
      });
      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.connect(this.outputAudioCtx.destination);
    }
    if (this.outputAudioCtx.state === 'suspended') {
      this.outputAudioCtx.resume();
    }
  }

  /**
   * Enqueue base64 PCM 24kHz chunk from model turn and schedule gapless playback
   */
  public async playAudioChunk(base64PCM: string): Promise<void> {
    this.initOutputAudioContext();
    if (!this.outputAudioCtx || !this.outputAnalyser) return;

    try {
      const arrayBuffer = this.base64ToArrayBuffer(base64PCM);
      const float32Data = this.pcm16ToFloat32(arrayBuffer);

      if (float32Data.length === 0) return;

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAnalyser);

      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.02; // Small 20ms buffer to prevent initial pop
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
      };
    } catch (err) {
      console.error('Error playing audio chunk:', err);
    }
  }

  /**
   * Immediate Barge-In: Cut off all current and scheduled audio playback within milliseconds
   */
  public stopPlayback(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop(0);
        source.disconnect();
      } catch {
        // Source may have already ended
      }
    });
    this.activeSources.clear();
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  /**
   * Monitor input & output volume levels for aura ripples
   */
  private startVolumeMonitoring(): void {
    if (this.volumeAnimationId) cancelAnimationFrame(this.volumeAnimationId);

    const micData = new Uint8Array(128);
    const outputData = new Uint8Array(128);

    const update = () => {
      let inputVol = 0;
      let outputVol = 0;

      if (this.micAnalyser) {
        this.micAnalyser.getByteFrequencyData(micData);
        let sum = 0;
        for (let i = 0; i < micData.length; i++) sum += micData[i];
        inputVol = sum / micData.length / 255;
      }

      if (this.outputAnalyser && this.activeSources.size > 0) {
        this.outputAnalyser.getByteFrequencyData(outputData);
        let sum = 0;
        for (let i = 0; i < outputData.length; i++) sum += outputData[i];
        outputVol = sum / outputData.length / 255;
      }

      this.inputVolume = inputVol;
      this.outputVolume = outputVol;

      if (this.onVolumeChange) {
        this.onVolumeChange(inputVol, outputVol);
      }

      this.volumeAnimationId = requestAnimationFrame(update);
    };

    update();
  }

  // --- Helper Conversion Methods ---

  private downsampleBuffer(buffer: Float32Array, sampleRate: number, outSampleRate: number): Float32Array {
    if (outSampleRate === sampleRate || outSampleRate > sampleRate) {
      return buffer;
    }
    const sampleRateRatio = sampleRate / outSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const output = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  private pcm16ToFloat32(arrayBuffer: ArrayBuffer): Float32Array {
    const dataView = new DataView(arrayBuffer);
    const length = Math.floor(arrayBuffer.byteLength / 2);
    const float32 = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const int16 = dataView.getInt16(i * 2, true);
      float32[i] = int16 / 32768;
    }
    return float32;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
