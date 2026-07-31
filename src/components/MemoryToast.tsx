import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Brain, Trash2, X } from 'lucide-react';
import { MemoryItem } from '../lib/memoryStore';

export interface ToastInfo {
  type: 'saved' | 'deleted';
  text: string;
}

interface MemoryToastProps {
  toastInfo: ToastInfo | null;
  onDismiss: () => void;
}

export const MemoryToast: React.FC<MemoryToastProps> = ({ toastInfo, onDismiss }) => {
  useEffect(() => {
    if (!toastInfo) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000); // Dismiss after 5 seconds

    return () => clearTimeout(timer);
  }, [toastInfo, onDismiss]);

  return (
    <AnimatePresence>
      {toastInfo && (
        <motion.div
          id="yui-memory-toast"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed top-4 right-4 z-50 max-w-sm rounded-2xl border border-sky-500/40 bg-slate-900/85 p-4 backdrop-blur-xl shadow-[0_10px_35px_rgba(14,165,233,0.25)] text-slate-100"
        >
          <div className="flex items-start space-x-3">
            {/* Pulsing Sky-Blue Indicator + Icon */}
            <div className="relative flex-shrink-0 mt-0.5">
              <span className={`absolute -inset-1 rounded-full animate-ping opacity-75 ${toastInfo.type === 'saved' ? 'bg-sky-400/40' : 'bg-rose-400/40'}`} />
              <div className={`relative flex h-8 w-8 items-center justify-center rounded-full border ${
                toastInfo.type === 'saved' 
                  ? 'bg-sky-500/20 border-sky-400/60 text-sky-300' 
                  : 'bg-rose-500/20 border-rose-400/60 text-rose-300'
              }`}>
                {toastInfo.type === 'saved' ? (
                  <Check className="h-4 w-4 text-sky-300" />
                ) : (
                  <Trash2 className="h-4 w-4 text-rose-300" />
                )}
              </div>
            </div>

            {/* Memory Content */}
            <div className="flex-1 pr-2">
              <div className="flex items-center space-x-1.5">
                <Brain className="h-3.5 w-3.5 text-sky-400" />
                <h4 className="text-xs font-semibold tracking-wide text-sky-200">
                  {toastInfo.type === 'saved' ? 'Memory Saved by Yui' : 'Memory Erased by Yui'}
                </h4>
              </div>
              <p className="mt-1 text-xs text-slate-200 font-medium line-clamp-2 leading-relaxed">
                "{toastInfo.text}"
              </p>
              <span className="mt-1.5 inline-block text-[10px] text-sky-400/80 font-mono">
                {toastInfo.type === 'saved'
                  ? 'Stored for तन्मय भैया • Permanent Recall'
                  : 'Removed from Storage • Yui Memory Core'}
              </span>
            </div>

            {/* Close Button */}
            <button
              onClick={onDismiss}
              className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
