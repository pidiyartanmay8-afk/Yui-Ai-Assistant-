import React from 'react';
import { X, Youtube, ExternalLink, Music2 } from 'lucide-react';
import { YouTubeMediaInfo } from '../lib/liveSession';

interface YouTubePlayerModalProps {
  mediaInfo: YouTubeMediaInfo | null;
  onClose: () => void;
}

export const YouTubePlayerModal: React.FC<YouTubePlayerModalProps> = ({
  mediaInfo,
  onClose,
}) => {
  if (!mediaInfo || !mediaInfo.show || !mediaInfo.videoId) return null;

  const embedUrl = `https://www.youtube.com/embed/${mediaInfo.videoId}?autoplay=1&enablejsapi=1&rel=0`;
  const watchUrl = `https://www.youtube.com/watch?v=${mediaInfo.videoId}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-md sm:max-w-lg p-2 animate-in fade-in slide-in-from-bottom-6 duration-300">
      <div className="relative overflow-hidden rounded-3xl border border-sky-400/40 bg-slate-950/90 shadow-[0_0_50px_rgba(56,189,248,0.35)] backdrop-blur-xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-sky-400/20 bg-slate-900/80 px-4 py-3">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Youtube className="h-4 w-4" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-xs font-semibold text-sky-200">
                {mediaInfo.videoTitle || mediaInfo.query || 'YouTube Playback'}
              </span>
              <span className="flex items-center text-[10px] text-sky-400/70 font-medium space-x-1">
                <Music2 className="h-3 w-3 text-cyan-400 animate-pulse" />
                <span>Now Playing via Yui Assistant</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open on YouTube"
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-sky-300 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={onClose}
              title="Close Player"
              className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Video Embed Frame */}
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={embedUrl}
            title={mediaInfo.videoTitle || 'YouTube Video Player'}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};
