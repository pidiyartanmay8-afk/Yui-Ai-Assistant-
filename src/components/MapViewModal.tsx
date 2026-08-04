import React, { useEffect, useRef, useState } from 'react';
import {
  MapPin,
  Navigation,
  X,
  Compass,
  LocateFixed,
  CheckCircle2,
  Search,
  Loader2,
  Building2,
  Store,
  Layers,
  Sparkles,
  ExternalLink,
  Crosshair,
  Coffee,
  Hospital,
  Fuel,
  Landmark,
  Utensils,
  Maximize2,
  Eye,
} from 'lucide-react';
import L from 'leaflet';
import {
  fetchLocationIQAutocomplete,
  fetchLocationIQReverse,
  fetchLocationIQNearbyPOIs,
  requestUserLocation,
} from '../lib/locationService';

export interface MapPlaceResult {
  name: string;
  address: string;
  lat: number;
  lon: number;
  type?: string;
}

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
  places?: MapPlaceResult[];
}

interface MapViewModalProps {
  mapData: MapDataInfo | null;
  onClose: () => void;
  onSelectPlaceContext?: (place: MapPlaceResult) => void;
  onSyncUIContext?: (uiContext: {
    lat: number;
    lon: number;
    zoom: number;
    query: string;
    selectedPlaceName?: string;
    selectedAddress?: string;
    renderedMarkers: string[];
  }) => void;
}

const LOCATIONIQ_KEY = 'pk.87f2b6b571120a1f0a1c1d8bf616453f';

