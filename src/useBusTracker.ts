import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BusVehicle, RoutePath, StopMatchResult, Coordinates } from './types';
import {
  getStoredRoutes,
  saveRoutesToLocalStorage,
  saveRouteToCloud,
  deleteRouteFromCloud,
  subscribeToCloudRoutes,
  resetToTiftDefaults
} from './routeStorage';
import { db } from './firebaseConfig';
import { collection, onSnapshot } from 'firebase/firestore';
import { getRoadSnappedPath } from './routingService';

// Helper to find the index of the coordinate along the path closest to a target
function findClosestPathIndex(path: Coordinates[], target: Coordinates): number {
  if (!path || path.length === 0) return 0;
  let minD = Infinity;
  let best = 0;
  for (let i = 0; i < path.length; i++) {
    const dLat = (path[i].lat - target.lat) * 69;
    const dLng = (path[i].lng - target.lng) * 59;
    const d = dLat * dLat + dLng * dLng;
    if (d < minD) {
      minD = d;
      best = i;
    }
  }
  return best;
}

// Calculate road segment bearing (degrees: 0 = North, 90 = East, 180 = South, 270 = West)
function calculateBearing(p1: Coordinates, p2: Coordinates): number {
  const dLng = p2.lng - p1.lng;
  const dLat = p2.lat - p1.lat;
  if (Math.abs(dLng) > 0.000005 || Math.abs(dLat) > 0.000005) {
    return Math.round((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
  }
  return 90;
}

interface FleetEntry {
  pathIndex: number;
  dwellTicks?: number;
  lastDwellStopId?: string;
  vehicle: BusVehicle;
}

export function useBusTracker() {
  const [routes, setRoutes] = useState<RoutePath[]>(() => getStoredRoutes());
  const [selectedRouteId, setSelectedRouteId] = useState<string>(() => routes[0]?.id || 'tift-route-14');
  const [targetStopId, setTargetStopId] = useState<string | null>(null);
  const [isLiveSimulating, setIsLiveSimulating] = useState<boolean>(true);
  const [bouncieConnected, setBouncieConnected] = useState<boolean>(false);
  const [firestoreSyncStatus, setFirestoreSyncStatus] = useState<'synced' | 'connecting' | 'local_only'>('local_only');

  // Real-time synchronization with Firestore cloud database
  useEffect(() => {
    const unsubscribe = subscribeToCloudRoutes(
      (cloudRoutes) => {
        setRoutes(cloudRoutes);
      },
      (status) => {
        setFirestoreSyncStatus(status);
      }
    );
    return () => unsubscribe();
  }, []);

  // Active route
  const selectedRoute = useMemo(() => {
    return routes.find((r) => r.id === selectedRouteId) || routes[0] || null;
  }, [routes, selectedRouteId]);

  // Maintain live bus states for each route along the exact road coordinates
  const [busFleet, setBusFleet] = useState<Record<string, FleetEntry>>(() => {
    const fleet: Record<string, FleetEntry> = {};
    routes.forEach((route, idx) => {
      const initialCoord = route.path[0] || (route.stops[0]?.coordinates ?? { lat: 31.4505, lng: -83.5085 });
      const nextCoord = route.path[1] || initialCoord;
      const initialHeading = calculateBearing(initialCoord, nextCoord);

      fleet[route.id] = {
        pathIndex: 0,
        dwellTicks: 0,
        vehicle: {
          id: `bus-tift-${route.routeNumber.replace(/\s+/g, '-').toLowerCase() || idx}`,
          vehicleName: route.busNumber || `Bus #${route.routeNumber}`,
          driverName: route.driverName || 'District Driver',
          vin: `1TCB${route.routeNumber.replace(/\D/g, '').padStart(3, '0')}7HA${idx}904`,
          bouncieVin: route.bouncieVin,
          routeNumber: route.routeNumber,
          routeName: route.name,
          coordinates: initialCoord,
          heading: initialHeading,
          speedMph: 24,
          status: 'In Transit',
          nextStop: route.stops[1]?.name || route.stops[0]?.name || 'TCHS Campus',
          etaMinutes: 3,
          lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          isSimulated: true,
          gpsProvider: 'simulated'
        }
      };
    });
    return fleet;
  });

  // Keep bus fleet in sync when routes change
  useEffect(() => {
    setBusFleet((prev) => {
      const nextFleet = { ...prev };
      routes.forEach((route, idx) => {
        if (!nextFleet[route.id]) {
          const initialCoord = route.path[0] || (route.stops[0]?.coordinates ?? { lat: 31.4505, lng: -83.5085 });
          const nextCoord = route.path[1] || initialCoord;
          const initialHeading = calculateBearing(initialCoord, nextCoord);

          nextFleet[route.id] = {
            pathIndex: 0,
            dwellTicks: 0,
            vehicle: {
              id: `bus-tift-${route.routeNumber.replace(/\s+/g, '-').toLowerCase() || idx}`,
              vehicleName: route.busNumber || `Bus #${route.routeNumber}`,
              driverName: route.driverName || 'District Driver',
              vin: `1TCB${route.routeNumber.replace(/\D/g, '').padStart(3, '0')}7HA${idx}904`,
              bouncieVin: route.bouncieVin,
              routeNumber: route.routeNumber,
              routeName: route.name,
              coordinates: initialCoord,
              heading: initialHeading,
              speedMph: 22,
              status: 'In Transit',
              nextStop: route.stops[1]?.name || route.stops[0]?.name || 'Terminal',
              etaMinutes: 4,
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              isSimulated: true,
              gpsProvider: 'simulated'
            }
          };
        }
      });
      return nextFleet;
    });
  }, [routes]);

  // Ensure active routes follow real roads so simulated buses travel along streets
  useEffect(() => {
    routes.forEach((route) => {
      if (route.stops.length >= 2 && (!route.path || route.path.length <= route.stops.length)) {
        getRoadSnappedPath(route.stops).then((roadCoords) => {
          if (roadCoords && roadCoords.length > route.stops.length) {
            setRoutes((prev) => {
              const updated = prev.map((r) => (r.id === route.id ? { ...r, path: roadCoords } : r));
              saveRoutesToLocalStorage(updated);
              saveRouteToCloud(updated.find((r) => r.id === route.id)!);
              return updated;
            });
          }
        });
      }
    });
  }, [routes]);


  // Subscribe to live Bouncie GPS collection in Firestore (written by Bouncie Cloud Function)
  useEffect(() => {
    try {
      const busesCol = collection(db, 'buses');
      const unsubscribe = onSnapshot(busesCol, (snapshot) => {
        if (snapshot.empty) return;
        setBouncieConnected(true);
        setBusFleet((prevFleet) => {
          const nextFleet = { ...prevFleet };
          snapshot.forEach((docSnap) => {
            const bouncieData = docSnap.data();
            const docId = docSnap.id;

            // Match route by Bouncie VIN, doc ID, or route number
            const matchedRoute = routes.find(
              (r) =>
                (r.bouncieVin && (r.bouncieVin === docId || r.bouncieVin === bouncieData.vin)) ||
                (r.busNumber && bouncieData.vehicleName && bouncieData.vehicleName.includes(r.busNumber)) ||
                (r.routeNumber && bouncieData.routeNumber === r.routeNumber)
            );

            if (matchedRoute && bouncieData.coordinates?.lat && bouncieData.coordinates?.lng) {
              const entry = nextFleet[matchedRoute.id];
              if (entry) {
                nextFleet[matchedRoute.id] = {
                  ...entry,
                  vehicle: {
                    ...entry.vehicle,
                    coordinates: {
                      lat: bouncieData.coordinates.lat,
                      lng: bouncieData.coordinates.lng
                    },
                    heading: bouncieData.heading ?? entry.vehicle.heading,
                    speedMph: bouncieData.speedMph ?? entry.vehicle.speedMph,
                    status: bouncieData.status ?? entry.vehicle.status,
                    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    isSimulated: false,
                    gpsProvider: 'bouncie'
                  }
                };
              }
            }
          });
          return nextFleet;
        });
      }, (error) => {
        // Fallback silently if offline or demo keys
        console.info('Bouncie GPS live feed on standby:', error.message);
      });

      return () => unsubscribe();
    } catch (err) {
      console.info('Firestore Bouncie listener:', err);
    }
  }, [routes]);

  // Active bus for currently selected route
  const busData = useMemo<BusVehicle>(() => {
    if (selectedRoute && busFleet[selectedRoute.id]) {
      return busFleet[selectedRoute.id].vehicle;
    }
    return {
      id: 'bus-active',
      vehicleName: selectedRoute?.busNumber || 'Bus #14',
      driverName: selectedRoute?.driverName || 'District Driver',
      vin: '1TCB0147HA0904',
      routeNumber: selectedRoute?.routeNumber || 'Route 14',
      routeName: selectedRoute?.name || 'Tift County Route',
      coordinates: selectedRoute?.stops[0]?.coordinates || { lat: 31.4505, lng: -83.5085 },
      heading: 0,
      speedMph: 25,
      status: 'In Transit',
      nextStop: selectedRoute?.stops[0]?.name || 'Next Stop',
      etaMinutes: 4,
      lastUpdated: new Date().toLocaleTimeString(),
      isSimulated: true,
      gpsProvider: 'simulated'
    };
  }, [busFleet, selectedRoute]);

  // Live GPS simulation ticker (runs when not receiving physical Bouncie feed or when simulation is enabled)
  useEffect(() => {
    if (!isLiveSimulating) return;

    const interval = setInterval(() => {
      setBusFleet((prevFleet) => {
        const updated = { ...prevFleet };

        routes.forEach((route) => {
          const entry = updated[route.id];
          if (!entry || !route.path || route.path.length === 0) return;

          // Skip simulation for a bus if it is currently driven by a live physical Bouncie device
          if (entry.vehicle.gpsProvider === 'bouncie') return;

          const path = route.path;
          const stops = route.stops;
          const currentIndex = entry.pathIndex;

          // 1. If currently dwelling at a bus stop, countdown dwell ticks
          if (entry.dwellTicks && entry.dwellTicks > 0) {
            updated[route.id] = {
              ...entry,
              dwellTicks: entry.dwellTicks - 1,
              vehicle: {
                ...entry.vehicle,
                speedMph: 0,
                status: 'At Stop',
                etaMinutes: 0,
                lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              }
            };
            return;
          }

          // 2. Pre-map each stop's index along the road path
          const stopIndices = stops.map((s) => ({
            stop: s,
            index: findClosestPathIndex(path, s.coordinates)
          }));

          // 3. Advance to next waypoint along the road polyline
          const nextIdx = (currentIndex + 1) % path.length;
          const currentCoord = path[nextIdx];
          const prevCoord = path[currentIndex];
          const headingDeg = calculateBearing(prevCoord, currentCoord);

          // 4. Check if we just arrived at a stop
          const arrivedStop = stopIndices.find(
            (item) => Math.abs(item.index - nextIdx) <= 1 && item.stop.id !== entry.lastDwellStopId
          );

          if (arrivedStop) {
            // Bus arrives at stop: pause for 2 ticks (~2.4s)
            updated[route.id] = {
              pathIndex: nextIdx,
              dwellTicks: 2,
              lastDwellStopId: arrivedStop.stop.id,
              vehicle: {
                ...entry.vehicle,
                coordinates: currentCoord,
                heading: headingDeg,
                speedMph: 0,
                status: 'At Stop',
                nextStop: arrivedStop.stop.name,
                etaMinutes: 0,
                lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              }
            };
            return;
          }

          // 5. In transit: Find the next upcoming stop along the route
          let upcoming = stopIndices.find((item) => item.index > nextIdx);
          if (!upcoming && stopIndices.length > 0) {
            upcoming = stopIndices[0]; // Wrap around to first stop
          }

          let remainingPoints = 0;
          if (upcoming) {
            if (upcoming.index >= nextIdx) {
              remainingPoints = upcoming.index - nextIdx;
            } else {
              remainingPoints = (path.length - nextIdx) + upcoming.index;
            }
          }

          // ~136 ft (0.025 miles) per point; 25 mph simulated driving
          const remainingMiles = remainingPoints * 0.025;
          const eta = Math.max(1, Math.min(12, Math.round((remainingMiles / 25) * 60)));
          const dynamicSpeed = 22 + (nextIdx % 6);

          updated[route.id] = {
            pathIndex: nextIdx,
            dwellTicks: 0,
            lastDwellStopId: entry.lastDwellStopId,
            vehicle: {
              ...entry.vehicle,
              coordinates: currentCoord,
              heading: headingDeg,
              speedMph: dynamicSpeed,
              status: 'In Transit',
              nextStop: upcoming ? upcoming.stop.name : (stops[0]?.name || 'Next Stop'),
              etaMinutes: eta,
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }
          };
        });

        return updated;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isLiveSimulating, routes]);

  // Route switcher
  const changeRoute = useCallback((routeId: string) => {
    setSelectedRouteId(routeId);
    setTargetStopId(null);
  }, []);

  // Automatic Route Finder by Stop Name / Query
  const findRoutesByStop = useCallback((stopQuery: string): StopMatchResult[] => {
    if (!stopQuery || stopQuery.trim() === '') return [];
    const normalized = stopQuery.trim().toLowerCase();

    const matches: StopMatchResult[] = [];

    routes.forEach((route) => {
      route.stops.forEach((stop, stopIndex) => {
        const stopNameMatch = stop.name.toLowerCase().includes(normalized);
        const addressMatch = stop.address ? stop.address.toLowerCase().includes(normalized) : false;
        const notesMatch = stop.notes ? stop.notes.toLowerCase().includes(normalized) : false;

        if (stopNameMatch || addressMatch || notesMatch) {
          const fleetEntry = busFleet[route.id];
          const vehicle = fleetEntry?.vehicle || {
            id: `bus-${route.id}`,
            vehicleName: route.busNumber || 'School Bus',
            driverName: route.driverName || 'District Driver',
            routeNumber: route.routeNumber,
            routeName: route.name,
            coordinates: stop.coordinates,
            heading: 0,
            speedMph: 20,
            status: 'In Transit',
            nextStop: route.stops[0]?.name || '',
            etaMinutes: 5,
            lastUpdated: new Date().toLocaleTimeString()
          };

          const currentStopIndex = route.stops.findIndex((s) => s.name === vehicle.nextStop);
          let stopsAway = 1;
          if (currentStopIndex !== -1) {
            stopsAway = stopIndex >= currentStopIndex 
              ? stopIndex - currentStopIndex 
              : (route.stops.length - currentStopIndex) + stopIndex;
          }
          const estimatedMinutes = Math.max(1, stopsAway * 3);

          matches.push({
            route,
            stop,
            stopIndex: stopIndex + 1,
            totalStops: route.stops.length,
            stopsAway,
            estimatedMinutes,
            busVehicle: vehicle
          });
        }
      });
    });

    return matches;
  }, [routes, busFleet]);

  // Select a specific stop and automatically navigate to its route
  const selectStopAndFocus = useCallback((routeId: string, stopId: string) => {
    setSelectedRouteId(routeId);
    setTargetStopId(stopId);
  }, []);

  // Route Management: Add / Update (Syncs to both localStorage & Firestore)
  const saveRoute = useCallback((newOrUpdatedRoute: RoutePath) => {
    setRoutes((prev) => {
      const existsIndex = prev.findIndex((r) => r.id === newOrUpdatedRoute.id);
      let updated: RoutePath[];
      if (existsIndex >= 0) {
        updated = [...prev];
        updated[existsIndex] = newOrUpdatedRoute;
      } else {
        updated = [newOrUpdatedRoute, ...prev];
      }
      saveRoutesToLocalStorage(updated);
      return updated;
    });
    // Persist to Cloud Firestore
    saveRouteToCloud(newOrUpdatedRoute);
    setSelectedRouteId(newOrUpdatedRoute.id);
  }, []);

  // Route Management: Delete (Deletes from both localStorage & Firestore)
  const deleteRoute = useCallback((routeId: string) => {
    setRoutes((prev) => {
      const updated = prev.filter((r) => r.id !== routeId);
      saveRoutesToLocalStorage(updated);
      if (selectedRouteId === routeId && updated.length > 0) {
        setSelectedRouteId(updated[0].id);
      }
      return updated;
    });
    // Delete from Cloud Firestore
    deleteRouteFromCloud(routeId);
  }, [selectedRouteId]);

  // Route Management: Reset to Tift County Defaults
  const resetRoutes = useCallback(async () => {
    const defaults = await resetToTiftDefaults();
    setRoutes(defaults);
    if (defaults.length > 0) {
      setSelectedRouteId(defaults[0].id);
      setTargetStopId(null);
    }
  }, []);

  // Get all unique stops across all Tift County routes for rapid autocomplete
  const allStops = useMemo(() => {
    const map = new Map<string, { stopName: string; routeNames: string[]; routeCount: number }>();
    routes.forEach((route) => {
      route.stops.forEach((stop) => {
        const existing = map.get(stop.name);
        if (existing) {
          if (!existing.routeNames.includes(route.routeNumber)) {
            existing.routeNames.push(route.routeNumber);
            existing.routeCount += 1;
          }
        } else {
          map.set(stop.name, {
            stopName: stop.name,
            routeNames: [route.routeNumber],
            routeCount: 1
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.stopName.localeCompare(b.stopName));
  }, [routes]);

  return {
    routes,
    selectedRoute,
    selectedRouteId,
    changeRoute,
    busData,
    targetStopId,
    setTargetStopId,
    isLiveSimulating,
    setIsLiveSimulating,
    bouncieConnected,
    firestoreSyncStatus,
    findRoutesByStop,
    selectStopAndFocus,
    saveRoute,
    deleteRoute,
    resetRoutes,
    allStops
  };
}
