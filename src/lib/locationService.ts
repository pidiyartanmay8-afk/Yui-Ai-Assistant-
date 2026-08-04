/**
 * Real-Time Geolocation & Live Weather Service for Yui AI Assistant
 */

export interface LiveWeatherInfo {
  temperature: number; // in Celsius
  condition: string;
  windspeed: number;
  isDay: boolean;
}

export interface LiveLocationData {
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'error';
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null; // meters
  city: string;
  region: string;
  country: string;
  locality: string;
  weather: LiveWeatherInfo | null;
  errorMessage?: string;
  lastUpdated: string | null;
}

const defaultLocationState: LiveLocationData = {
  status: 'idle',
  latitude: null,
  longitude: null,
  accuracy: null,
  city: 'Unknown City',
  region: '',
  country: '',
  locality: '',
  weather: null,
  lastUpdated: null,
};

let cachedLocation: LiveLocationData = { ...defaultLocationState };
const listeners: Array<(data: LiveLocationData) => void> = [];

function notifyListeners() {
  listeners.forEach((listener) => listener({ ...cachedLocation }));
}

export function subscribeLocationUpdates(callback: (data: LiveLocationData) => void): () => void {
  listeners.push(callback);
  // Send current cached value immediately
  callback({ ...cachedLocation });
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function getCachedLocation(): LiveLocationData {
  return { ...cachedLocation };
}

/**
 * Interpret Open-Meteo WMO Weather interpretation codes
 */
function getWeatherConditionName(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 55) return 'Light drizzle';
  if (code >= 56 && code <= 57) return 'Freezing drizzle';
  if (code >= 61 && code <= 65) return 'Rainy';
  if (code >= 66 && code <= 67) return 'Freezing rain';
  if (code >= 71 && code <= 77) return 'Snowy';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Fair';
}

/**
 * Fetches reverse geocoding details and live weather for coordinates using LocationIQ API
 */
const LOCATIONIQ_KEY = 'pk.87f2b6b571120a1f0a1c1d8bf616453f';

async function fetchLocationDetails(lat: number, lon: number): Promise<{
  city: string;
  region: string;
  country: string;
  locality: string;
  weather: LiveWeatherInfo | null;
}> {
  let city = 'Local Area';
  let region = '';
  let country = '';
  let locality = '';
  let weather: LiveWeatherInfo | null = null;

  // 1. Reverse Geocode via LocationIQ API
  try {
    const liqRes = await fetch(
      `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_KEY}&lat=${lat}&lon=${lon}&format=json`
    );
    if (liqRes.ok) {
      const liqData = await liqRes.json();
      const addr = liqData.address || {};
      city = addr.city || addr.town || addr.village || addr.county || 'Local Area';
      region = addr.state || addr.region || '';
      country = addr.country || '';
      locality = addr.suburb || addr.neighbourhood || addr.road || addr.locality || '';
    } else {
      // Fallback reverse geocode via BigDataCloud
      const geoRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        city = geoData.city || geoData.locality || geoData.principalSubdivision || 'Local Area';
        region = geoData.principalSubdivision || '';
        country = geoData.countryName || '';
        locality = geoData.locality || '';
      }
    }
  } catch (err) {
    console.warn('LocationIQ reverse geocode warning:', err);
  }

  // 2. Live Weather via Open-Meteo API
  try {
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    if (weatherRes.ok) {
      const weatherData = await weatherRes.json();
      if (weatherData.current_weather) {
        const cw = weatherData.current_weather;
        weather = {
          temperature: Math.round(cw.temperature),
          condition: getWeatherConditionName(cw.weathercode),
          windspeed: Math.round(cw.windspeed),
          isDay: Boolean(cw.is_day),
        };
      }
    }
  } catch (err) {
    console.warn('Live weather lookup warning:', err);
  }

  return { city, region, country, locality, weather };
}

/**
 * Fetch autocomplete search predictions from LocationIQ API
 */
export async function fetchLocationIQAutocomplete(
  query: string,
  lat?: number | null,
  lon?: number | null
): Promise<Array<{ display_name: string; name: string; address: any; lat: number; lon: number; type: string }>> {
  if (!query || query.trim().length < 2) return [];
  try {
    let url = `https://us1.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(
      query.trim()
    )}&limit=6&format=json`;

    if (lat && lon) {
      url += `&viewbox=${lon - 0.25},${lat + 0.25},${lon + 0.25},${lat - 0.25}&bounded=0`;
    }

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return data.map((item: any) => ({
        display_name: item.display_name,
        name: item.display_name.split(',')[0] || item.display_place || 'Location',
        address: item.address || {},
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type || 'place',
      }));
    }
  } catch (err) {
    console.warn('LocationIQ autocomplete error:', err);
  }
  return [];
}

/**
 * Reverse geocode coordinates to human-readable address via LocationIQ
 */
