import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

export const GOOGLE_MAPS_API_KEY = 
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBLjTPlCjrlu2JGhlwzIcMe4a-O_f-jnQA';

// Tift County Bounding Box
export const TIFT_BOUNDS = {
  south: 31.20,
  west: -83.75,
  north: 31.65,
  east: -83.30
};

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
    googleMapsAuthFailed?: boolean;
  }
}

// Global hook to suppress Google's intrusive modal dialog
export function dismissGoogleErrorModals() {
  if (typeof document === 'undefined') return;
  try {
    document.querySelectorAll('div[role="dialog"], .dismissButton, .gm-err-container, .gm-err-content').forEach((el) => {
      if (
        el.textContent?.includes("Google Maps") || 
        el.textContent?.includes("Do you own this website") ||
        el.textContent?.includes("can't load Google Maps correctly")
      ) {
        const parent = el.closest('div[style*="z-index"]') || el.parentElement || el;
        parent.remove();
      }
    });
  } catch {}
}

// Intercept Google Maps Authentication Failure immediately
if (typeof window !== 'undefined') {
  const originalAuthFailure = window.gm_authFailure;
  window.gm_authFailure = () => {
    console.warn('Google Maps authentication notice: billing/API key needs activation in Google Cloud Console.');
    window.googleMapsAuthFailed = true;
    dismissGoogleErrorModals();
    setTimeout(dismissGoogleErrorModals, 100);
    setTimeout(dismissGoogleErrorModals, 500);
    setTimeout(dismissGoogleErrorModals, 1500);
    if (typeof originalAuthFailure === 'function') {
      try { originalAuthFailure(); } catch {}
    }
  };
}

export function isGoogleMapsAuthFailed(): boolean {
  return typeof window !== 'undefined' && Boolean(window.googleMapsAuthFailed);
}

let googleMapsPromise: Promise<any> | null = null;

export async function loadGoogleMaps(): Promise<any> {
  if (typeof window !== 'undefined' && window.google?.maps?.places) {
    return window.google;
  }

  if (!googleMapsPromise) {
    setOptions({
      key: GOOGLE_MAPS_API_KEY,
      v: 'weekly'
    });

    googleMapsPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('places'),
      importLibrary('geometry')
    ]).then(() => {
      setTimeout(dismissGoogleErrorModals, 200);
      return window.google;
    }).catch((err) => {
      dismissGoogleErrorModals();
      if (window.google?.maps) {
        return window.google;
      }
      throw err;
    });
  }

  return googleMapsPromise;
}

// Google Geocoding for Rooftop accuracy in Tift County
export async function geocodeWithGoogle(address: string): Promise<{
  lat: number;
  lng: number;
  formattedAddress: string;
  locationType: string;
} | null> {
  try {
    const googleInstance = await loadGoogleMaps();
    const geocoder = new googleInstance.maps.Geocoder();

    let query = address.trim();
    if (!/tifton|tift|omega|ga|georgia/i.test(query)) {
      query += ', Tifton, GA';
    } else if (!/ga|georgia/i.test(query)) {
      query += ', GA';
    }

    const response = await geocoder.geocode({
      address: query,
      componentRestrictions: { country: 'US', administrativeArea: 'GA' },
      bounds: new googleInstance.maps.LatLngBounds(
        new googleInstance.maps.LatLng(TIFT_BOUNDS.south, TIFT_BOUNDS.west),
        new googleInstance.maps.LatLng(TIFT_BOUNDS.north, TIFT_BOUNDS.east)
      )
    });

    if (response.results && response.results.length > 0) {
      const top = response.results[0];
      const loc = top.geometry.location;
      return {
        lat: loc.lat(),
        lng: loc.lng(),
        formattedAddress: top.formatted_address,
        locationType: top.geometry.location_type || 'ROOFTOP'
      };
    }
  } catch (err) {
    console.warn('Google Maps Geocoding failed, falling back:', err);
  }
  return null;
}

// Reverse Geocoding with Google
export async function reverseGeocodeWithGoogle(lat: number, lng: number): Promise<string | null> {
  try {
    const googleInstance = await loadGoogleMaps();
    const geocoder = new googleInstance.maps.Geocoder();

    const response = await geocoder.geocode({
      location: { lat, lng }
    });

    if (response.results && response.results.length > 0) {
      return response.results[0].formatted_address;
    }
  } catch (err) {
    console.warn('Google Maps reverse geocode failed:', err);
  }
  return null;
}

// Attach Google Places Autocomplete to an HTML Input
export async function attachGooglePlacesAutocomplete(
  inputEl: HTMLInputElement,
  onPlaceSelected: (data: { address: string; lat: number; lng: number }) => void
): Promise<any | null> {
  if (isGoogleMapsAuthFailed()) {
    return null;
  }

  // Dismiss any Google error modal if user begins typing
  const inputCleaner = () => {
    dismissGoogleErrorModals();
  };
  inputEl.addEventListener('input', inputCleaner);

  try {
    const googleInstance = await loadGoogleMaps();
    if (!googleInstance?.maps?.places?.Autocomplete) {
      return null;
    }

    const autocomplete = new googleInstance.maps.places.Autocomplete(inputEl, {
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'geometry', 'formatted_address', 'name'],
      bounds: new googleInstance.maps.LatLngBounds(
        new googleInstance.maps.LatLng(TIFT_BOUNDS.south, TIFT_BOUNDS.west),
        new googleInstance.maps.LatLng(TIFT_BOUNDS.north, TIFT_BOUNDS.east)
      ),
      strictBounds: false
    });

    autocomplete.addListener('place_changed', () => {
      try {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) {
          return;
        }

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || place.name || inputEl.value;

        onPlaceSelected({
          address,
          lat,
          lng
        });
      } catch (err) {
        console.warn('Place selection error:', err);
      }
    });

    return autocomplete;
  } catch (err) {
    console.warn('Google Places Autocomplete disabled due to API limits or auth:', err);
    return null;
  }
}

