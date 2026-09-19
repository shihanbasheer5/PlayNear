/**
 * Helper utilities for Google Maps Platform integrations
 */

export const DEFAULT_MAP_CENTER = {
  lat: 37.7749, // San Francisco default
  lng: -122.4194,
};

export const DEFAULT_MAP_ZOOM = 11;

export function getGoogleMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
}

export function isGoogleMapsConfigured(): boolean {
  const key = getGoogleMapsApiKey();
  return !!key && key.trim().length > 0 && key !== 'your-google-maps-api-key';
}

export function generateStaticMapUrl(lat: number, lng: number, zoom: number = 14, width: number = 600, height: number = 300): string {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || apiKey === 'your-google-maps-api-key') {
    // Return an OpenStreetMap / Stamen fallback or placeholder when API key isn't provided
    return `https://images.unsplash.com/photo-1524661135-423995f22d0b?w=${width}&h=${height}&fit=crop`;
  }
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&scale=2&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
}

export function getGoogleMapsDirectionsUrl(lat: number, lng: number, address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || `${lat},${lng}`)}`;
}
