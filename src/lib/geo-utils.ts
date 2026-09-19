/**
 * Geographic and location utility helpers for PlayNear
 * Handles client-side geocoding, distance calculation, and coordinates fallback
 */

export interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number;
}

// Built-in coordinates for Indian cities and key hubs
export const CITY_COORDINATES: Record<string, Coordinates> = {
  kochi: { lat: 9.9312, lng: 76.2673 },
  cochin: { lat: 9.9312, lng: 76.2673 },
  ernakulam: { lat: 9.9816, lng: 76.2999 },
  moodbidri: { lat: 13.0694, lng: 74.9972 },
  moodabidri: { lat: 13.0694, lng: 74.9972 },
  kasaragod: { lat: 12.5102, lng: 74.9852 },
  kasargod: { lat: 12.5102, lng: 74.9852 },
  mangalore: { lat: 12.9141, lng: 74.8560 },
  mangaluru: { lat: 12.9141, lng: 74.8560 },
  udupi: { lat: 13.3409, lng: 74.7421 },
  manipal: { lat: 13.3525, lng: 74.7928 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  mysore: { lat: 12.2958, lng: 76.6394 },
  mysuru: { lat: 12.2958, lng: 76.6394 },
  mumbai: { lat: 19.0760, lng: 72.8777 },
  pune: { lat: 18.5204, lng: 73.8567 },
  thane: { lat: 19.2183, lng: 72.9781 },
  delhi: { lat: 28.6139, lng: 77.2090 },
  "new delhi": { lat: 28.6139, lng: 77.2090 },
  noida: { lat: 28.5355, lng: 77.3910 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  hyderabad: { lat: 17.3850, lng: 78.4867 },
  secunderabad: { lat: 17.4399, lng: 78.4983 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  madras: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  calcutta: { lat: 22.5726, lng: 88.3639 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  surat: { lat: 21.1702, lng: 72.8311 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  goa: { lat: 15.2993, lng: 74.1240 },
  panaji: { lat: 15.4909, lng: 73.8278 },
  kozhikode: { lat: 11.2588, lng: 75.7804 },
  calicut: { lat: 11.2588, lng: 75.7804 },
  kannur: { lat: 11.8745, lng: 75.3704 },
  thrissur: { lat: 10.5276, lng: 76.2144 },
  kollam: { lat: 8.8932, lng: 76.6141 },
  thiruvananthapuram: { lat: 8.5241, lng: 76.9366 },
  trivandrum: { lat: 8.5241, lng: 76.9366 },
  malappuram: { lat: 11.0510, lng: 76.0711 },
  wayanad: { lat: 11.6854, lng: 76.1320 },
  palakkad: { lat: 10.7867, lng: 76.6548 },
  alappuzha: { lat: 9.4981, lng: 76.3388 },
  kottayam: { lat: 9.5916, lng: 76.5222 },
  coimbatore: { lat: 11.0168, lng: 76.9558 },
  madurai: { lat: 9.9252, lng: 78.1198 },
  chandrapur: { lat: 19.9615, lng: 79.2961 },
  bhopal: { lat: 23.2599, lng: 77.4126 },
  indore: { lat: 22.7196, lng: 75.8577 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  kanpur: { lat: 26.4499, lng: 80.3319 },
  patna: { lat: 25.5941, lng: 85.1376 },
  bhubaneswar: { lat: 20.2961, lng: 85.8245 },
  visakhapatnam: { lat: 17.6868, lng: 83.2185 },
  vizag: { lat: 17.6868, lng: 83.2185 },
  vijayawada: { lat: 16.5062, lng: 80.6480 },
  kanhangad: { lat: 12.3087, lng: 75.0867 },
  nileshwar: { lat: 12.2536, lng: 75.1326 },
  payyanur: { lat: 12.1023, lng: 75.2014 },
  puttur: { lat: 12.7634, lng: 75.2003 },
  bantwal: { lat: 12.8953, lng: 75.0345 },
  belthangady: { lat: 13.0039, lng: 75.2635 },
  sullia: { lat: 12.5604, lng: 75.3908 },
  karkala: { lat: 13.2127, lng: 74.9961 },
  kundapura: { lat: 13.6268, lng: 74.6934 },
  thalassery: { lat: 11.7480, lng: 75.4894 },
  vadakara: { lat: 11.6087, lng: 75.5916 },
  sanfrancisco: { lat: 37.7749, lng: -122.4194 },
  london: { lat: 51.5074, lng: -0.1278 },
  dubai: { lat: 25.2048, lng: 55.2708 },
};

/**
 * Generate a deterministic slight jitter so multiple tournaments in the same city
 * don't overlap completely on the exact same coordinate.
 */
function getCoordinateJitter(id: string, index = 0): { latOffset: number; lngOffset: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const factor = (Math.abs(hash) % 100) / 100;
  const angle = (index * 60 + factor * 360) * (Math.PI / 180);
  // Radius ~ 800m to 2.5km
  const radius = 0.008 + factor * 0.015;
  return {
    latOffset: Math.sin(angle) * radius,
    lngOffset: Math.cos(angle) * radius,
  };
}

/**
 * Resolve coordinates for a tournament based on venue_lat/lng or city name.
 */
export function resolveTournamentCoordinates(
  tournament: {
    id: string;
    venue_lat?: number | null;
    venue_lng?: number | null;
    venue_city?: string | null;
    venue_address?: string | null;
    venue_name?: string | null;
  },
  index = 0
): Coordinates {
  // If valid coordinates are stored in database
  if (
    typeof tournament.venue_lat === "number" &&
    typeof tournament.venue_lng === "number" &&
    !isNaN(tournament.venue_lat) &&
    !isNaN(tournament.venue_lng) &&
    (tournament.venue_lat !== 0 || tournament.venue_lng !== 0)
  ) {
    return {
      lat: tournament.venue_lat,
      lng: tournament.venue_lng,
    };
  }

  // Look up by city or address
  const textToSearch = [
    tournament.venue_city || "",
    tournament.venue_address || "",
    tournament.venue_name || "",
  ].join(" ").toLowerCase();

  for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
    if (textToSearch.includes(cityName)) {
      const jitter = getCoordinateJitter(tournament.id || "tourney", index);
      return {
        lat: coords.lat + jitter.latOffset,
        lng: coords.lng + jitter.lngOffset,
      };
    }
  }

  // Default fallback: India center (Kochi/Bangalore region)
  const defaultBase = CITY_COORDINATES["kochi"];
  const jitter = getCoordinateJitter(tournament.id || "fallback", index);
  return {
    lat: defaultBase.lat + jitter.latOffset,
    lng: defaultBase.lng + jitter.lngOffset,
  };
}

/**
 * Calculate distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance into a human-readable string (e.g. "2.4 km" or "850 m")
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

export interface PlaceSearchResult {
  name: string;
  lat: number;
  lng: number;
  type?: string;
}

/**
 * Search places by query text (checks local dictionary + OpenStreetMap geocoder)
 */
export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const results: PlaceSearchResult[] = [];

  // 1. Fast match against local dictionary
  for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
    if (cityName.includes(q) || q.includes(cityName)) {
      results.push({
        name: cityName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        lat: coords.lat,
        lng: coords.lng,
        type: "City",
      });
    }
  }

  // 2. Fetch from OpenStreetMap Nominatim for accurate addresses & venues
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
      {
        signal: controller.signal,
        headers: {
          "Accept-Language": "en",
        },
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            // Avoid duplicate near coords
            if (!results.some(r => Math.abs(r.lat - lat) < 0.01 && Math.abs(r.lng - lng) < 0.01)) {
              results.push({
                name: item.display_name.split(",").slice(0, 3).join(","),
                lat,
                lng,
                type: item.type || "Location",
              });
            }
          }
        }
      }
    }
  } catch {
    // Network or offline fallback
  }

  return results.slice(0, 6);
}

