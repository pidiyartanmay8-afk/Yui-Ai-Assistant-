import React from 'react';
import { MapPin, Navigation, X, Compass, LocateFixed, CheckCircle2 } from 'lucide-react';

export interface MapDataInfo {
  show: boolean;
  title?: string;
  query?: string;
  lat?: number | null;
  lon?: number | null;
  destinationName?: string;
  distanceKm?: number;
  durationMin?: number;
  steps?: string[];
}

interface MapViewModalProps {
  mapData: MapDataInfo | null;
  onClose: () => void;
}

export const MapViewModal: React.FC<MapViewModalProps> = ({ mapData, onClose }) => {
  if (!mapData || !mapData.show) return null;

  const lat = mapData.lat || 28.6139; // Default center (e.g. Delhi) if GPS not yet loaded
  const lon = mapData.lon || 77.209;
  const title = mapData.title || mapData.destinationName || 'Navigation & Location Map';

  // Embed OpenStreetMap / LocationIQ tile map iframe
  const mapIframeUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.03}%2C${lat - 0.02}%2C${lon + 0.03}%2C${lat + 0.02}&layer=mapnik&marker=${lat}%2C${lon}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900/95 border border-sky-500/40 rounded-3xl shadow-[0_0_50px_rgba(56,189,248,0.3)] overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sky-500/20 bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-400/30">
              <Navigation className="h-5 w-5 text-cyan-300 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-sky-100">{title}</h3>
              <p className="text-xs text-sky-300/70 flex items-center gap-1">
                <Compass className="h-3.5 w-3.5 text-cyan-400" /> LocationIQ GPS & Navigation Display
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            aria-label="Close Map View"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Map Canvas / Tile Embed */}
        <div className="relative w-full h-64 sm:h-72 bg-slate-950 overflow-hidden">
          <iframe
            title="Location Map"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={mapIframeUrl}
            className="opacity-90 contrast-125 filter grayscale-[20%] invert-[90%] hue-rotate-180"
          ></iframe>

          {/* Floating Coordinates Badge */}
          <div className="absolute top-3 left-3 bg-slate-950/90 border border-sky-400/40 rounded-full px-3 py-1 text-[11px] font-medium text-cyan-200 backdrop-blur-md shadow-lg flex items-center gap-1.5">
            <LocateFixed className="h-3.5 w-3.5 text-cyan-400" />
            <span>Lat: {lat.toFixed(4)}, Lon: {lon.toFixed(4)}</span>
          </div>

          <div className="absolute bottom-3 right-3 bg-sky-500/20 border border-sky-400/50 rounded-full px-3 py-1 text-[11px] font-semibold text-sky-200 backdrop-blur-md">
            LocationIQ Active
          </div>
        </div>

        {/* Directions / Details Content Box */}
        {mapData.steps && mapData.steps.length > 0 && (
          <div className="p-4 sm:p-5 overflow-y-auto max-h-48 border-t border-sky-500/20 bg-slate-950/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-cyan-400" /> Turn-by-Turn Route Guidance
              </span>
              {mapData.distanceKm && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                  {mapData.distanceKm} km ({mapData.durationMin || 10} min)
                </span>
              )}
            </div>
            <div className="space-y-2 text-xs text-slate-200">
              {mapData.steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-slate-900/60 p-2 rounded-xl border border-sky-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-sky-500/20 bg-slate-950/80 flex items-center justify-between text-xs text-sky-300/80">
          <span>Voice-first interaction active. Say "Map close karo" or click close to dismiss.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-100 font-semibold hover:bg-sky-500/30 transition-all"
          >
            Close Map
          </button>
        </div>
      </div>
    </div>
  );
};
