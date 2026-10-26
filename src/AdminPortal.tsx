import { useEffect, useRef, useState, type FC } from 'react';
import {
  Trash2,
  Edit3,
  MoveUp,
  MoveDown,
  Search,
  Loader2
} from 'lucide-react';
import type { RoutePath, BusStop } from './types';
import { geocodeTiftAddress, reverseGeocodeTift } from './geocoding';
import { loadGoogleMaps, attachGooglePlacesAutocomplete, dismissGoogleErrorModals } from './googleMapsLoader';
import { getRoadSnappedPath, optimizeRouteWithOSRM } from './routingService';

interface AdminPortalProps {
  routes: RoutePath[];
  onSaveRoute: (route: RoutePath) => void;
  onDeleteRoute: (routeId: string) => void;
  onResetDefaults: () => void;
  onSelectRoute: (routeId: string) => void;
  onSwitchToStudentView: () => void;
  firestoreSyncStatus?: 'synced' | 'connecting' | 'local_only';
  onOpenFirebaseSettings?: () => void;
}

const COLOR_OPTIONS = [
  { label: 'Royal Blue (Blue Devil)', value: '#2563eb' },
  { label: 'Amber Gold', value: '#d97706' },
  { label: 'Emerald Green', value: '#059669' },
  { label: 'Deep Purple', value: '#7c3aed' },
  { label: 'Crimson Red', value: '#dc2626' },
  { label: 'Ocean Teal', value: '#0891b2' }
];

const TIFT_SCHOOLS_SUGGESTIONS = [
  'Tift County High School',
  'Eighth Street Middle School',
  'Northeast Middle School',
  'J.T. Reddick School',
  'Matt Wilson Elementary School',
  'Charles Spencer Elementary School',
  'G.O. Bailey Elementary School',
  'Annie Belle Clark Elementary',
  'Len Lastinger Elementary School',
  'Omega Elementary School'
];

