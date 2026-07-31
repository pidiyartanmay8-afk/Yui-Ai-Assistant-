import React from 'react';
import { IdentityStatus } from '../lib/liveSession';
import { Heart, ShieldCheck, UserCheck, Brain, Camera, Sparkles } from 'lucide-react';

interface StatusHeaderProps {
  identity: IdentityStatus;
  memoriesCount: number;
  isCameraOpen: boolean;
  onOpenMemories: () => void;
  onToggleCamera: () => void;
}

export const StatusHeader: React.FC<StatusHeaderProps> = ({
  identity,
  memoriesCount,
  isCameraOpen,
  onOpenMemories,
  onToggleCamera,
}) => {
  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/60 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        {/* Yui Title Branding */}
        <div className="flex items-center space-x-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 p-0.5 shadow-[0_0_15px_rgba(56,189,248,0.4)]">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
              <Sparkles className="h-4 w-4 text-cyan-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="text-sm font-bold tracking-wider text-slate-100">Yui AI</h1>
              <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-mono text-sky-300 border border-sky-500/30">
                SAO Live
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-light">Sword Art Online • Voice AI</p>
          </div>
        </div>

        {/* Identity Verification Badge */}
        <div className="hidden sm:flex items-center space-x-2">
          {identity.isTanmay ? (
            <div className="flex items-center space-x-1.5 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-xs font-medium text-pink-200 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
              <Heart className="h-3.5 w-3.5 text-pink-400 fill-pink-400" />
              <span>Verified: तन्मय भैया</span>
              <ShieldCheck className="h-3.5 w-3.5 text-pink-400" />
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
              <UserCheck className="h-3.5 w-3.5 text-slate-400" />
              <span>Identity: {identity.speakerName}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Camera Button */}
          <button
            id="toggle-camera-btn"
            onClick={onToggleCamera}
            className={`flex items-center space-x-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
              isCameraOpen
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Vision</span>
          </button>

          {/* Long-Term Memory Button */}
          <button
            id="view-memories-btn"
            onClick={onOpenMemories}
            className="flex items-center space-x-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 hover:border-sky-400/50 hover:bg-sky-500/20 transition-all shadow-[0_0_12px_rgba(56,189,248,0.15)]"
          >
            <Brain className="h-3.5 w-3.5 text-sky-400" />
            <span>Memories</span>
            {memoriesCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-slate-950">
                {memoriesCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
