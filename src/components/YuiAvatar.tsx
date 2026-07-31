import React from 'react';
import { motion } from 'motion/react';
import { ConnectionState } from '../lib/liveSession';
import { Mic, Heart, Volume2, Sparkles } from 'lucide-react';

interface YuiAvatarProps {
  connectionState: ConnectionState;
  inputVol: number;
  outputVol: number;
  isTanmayVerified: boolean;
  onToggleSession: () => void;
}

export const YuiAvatar: React.FC<YuiAvatarProps> = ({
  connectionState,
  inputVol,
  outputVol,
  isTanmayVerified,
  onToggleSession,
}) => {
  const isConnected = connectionState === 'listening' || connectionState === 'speaking';
  const isSpeaking = connectionState === 'speaking';
  const isListening = connectionState === 'listening';
  const activeVol = Math.max(inputVol, outputVol);

  // Aura glow intensity based on volume
  const glowScale = 1 + activeVol * 0.3;
  const glowOpacity = isSpeaking ? 0.75 : isListening ? 0.45 : 0.2;

  return (
    <div className="relative flex flex-col items-center justify-center w-full min-h-[70vh]">
      {/* Background Audio-Reactive Ethereal Glow */}
      {isConnected && (
        <motion.div
          animate={{ scale: glowScale, opacity: glowOpacity }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className={`absolute h-[500px] w-[320px] sm:w-[380px] rounded-full blur-3xl pointer-events-none ${
            isTanmayVerified
              ? 'bg-gradient-to-t from-sky-500/40 via-cyan-400/30 to-pink-500/20'
              : 'bg-gradient-to-t from-sky-500/30 via-cyan-300/20 to-blue-600/20'
          }`}
        />
      )}

      {/* Full Vertical Standing Portrait Container */}
      <motion.button
        id="yui-standing-portrait"
        onClick={onToggleSession}
        initial={{ opacity: 0, y: 20 }}
        animate={{
          opacity: 1,
          y: isSpeaking ? [0, -6, 0] : [0, -4, 0],
        }}
        transition={{
          y: {
            duration: isSpeaking ? 1.8 : 3.5,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          },
          opacity: { duration: 0.8 },
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`relative z-20 flex flex-col items-center justify-center cursor-pointer group transition-all duration-500 max-w-sm sm:max-w-md w-full h-[62vh] sm:h-[68vh] rounded-3xl overflow-hidden border ${
          isSpeaking
            ? 'border-cyan-300/80 shadow-[0_0_50px_rgba(56,189,248,0.6)]'
            : isListening
            ? 'border-sky-400/60 shadow-[0_0_35px_rgba(56,189,248,0.35)]'
            : connectionState === 'connecting'
            ? 'border-amber-400/70 shadow-[0_0_30px_rgba(251,191,36,0.4)] animate-pulse'
            : 'border-slate-800/80 shadow-[0_0_25px_rgba(15,23,42,0.8)] hover:border-sky-400/40'
        }`}
      >
        {/* Full Standing Vertical Portrait of Yui */}
        <img
          src="/src/assets/images/yui_standing_portrait_1785140884164.jpg"
          alt="Yui SAO Full Standing Portrait"
          className={`h-full w-full object-cover object-top transition-transform duration-700 ${
            isSpeaking ? 'scale-[1.03] filter brightness-110 contrast-105' : 'scale-100'
          }`}
        />

        {/* Ethereal Vignette Overlay for Seamless Background Blending */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />

        {/* Floating Minimal Status Overlay on Bottom of Portrait */}
        <div className="absolute bottom-4 inset-x-4 z-30 flex flex-col items-center space-y-1.5 pointer-events-none">
          <div className="inline-flex items-center space-x-2 rounded-full border border-sky-400/30 bg-slate-950/70 px-4 py-1.5 backdrop-blur-md shadow-xl">
            <span className="relative flex h-2.5 w-2.5">
              {isConnected ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
                </>
              ) : connectionState === 'connecting' ? (
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
              ) : (
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-500" />
              )}
            </span>

            <span className="text-xs font-semibold tracking-wide text-slate-100">
              {isSpeaking
                ? 'Yui is speaking...'
                : isListening
                ? 'Yui is listening...'
                : connectionState === 'connecting'
                ? 'Awakening Yui...'
                : 'Tap Yui to connect'}
            </span>

            {isSpeaking ? (
              <Volume2 className="h-3.5 w-3.5 text-cyan-300 animate-bounce" />
            ) : isTanmayVerified ? (
              <Heart className="h-3.5 w-3.5 text-pink-400 fill-pink-400/40" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            )}
          </div>
        </div>

        {/* Big Tap Mic Overlay when Disconnected */}
        {!isConnected && connectionState !== 'connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/30 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/80 text-slate-950 shadow-2xl backdrop-blur-md">
              <Mic className="h-7 w-7" />
            </div>
            <span className="mt-2 text-xs font-bold text-sky-200 tracking-wider bg-slate-950/80 px-3 py-1 rounded-full border border-sky-400/30">
              TAP TO TALK WITH YUI
            </span>
          </div>
        )}
      </motion.button>
    </div>
  );
};

