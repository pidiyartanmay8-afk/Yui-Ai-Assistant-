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
 * Fetches reverse geocoding details and live weather for coordinates
 */
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

  // 1. Reverse Geocode via BigDataCloud (Free, CORS-enabled, reliable)
  try {
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
  } catch (err) {
    console.warn('Reverse geocode lookup warning:', err);
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
 * Trigger explicit Browser Geolocation Request
 */
export async function requestUserLocation(): Promise<LiveLocationData> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    cachedLocation = {
      ...cachedLocation,
      status: 'error',
      errorMessage: 'Geolocation is not supported by this browser.',
    };
    notifyListeners();
    return cachedLocation;
  }

  cachedLocation = {
    ...cachedLocation,
    status: 'requesting',
  };
  notifyListeners();

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
      (error) => {
        let errorMsg = 'Unable to retrieve location.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission denied by user.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location information unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out.';
        }

        cachedLocation = {
          ...cachedLocation,
          status: error.code === error.PERMISSION_DENIED ? 'denied' : 'error',
          errorMessage: errorMsg,
        };

        notifyListeners();
        resolve(cachedLocation);
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
