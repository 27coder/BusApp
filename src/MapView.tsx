import { useEffect, useRef, useState, type FC } from 'react';
import type { BusVehicle, RoutePath, BusStop } from './types';
import { loadGoogleMaps, dismissGoogleErrorModals } from './googleMapsLoader';
import { getRoadSnappedPath } from './routingService';

interface MapViewProps {
  activeBus: BusVehicle;
  route: RoutePath;
  targetStopId?: string | null;
  onSelectStop?: (stop: BusStop) => void;
}

export const MapView: FC<MapViewProps> = ({
  activeBus,
  route,
  targetStopId,
  onSelectStop
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const busMarkerRef = useRef<google.maps.Marker | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentAnimatedPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [googleReady, setGoogleReady] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Suppress Google error popup modals
  useEffect(() => {
    dismissGoogleErrorModals();
    const interval = setInterval(() => {
      dismissGoogleErrorModals();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Google Maps instance
  useEffect(() => {
    let isMounted = true;

    loadGoogleMaps()
      .then((googleInstance) => {
        if (!isMounted || !mapContainerRef.current) return;

        if (!googleMapRef.current) {
          const map = new googleInstance.maps.Map(mapContainerRef.current, {
            center: { lat: 31.4550, lng: -83.5150 }, // Tifton, GA
            zoom: 13,
            mapTypeId: mapType,
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            styles: [
              {
                featureType: 'poi.business',
                stylers: [{ visibility: 'simplified' }]
              },
              {
                featureType: 'transit.station.bus',
                stylers: [{ visibility: 'on' }]
              }
            ]
          });

          infoWindowRef.current = new googleInstance.maps.InfoWindow();
          googleMapRef.current = map;
          setGoogleReady(true);
          dismissGoogleErrorModals();
        }
      })
      .catch((err) => {
        console.warn('Failed to initialize Google Maps:', err);
        if (isMounted) {
          setLoadError(err?.message || 'Google Maps failed to load.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Update map type when user toggles Roadmap vs Satellite Hybrid
  useEffect(() => {
    if (googleMapRef.current && window.google?.maps) {
      googleMapRef.current.setMapTypeId(
        mapType === 'hybrid'
          ? window.google.maps.MapTypeId.HYBRID
          : window.google.maps.MapTypeId.ROADMAP
      );
    }
  }, [mapType]);

  // Render Route Polyline & Bus Stop Markers
  useEffect(() => {
    if (!googleReady || !googleMapRef.current || !window.google?.maps) return;

    const googleInstance = window.google;
    const map = googleMapRef.current;

    // Clear previous stop markers & polyline
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // 1. Draw Road-Following Polyline
    const initialCoords = (route.path && route.path.length > 0)
      ? route.path
      : route.stops.map((s) => s.coordinates);

    if (initialCoords.length > 0) {
      const polyline = new googleInstance.maps.Polyline({
        path: initialCoords.map((c) => ({ lat: c.lat, lng: c.lng })),
        geodesic: true,
        strokeColor: route.color || '#2563eb',
        strokeOpacity: 0.85,
        strokeWeight: 5
      });
      polyline.setMap(map);
      polylineRef.current = polyline;

      // Snap polyline to actual roads
      if (route.stops.length >= 2) {
        getRoadSnappedPath(route.stops).then((roadCoords) => {
          if (polylineRef.current && roadCoords.length > 0) {
            polylineRef.current.setPath(roadCoords.map((c) => ({ lat: c.lat, lng: c.lng })));
          }
        });
      }
    }

    // 2. Add Stop Markers
    const bounds = new googleInstance.maps.LatLngBounds();

    route.stops.forEach((stop, index) => {
      const isTarget = targetStopId === stop.id;
      const position = { lat: stop.coordinates.lat, lng: stop.coordinates.lng };
      bounds.extend(position);

      const pinColor = isTarget ? '#ef4444' : (route.color || '#2563eb');
      const pinSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 32 38">
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
            </filter>
          </defs>
          <path d="M16 0C7.16 0 0 7.16 0 16c0 10.5 14 20.8 15.2 21.6.4.3 1.1.3 1.5 0C18 36.8 32 26.5 32 16 32 7.16 24.84 0 16 0z" fill="${pinColor}" filter="url(#shadow)"/>
          <circle cx="16" cy="15" r="10" fill="#ffffff"/>
          <text x="16" y="19" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="900" fill="${pinColor}" text-anchor="middle">${index + 1}</text>
        </svg>
      `)}`;

      const marker = new googleInstance.maps.Marker({
        position,
        map,
        title: `${index + 1}. ${stop.name}`,
        icon: {
          url: pinSvg,
          scaledSize: new googleInstance.maps.Size(32, 38),
          anchor: new googleInstance.maps.Point(16, 38)
        },
        zIndex: isTarget ? 999 : 100 + index
      });

      marker.addListener('click', () => {
        onSelectStop?.(stop);

        if (infoWindowRef.current) {
          const content = `
            <div style="font-family: inherit; font-size: 13px; padding: 4px 6px; min-width: 170px;">
              <strong style="color: #0f172a; font-size: 14px;">${stop.name}</strong>
              <div style="color: #64748b; font-size: 12px; margin-top: 3px;">${stop.address || 'Tift County Stop'}</div>
              <div style="color: #b45309; font-weight: 700; font-size: 12px; margin-top: 4px;">Pickup: ${stop.scheduledTime}</div>
              ${isTarget ? '<div style="color: #dc2626; font-weight: 800; margin-top: 6px;">Selected Pickup Stop</div>' : ''}
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, marker);
        }
      });

      markersRef.current.push(marker);
    });

    if (route.stops.length > 0) {
      map.fitBounds(bounds);
      const listener = googleInstance.maps.event.addListener(map, 'idle', () => {
        if (map.getZoom()! > 16) map.setZoom(16);
        googleInstance.maps.event.removeListener(listener);
      });
    }
  }, [googleReady, route, targetStopId, onSelectStop]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Render & Animate Bus Vehicle Marker Smoothly Along the Route
  useEffect(() => {
    if (!googleReady || !googleMapRef.current || !window.google?.maps) return;

    const googleInstance = window.google;
    const map = googleMapRef.current;
    const isBouncie = activeBus.gpsProvider === 'bouncie';
    const heading = activeBus.heading ?? 0;
    const routeNum = activeBus.routeNumber ? activeBus.routeNumber.replace(/\D/g, '') : '';
    const statusColor = isBouncie ? '#10b981' : (activeBus.status === 'At Stop' ? '#ef4444' : '#f59e0b');
    const busPos = { lat: activeBus.coordinates.lat, lng: activeBus.coordinates.lng };

    // High-visibility directional SVG icon showing the school bus facing the exact road heading
    const busSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <defs>
          <filter id="bus-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.38"/>
          </filter>
        </defs>
        
        <!-- Rotating Bus Vehicle Facing Route Heading -->
        <g transform="rotate(${heading}, 24, 24)" filter="url(#bus-glow)">
          <!-- Directional Navigation Nose Indicator -->
          <polygon points="24,2 29,9 24,6.5 19,9" fill="#f59e0b" stroke="#78350f" stroke-width="1.2"/>
          
          <!-- School Bus Main Body -->
          <rect x="14" y="9" width="20" height="30" rx="5" fill="#f59e0b" stroke="#78350f" stroke-width="2"/>
          
          <!-- Front Windshield -->
          <path d="M16 14 Q24 12 32 14 L31 18 Q24 16 17 18 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="0.75"/>
          
          <!-- Rear Window -->
          <rect x="17" y="34.5" width="14" height="2.5" rx="1" fill="#38bdf8" stroke="#0284c7" stroke-width="0.5"/>
          
          <!-- Side Windows Left -->
          <rect x="15" y="20" width="2" height="11" rx="0.5" fill="#38bdf8"/>
          
          <!-- Side Windows Right -->
          <rect x="31" y="20" width="2" height="11" rx="0.5" fill="#38bdf8"/>
          
          <!-- Roof Top Panel -->
          <rect x="18.5" y="19" width="11" height="13" rx="2" fill="#fef3c7" stroke="#d97706" stroke-width="0.5"/>
          
          <!-- Route Number Stamped on Roof -->
          <text x="24" y="28.5" font-family="Inter, -apple-system, sans-serif" font-size="9" font-weight="900" fill="#78350f" text-anchor="middle">${routeNum || 'BUS'}</text>
          
          <!-- Front Amber Headlights -->
          <circle cx="16" cy="10" r="1.5" fill="#fef08a"/>
          <circle cx="32" cy="10" r="1.5" fill="#fef08a"/>
          
          <!-- Rear Red Taillights -->
          <circle cx="16" cy="38" r="1.5" fill="#ef4444"/>
          <circle cx="32" cy="38" r="1.5" fill="#ef4444"/>
          
          <!-- Warning Flashers -->
          <circle cx="18" cy="9.5" r="1" fill="#ef4444"/>
          <circle cx="30" cy="9.5" r="1" fill="#ef4444"/>
        </g>
        
        <!-- GPS Beacon Status Ring (Non-rotating) -->
        <circle cx="39" cy="39" r="5" fill="#ffffff" stroke="#94a3b8" stroke-width="1.2"/>
        <circle cx="39" cy="39" r="3.5" fill="${statusColor}"/>
      </svg>
    `)}`;

    const markerIcon = {
      url: busSvg,
      scaledSize: new googleInstance.maps.Size(48, 48),
      anchor: new googleInstance.maps.Point(24, 24)
    };

    if (!busMarkerRef.current) {
      const busMarker = new googleInstance.maps.Marker({
        position: busPos,
        map,
        title: `${activeBus.vehicleName} (${activeBus.routeNumber})`,
        icon: markerIcon,
        zIndex: 1000
      });

      busMarker.addListener('click', () => {
        if (infoWindowRef.current) {
          const content = `
            <div style="font-family: inherit; font-size: 13px; padding: 4px 6px;">
              <strong style="color: #0f172a; font-size: 14px;">${activeBus.vehicleName}</strong>
              <div style="color: #2563eb; font-weight: 700; margin-top: 2px;">${activeBus.routeNumber}</div>
              <div style="color: #64748b; font-size: 12px; margin-top: 3px;">
                ${activeBus.status === 'At Stop' ? 'Stopped At:' : 'Next Stop:'} <strong>${activeBus.nextStop}</strong>
              </div>
              <div style="color: #64748b; font-size: 12px; margin-top: 2px;">
                Speed: <strong>${activeBus.speedMph} mph</strong> • Heading: <strong>${heading}°</strong>
              </div>
              <div style="color: ${isBouncie ? '#059669' : '#b45309'}; font-weight: 700; font-size: 12px; margin-top: 4px;">
                ${isBouncie ? 'Bouncie OBD-II GPS Live' : 'Live GPS Active (Road Snapped)'}
              </div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, busMarker);
        }
      });

      busMarkerRef.current = busMarker;
      currentAnimatedPosRef.current = busPos;
    } else {
      // Update icon with current heading rotation
      busMarkerRef.current.setIcon(markerIcon);

      // Smoothly animate marker along the route to next road waypoint
      const prev = currentAnimatedPosRef.current || busPos;
      const dLat = busPos.lat - prev.lat;
      const dLng = busPos.lng - prev.lng;
      const distanceSq = dLat * dLat + dLng * dLng;

      // If switched routes or large teleport, immediately set position
      if (distanceSq > 0.002) {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        busMarkerRef.current.setPosition(busPos);
        currentAnimatedPosRef.current = busPos;
      } else {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        const startLat = prev.lat;
        const startLng = prev.lng;
        const startTime = performance.now();
        const duration = 1150; // Smooth 1.15s animation matching the 1.2s ticker

        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(1, elapsed / duration);

          const currentLat = startLat + dLat * progress;
          const currentLng = startLng + dLng * progress;
          const interpolated = { lat: currentLat, lng: currentLng };

          currentAnimatedPosRef.current = interpolated;
          busMarkerRef.current?.setPosition(interpolated);

          if (progress < 1) {
            animationFrameRef.current = requestAnimationFrame(animate);
          }
        };

        animationFrameRef.current = requestAnimationFrame(animate);
      }
    }
  }, [
    activeBus.coordinates,
    activeBus.heading,
    activeBus.speedMph,
    activeBus.status,
    activeBus.gpsProvider,
    activeBus.vehicleName,
    activeBus.routeNumber,
    activeBus.nextStop,
    googleReady
  ]);

  const targetStop = route.stops.find((s) => s.id === targetStopId);

  return (
    <div className="map-view-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Top Floating Status Overlay Banner */}
      <div className="map-floating-overlay">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: route.color || '#2563eb',
              boxShadow: `0 0 0 3px #ffffff`
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{route.routeNumber}</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>• {route.name}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Next Stop: <strong>{activeBus.nextStop}</strong> (ETA ~{activeBus.etaMinutes}m)
            </div>
          </div>
        </div>

        {targetStop && (
          <div className="target-stop-badge">
            <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#b45309' }}>
              Your Stop:
            </span>
            <strong style={{ fontSize: '0.78rem', color: '#92400e', marginLeft: 4 }}>
              {targetStop.name}
            </strong>
          </div>
        )}
      </div>

      {/* Map Style Toggle Button (Roadmap vs Satellite Hybrid) */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 4, background: '#ffffff', padding: '3px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <button
          type="button"
          onClick={() => setMapType('roadmap')}
          style={{
            border: 'none',
            background: mapType === 'roadmap' ? '#2563eb' : 'transparent',
            color: mapType === 'roadmap' ? '#ffffff' : '#64748b',
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Map
        </button>
        <button
          type="button"
          onClick={() => setMapType('hybrid')}
          style={{
            border: 'none',
            background: mapType === 'hybrid' ? '#2563eb' : 'transparent',
            color: mapType === 'hybrid' ? '#ffffff' : '#64748b',
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Satellite
        </button>
      </div>

      {/* Primary Google Maps Container */}
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', minHeight: '450px', background: '#f8fafc' }}
      />

      {/* Loading Overlay */}
      {!googleReady && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b', gap: '0.6rem', padding: '1.5rem', textAlign: 'center' }}>
          {loadError ? (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '1rem 1.5rem', borderRadius: 8, color: '#991b1b', maxWidth: 420 }}>
              <strong style={{ display: 'block', marginBottom: 4, fontSize: '0.9rem' }}>Google Maps Status Notice</strong>
              <span style={{ fontSize: '0.78rem' }}>{loadError}</span>
            </div>
          ) : (
            <>
              <div style={{ width: 28, height: 28, border: '3px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Loading Google Maps...</span>
            </>
          )}
        </div>
      )}

      {/* Map Legend Overlay */}
      <div className="map-legend-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#1e293b' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', border: '1.5px solid #b45309', display: 'inline-block' }}></span>
          <span>School Bus ({activeBus.gpsProvider === 'bouncie' ? 'Bouncie Live' : 'Live GPS'})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#1e293b', marginTop: '0.2rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffffff', border: `2px solid ${route.color}`, display: 'inline-block' }}></span>
          <span>Stops ({route.stops.length})</span>
        </div>
        {targetStopId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#dc2626', fontWeight: 700, marginTop: '0.2rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
            <span>Your Selected Stop</span>
          </div>
        )}
      </div>
    </div>
  );
};