/**
 * Reverse geocode coordinates to a clean place name (City, State / Area)
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // 1. Check if near any predefined Indian city in CITY_COORDINATES (< 12 km)
  let closestCity: string | null = null;
  let minDistance = 12; // km threshold
  for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
    const dist = calculateDistanceKm(lat, lng, coords.lat, coords.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestCity = cityName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }

  if (closestCity && minDistance < 5) {
    return closestCity;
  }

  // 2. Query Nominatim reverse geocode
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
      {
        signal: controller.signal,
        headers: { "Accept-Language": "en" },
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address;
      if (addr) {
        const place = addr.city || addr.town || addr.village || addr.suburb || addr.county || addr.district;
        const state = addr.state;
        if (place && state) return `${place}, ${state}`;
        if (place) return place;
        if (data.display_name) return data.display_name.split(",").slice(0, 2).join(",");
      }
    }
  } catch {
    // fallback
  }

  return closestCity || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

const STORAGE_KEY = "localsports_user_custom_location";

export function getStoredUserLocation(): { coords: Coordinates; name: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number") {
      return {
        coords: { lat: parsed.lat, lng: parsed.lng, accuracy: parsed.accuracy },
        name: parsed.name || "My Location",
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function setStoredUserLocation(coords: Coordinates, name: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy, name })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function clearStoredUserLocation(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
