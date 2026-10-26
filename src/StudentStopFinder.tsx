import { useState, useRef, useEffect, type FC } from 'react';
import {
  Search,
  Navigation,
  Loader2,
  X
} from 'lucide-react';
import type { StopMatchResult, RoutePath, BusStop } from './types';
import { geocodeTiftAddress } from './geocoding';
import { attachGooglePlacesAutocomplete, dismissGoogleErrorModals } from './googleMapsLoader';

// Distance calculation
function getDistanceInMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

interface NearestMatch {
  route: RoutePath;
  stop: BusStop;
  distanceMiles?: number;
  walkMinutes?: number;
  scheduledTime: string;
}

interface StudentStopFinderProps {
  routes: RoutePath[];
  onSelectRouteAndStop: (routeId: string, stopId: string) => void;
  findRoutesByStop: (query: string) => StopMatchResult[];
  allStops: { stopName: string; routeNames: string[]; routeCount: number }[];
}

export const StudentStopFinder: FC<StudentStopFinderProps> = ({
  routes,
  onSelectRouteAndStop,
  findRoutesByStop,
  allStops
}) => {
  const [searchInput, setSearchInput] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [matchResult, setMatchResult] = useState<NearestMatch | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper to match nearest stop to any coordinate
  const matchNearestToCoords = (lat: number, lng: number) => {
    let closestMatch: NearestMatch | null = null;
    let minDistance = Infinity;

    routes.forEach((route) => {
      route.stops.forEach((stop) => {
        const dist = getDistanceInMiles(lat, lng, stop.coordinates.lat, stop.coordinates.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestMatch = {
            route,
            stop,
            distanceMiles: dist,
            walkMinutes: Math.max(1, Math.round(dist * 18)),
            scheduledTime: stop.scheduledTime
          };
        }
      });
    });

    setMatchResult(closestMatch);
    if (closestMatch) {
      onSelectRouteAndStop((closestMatch as NearestMatch).route.id, (closestMatch as NearestMatch).stop.id);
    }
  };

  // Attach Google Places Autocomplete to the search input
  useEffect(() => {
    if (!inputRef.current) return;

    attachGooglePlacesAutocomplete(inputRef.current, (data) => {
      setSearchInput(data.address);
      setHasSearched(true);
      matchNearestToCoords(data.lat, data.lng);
    });
  }, [routes]);

  // Unified Search Handler: handles address OR stop name
  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setIsSearching(true);
    setHasSearched(true);

    const text = searchInput.trim();

    // 1. Check direct stop name match first
    const directMatches = findRoutesByStop(text);
    if (directMatches.length > 0) {
      const top = directMatches[0];
      setMatchResult({
        route: top.route,
        stop: top.stop,
        scheduledTime: top.stop.scheduledTime
      });
      onSelectRouteAndStop(top.route.id, top.stop.id);
      setIsSearching(false);
      return;
    }

    // 2. Resolve address / street coordinates with high-accuracy geocoding engine
    let lat = 31.4550;
    let lng = -83.5150;

    const geoResult = await geocodeTiftAddress(text);
    if (geoResult) {
      lat = geoResult.lat;
      lng = geoResult.lng;
    }

    // 3. Find closest bus stop across all routes
    let closestMatch: NearestMatch | null = null;
    let minDistance = Infinity;

    routes.forEach((route) => {
      route.stops.forEach((stop) => {
        const dist = getDistanceInMiles(lat, lng, stop.coordinates.lat, stop.coordinates.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestMatch = {
            route,
            stop,
            distanceMiles: dist,
            walkMinutes: Math.max(1, Math.round(dist * 18)),
            scheduledTime: stop.scheduledTime
          };
        }
      });
    });

    setMatchResult(closestMatch);
    if (closestMatch) {
      onSelectRouteAndStop((closestMatch as NearestMatch).route.id, (closestMatch as NearestMatch).stop.id);
    }
    setIsSearching(false);
  };

  // Device GPS Location
  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      alert('Location services unavailable in this browser.');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        let closestMatch: NearestMatch | null = null;
        let minDistance = Infinity;

        routes.forEach((route) => {
          route.stops.forEach((stop) => {
            const dist = getDistanceInMiles(userLat, userLng, stop.coordinates.lat, stop.coordinates.lng);
            if (dist < minDistance) {
              minDistance = dist;
              closestMatch = {
                route,
                stop,
                distanceMiles: dist,
                walkMinutes: Math.max(1, Math.round(dist * 18)),
                scheduledTime: stop.scheduledTime
              };
            }
          });
        });

        setSearchInput('My Current Location');
        setMatchResult(closestMatch);
        if (closestMatch) {
          onSelectRouteAndStop((closestMatch as NearestMatch).route.id, (closestMatch as NearestMatch).stop.id);
        }
        setIsSearching(false);
      },
      () => {
        setIsSearching(false);
        alert('Could not access GPS. Please type your street address.');
      },
      { timeout: 6000 }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {/* Unified Search Input */}
      <div>
        <label className="form-label" style={{ marginBottom: '0.4rem' }}>
          Find Your Bus Stop
        </label>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              ref={inputRef}
              type="text"
              className="select-input"
              list="all-tift-stops"
              style={{
                backgroundColor: '#ffffff',
                paddingRight: searchInput ? '2rem' : '0.85rem'
              }}
              placeholder="Enter home address or school stop..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                dismissGoogleErrorModals();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />

            <datalist id="all-tift-stops">
              {allStops.map((s) => (
                <option key={s.stopName} value={s.stopName} />
              ))}
            </datalist>

            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setMatchResult(null);
                  setHasSearched(false);
                }}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            className="btn-matte primary"
            style={{ padding: '0.55rem 0.85rem' }}
            onClick={handleSearch}
            disabled={isSearching}
            title="Search nearest stop"
          >
            {isSearching ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
          </button>

          <button
            className="btn-matte"
            style={{ padding: '0.55rem 0.75rem' }}
            onClick={handleUseGPS}
            disabled={isSearching}
            title="Use current GPS location"
          >
            <Navigation size={14} color="#2563eb" />
          </button>
        </div>
      </div>

      {/* Match Result Card */}
      {matchResult && (
        <div
          className="match-result-card selected"
          style={{ borderLeftColor: matchResult.route.color }}
          onClick={() => onSelectRouteAndStop(matchResult.route.id, matchResult.stop.id)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  backgroundColor: matchResult.route.color,
                  color: '#ffffff',
                  padding: '0.12rem 0.45rem',
                  borderRadius: 4
                }}>
                  {matchResult.route.routeNumber}
                </span>
                <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>
                  {matchResult.route.busNumber || 'Bus Assigned'}
                </strong>
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', marginTop: '0.3rem' }}>
                {matchResult.stop.name}
              </div>

              {matchResult.distanceMiles !== undefined && (
                <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700, marginTop: '0.2rem' }}>
                  {matchResult.distanceMiles} mi away (~{matchResult.walkMinutes} min walk)
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Pickup
              </span>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                {matchResult.scheduledTime}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.5rem',
            paddingTop: '0.4rem',
            borderTop: '1px solid #f1f5f9',
            fontSize: '0.72rem'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {matchResult.route.name}
            </span>

            <span style={{ fontWeight: 600, color: matchResult.route.color }}>
              Select Stop
            </span>
          </div>
        </div>
      )}

      {/* No Result Notice */}
      {hasSearched && !matchResult && !isSearching && (
        <div style={{ fontSize: '0.74rem', color: '#b91c1c', background: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: 6 }}>
          No matching bus stop found. Try typing a street name or school.
        </div>
      )}
    </div>
  );
};
