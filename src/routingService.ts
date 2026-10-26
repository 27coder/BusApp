import type { Coordinates, BusStop } from './types';
import { loadGoogleMaps } from './googleMapsLoader';
import { PRECOMPUTED_ROAD_PATHS } from './precomputedRoadPaths';

// Memory cache for road-snapped route paths
const routingCache = new Map<string, Coordinates[]>();

function getRouteKey(coords: Coordinates[]): string {
  return coords.map((c) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`).join('|');
}

// Pre-seed known Tift County routes so they return instantly without network latency
const initialRouteStops: Record<string, Coordinates[]> = {
  'tift-route-14': [
    { lat: 31.4720, lng: -83.5180 },
    { lat: 31.4580, lng: -83.5090 },
    { lat: 31.4550, lng: -83.5020 },
    { lat: 31.4645, lng: -83.5290 }
  ],
  'tift-route-22': [
    { lat: 31.4520, lng: -83.5220 },
    { lat: 31.4460, lng: -83.5180 },
    { lat: 31.4530, lng: -83.5130 },
    { lat: 31.4645, lng: -83.5290 }
  ],
  'tift-route-08': [
    { lat: 31.3430, lng: -83.5930 },
    { lat: 31.4310, lng: -83.5110 },
    { lat: 31.4390, lng: -83.5040 },
    { lat: 31.4530, lng: -83.5130 }
  ],
  'tift-route-31': [
    { lat: 31.4780, lng: -83.5270 },
    { lat: 31.4750, lng: -83.5120 },
    { lat: 31.4690, lng: -83.4980 },
    { lat: 31.4645, lng: -83.5290 }
  ]
};

Object.entries(initialRouteStops).forEach(([id, stops]) => {
  if (PRECOMPUTED_ROAD_PATHS[id]) {
    routingCache.set(getRouteKey(stops), PRECOMPUTED_ROAD_PATHS[id]);
  }
});


/**
 * Calculates a turn-by-turn road route connecting bus stops.
 * Priority 1: OSRM (Open Source Routing Machine) driving router (Fast, free, turn-by-turn road snapping)
 * Priority 2: Google Maps DirectionsService
 * Priority 3: Interpolated road fallback
 */
export async function getRoadSnappedPath(stops: (Coordinates | BusStop)[]): Promise<Coordinates[]> {
  const coords: Coordinates[] = stops.map((s) => ('coordinates' in s ? s.coordinates : s));
  if (coords.length < 2) return coords;

  const cacheKey = getRouteKey(coords);
  if (routingCache.has(cacheKey)) {
    return routingCache.get(cacheKey)!;
  }

  // 1. Primary: OSRM driving router for realistic street tracing
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // OSRM expects coordinates as {lng},{lat}
    const coordsParam = coords.map((c) => `${c.lng.toFixed(6)},${c.lat.toFixed(6)}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0 && data.routes[0].geometry?.coordinates) {
        const rawCoords: [number, number][] = data.routes[0].geometry.coordinates;
        const osrmPath: Coordinates[] = rawCoords.map(([lng, lat]) => ({ lat, lng }));

        if (osrmPath.length > 0) {
          routingCache.set(cacheKey, osrmPath);
          return osrmPath;
        }
      }
    }
  } catch (err) {
    console.warn('OSRM router request failed or timed out, trying secondary engine:', err);
  }

  // 2. Secondary: Google Maps DirectionsService (if available)
  try {
    const googleInstance = await loadGoogleMaps();
    if (googleInstance?.maps?.DirectionsService) {
      const directionsService = new googleInstance.maps.DirectionsService();
      const maxBatchSize = 25;
      const fullPath: Coordinates[] = [];

      for (let i = 0; i < coords.length - 1; i += maxBatchSize - 1) {
        const batch = coords.slice(i, i + maxBatchSize);
        if (batch.length < 2) break;

        const origin = batch[0];
        const destination = batch[batch.length - 1];
        const waypoints = batch.slice(1, -1).map((pt) => ({
          location: new googleInstance.maps.LatLng(pt.lat, pt.lng),
          stopover: true
        }));

        const response: any = await new Promise((resolve, reject) => {
          directionsService.route(
            {
              origin: new googleInstance.maps.LatLng(origin.lat, origin.lng),
              destination: new googleInstance.maps.LatLng(destination.lat, destination.lng),
              waypoints,
              travelMode: googleInstance.maps.TravelMode.DRIVING,
              optimizeWaypoints: false
            },
            (result: any, status: any) => {
              if (status === 'OK' && result) {
                resolve(result);
              } else {
                reject(new Error(`Directions status: ${status}`));
              }
            }
          );
        });

        if (response.routes && response.routes.length > 0) {
          const legSteps = response.routes[0].legs;
          legSteps.forEach((leg: any) => {
            leg.steps.forEach((step: any) => {
              step.lat_lngs.forEach((pt: any) => {
                fullPath.push({ lat: pt.lat(), lng: pt.lng() });
              });
            });
          });
        }
      }

      if (fullPath.length > 0) {
        const cleaned: Coordinates[] = [];
        fullPath.forEach((pt) => {
          const last = cleaned[cleaned.length - 1];
          if (!last || Math.abs(last.lat - pt.lat) > 0.00005 || Math.abs(last.lng - pt.lng) > 0.00005) {
            cleaned.push(pt);
          }
        });

        routingCache.set(cacheKey, cleaned);
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('Google DirectionsService failed:', err);
  }

  // 3. Fallback: Interpolate straight lines between stops
  const interpolated: Coordinates[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    interpolated.push(p1);
    interpolated.push({
      lat: (p1.lat + p2.lat) / 2,
      lng: (p1.lng + p2.lng) / 2
    });
  }
  interpolated.push(coords[coords.length - 1]);

  routingCache.set(cacheKey, interpolated);
  return interpolated;
}

/**
 * Optimizes the stop sequence to find the most efficient driving route.
 * Keeps the first stop as start, keeps the final destination (school) as end,
 * and re-orders intermediate pickup stops for minimum travel time and distance.
 */
export async function optimizeRouteWithOSRM(stops: BusStop[]): Promise<{
  optimizedStops: BusStop[];
  distanceMiles: number;
  durationMinutes: number;
}> {
  if (stops.length <= 2) {
    return {
      optimizedStops: stops,
      distanceMiles: 0,
      durationMinutes: 0
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const coordsParam = stops
      .map((s) => `${s.coordinates.lng.toFixed(6)},${s.coordinates.lat.toFixed(6)}`)
      .join(';');

    // OSRM Trip API (TSP solver): source=first & destination=last with roundtrip=false
    const url = `https://router.project-osrm.org/trip/v1/driving/${coordsParam}?source=first&destination=last&roundtrip=false&geometries=geojson&overview=simplified`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.waypoints && data.trips && data.trips.length > 0) {
        // data.waypoints has waypoint_index for each input coordinate
        const sortedStopsWithOrder = data.waypoints.map((wp: any, inputIndex: number) => ({
          stop: stops[inputIndex],
          order: wp.waypoint_index
        }));

        sortedStopsWithOrder.sort((a: any, b: any) => a.order - b.order);
        const reorderedStops = sortedStopsWithOrder.map((item: any) => item.stop);

        const distanceMeters = data.trips[0].distance || 0;
        const durationSeconds = data.trips[0].duration || 0;

        return {
          optimizedStops: reorderedStops,
          distanceMiles: Math.round((distanceMeters / 1609.34) * 10) / 10,
          durationMinutes: Math.round(durationSeconds / 60)
        };
      }
    }
  } catch (err) {
    console.warn('OSRM Trip API optimization failed, using local 2-opt optimizer:', err);
  }

  // Local 2-Opt TSP fallback if OSRM Trip service is offline
  return solveLocalTSP(stops);
}