export const AdminPortal: FC<AdminPortalProps> = ({
  routes,
  onSaveRoute,
  onDeleteRoute,
  onResetDefaults,
  onSelectRoute,
  onSwitchToStudentView,
  firestoreSyncStatus = 'local_only',
  onOpenFirebaseSettings
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);

  // Route Customization State
  const [busNumber, setBusNumber] = useState<string>('Bus #14');
  const [destinationSchool, setDestinationSchool] = useState<string>('Tift County High School');
  const [routeNumber, setRouteNumber] = useState<string>('Route 14');
  const [routeName, setRouteName] = useState<string>('Northside Express to TCHS');
  const [driverName, setDriverName] = useState<string>('Ms. Clara Davis');
  const [bouncieVin, setBouncieVin] = useState<string>('');
  const [color, setColor] = useState<string>('#2563eb');
  const [description, setDescription] = useState<string>('Serves morning student pickup stops destined for TCHS.');

  // Stops on the route
  const [stops, setStops] = useState<BusStop[]>([
    {
      id: `stop-default-1`,
      name: 'Fulwood Park Crossing',
      address: 'Park Ave & 8th St, Tifton, GA',
      coordinates: { lat: 31.4580, lng: -83.5090 },
      scheduledTime: '07:25 AM'
    },
    {
      id: `stop-default-2`,
      name: 'TCHS Main Concourse',
      address: 'One Blue Devil Way, Tifton, GA 31794',
      coordinates: { lat: 31.4645, lng: -83.5290 },
      scheduledTime: '07:50 AM'
    }
  ]);

  // Stop Customization Inputs
  const [stopAddress, setStopAddress] = useState<string>('');
  const [stopName, setStopName] = useState<string>('');
  const [estimatedPickupTime, setEstimatedPickupTime] = useState<string>('07:30 AM');
  const [stopLat, setStopLat] = useState<number>(31.4550);
  const [stopLng, setStopLng] = useState<number>(-83.5150);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [geocodeMessage, setGeocodeMessage] = useState<string | null>(null);
  const [lastGeocodedAddress, setLastGeocodedAddress] = useState<string>('');

  // Embedded Google Map in Route Editor
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const stopMarkersRef = useRef<google.maps.Marker[]>([]);
  const pendingMarkerRef = useRef<google.maps.Marker | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const stopAddressInputRef = useRef<HTMLInputElement>(null);
  const [adminMapType, setAdminMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [adminMapReady, setAdminMapReady] = useState<boolean>(false);

  const [notification, setNotification] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizationNotice, setOptimizationNotice] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Start new route creation
  const handleStartNewRoute = () => {
    const nextNum = routes.length + 15;
    setEditingRouteId(null);
    setBusNumber(`Bus #${nextNum}`);
    setDestinationSchool('Tift County High School');
    setRouteNumber(`Route ${nextNum}`);
    setRouteName(`Route ${nextNum} School Transit`);
    setDriverName('District Driver');
    setBouncieVin('');
    setColor('#2563eb');
    setDescription(`Morning bus route serving stops to TCHS.`);
    setStops([
      {
        id: `stop-${Date.now()}-1`,
        name: 'Carpenter Rd Crossing',
        address: '1464 Carpenter Rd, Tifton, GA',
        coordinates: { lat: 31.4720, lng: -83.5180 },
        scheduledTime: '07:20 AM'
      },
      {
        id: `stop-${Date.now()}-2`,
        name: 'TCHS Blue Devil Way',
        address: 'One Blue Devil Way, Tifton, GA',
        coordinates: { lat: 31.4645, lng: -83.5290 },
        scheduledTime: '07:50 AM'
      }
    ]);
    setStopAddress('');
    setStopName('');
    setEstimatedPickupTime('07:30 AM');
    setStopLat(31.4550);
    setStopLng(-83.5150);
    setGeocodeMessage(null);
    setIsEditing(true);
  };

  // Start editing existing route
  const handleEditRoute = (route: RoutePath) => {
    setEditingRouteId(route.id);
    setBusNumber(route.busNumber || `Bus #${route.routeNumber}`);
    setDestinationSchool(route.destinationSchool || 'Tift County High School');
    setRouteNumber(route.routeNumber);
    setRouteName(route.name);
    setDriverName(route.driverName || 'District Driver');
    setBouncieVin(route.bouncieVin || '');
    setColor(route.color || '#2563eb');
    setDescription(route.description || '');
    setStops([...route.stops]);
    setStopAddress('');
    setStopName('');
    setEstimatedPickupTime('07:30 AM');
    setStopLat(31.4550);
    setStopLng(-83.5150);
    setGeocodeMessage(null);
    setIsEditing(true);
  };

  // Initialize Google Maps inside route editor
  useEffect(() => {
    if (!isEditing || !mapContainerRef.current) return;
    let isMounted = true;

    loadGoogleMaps().then((googleInstance) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (!googleMapRef.current) {
        const map = new googleInstance.maps.Map(mapContainerRef.current, {
          center: { lat: stopLat || 31.4550, lng: stopLng || -83.5150 },
          zoom: 14,
          mapTypeId: adminMapType,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true
        });

        // Map click to place or move stop location
        map.addListener('click', async (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const clickedLat = e.latLng.lat();
          const clickedLng = e.latLng.lng();
          setStopLat(clickedLat);
          setStopLng(clickedLng);

          setGeocodeMessage('Locating address from pin...');
          const resolvedAddress = await reverseGeocodeTift(clickedLat, clickedLng);
          if (resolvedAddress) {
            setStopAddress(resolvedAddress);
            setLastGeocodedAddress(resolvedAddress);
            if (!stopName) {
              setStopName(resolvedAddress.split(',')[0]);
            }
            setGeocodeMessage(`Address: ${resolvedAddress}`);
          } else {
            setLastGeocodedAddress(`${clickedLat.toFixed(4)},${clickedLng.toFixed(4)}`);
            setGeocodeMessage(`GPS: ${clickedLat.toFixed(4)}°N, ${clickedLng.toFixed(4)}°W`);
          }
        });

        googleMapRef.current = map;
        setAdminMapReady(true);
      }
    }).catch((err) => {
      console.warn('Failed to load Google Maps in admin:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [isEditing]);

  // Update map type when user toggles Roadmap vs Satellite
  useEffect(() => {
    if (googleMapRef.current && window.google?.maps) {
      googleMapRef.current.setMapTypeId(
        adminMapType === 'hybrid'
          ? window.google.maps.MapTypeId.HYBRID
          : window.google.maps.MapTypeId.ROADMAP
      );
    }
  }, [adminMapType]);

  // Update stop markers and polyline on Google Map
  useEffect(() => {
    if (!adminMapReady || !googleMapRef.current || !window.google?.maps) return;

    const googleInstance = window.google;
    const map = googleMapRef.current;

    // Clear old markers & polyline
    stopMarkersRef.current.forEach((m) => m.setMap(null));
    stopMarkersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // Render configured stops
    const bounds = new googleInstance.maps.LatLngBounds();

    stops.forEach((s, idx) => {
      const pos = { lat: s.coordinates.lat, lng: s.coordinates.lng };
      bounds.extend(pos);

      const pinSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34">
          <path d="M14 0C6.27 0 0 6.27 0 14c0 9.2 12.25 18.2 13.3 18.9.4.3.9.3 1.3 0C15.75 32.2 28 23.2 28 14 28 6.27 21.73 0 14 0z" fill="${color || '#2563eb'}"/>
          <circle cx="14" cy="13" r="8" fill="#ffffff"/>
          <text x="14" y="17" font-family="Inter, -apple-system, sans-serif" font-size="10" font-weight="900" fill="${color || '#2563eb'}" text-anchor="middle">${idx + 1}</text>
        </svg>
      `)}`;

      const marker = new googleInstance.maps.Marker({
        position: pos,
        map,
        title: `${idx + 1}. ${s.name}`,
        icon: {
          url: pinSvg,
          scaledSize: new googleInstance.maps.Size(28, 34),
          anchor: new googleInstance.maps.Point(14, 34)
        }
      });

      stopMarkersRef.current.push(marker);
    });

    // Draw route polyline snapped to actual roads
    if (stops.length > 1) {
      const initialCoords = stops.map((s) => ({ lat: s.coordinates.lat, lng: s.coordinates.lng }));
      const poly = new googleInstance.maps.Polyline({
        path: initialCoords,
        geodesic: true,
        strokeColor: color || '#2563eb',
        strokeOpacity: 0.85,
        strokeWeight: 4
      });
      poly.setMap(map);
      polylineRef.current = poly;

      // Snap editor polyline to real street network
      getRoadSnappedPath(stops).then((roadCoords) => {
        if (polylineRef.current && roadCoords.length > 0) {
          polylineRef.current.setPath(roadCoords.map((c) => ({ lat: c.lat, lng: c.lng })));
        }
      });
    }

    // Render Pending Stop draggable marker
    const pendingSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
        <circle cx="17" cy="17" r="16" fill="#ef4444" opacity="0.3"/>
        <path d="M17 2C9.82 2 4 7.82 4 15c0 8.5 11.5 17.5 12.4 18.2.4.3.8.3 1.2 0C18.5 32.5 30 23.5 30 15 30 7.82 24.18 2 17 2z" fill="#dc2626"/>
        <circle cx="17" cy="14" r="6" fill="#ffffff"/>
        <text x="17" y="18" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="900" fill="#dc2626" text-anchor="middle">+</text>
      </svg>
    `)}`;

    if (pendingMarkerRef.current) {
      pendingMarkerRef.current.setMap(null);
    }

    const pMarker = new googleInstance.maps.Marker({
      position: { lat: stopLat, lng: stopLng },
      map,
      draggable: true,
      title: 'Drag to adjust exact stop location',
      icon: {
        url: pendingSvg,
        scaledSize: new googleInstance.maps.Size(34, 42),
        anchor: new googleInstance.maps.Point(17, 36)
      },
      zIndex: 999
    });

    pMarker.addListener('dragend', async () => {
      const pos = pMarker.getPosition();
      if (!pos) return;
      const lat = pos.lat();
      const lng = pos.lng();
      setStopLat(lat);
      setStopLng(lng);

      const resolved = await reverseGeocodeTift(lat, lng);
      if (resolved) {
        setStopAddress(resolved);
        setLastGeocodedAddress(resolved);
        setGeocodeMessage(`Address: ${resolved}`);
      } else {
        setLastGeocodedAddress(`${lat.toFixed(4)},${lng.toFixed(4)}`);
      }
    });

    pendingMarkerRef.current = pMarker;
  }, [adminMapReady, stops, color, stopLat, stopLng]);

  // Attach Google Places Autocomplete to Stop Address input
  useEffect(() => {
    if (!isEditing || !stopAddressInputRef.current) return;

    attachGooglePlacesAutocomplete(stopAddressInputRef.current, (data) => {
      setStopAddress(data.address);
      setLastGeocodedAddress(data.address);
      setStopLat(data.lat);
      setStopLng(data.lng);
      setGeocodeMessage(`Located via Google Places: ${data.address}`);

      if (googleMapRef.current) {
        googleMapRef.current.setCenter({ lat: data.lat, lng: data.lng });
        googleMapRef.current.setZoom(17);
      }
    });
  }, [isEditing]);

  // Exact Geocode lookup for the address entered
  const handleGeocodeAddress = async (addressToLookup?: string) => {
    const target = addressToLookup || stopAddress;
    if (!target.trim()) return;

    setIsGeocoding(true);
    setGeocodeMessage('Searching exact location on Tift County map...');

    const res = await geocodeTiftAddress(target);
    setIsGeocoding(false);

    if (res) {
      setStopLat(res.lat);
      setStopLng(res.lng);
      setLastGeocodedAddress(target.trim());
      setGeocodeMessage(`Located (${res.source || 'Map'}): ${res.displayName || `${res.lat.toFixed(4)}, ${res.lng.toFixed(4)}`}`);

      // Pan editor Google map directly to this address with high street-level zoom
      if (googleMapRef.current) {
        googleMapRef.current.setCenter({ lat: res.lat, lng: res.lng });
        googleMapRef.current.setZoom(17);
      }
    } else {
      setGeocodeMessage('Address not found. Click on the map to place the pin manually.');
    }
  };

  // Add stop to current route
  const handleAddStop = async () => {
    if (!stopAddress.trim() && !stopName.trim()) {
      alert("Please enter the stop's street address.");
      return;
    }

    const effectiveAddress = stopAddress.trim() || undefined;
    const effectiveName = stopName.trim() || (effectiveAddress ? effectiveAddress.split(',')[0] : 'Bus Stop');

    let finalLat = stopLat;
    let finalLng = stopLng;

    // Only geocode if this address has not been resolved yet
    if (effectiveAddress && effectiveAddress !== lastGeocodedAddress) {
      setIsGeocoding(true);
      const geoResult = await geocodeTiftAddress(effectiveAddress);
      setIsGeocoding(false);
      if (geoResult) {
        finalLat = geoResult.lat;
        finalLng = geoResult.lng;
        setStopLat(finalLat);
        setStopLng(finalLng);
        if (googleMapRef.current) {
          googleMapRef.current.setCenter({ lat: finalLat, lng: finalLng });
          googleMapRef.current.setZoom(17);
        }
      }
    }

    const newStop: BusStop = {
      id: `stop-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: effectiveName,
      address: effectiveAddress,
      coordinates: {
        lat: finalLat,
        lng: finalLng
      },
      scheduledTime: estimatedPickupTime.trim() || '07:30 AM'
    };

    setStops([...stops, newStop]);
    setStopAddress('');
    setStopName('');
    setLastGeocodedAddress('');
    setEstimatedPickupTime('07:35 AM');
    setGeocodeMessage(null);
    showNotification(`Added stop: "${newStop.name}" at (${finalLat.toFixed(4)}, ${finalLng.toFixed(4)})`);
  };

  // Reorder stops
  const handleMoveStop = (index: number, direction: 'up' | 'down') => {
    const newStops = [...stops];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newStops.length) return;
    const temp = newStops[index];
    newStops[index] = newStops[targetIdx];
    newStops[targetIdx] = temp;
    setStops(newStops);
  };

  const handleDeleteStop = (stopId: string) => {
    setStops(stops.filter((s) => s.id !== stopId));
  };

  // OSRM Stop Sequence Auto-Optimization
  const handleAutoOptimizeSequence = async () => {
    if (stops.length <= 2) {
      alert('At least 3 stops are required to optimize the driving sequence.');
      return;
    }
    setIsOptimizing(true);
    setOptimizationNotice(null);

    try {
      const result = await optimizeRouteWithOSRM(stops);
      if (result.optimizedStops && result.optimizedStops.length > 0) {
        // Recalculate scheduled pickup times progressively in 4-minute intervals
        const baseHour = 7;
        const startMinute = 15;
        const updated = result.optimizedStops.map((stop, i) => {
          const totalMinutes = startMinute + (i * 4);
          const hrs = baseHour + Math.floor(totalMinutes / 60);
          const mins = totalMinutes % 60;
          const formatted = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')} AM`;
          return {
            ...stop,
            scheduledTime: formatted
          };
        });

        setStops(updated);
        setOptimizationNotice(
          result.distanceMiles > 0
            ? `Route optimized by OSRM: ${result.distanceMiles} mi total (~${result.durationMinutes} mins travel time)`
            : `Stops re-sequenced for shortest driving distance`
        );
      }
    } catch (err) {
      console.warn('Failed to optimize stops:', err);
      alert('Could not optimize route at this time.');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Save Route with road-snapped driving geometry
  const handleSave = async () => {
    if (!busNumber.trim()) {
      alert('Please specify the Bus Number (e.g. Bus #14).');
      return;
    }

    if (!destinationSchool.trim()) {
      alert('Please specify the Destination School (which school this route goes to).');
      return;
    }

    if (!routeName.trim() || !routeNumber.trim()) {
      alert('Please provide both Route Number and Route Name.');
      return;
    }

    if (stops.length < 2) {
      alert('A bus route must have at least 2 stops.');
      return;
    }

    showNotification('Calculating road-following driving route...');
    const roadCoords = await getRoadSnappedPath(stops);
    const finalPath = roadCoords.length > 0 ? roadCoords : stops.map((s) => s.coordinates);

    const newRoute: RoutePath = {
      id: editingRouteId || `tift-route-${Date.now()}`,
      routeNumber: routeNumber.trim(),
      name: routeName.trim(),
      county: 'Tift County',
      color,
      busNumber: busNumber.trim(),
      destinationSchool: destinationSchool.trim(),
      driverName: driverName.trim(),
      bouncieVin: bouncieVin.trim() || undefined,
      description: description.trim(),
      stops,
      path: finalPath
    };

    onSaveRoute(newRoute);
    setIsEditing(false);
    showNotification(`Route "${newRoute.routeNumber}" (${newRoute.busNumber}) saved with road-following path!`);
  };

  return (
    <div className="admin-portal">
      {/* Toast Notification */}
      {notification && (
        <div className="admin-toast">
          <span>{notification}</span>
        </div>
      )}

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
            Route Administration
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Configure bus numbers, school destinations, stop addresses, and pickup times.
          </p>
        </div>

        {!isEditing && (
          <button
            className="btn-matte primary"
            onClick={handleStartNewRoute}
            style={{ whiteSpace: 'nowrap' }}
          >
            Add New Route
          </button>
        )}
      </div>

      {/* Route Form Mode */}
      {isEditing ? (
        <div className="school-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              {editingRouteId ? 'Edit Route Details' : 'Create New Bus Route'}
            </h3>
            <button className="btn-matte" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>

          {/* Primary Route Metadata Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            {/* 1. Bus Number */}
            <div>
              <label className="form-label">
                Bus Number
              </label>
              <input
                type="text"
                className="select-input"
                placeholder="e.g. Bus #14 or Bus 42"
                value={busNumber}
                onChange={(e) => setBusNumber(e.target.value)}
              />
            </div>

            {/* 2. Destination School */}
            <div>
              <label className="form-label">
                Destination School
              </label>
              <input
                type="text"
                className="select-input"
                list="destination-schools"
                placeholder="e.g. Tift County High School"
                value={destinationSchool}
                onChange={(e) => setDestinationSchool(e.target.value)}
              />
              <datalist id="destination-schools">
                {TIFT_SCHOOLS_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* 3. Route Number / Code */}
            <div>
              <label className="form-label">Route Number / Code</label>
              <input
                type="text"
                className="select-input"
                placeholder="e.g. Route 14 or 14-EXP"
                value={routeNumber}
                onChange={(e) => setRouteNumber(e.target.value)}
              />
            </div>

            {/* 4. Route Name */}
            <div>
              <label className="form-label">Route Name & Zone</label>
              <input
                type="text"
                className="select-input"
                placeholder="e.g. Northside & Fulwood to TCHS"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
              />
            </div>

            {/* 5. Assigned Driver */}
            <div>
              <label className="form-label">Assigned Driver</label>
              <input
                type="text"
                className="select-input"
                placeholder="e.g. Ms. Clara Davis"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
            </div>

            {/* 6. Bouncie GPS VIN / Device ID */}
            <div>
              <label className="form-label">Bouncie GPS VIN / Device ID (Optional)</label>
              <input
                type="text"
                className="select-input"
                placeholder="e.g. 1TCB0147HA0904 or Bouncie IMEI"
                value={bouncieVin}
                onChange={(e) => setBouncieVin(e.target.value)}
              />
            </div>
          </div>

          {/* Color & Description */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label className="form-label">Route Accent Color</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: c.value,
                      border: color === c.value ? '3px solid #0f172a' : '2px solid #ffffff',
                      boxShadow: color === c.value ? '0 0 0 2px #cbd5e1' : 'none',
                      cursor: 'pointer'
                    }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Route Notes</label>
              <input
                type="text"
                className="select-input"
                placeholder="e.g. Serves students along North Tifton heading to high school..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Stops Section */}
          <div style={{ marginTop: '1.5rem', borderTop: '1.5px solid #f1f5f9', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                Route Stops Sequence ({stops.length} stops)
              </h4>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn-matte"
                  onClick={handleAutoOptimizeSequence}
                  disabled={isOptimizing || stops.length < 3}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.74rem',
                    color: '#1d4ed8',
                    borderColor: '#93c5fd',
                    background: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    cursor: stops.length < 3 ? 'not-allowed' : 'pointer'
                  }}
                  title="Calculate the shortest and fastest driving sequence between stops"
                >
                  {isOptimizing && <Loader2 size={13} className="spin" />}
                  <span>{isOptimizing ? 'Optimizing Route...' : 'Auto-Optimize Sequence'}</span>
                </button>

                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Destination: <strong>{destinationSchool}</strong>
                </span>
              </div>
            </div>

            {optimizationNotice && (
              <div style={{ fontSize: '0.74rem', color: '#047857', background: '#d1fae5', border: '1px solid #6ee7b7', padding: '0.45rem 0.75rem', borderRadius: 6, marginBottom: '0.85rem' }}>
                <span>{optimizationNotice}</span>
              </div>
            )}

            {/* List of stops */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {stops.map((stop, index) => (
                <div key={stop.id} className="admin-stop-row">
                  <div className="stop-index-pill">
                    {index + 1}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{stop.name}</strong>
                    </div>
                    {stop.address && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                        {stop.address}
                      </div>
                    )}
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      GPS: {stop.coordinates.lat.toFixed(4)}°N, {stop.coordinates.lng.toFixed(4)}°W
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155', background: '#f1f5f9', padding: '0.2rem 0.55rem', borderRadius: 4 }}>
                      Pickup: {stop.scheduledTime}
                    </div>

                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => handleMoveStop(index, 'up')}
                      disabled={index === 0}
                      title="Move Stop Earlier"
                    >
                      <MoveUp size={13} />
                    </button>

                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => handleMoveStop(index, 'down')}
                      disabled={index === stops.length - 1}
                      title="Move Stop Later"
                    >
                      <MoveDown size={13} />
                    </button>

                    <button
                      type="button"
                      className="btn-icon danger"
                      onClick={() => handleDeleteStop(stop.id)}
                      title="Remove Stop"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Stop Input Box with Address Geocoding */}
            <div className="add-stop-box" style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: '#1e40af', display: 'block', marginBottom: '0.85rem' }}>
                Add Stop by Address or Map Pin
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                {/* 1. Stop's Address */}
                <div>
                  <label className="form-label">Stop Street Address (e.g. 61 Carpenter Rd N)</label>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <input
                      ref={stopAddressInputRef}
                      type="text"
                      className="select-input"
                      placeholder="e.g. 61 Carpenter Rd N, Tifton, GA"
                      value={stopAddress}
                      onChange={(e) => {
                        setStopAddress(e.target.value);
                        dismissGoogleErrorModals();
                      }}
                      onBlur={() => handleGeocodeAddress()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleGeocodeAddress();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn-matte"
                      onClick={() => handleGeocodeAddress()}
                      title="Locate exact coordinates"
                      disabled={isGeocoding}
                    >
                      {isGeocoding ? <Loader2 size={13} className="spin" /> : <Search size={13} />}
                    </button>
                  </div>
                </div>

                {/* 2. Stop Name / Label */}
                <div>
                  <label className="form-label">Stop Name / Label (Optional)</label>
                  <input
                    type="text"
                    className="select-input"
                    placeholder="e.g. North Carpenter Stop or Home Pickup"
                    value={stopName}
                    onChange={(e) => setStopName(e.target.value)}
                  />
                </div>

                {/* 3. Estimated Pickup Time */}
                <div>
                  <label className="form-label">Estimated Morning Pickup Time</label>
                  <input
                    type="text"
                    className="select-input"
                    placeholder="e.g. 07:25 AM"
                    value={estimatedPickupTime}
                    onChange={(e) => setEstimatedPickupTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Geocoding Status Feedback */}
              {geocodeMessage && (
                <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginBottom: '0.5rem', background: '#ecfdf5', padding: '0.35rem 0.6rem', borderRadius: 4 }}>
                  <span>{geocodeMessage}</span>
                </div>
              )}

              <button
                type="button"
                className="btn-matte"
                onClick={handleAddStop}
                style={{ width: '100%', marginTop: '0.25rem' }}
                disabled={isGeocoding}
              >
                Add Stop to Route
              </button>
            </div>

            {/* Interactive Google Map for Route & Stop Verification */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-sub)' }}>
                  Interactive Google Map: Click or drag pin to place stop with rooftop precision
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '2px', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setAdminMapType('roadmap')}
                      style={{
                        border: 'none',
                        background: adminMapType === 'roadmap' ? '#2563eb' : 'transparent',
                        color: adminMapType === 'roadmap' ? '#ffffff' : '#64748b',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Map
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminMapType('hybrid')}
                      style={{
                        border: 'none',
                        background: adminMapType === 'hybrid' ? '#2563eb' : 'transparent',
                        color: adminMapType === 'hybrid' ? '#ffffff' : '#64748b',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Satellite
                    </button>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#2563eb' }}>
                    {stopLat.toFixed(4)}°N, {stopLng.toFixed(4)}°W
                  </span>
                </div>
              </div>
              <div
                ref={mapContainerRef}
                style={{ width: '100%', height: '340px', borderRadius: 10, border: '1.5px solid #cbd5e1', overflow: 'hidden', position: 'relative' }}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1.5px solid #f1f5f9', paddingTop: '1rem' }}>
            <button className="btn-matte" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button className="btn-matte primary" onClick={handleSave}>
              Save Route
            </button>
          </div>
        </div>
      ) : null}

      {/* Existing Routes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {routes.map((route) => (
          <div key={route.id} className="admin-route-card" style={{ borderLeftColor: route.color }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      backgroundColor: route.color,
                      color: '#ffffff',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 4
                    }}
                  >
                    {route.routeNumber}
                  </span>
                  <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                    {route.busNumber || 'Bus Assigned'}
                  </strong>
                </div>

                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                  {route.name}
                </h4>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  className="btn-icon"
                  onClick={() => handleEditRoute(route)}
                  title="Edit Route"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  className="btn-icon danger"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete ${route.routeNumber}?`)) {
                      onDeleteRoute(route.id);
                      showNotification(`Deleted ${route.routeNumber}`);
                    }
                  }}
                  title="Delete Route"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Destination School Badge */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: '0.35rem 0.65rem',
              fontSize: '0.72rem',
              color: '#1e40af',
              fontWeight: 700,
              marginBottom: '0.65rem'
            }}>
              <span>Destination: <strong>{route.destinationSchool || 'School'}</strong></span>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginBottom: '0.75rem' }}>
              <div>Driver: <strong>{route.driverName || 'District Driver'}</strong></div>
              <div style={{ marginTop: '0.15rem' }}>{route.stops.length} stops scheduled</div>
              {route.bouncieVin && (
                <div style={{ marginTop: '0.2rem', color: '#475569', fontWeight: 500 }}>
                  Bouncie Device: <strong>{route.bouncieVin}</strong>
                </div>
              )}
            </div>

            {/* Stops Preview preview */}
            <div style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: 8, fontSize: '0.72rem', marginBottom: '0.75rem', border: '1px solid #e2e8f0' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                Stops & Estimated Times:
              </span>
              {route.stops.slice(0, 3).map((s, idx) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.15rem 0' }}>
                  <span style={{ color: '#1e293b' }}>{idx + 1}. {s.address || s.name}</span>
                  <span style={{ color: '#b45309', fontWeight: 600 }}>{s.scheduledTime}</span>
                </div>
              ))}
              {route.stops.length > 3 && (
                <div style={{ color: '#94a3b8', fontStyle: 'italic', marginTop: '0.2rem' }}>
                  +{route.stops.length - 3} more stops...
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn-matte"
                style={{ flex: 1, fontSize: '0.75rem' }}
                onClick={() => {
                  onSelectRoute(route.id);
                  onSwitchToStudentView();
                }}
              >
                Track on Map
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer System Maintenance Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '1rem',
        borderTop: '1.5px solid #e2e8f0',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>System Storage: <strong>{firestoreSyncStatus === 'synced' ? 'Cloud Firestore (Real-Time Live Sync)' : 'Local Storage Cache'}</strong></span>
          {onOpenFirebaseSettings && (
            <button
              type="button"
              className="btn-matte"
              style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
              onClick={onOpenFirebaseSettings}
            >
              Configure Firebase / Deploy
            </button>
          )}
        </div>

        <button
          className="btn-matte"
          onClick={() => {
            if (confirm('Reset all bus routes back to standard defaults?')) {
              onResetDefaults();
              showNotification('Reset to standard bus routes.');
            }
          }}
          title="Reset to default routes"
        >
          Reset Routes to Default
        </button>
      </div>
    </div>
  );
};