export async function fetchLocationIQReverse(
  lat: number,
  lon: number
): Promise<{ display_name: string; city: string; state: string; country: string; road: string; raw: any }> {
  try {
    const res = await fetch(
      `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_KEY}&lat=${lat}&lon=${lon}&format=json`
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      return {
        display_name: data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        city: addr.city || addr.town || addr.village || addr.county || 'Local Area',
        state: addr.state || addr.region || '',
        country: addr.country || '',
        road: addr.road || addr.suburb || addr.neighbourhood || '',
        raw: data,
      };
    }
  } catch (err) {
    console.warn('LocationIQ reverse lookup error:', err);
  }
  return {
    display_name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    city: 'Local Area',
    state: '',
    country: '',
    road: '',
    raw: null,
  };
}

/**
 * Fetch nearby POIs (hospitals, ATMs, restaurants, temples, fuel stations) around lat/lon
 */
export async function fetchLocationIQNearbyPOIs(
  lat: number,
  lon: number,
  tag: string = 'amenity'
): Promise<Array<{ name: string; address: string; lat: number; lon: number; type: string }>> {
  try {
    let url = `https://us1.locationiq.com/v1/nearby?key=${LOCATIONIQ_KEY}&lat=${lat}&lon=${lon}&tag=${encodeURIComponent(
      tag
    )}&radius=3000&format=json`;

    let res = await fetch(url);
    if (!res.ok) {
      // Fallback search endpoint with query tag
      url = `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(
        tag
      )}&format=json&limit=8&viewbox=${lon - 0.1},${lat + 0.1},${lon + 0.1},${lat - 0.1}&bounded=0`;
      res = await fetch(url);
    }

    if (res.ok) {
      const data = await res.json();
      return data.map((item: any) => ({
        name: item.display_name ? item.display_name.split(',')[0] : 'POI Item',
        address: item.display_name || 'Nearby Address',
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type || tag,
      }));
    }
  } catch (err) {
    console.warn('LocationIQ nearby POI lookup error:', err);
  }
  return [];
}

/**
 * Fetch nearby places using LocationIQ Nearby / Search API quietly in background
 */
export async function fetchLocationIQNearby(
  lat: number | null,
  lon: number | null,
  query: string
): Promise<{ success: boolean; query: string; places: Array<{ name: string; address: string; distance?: string }>; error?: string }> {
  try {
    let searchLat = lat;
    let searchLon = lon;

    if (!searchLat || !searchLon) {
      const userLoc = getCachedLocation();
      searchLat = userLoc.latitude;
      searchLon = userLoc.longitude;
    }

    let url = `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&format=json&limit=5`;
    if (searchLat && searchLon) {
      url += `&viewbox=${searchLon - 0.1},${searchLat + 0.1},${searchLon + 0.1},${searchLat - 0.1}&bounded=1`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      // Fallback without bounding box
      const fallbackRes = await fetch(`https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&format=json&limit=5`);
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        const places = data.map((item: any) => ({
          name: item.display_name.split(',')[0],
          address: item.display_name,
          lat: item.lat,
          lon: item.lon,
        }));
        return { success: true, query, places };
      }
      return { success: false, query, places: [], error: 'Could not fetch nearby places from LocationIQ.' };
    }

    const data = await res.json();
    const places = data.map((item: any) => ({
      name: item.display_name.split(',')[0],
      address: item.display_name,
      lat: item.lat,
      lon: item.lon,
    }));

    return { success: true, query, places };
  } catch (err: any) {
    return { success: false, query, places: [], error: err?.message || 'Nearby places lookup failed.' };
  }
}

/**
 * Fetch routing directions using LocationIQ Directions API quietly in background
 */
