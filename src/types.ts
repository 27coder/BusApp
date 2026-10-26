export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BusStop {
  id: string;
  name: string;
  address?: string;
  coordinates: Coordinates;
  scheduledTime: string;
  notes?: string;
}

export interface BusVehicle {
  id: string;
  vehicleName: string;
  driverName?: string;
  vin?: string;
  bouncieVin?: string;
  routeNumber: string;
  routeName: string;
  coordinates: Coordinates;
  heading: number; // 0 - 360 degrees
  speedMph: number;
  status: 'In Transit' | 'At Stop' | 'Delayed' | 'Out of Service';
  nextStop: string;
  etaMinutes: number;
  lastUpdated: string;
  isSimulated?: boolean;
  gpsProvider?: 'bouncie' | 'simulated';
}

export interface RoutePath {
  id: string;
  routeNumber: string;
  name: string;
  county: string; // e.g. "Tift County"
  color: string;
  driverName?: string;
  busNumber?: string;
  destinationSchool?: string; // which school this route goes to
  bouncieVin?: string;
  description?: string;
  path: Coordinates[];
  stops: BusStop[];
}

export interface StopMatchResult {
  route: RoutePath;
  stop: BusStop;
  stopIndex: number;
  totalStops: number;
  stopsAway: number;
  estimatedMinutes: number;
  busVehicle: BusVehicle;
}
