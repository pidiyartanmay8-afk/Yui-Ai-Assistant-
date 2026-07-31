import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CameraFacing } from '../lib/liveSession';
import { Camera, RefreshCw, X, Eye } from 'lucide-react';

interface CameraViewProps {
  cameraFacing: CameraFacing;
  onClose: () => void;
  onSwitchFacing: (facing: CameraFacing) => void;
  onSendVideoFrame: (base64JPEG: string) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  cameraFacing,
  onClose,
  onSwitchFacing,
  onSendVideoFrame,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stop all camera tracks and clear frame capture interval
  const stopCameraStream = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }
  }, []);

  // Capture video frame at 1 FPS and stream base64 JPEG to Gemini Live API
  const startFrameCapture = useCallback(() => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    frameIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState !== 4 || !ctx) return;

      canvas.width = 640;
      canvas.height = (video.videoHeight / video.videoWidth) * 640 || 480;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // Compress JPEG for low latency
      const base64 = dataUrl.split(',')[1];
      if (base64) {
        onSendVideoFrame(base64);
      }
    }, 1000); // 1 FPS rate limit as recommended by Gemini Live API
  }, [onSendVideoFrame]);

  // Start media stream when cameraFacing changes
  useEffect(() => {
    if (cameraFacing === 'closed') {
      stopCameraStream();
      return;
    }

    let isSubscribed = true;
    setErrorMsg(null);

    async function initCamera() {
      stopCameraStream();

      const facingMode = cameraFacing === 'front' ? 'user' : 'environment';

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          startFrameCapture();
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        if (isSubscribed) {
          setErrorMsg('Camera access unavailable or blocked.');
        }
      }
    }

    initCamera();

    return () => {
      isSubscribed = false;
      stopCameraStream();
    };
  }, [cameraFacing, stopCameraStream, startFrameCapture]);

  if (cameraFacing === 'closed') return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 w-72 sm:w-80 overflow-hidden rounded-2xl border border-sky-500/40 bg-slate-900/90 shadow-[0_12px_40px_rgba(14,165,233,0.3)] backdrop-blur-xl transition-all duration-300">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-3.5 py-2">
        <div className="flex items-center space-x-2">
          <Eye className="h-4 w-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-semibold text-sky-200">
            Yui Vision ({cameraFacing === 'front' ? 'Front Cam' : 'Back Cam'})
          </span>
        </div>

        <div className="flex items-center space-x-1">
          {/* Switch Facing Mode Button */}
          <button
            onClick={() => onSwitchFacing(cameraFacing === 'front' ? 'back' : 'front')}
            title="Switch Camera"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {/* Close Camera Button */}
          <button
            onClick={onClose}
            title="Turn Off Camera"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Video Stream Container */}
      <div className="relative aspect-video w-full bg-slate-950">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${cameraFacing === 'front' ? 'scale-x-[-1]' : ''}`}
        />

        {errorMsg ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/90 text-rose-300">
            <Camera className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs font-medium">{errorMsg}</p>
          </div>
        ) : (
          /* Live Vision Indicator */
          <div className="absolute top-2 left-2 flex items-center space-x-1.5 rounded-full bg-slate-950/70 px-2.5 py-1 backdrop-blur-md border border-sky-400/30 text-[10px] text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Streaming to Yui</span>
          </div>
        )}
      </div>
    </div>
  );
};