/**
 * Fallback in-browser 2-Opt / Nearest-Neighbor TSP solver
 * Keeps stop[0] and stop[last] fixed, optimizes intermediate stops.
 */
function solveLocalTSP(stops: BusStop[]): {
  optimizedStops: BusStop[];
  distanceMiles: number;
  durationMinutes: number;
} {
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const intermediate = stops.slice(1, -1);

  if (intermediate.length <= 1) {
    return { optimizedStops: stops, distanceMiles: 0, durationMinutes: 0 };
  }

  // Nearest-Neighbor ordering
  const remaining = [...intermediate];
  const ordered: BusStop[] = [];
  let current = origin;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let minD = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = distSq(current.coordinates, remaining[i].coordinates);
      if (d < minD) {
        minD = d;
        bestIndex = i;
      }
    }

    current = remaining[bestIndex];
    ordered.push(current);
    remaining.splice(bestIndex, 1);
  }

  // 2-Opt swap refinement
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 30) {
    improved = false;
    iterations++;
    for (let i = 0; i < ordered.length - 1; i++) {
      for (let k = i + 1; k < ordered.length; k++) {
        const prev = i === 0 ? origin : ordered[i - 1];
        const next = k === ordered.length - 1 ? destination : ordered[k + 1];

        const dCurrent = Math.sqrt(distSq(prev.coordinates, ordered[i].coordinates)) +
                         Math.sqrt(distSq(ordered[k].coordinates, next.coordinates));
        const dSwapped = Math.sqrt(distSq(prev.coordinates, ordered[k].coordinates)) +
                         Math.sqrt(distSq(ordered[i].coordinates, next.coordinates));

        if (dSwapped < dCurrent - 0.0001) {
          // Reverse sub-array
          const slice = ordered.slice(i, k + 1).reverse();
          ordered.splice(i, slice.length, ...slice);
          improved = true;
        }
      }
    }
  }

  const result = [origin, ...ordered, destination];
  return {
    optimizedStops: result,
    distanceMiles: 0,
    durationMinutes: 0
  };
}

function distSq(c1: Coordinates, c2: Coordinates): number {
  const dx = c1.lat - c2.lat;
  const dy = c1.lng - c2.lng;
  return dx * dx + dy * dy;
}
