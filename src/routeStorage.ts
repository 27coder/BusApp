import type { RoutePath } from './types';
import { INITIAL_TIFT_ROUTES } from './tiftCountyData';
import { db, isFirebaseConfigured } from './firebaseConfig';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

const STORAGE_KEY = 'tift_county_bus_routes_v2';

/**
 * Retrieve cached routes from localStorage (immediate, zero latency)
 */
export function getStoredRoutes(): RoutePath[] {
  try {
    localStorage.removeItem('tift_county_bus_routes_v1');
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read routes from localStorage:', err);
  }
  saveRoutesToLocalStorage(INITIAL_TIFT_ROUTES);
  return INITIAL_TIFT_ROUTES;
}

/**
 * Write routes to browser localStorage
 */
export function saveRoutesToLocalStorage(routes: RoutePath[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch (err) {
    console.warn('Could not save routes to localStorage:', err);
  }
}

/**
 * Save or update a single route directly in Firestore
 */
export async function saveRouteToCloud(route: RoutePath): Promise<boolean> {
  try {
    const routeRef = doc(db, 'bus_routes', route.id);
    await setDoc(routeRef, {
      ...route,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.info('Cloud route save pending / offline:', err);
    return false;
  }
}

/**
 * Delete a route from Firestore
 */
export async function deleteRouteFromCloud(routeId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'bus_routes', routeId));
    return true;
  } catch (err) {
    console.info('Cloud route deletion pending / offline:', err);
    return false;
  }
}

/**
 * Seed initial Tift County routes into Firestore so cloud database is populated
 */
export async function seedDefaultRoutesToCloud(): Promise<boolean> {
  try {
    const routesCol = collection(db, 'bus_routes');
    for (const route of INITIAL_TIFT_ROUTES) {
      await setDoc(doc(routesCol, route.id), {
        ...route,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }
    return true;
  } catch (err) {
    console.info('Could not seed defaults to cloud:', err);
    return false;
  }
}

/**
 * Real-time two-way synchronization with Firestore.
 * Subscribes to live updates from the `bus_routes` collection.
 */
export function subscribeToCloudRoutes(
  onUpdate: (routes: RoutePath[]) => void,
  onStatusChange?: (status: 'synced' | 'local_only' | 'connecting') => void
): () => void {
  // If Firebase is not configured with real credentials yet, rely on local cache
  if (!isFirebaseConfigured()) {
    onStatusChange?.('local_only');
    return () => {};
  }

  onStatusChange?.('connecting');

  try {
    const routesCol = collection(db, 'bus_routes');

    const unsubscribe = onSnapshot(
      routesCol,
      (snapshot) => {
        if (snapshot.empty) {
          // If the cloud database is empty, automatically seed with Tift County defaults
          seedDefaultRoutesToCloud().then(() => {
            onUpdate(INITIAL_TIFT_ROUTES);
            saveRoutesToLocalStorage(INITIAL_TIFT_ROUTES);
            onStatusChange?.('synced');
          });
          return;
        }

        const cloudRoutes: RoutePath[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as RoutePath;
          cloudRoutes.push(data);
        });

        if (cloudRoutes.length > 0) {
          // Sort by routeNumber for consistency
          cloudRoutes.sort((a, b) => a.routeNumber.localeCompare(b.routeNumber, undefined, { numeric: true }));
          saveRoutesToLocalStorage(cloudRoutes);
          onUpdate(cloudRoutes);
          onStatusChange?.('synced');
        }
      },
      (error) => {
        console.info('Firestore routes live subscription on standby:', error.message);
        onStatusChange?.('local_only');
      }
    );

    return unsubscribe;
  } catch (err) {
    console.info('Error setting up Firestore listener:', err);
    onStatusChange?.('local_only');
    return () => {};
  }
}

/**
 * Reset all routes back to default Tift County configuration in both localStorage and Firestore
 */
export async function resetToTiftDefaults(): Promise<RoutePath[]> {
  saveRoutesToLocalStorage(INITIAL_TIFT_ROUTES);
  if (isFirebaseConfigured()) {
    await seedDefaultRoutesToCloud();
  }
  return INITIAL_TIFT_ROUTES;
}
