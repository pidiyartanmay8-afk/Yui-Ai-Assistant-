import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AincradBackground } from './components/AincradBackground';
import { YuiAvatar } from './components/YuiAvatar';
import { MemoryToast, ToastInfo } from './components/MemoryToast';
import { MemoryModal } from './components/MemoryModal';
import { MicPermissionGuide } from './components/MicPermissionGuide';
import {
  YuiLiveSession,
  ConnectionState,
  IdentityStatus,
  CameraFacing,
} from './lib/liveSession';
import { getAllMemories, subscribeMemorySaved } from './lib/memoryStore';
import { requestUserLocation, watchUserLocation } from './lib/locationService';
import {
  registerTanmayFaceFromCamera,
  verifyTanmayFaceFromCamera,
  hasSavedTanmayFace,
} from './lib/faceRecognitionService';
import { Mic, AlertCircle, Sparkles, Camera, ShieldCheck } from 'lucide-react';

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [identity, setIdentity] = useState<IdentityStatus>({
    speakerName: 'Unverified',
    isTanmay: false,
  });
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('closed');
  const [inputVol, setInputVol] = useState<number>(0);
  const [outputVol, setOutputVol] = useState<number>(0);

  const [memoriesCount, setMemoriesCount] = useState<number>(0);
  const [toastInfo, setToastInfo] = useState<ToastInfo | null>(null);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState<boolean>(false);
  const [isMicGuideOpen, setIsMicGuideOpen] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const sessionRef = useRef<YuiLiveSession | null>(null);

  // Update memories count
  const updateMemoriesCount = useCallback(() => {
    setMemoriesCount(getAllMemories().length);
  }, []);

  useEffect(() => {
    updateMemoriesCount();

    // Trigger browser Geolocation permission request upon app startup
    requestUserLocation();
    const stopWatcher = watchUserLocation();

    // Automatic startup face verification against localStorage ('tanmay_verified_face')
    if (hasSavedTanmayFace()) {
      verifyTanmayFaceFromCamera().then((res) => {
        if (res.matched) {
          setIdentity({ speakerName: 'Tanmay', isTanmay: true });
          setToastInfo({
            type: 'saved',
            text: `Welcome back, Tanmay Bhaiya! (${res.confidencePercent}% visual face match)`,
          });
        } else {
          setIdentity({ speakerName: 'Guest', isTanmay: false });
        }
      });
    }

    // Subscribe to memory saved events
    const unsubscribe = subscribeMemorySaved((newMem) => {
      setToastInfo({ type: 'saved', text: newMem.text });
      updateMemoriesCount();
    });

    return () => {
      stopWatcher();
      unsubscribe();
    };
  }, [updateMemoriesCount]);

  // Instantiate YuiLiveSession manager
  useEffect(() => {
    const session = new YuiLiveSession({
      onConnectionStateChange: (state) => setConnectionState(state),
      onIdentityChange: (idStatus) => setIdentity(idStatus),
      onCameraChange: (facing) => setCameraFacing(facing),
      onVolumeChange: (inVol, outVol) => {
        setInputVol(inVol);
        setOutputVol(outVol);
      },
      onError: (msg) => {
        setErrorBanner(msg);
        if (
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('microphone') ||
          msg.toLowerCase().includes('blocked')
        ) {
          setIsMicGuideOpen(true);
        }
      },
      onMemorySavedToast: (memory) => {
        setToastInfo({ type: 'saved', text: memory.text });
        updateMemoriesCount();
      },
      onMemoryDeletedToast: (deletedText) => {
        setToastInfo({ type: 'deleted', text: deletedText });
        updateMemoriesCount();
      },
      onReturnToApp: () => {
        setToastInfo({ type: 'saved', text: 'Returned to Yui AI Primary Interface' });
      },
    });

    sessionRef.current = session;

    return () => {
      session.disconnect();
    };
  }, [updateMemoriesCount]);

  // Connect or disconnect Yui session
  const handleToggleSession = async () => {
    setErrorBanner(null);
    if (!sessionRef.current) return;

    if (connectionState === 'disconnected' || connectionState === 'error') {
      await sessionRef.current.connect();
    } else {
      sessionRef.current.disconnect();
    }
  };

  // Toggle Background Camera Vision
  const handleToggleCamera = () => {
    if (!sessionRef.current) return;
    if (cameraFacing === 'closed') {
      sessionRef.current.startBackgroundVision('front');
    } else if (cameraFacing === 'front') {
      sessionRef.current.startBackgroundVision('back');
    } else {
      sessionRef.current.stopBackgroundVision();
    }
  };

  // Manual Identity Testing Override
  const handleToggleTanmayVerification = () => {
    const newStatus: IdentityStatus = identity.isTanmay
      ? { speakerName: 'Guest', isTanmay: false }
      : { speakerName: 'Tanmay', isTanmay: true };
    setIdentity(newStatus);
  };

  // Camera Face Registration: "Mera Chehra Yaad Kar Lo"
  const handleRegisterFace = async () => {
    setToastInfo({ type: 'saved', text: 'Capturing camera frame to remember Tanmay face...' });
    const res = await registerTanmayFaceFromCamera();
    if (res.success) {
      setIdentity({ speakerName: 'Tanmay', isTanmay: true });
      setToastInfo({
        type: 'saved',
        text: 'Maine aapka chehra save kar liya hai, ab अगली बार से पहचान जाऊँगी।',
      });
    } else {
      setErrorBanner(res.details);
    }
  };

  // Real-Time Camera Verification
  const handleVerifyFace = async () => {
    setToastInfo({ type: 'saved', text: 'Scanning live camera feed to verify face...' });
    const res = await verifyTanmayFaceFromCamera();
    if (res.matched) {
      setIdentity({ speakerName: 'Tanmay', isTanmay: true });
      setToastInfo({
        type: 'saved',
        text: `Welcome back, Tanmay Bhaiya! Main aa gayi hoon (${res.confidencePercent}% match)`,
      });
    } else {
      setIdentity({ speakerName: 'Guest', isTanmay: false });
      setToastInfo({
        type: 'deleted',
        text: `Aap Tanmay bhaiya nahi hain. (${res.confidencePercent}% similarity)`,
      });
    }
  };

  return (
    <AincradBackground>
      {/* Absolute Zero-Clutter Fullscreen Canvas */}
      <main className="relative flex flex-1 flex-col items-center justify-center p-2 sm:p-4 max-w-4xl mx-auto w-full z-10 min-h-screen">
        {/* Error / Notice Banner (only shown if an error occurs) */}
        {errorBanner && (
          <div className="absolute top-4 left-4 right-4 z-50 mx-auto max-w-md flex items-center justify-between rounded-2xl border border-rose-500/40 bg-slate-950/90 p-3 text-xs text-rose-200 backdrop-blur-md shadow-2xl">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <div className="flex items-center space-x-2">
              {(errorBanner.includes('Permission') || errorBanner.includes('Microphone')) && (
                <button
                  onClick={() => setIsMicGuideOpen(true)}
                  className="rounded bg-rose-500/30 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/50 transition-colors"
                >
                  How to Fix
                </button>
              )}
              <button
                onClick={() => setErrorBanner(null)}
                className="text-rose-400 hover:text-white text-xs font-bold px-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Central Full Vertical Standing Portrait of Yui */}
        <div className="flex-1 flex flex-col items-center justify-center w-full py-2">
          <YuiAvatar
            connectionState={connectionState}
            inputVol={inputVol}
            outputVol={outputVol}
            isTanmayVerified={identity.isTanmay}
            onToggleSession={handleToggleSession}
          />
        </div>

        {/* Bottom Minimalist Floating Voice Session Button */}
        <div className="pb-6 pt-2 flex flex-col items-center z-30">
          <button
            id="main-voice-activation-btn"
            onClick={handleToggleSession}
            className={`flex items-center space-x-3 rounded-full px-8 py-3.5 text-sm font-semibold tracking-wide transition-all duration-300 shadow-2xl backdrop-blur-md ${
              connectionState === 'listening' || connectionState === 'speaking'
                ? 'bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-500 text-slate-950 shadow-[0_0_35px_rgba(56,189,248,0.6)] hover:brightness-110 active:scale-95'
                : connectionState === 'connecting'
                ? 'bg-amber-400 text-slate-950 shadow-[0_0_25px_rgba(251,191,36,0.6)] animate-pulse'
                : 'bg-slate-950/80 border border-sky-400/50 text-sky-200 hover:border-cyan-300 hover:bg-slate-900/90 shadow-[0_0_20px_rgba(56,189,248,0.25)] active:scale-95'
            }`}
          >
            {connectionState === 'listening' || connectionState === 'speaking' ? (
              <>
                <Mic className="h-5 w-5 animate-pulse text-slate-950" />
                <span>Disconnect Yui Session</span>
              </>
            ) : connectionState === 'connecting' ? (
              <>
                <Sparkles className="h-5 w-5 animate-spin text-slate-950" />
                <span>Connecting with Yui...</span>
              </>
            ) : (
              <>
                <Mic className="h-5 w-5 text-cyan-300" />
                <span>Start Voice Call with Yui</span>
              </>
            )}
          </button>

          {/* Facial Registration & Verification Toolbar */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              id="register-tanmay-face-btn"
              onClick={handleRegisterFace}
              className="flex items-center space-x-1.5 rounded-full border border-sky-400/40 bg-slate-900/80 px-4 py-2 text-xs font-medium text-sky-300 hover:border-cyan-300 hover:bg-slate-800/90 transition-all shadow-md active:scale-95"
              title="Capture and save face to localStorage ('tanmay_verified_face')"
            >
              <Camera className="h-3.5 w-3.5 text-cyan-400" />
              <span>Mera Chehra Yaad Kar Lo</span>
            </button>

            <button
              id="verify-tanmay-face-btn"
              onClick={handleVerifyFace}
              className="flex items-center space-x-1.5 rounded-full border border-emerald-400/40 bg-slate-900/80 px-4 py-2 text-xs font-medium text-emerald-300 hover:border-emerald-300 hover:bg-slate-800/90 transition-all shadow-md active:scale-95"
              title="Verify face from camera against stored localStorage image"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Verify Tanmay Face</span>
            </button>
          </div>
        </div>
      </main>

      {/* Top Right Frosted Glass Toast Notification for Memory Saves & Erasures */}
      <MemoryToast
        toastInfo={toastInfo}
        onDismiss={() => setToastInfo(null)}
      />

      {/* Long-Term Memory Inspection Modal */}
      <MemoryModal
        isOpen={isMemoryModalOpen}
        isTanmayVerified={identity.isTanmay}
        onClose={() => setIsMemoryModalOpen(false)}
        onMemoriesUpdated={updateMemoriesCount}
      />

      {/* Interactive Microphone Permission Guide Modal */}
      <MicPermissionGuide
        isOpen={isMicGuideOpen}
        onClose={() => setIsMicGuideOpen(false)}
        onRetry={handleToggleSession}
      />
    </AincradBackground>
  );
}