export const MapViewModal: React.FC<MapViewModalProps> = ({
  mapData,
  onClose,
  onSelectPlaceContext,
  onSyncUIContext,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>(mapData?.query || mapData?.destinationName || '');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<MapPlaceResult[]>(mapData?.places || []);
  const [selectedPlace, setSelectedPlace] = useState<MapPlaceResult | null>(null);
  const [activeZoom, setActiveZoom] = useState<number>(16);
  const [activePoiTag, setActivePoiTag] = useState<string>('all');

  // Autocomplete state
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<
    Array<{ display_name: string; name: string; lat: number; lon: number; type: string }>
  >([]);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState<boolean>(false);
  const [showAutocompleteDropdown, setShowAutocompleteDropdown] = useState<boolean>(false);

  const [currentLat, setCurrentLat] = useState<number>(mapData?.lat || 28.6139);
  const [currentLon, setCurrentLon] = useState<number>(mapData?.lon || 77.209);
  const [currentAddress, setCurrentAddress] = useState<string>('Locating user position...');

  const modalTitle = mapData?.title || mapData?.destinationName || searchQuery || 'Location & Navigation Dashboard';

  // 1. Ensure Leaflet CSS
  useEffect(() => {
    const linkId = 'leaflet-css-style';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  // 2. Startup Geolocation & Live Positioning when modal opens
  useEffect(() => {
    if (!mapData?.show) return;

    let isMounted = true;
    async function initStartupLocation() {
      let lat = mapData?.lat || null;
      let lon = mapData?.lon || null;

      if (!lat || !lon) {
        const loc = await requestUserLocation();
        if (loc.latitude && loc.longitude) {
          lat = loc.latitude;
          lon = loc.longitude;
        }
      }

      const activeLat = lat || currentLat;
      const activeLon = lon || currentLon;

      if (isMounted) {
        setCurrentLat(activeLat);
        setCurrentLon(activeLon);
      }

      // Reverse geocode live location using LocationIQ reverse.php
      const rev = await fetchLocationIQReverse(activeLat, activeLon);
      if (isMounted) {
        setCurrentAddress(rev.display_name);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([activeLat, activeLon], 16, { duration: 1.2 });
        }

        renderMapMarkers([
          {
            name: 'My GPS Location',
            address: rev.display_name,
            lat: activeLat,
            lon: activeLon,
            type: 'current_user',
          },
          ...searchResults,
        ]);

        triggerUIContextSync(16, activeLat, activeLon);
      }
    }

    initStartupLocation();

    return () => {
      isMounted = false;
    };
  }, [mapData?.show]);

  // 3. Initialize Leaflet Map Instance (Zoom Level 16)
  useEffect(() => {
    if (!mapData?.show || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const initialZoom = 16;
    const map = L.map(mapContainerRef.current, {
      center: [currentLat, currentLon],
      zoom: initialZoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; LocationIQ GPS & OpenStreetMap',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    map.on('zoomend', () => {
      const newZoom = map.getZoom();
      setActiveZoom(newZoom);
      triggerUIContextSync(newZoom, currentLat, currentLon);
    });

    map.on('moveend', async () => {
      const center = map.getCenter();
      setCurrentLat(center.lat);
      setCurrentLon(center.lng);

      // Perform quiet reverse lookup on move
      const rev = await fetchLocationIQReverse(center.lat, center.lng);
      setCurrentAddress(rev.display_name);

      triggerUIContextSync(map.getZoom(), center.lat, center.lng);
    });

    // Draw initial markers
    renderMapMarkers([
      {
        name: 'My GPS Location',
        address: currentAddress || `Lat: ${currentLat.toFixed(5)}, Lon: ${currentLon.toFixed(5)}`,
        lat: currentLat,
        lon: currentLon,
        type: 'current_user',
      },
      ...searchResults,
    ]);

    // Initial search if query provided
    if (mapData?.query && (!mapData.places || mapData.places.length === 0)) {
      handleLocationIQSearch(mapData.query);
    }

    // Trigger initial sync with AI assistant
    triggerUIContextSync(initialZoom, currentLat, currentLon);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapData?.show]);

  // 4. Render Multi-Markers
  const renderMapMarkers = (places: MapPlaceResult[]) => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();

    places.forEach((place, index) => {
      const isUserLoc = place.type === 'current_user';
      const isSelected = selectedPlace?.lat === place.lat && selectedPlace?.lon === place.lon;

      const markerHtml = isUserLoc
        ? `<div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-cyan-400 opacity-80"></span>
            <div class="relative h-8 w-8 rounded-full bg-cyan-500 border-2 border-white shadow-[0_0_20px_rgba(34,211,238,0.8)] flex items-center justify-center text-white font-bold text-xs">
              📍
            </div>
           </div>`
        : isSelected
        ? `<div class="relative flex items-center justify-center">
            <span class="animate-pulse absolute inline-flex h-12 w-12 rounded-full bg-emerald-400 opacity-70"></span>
            <div class="relative h-9 w-9 rounded-full bg-emerald-600 border-2 border-amber-300 shadow-2xl flex items-center justify-center text-white font-bold text-xs">
              ⭐
            </div>
           </div>`
        : `<div class="relative flex items-center justify-center hover:scale-125 transition-all cursor-pointer">
            <div class="h-8 w-8 rounded-full bg-amber-500 border-2 border-slate-900 shadow-md flex items-center justify-center text-slate-950 font-bold text-xs">
              ${index}
            </div>
           </div>`;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-map-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([place.lat, place.lon], { icon: customIcon });

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; padding: 6px; color: #0f172a; max-width: 240px;">
          <h4 style="margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #0284c7;">${place.name}</h4>
          <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.3;">${place.address}</p>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        setSelectedPlace(place);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([place.lat, place.lon], 16, { duration: 1.2 });
        }
        if (onSelectPlaceContext) {
          onSelectPlaceContext(place);
        }
      });

      markersGroupRef.current?.addLayer(marker);
    });
  };

  // 5. Trigger Real-Time UI Context Sync with AI Assistant Memory
  const triggerUIContextSync = (zoomVal: number, latVal: number, lonVal: number) => {
    if (!onSyncUIContext) return;

    const renderedMarkers = searchResults.map((p) => p.name);
    onSyncUIContext({
      lat: latVal,
      lon: lonVal,
      zoom: zoomVal,
      query: searchQuery,
      selectedPlaceName: selectedPlace?.name,
      selectedAddress: selectedPlace?.address || currentAddress,
      renderedMarkers,
    });
  };

  // 6. Real-Time LocationIQ Autocomplete Search Suggestions
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setAutocompleteSuggestions([]);
      setShowAutocompleteDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsAutocompleteLoading(true);
      const suggestions = await fetchLocationIQAutocomplete(searchQuery, currentLat, currentLon);
      setAutocompleteSuggestions(suggestions);
      setShowAutocompleteDropdown(suggestions.length > 0);
      setIsAutocompleteLoading(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, currentLat, currentLon]);

  // 7. LocationIQ Forward Search
  const handleLocationIQSearch = async (overrideQuery?: string) => {
    const q = overrideQuery || searchQuery;
    if (!q.trim()) return;

    setShowAutocompleteDropdown(false);
    setIsSearching(true);
    try {
      let url = `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(
        q
      )}&format=json&limit=8`;

      if (currentLat && currentLon) {
        url += `&viewbox=${currentLon - 0.2},${currentLat + 0.2},${currentLon + 0.2},${currentLat - 0.2}&bounded=0`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const results: MapPlaceResult[] = data.map((item: any, idx: number) => ({
          name: item.display_name.split(',')[0] || `Place ${idx + 1}`,
          address: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          type: item.type || 'place',
        }));

        setSearchResults(results);

        if (results.length > 0) {
          const topResult = results[0];
          setSelectedPlace(topResult);

          renderMapMarkers([
            {
              name: 'My GPS Location',
              address: currentAddress,
              lat: currentLat,
              lon: currentLon,
              type: 'current_user',
            },
            ...results,
          ]);

          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([topResult.lat, topResult.lon], 16, {
              duration: 1.4,
            });
          }

          if (onSelectPlaceContext) {
            onSelectPlaceContext(topResult);
          }

          triggerUIContextSync(16, topResult.lat, topResult.lon);
        }
      }
    } catch (err) {
      console.warn('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // 8. Select Autocomplete Suggestion
  const handleSelectAutocomplete = (item: { display_name: string; name: string; lat: number; lon: number }) => {
    setSearchQuery(item.name);
    setShowAutocompleteDropdown(false);

    const placeObj: MapPlaceResult = {
      name: item.name,
      address: item.display_name,
      lat: item.lat,
      lon: item.lon,
    };

    setSelectedPlace(placeObj);
    setSearchResults([placeObj]);

    renderMapMarkers([
      {
        name: 'My GPS Location',
        address: currentAddress,
        lat: currentLat,
        lon: currentLon,
        type: 'current_user',
      },
      placeObj,
    ]);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([item.lat, item.lon], 16, { duration: 1.3 });
    }

    if (onSelectPlaceContext) {
      onSelectPlaceContext(placeObj);
    }

    triggerUIContextSync(16, item.lat, item.lon);
  };

  // 9. Fetch Nearby POIs by Category Tag
  const handleFilterPoiTag = async (tag: string) => {
    setActivePoiTag(tag);
    if (tag === 'all') {
      setSearchResults([]);
      renderMapMarkers([
        {
          name: 'My GPS Location',
          address: currentAddress,
          lat: currentLat,
          lon: currentLon,
          type: 'current_user',
        },
      ]);
      return;
    }

    setIsSearching(true);
    const pois = await fetchLocationIQNearbyPOIs(currentLat, currentLon, tag);
    const results: MapPlaceResult[] = pois.map((p) => ({
      name: p.name,
      address: p.address,
      lat: p.lat,
      lon: p.lon,
      type: p.type,
    }));

    setSearchResults(results);
    setIsSearching(false);

    renderMapMarkers([
      {
        name: 'My GPS Location',
        address: currentAddress,
        lat: currentLat,
        lon: currentLon,
        type: 'current_user',
      },
      ...results,
    ]);

    triggerUIContextSync(activeZoom, currentLat, currentLon);
  };

  // 10. Center map back on current GPS location
  const handleLocateMe = async () => {
    const loc = await requestUserLocation();
    const lat = loc.latitude || currentLat;
    const lon = loc.longitude || currentLon;

    setCurrentLat(lat);
    setCurrentLon(lon);

    const rev = await fetchLocationIQReverse(lat, lon);
    setCurrentAddress(rev.display_name);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lon], 16, { duration: 1.2 });
    }

    renderMapMarkers([
      {
        name: 'My GPS Location',
        address: rev.display_name,
        lat,
        lon,
        type: 'current_user',
      },
      ...searchResults,
    ]);

    triggerUIContextSync(16, lat, lon);
  };

  if (!mapData || !mapData.show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-7xl h-[92vh] bg-slate-900/95 border border-sky-500/40 rounded-3xl shadow-[0_0_80px_rgba(56,189,248,0.35)] overflow-hidden flex flex-col">
        {/* Top Header Dashboard Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between px-5 py-3 border-b border-sky-500/20 bg-slate-950/80 gap-3 z-30">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/15 border border-sky-400/40 text-cyan-300">
              <Navigation className="h-6 w-6 animate-pulse text-cyan-300" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-sky-100 flex items-center gap-2">
                {modalTitle}
                <span className="px-2.5 py-0.5 text-[10px] uppercase font-extrabold rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                  Zoom Level {activeZoom}
                </span>
              </h3>
              <p className="text-xs text-sky-300/70 flex items-center gap-1.5 line-clamp-1">
                <Compass className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
                <span>{currentAddress}</span>
              </p>
            </div>
          </div>

          {/* Integrated Autocomplete Search Bar */}
          <div className="relative flex items-center gap-2 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (autocompleteSuggestions.length > 0) setShowAutocompleteDropdown(true);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleLocationIQSearch()}
                placeholder="Search custom address, shop, hospital, mandir, or village..."
                className="w-full bg-slate-950/90 border border-sky-500/40 rounded-2xl px-4 py-2.5 pl-10 pr-8 text-xs text-sky-100 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-inner"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-cyan-400" />
              {isAutocompleteLoading ? (
                <Loader2 className="absolute right-3 top-3 h-4 w-4 text-cyan-400 animate-spin" />
              ) : (
                searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setShowAutocompleteDropdown(false);
                    }}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs p-1"
                  >
                    ✕
                  </button>
                )
              )}

              {/* Autocomplete Prediction Dropdown List */}
              {showAutocompleteDropdown && autocompleteSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-12 bg-slate-900 border border-sky-500/40 rounded-2xl shadow-2xl overflow-hidden z-[1000] max-h-60 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-extrabold bg-slate-950/80 text-cyan-300 border-b border-sky-500/20">
                    LocationIQ Search Suggestions
                  </div>
                  {autocompleteSuggestions.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectAutocomplete(item)}
                      className="px-4 py-2.5 hover:bg-sky-500/20 border-b border-slate-800/80 cursor-pointer transition-all flex items-start gap-2.5 text-xs text-sky-100"
                    >
                      <MapPin className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-cyan-200">{item.name}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">{item.display_name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => handleLocationIQSearch()}
              disabled={isSearching}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 font-bold text-xs shadow-lg transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>Search</span>
            </button>

            <button
              onClick={handleLocateMe}
              title="Center on Live GPS Position (Zoom 16)"
              className="p-2.5 rounded-2xl bg-slate-800/90 border border-sky-400/40 text-cyan-300 hover:bg-slate-700/80 transition-all flex-shrink-0"
            >
              <LocateFixed className="h-5 w-5" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all self-end lg:self-auto"
            aria-label="Close Map View"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* POI Filter Quick Categories Bar */}
        <div className="px-5 py-2 bg-slate-950/60 border-b border-sky-500/20 flex items-center gap-2 overflow-x-auto z-20">
          <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1 flex-shrink-0 mr-1">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> POIs:
          </span>
          {[
            { id: 'all', label: 'All', icon: Layers },
            { id: 'hospital', label: 'Hospitals', icon: Hospital },
            { id: 'restaurant', label: 'Food & Cafes', icon: Utensils },
            { id: 'atm', label: 'ATMs & Banks', icon: Landmark },
            { id: 'fuel', label: 'Fuel Pumps', icon: Fuel },
            { id: 'place_of_worship', label: 'Temples & Mandirs', icon: Building2 },
          ].map((poi) => {
            const IconComp = poi.icon;
            const isAct = activePoiTag === poi.id;
            return (
              <button
                key={poi.id}
                onClick={() => handleFilterPoiTag(poi.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 border ${
                  isAct
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.3)]'
                    : 'bg-slate-900/60 border-sky-500/10 text-slate-400 hover:bg-slate-800 hover:text-sky-200'
                }`}
              >
                <IconComp className="h-3.5 w-3.5" />
                <span>{poi.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Viewport: Map Canvas + Interactive Sidebar */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* Leaflet Interactive Map */}
          <div className="flex-1 relative bg-slate-950 min-h-[380px]">
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {/* Floating Live GPS Status Badge */}
            <div className="absolute top-3 left-3 z-[400] bg-slate-950/90 border border-sky-400/40 rounded-2xl px-3.5 py-2 text-xs text-cyan-200 backdrop-blur-md shadow-2xl flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-cyan-400 animate-spin" />
              <span>
                <strong>GPS Coordinates:</strong> {currentLat.toFixed(5)}, {currentLon.toFixed(5)}
              </span>
            </div>

            {/* AI Vision Sync Status Badge */}
            <div className="absolute bottom-3 left-3 z-[400] bg-slate-950/90 border border-emerald-400/40 rounded-full px-3.5 py-1 text-[11px] font-bold text-emerald-300 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
              <Eye className="h-3.5 w-3.5 text-emerald-400" />
              <span>AI Vision Sync: Active</span>
            </div>
          </div>

          {/* Right Sidebar: Rendered POIs & Navigation Steps */}
          <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-sky-500/20 bg-slate-950/80 flex flex-col max-h-[320px] lg:max-h-none overflow-hidden">
            <div className="px-4 py-3 border-b border-sky-500/20 bg-slate-900/80 flex items-center justify-between">
              <span className="text-xs font-bold text-sky-200 uppercase tracking-wider flex items-center gap-1.5">
                <Store className="h-4 w-4 text-cyan-400" /> Map Elements ({searchResults.length})
              </span>
              {selectedPlace && (
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  Selected
                </span>
              )}
            </div>

            {/* Results / POI List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <Building2 className="h-9 w-9 text-sky-400/40" />
                  <p>Type any location name or select a POI category above to render map markers.</p>
                </div>
              ) : (
                searchResults.map((place, idx) => {
                  const isSel = selectedPlace?.lat === place.lat && selectedPlace?.lon === place.lon;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedPlace(place);
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.flyTo([place.lat, place.lon], 16, { duration: 1.2 });
                        }
                        if (onSelectPlaceContext) {
                          onSelectPlaceContext(place);
                        }
                        triggerUIContextSync(activeZoom, place.lat, place.lon);
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer text-xs ${
                        isSel
                          ? 'bg-sky-500/25 border-cyan-400/80 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.25)]'
                          : 'bg-slate-900/60 border-sky-500/10 text-slate-300 hover:bg-slate-800/60 hover:border-sky-400/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-extrabold text-cyan-300 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
                          <span>{place.name}</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-sky-200 border border-slate-700">
                          #{idx + 1}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{place.address}</p>
                    </div>
                  );
                })
              )}

              {/* Navigation Steps */}
              {mapData.steps && mapData.steps.length > 0 && (
                <div className="mt-4 pt-3 border-t border-sky-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Navigation className="h-3.5 w-3.5 text-cyan-400" /> Route Navigation
                    </span>
                    {mapData.distanceKm && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200">
                        {mapData.distanceKm} km ({mapData.durationMin || 10} min)
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 text-[11px] text-slate-200 max-h-40 overflow-y-auto pr-1">
                    {mapData.steps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 bg-slate-900/80 p-2 rounded-xl border border-sky-500/10">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-3 border-t border-sky-500/20 bg-slate-950/90 text-[11px] text-sky-300/80 flex items-center justify-between">
              <span>Location Context Synced with Yui</span>
              {selectedPlace && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedPlace.lat},${selectedPlace.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:underline flex items-center gap-1 font-bold text-[11px]"
                >
                  Google Maps <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-sky-500/20 bg-slate-950/90 flex items-center justify-between text-xs text-sky-300/80">
          <span>Voice-first interaction active. Say "मैप बंद करो" or click button to close map dashboard.</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-sky-500/20 border border-sky-400/40 text-sky-100 font-bold hover:bg-sky-500/30 transition-all shadow-md"
          >
            Close Map
          </button>
        </div>
      </div>
    </div>
  );
};
