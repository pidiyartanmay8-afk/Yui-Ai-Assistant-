import React, { useState } from 'react';
import { Mic, MicOff, Lock, RefreshCw, AlertTriangle, X } from 'lucide-react';

interface MicPermissionGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export const MicPermissionGuide: React.FC<MicPermissionGuideProps> = ({ isOpen, onClose, onRetry }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'denied' | null>(null);

  if (!isOpen) return null;

  const handleRequestMicDirectly = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setTestResult('success');
      setTimeout(() => {
        setTesting(false);
        onRetry();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Direct microphone test failed:', err);
      setTestResult('denied');
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-2xl border border-rose-500/40 bg-slate-900/95 p-6 shadow-[0_0_40px_rgba(244,63,94,0.25)] text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-400/50 text-rose-400">
            <MicOff className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-200">Microphone Permission Blocked</h3>
            <p className="text-xs text-slate-400">Yui needs microphone access to talk with you</p>
          </div>
        </div>

        {testResult === 'success' && (
          <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3 text-xs text-emerald-300 flex items-center space-x-2">
            <Mic className="h-4 w-4 text-emerald-400 animate-pulse" />
            <span>Microphone granted! Connecting to Yui...</span>
          </div>
        )}

        {testResult === 'denied' && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-950/60 p-3 text-xs text-rose-300 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <span>Still blocked. Please follow the browser steps below to unblock.</span>
          </div>
        )}

        <div className="space-y-3 text-xs text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <p className="font-semibold text-sky-300">How to enable microphone in your browser:</p>
          <ol className="list-decimal list-inside space-y-2 text-slate-300 leading-relaxed">
            <li>
              Look at your browser's address bar at the top and click the <Lock className="inline h-3.5 w-3.5 text-cyan-400 mx-1" /> <strong>Lock</strong> or <strong>Camera/Mic</strong> icon.
            </li>
            <li>
              Find <strong>Microphone</strong> in the settings dropdown and toggle it to <span className="text-emerald-400 font-medium">Allow</span>.
            </li>
            <li>
              Click the button below to retry connecting with Yui!
            </li>
          </ol>
        </div>

        <div className="mt-5 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleRequestMicDirectly}
            disabled={testing}
            className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg hover:brightness-110 active:scale-95 transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Checking Mic...' : 'Grant & Retry Mic'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