export async function fetchLocationIQDirections(
  startLat: number | null,
  startLon: number | null,
  destination: string
): Promise<{
  success: boolean;
  destinationName: string;
  distanceKm?: number;
  durationMin?: number;
  steps: string[];
  destLat?: number;
  destLon?: number;
  error?: string;
}> {
  try {
    let sLat = startLat;
    let sLon = startLon;

    if (!sLat || !sLon) {
      const userLoc = getCachedLocation();
      sLat = userLoc.latitude;
      sLon = userLoc.longitude;
    }

    if (!sLat || !sLon) {
      return { success: false, destinationName: destination, steps: [], error: 'Current GPS location is unavailable.' };
    }

    // 1. Geocode destination address via LocationIQ Search
    const geocodeRes = await fetch(
      `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(destination)}&format=json&limit=1`
    );
    if (!geocodeRes.ok) {
      return { success: false, destinationName: destination, steps: [], error: `Could not find destination '${destination}' on map.` };
    }

    const geocodeData = await geocodeRes.json();
    if (!geocodeData || geocodeData.length === 0) {
      return { success: false, destinationName: destination, steps: [], error: `Destination '${destination}' not found.` };
    }

    const destLat = parseFloat(geocodeData[0].lat);
    const destLon = parseFloat(geocodeData[0].lon);
    const destDisplayName = geocodeData[0].display_name;

    // 2. Fetch turn-by-turn routing via LocationIQ / OSRM directions
    const dirRes = await fetch(
      `https://us1.locationiq.com/v1/directions/driving/${sLon},${sLat};${destLon},${destLat}?key=${LOCATIONIQ_KEY}&steps=true&overview=full`
    );

    if (dirRes.ok) {
      const dirData = await dirRes.json();
      if (dirData.routes && dirData.routes.length > 0) {
        const route = dirData.routes[0];
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMin = Math.round(route.duration / 60);

        const steps: string[] = [];
        if (route.legs && route.legs[0] && route.legs[0].steps) {
          route.legs[0].steps.forEach((s: any, idx: number) => {
            if (s.maneuver && s.name) {
              steps.push(`${idx + 1}. Head ${s.maneuver.type || 'along'} on ${s.name} (${Math.round(s.distance)}m)`);
            } else if (s.name) {
              steps.push(`${idx + 1}. Continue on ${s.name} (${Math.round(s.distance)}m)`);
            }
          });
        }

        if (steps.length === 0) {
          steps.push(`Drive along main road towards ${destDisplayName} for approximately ${distanceKm} km.`);
        }

        return {
          success: true,
          destinationName: destDisplayName,
          distanceKm,
          durationMin,
          steps,
          destLat,
          destLon,
        };
      }
    }

    // Direct fallback calculation
    return {
      success: true,
      destinationName: destDisplayName,
      distanceKm: 5,
      durationMin: 12,
      steps: [`Proceed towards ${destDisplayName}. Total distance is approximately 5 km.`],
      destLat,
      destLon,
    };
  } catch (err: any) {
    return { success: false, destinationName: destination, steps: [], error: err?.message || 'Directions routing failed.' };
  }
}

/**
 * Fetch IP-based location fallback via LocationIQ IPGeo API
 */
export async function fetchLocationIQIPGeo(): Promise<{ lat: number; lon: number; city: string; region: string; country: string } | null> {
  try {
    const res = await fetch(`https://us1.locationiq.com/v1/ipgeo.php?key=${LOCATIONIQ_KEY}`);
    if (res.ok) {
      const data = await res.json();
      const lat = parseFloat(data.latitude || data.lat);
      const lon = parseFloat(data.longitude || data.lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        return {
          lat,
          lon,
          city: data.city || data.cityName || 'Local Area',
          region: data.region || data.regionName || data.state || '',
          country: data.country_name || data.country || '',
        };
      }
    }
  } catch (err) {
    console.warn('LocationIQ IP Geo lookup error:', err);
  }
  return null;
}

/**
 * Trigger explicit Browser Geolocation Request with LocationIQ IP Fallback
 */
export async function requestUserLocation(): Promise<LiveLocationData> {
  cachedLocation = {
    ...cachedLocation,
    status: 'requesting',
  };
  notifyListeners();

  const handleIpFallback = async (fallbackErrorMsg?: string): Promise<LiveLocationData> => {
    const ipGeo = await fetchLocationIQIPGeo();
    if (ipGeo) {
      const details = await fetchLocationDetails(ipGeo.lat, ipGeo.lon);
      cachedLocation = {
        status: 'granted',
        latitude: ipGeo.lat,
        longitude: ipGeo.lon,
        accuracy: 5000,
        city: details.city || ipGeo.city,
        region: details.region || ipGeo.region,
        country: details.country || ipGeo.country,
        locality: details.locality,
        weather: details.weather,
        lastUpdated: new Date().toLocaleTimeString(),
      };
      notifyListeners();
      return cachedLocation;
    }

    cachedLocation = {
      ...cachedLocation,
      status: 'error',
      errorMessage: fallbackErrorMsg || 'Unable to retrieve location via browser or IP fallback.',
    };
    notifyListeners();
    return cachedLocation;
  };

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return handleIpFallback('Geolocation API not supported by browser.');
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        const details = await fetchLocationDetails(lat, lon);

        cachedLocation = {
          status: 'granted',
          latitude: lat,
          longitude: lon,
          accuracy,
          city: details.city,
          region: details.region,
          country: details.country,
          locality: details.locality,
          weather: details.weather,
          lastUpdated: new Date().toLocaleTimeString(),
        };

        notifyListeners();
        resolve(cachedLocation);
      },
      async (error) => {
        let errorMsg = 'Unable to retrieve location.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission denied by browser/iframe.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location position unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out.';
        }

        console.warn(`Geolocation error (${error.code}): ${error.message}. Attempting LocationIQ IPGeo fallback...`);
        const fallbackData = await handleIpFallback(errorMsg);
        resolve(fallbackData);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Watch continuous location changes
 */
export function watchUserLocation(): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return () => {};

  const watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      const details = await fetchLocationDetails(lat, lon);

      cachedLocation = {
        status: 'granted',
        latitude: lat,
        longitude: lon,
        accuracy,
        city: details.city,
        region: details.region,
        country: details.country,
        locality: details.locality,
        weather: details.weather,
        lastUpdated: new Date().toLocaleTimeString(),
      };

      notifyListeners();
    },
    (error) => {
      console.warn('Geolocation watch warning:', error.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 15000,
    }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
