import type { BusStop, RoutePath } from './types';
import { PRECOMPUTED_ROAD_PATHS } from './precomputedRoadPaths';

// Pre-defined Landmark & School stops across Tift County, Georgia
export const TIFT_COUNTY_PRESET_STOPS: Omit<BusStop, 'id' | 'scheduledTime'>[] = [
  {
    name: 'Tift County High School (Blue Devil Way)',
    address: 'One Blue Devil Way, Tifton, GA 31794',
    coordinates: { lat: 31.4645, lng: -83.5290 },
    notes: 'Main Campus & Athletic Arena'
  },
  {
    name: 'Eighth Street Middle School',
    address: '700 W 8th St, Tifton, GA 31794',
    coordinates: { lat: 31.4530, lng: -83.5130 },
    notes: 'South entrance bus loop'
  },
  {
    name: 'Northeast Middle School (Fulwood Campus)',
    address: '3021 Fulwood Rd, Tifton, GA 31794',
    coordinates: { lat: 31.4690, lng: -83.4980 },
    notes: 'East Tift student drop-off'
  },
  {
    name: 'J.T. Reddick School',
    address: '404 Martin Luther King Jr Dr, Tifton, GA',
    coordinates: { lat: 31.4460, lng: -83.5180 },
    notes: 'West Central Tifton'
  },
  {
    name: 'Matt Wilson Elementary School',
    address: '510 12th St W, Tifton, GA 31794',
    coordinates: { lat: 31.4520, lng: -83.5220 },
    notes: 'West 12th St pickup'
  },
  {
    name: 'Charles Spencer Elementary School',
    address: '65 E 6th St, Tifton, GA 31794',
    coordinates: { lat: 31.4550, lng: -83.5020 },
    notes: 'Downtown East neighborhood'
  },
  {
    name: 'G.O. Bailey Elementary School',
    address: '1430 Newton Dr, Tifton, GA 31794',
    coordinates: { lat: 31.4310, lng: -83.5110 },
    notes: 'South Tifton residential'
  },
  {
    name: 'Annie Belle Clark Elementary',
    address: '1464 Carpenter Rd S, Tifton, GA',
    coordinates: { lat: 31.4750, lng: -83.5120 },
    notes: 'North Tifton loop'
  },
  {
    name: 'Len Lastinger Elementary School',
    address: '1210 Lake Dr, Tifton, GA 31794',
    coordinates: { lat: 31.4390, lng: -83.5040 },
    notes: 'Southeast Lake Dr zone'
  },
  {
    name: 'Omega Elementary & Community Center',
    address: '150 College Ave, Omega, GA 31775',
    coordinates: { lat: 31.3430, lng: -83.5930 },
    notes: 'Southwest County Connector'
  },
  {
    name: 'Fulwood Park Community Stop',
    address: 'Park Ave & 8th St, Tifton, GA',
    coordinates: { lat: 31.4580, lng: -83.5090 },
    notes: 'Historic Central Tifton'
  },
  {
    name: 'Carpenter Road Crossing (Northside)',
    address: 'Carpenter Rd & Whiddon Mill Rd',
    coordinates: { lat: 31.4720, lng: -83.5180 },
    notes: 'North residential corridor'
  },
  {
    name: 'ABAC / Moore Highway Transit Point',
    address: '2802 Moore Hwy, Tifton, GA',
    coordinates: { lat: 31.4780, lng: -83.5270 },
    notes: 'Northwest corridor'
  },
  {
    name: 'South Main St & 20th Ave Substation',
    address: 'South Main St, Tifton, GA',
    coordinates: { lat: 31.4420, lng: -83.5090 },
    notes: 'South Central neighborhood'
  }
];

// Initial Tift County Bus Routes
export const INITIAL_TIFT_ROUTES: RoutePath[] = [
  {
    id: 'tift-route-14',
    routeNumber: 'Route 14',
    name: 'Blue Devil Northside & TCHS Express',
    county: 'Tift County',
    color: '#2563eb', // Royal Blue
    driverName: 'Ms. Clara Davis',
    busNumber: 'Bus #14',
    destinationSchool: 'Tift County High School',
    description: 'Serves North Tifton, Carpenter Rd residential, Fulwood Park, and Tift County High School.',
    stops: [
      {
        id: 'stop-tift-14-1',
        name: 'Carpenter Road Crossing (Northside)',
        address: 'Carpenter Rd & Whiddon Mill Rd',
        coordinates: { lat: 31.4720, lng: -83.5180 },
        scheduledTime: '07:15 AM',
        notes: 'Northside neighborhood morning pickup'
      },
      {
        id: 'stop-tift-14-2',
        name: 'Fulwood Park Community Stop',
        address: 'Park Ave & 8th St, Tifton, GA',
        coordinates: { lat: 31.4580, lng: -83.5090 },
        scheduledTime: '07:28 AM',
        notes: 'Near park pavilion'
      },
      {
        id: 'stop-tift-14-3',
        name: 'Charles Spencer Elementary School',
        address: '65 E 6th St, Tifton, GA 31794',
        coordinates: { lat: 31.4550, lng: -83.5020 },
        scheduledTime: '07:40 AM',
        notes: 'East 6th St bus driveway'
      },
      {
        id: 'stop-tift-14-4',
        name: 'Tift County High School (Blue Devil Way)',
        address: 'One Blue Devil Way, Tifton, GA 31794',
        coordinates: { lat: 31.4645, lng: -83.5290 },
        scheduledTime: '07:55 AM',
        notes: 'High School Main Entrance loop'
      }
    ],
    path: PRECOMPUTED_ROAD_PATHS['tift-route-14'] || [
      { lat: 31.4720, lng: -83.5180 },
      { lat: 31.4580, lng: -83.5090 },
      { lat: 31.4550, lng: -83.5020 },
      { lat: 31.4645, lng: -83.5290 }
    ]
  },
  {
    id: 'tift-route-22',
    routeNumber: 'Route 22',
    name: 'West Tifton & Eighth Street Middle',
    county: 'Tift County',
    color: '#d97706', // Gold / Amber
    driverName: 'Mr. Marcus Henderson',
    busNumber: 'Bus #22',
    destinationSchool: 'Eighth Street Middle School',
    description: 'Connects West Tifton neighborhoods, Matt Wilson Elementary, J.T. Reddick, and Eighth St Middle.',
    stops: [
      {
        id: 'stop-tift-22-1',
        name: 'Matt Wilson Elementary School',
        address: '510 12th St W, Tifton, GA 31794',
        coordinates: { lat: 31.4520, lng: -83.5220 },
        scheduledTime: '07:20 AM',
        notes: 'West 12th St entrance'
      },
      {
        id: 'stop-tift-22-2',
        name: 'J.T. Reddick School',
        address: '404 Martin Luther King Jr Dr, Tifton, GA',
        coordinates: { lat: 31.4460, lng: -83.5180 },
        scheduledTime: '07:33 AM',
        notes: 'MLK Jr Dr bus lane'
      },
      {
        id: 'stop-tift-22-3',
        name: 'Eighth Street Middle School',
        address: '700 W 8th St, Tifton, GA 31794',
        coordinates: { lat: 31.4530, lng: -83.5130 },
        scheduledTime: '07:46 AM',
        notes: 'Middle school primary arrival'
      },
      {
        id: 'stop-tift-22-4',
        name: 'Tift County High School (Blue Devil Way)',
        address: 'One Blue Devil Way, Tifton, GA 31794',
        coordinates: { lat: 31.4645, lng: -83.5290 },
        scheduledTime: '08:00 AM',
        notes: 'Transfer hub'
      }
    ],
    path: PRECOMPUTED_ROAD_PATHS['tift-route-22'] || [
      { lat: 31.4520, lng: -83.5220 },
      { lat: 31.4460, lng: -83.5180 },
      { lat: 31.4530, lng: -83.5130 },
      { lat: 31.4645, lng: -83.5290 }
    ]
  },
  {
    id: 'tift-route-08',
    routeNumber: 'Route 08',
    name: 'South County & Omega Connector',
    county: 'Tift County',
    color: '#059669', // Emerald
    driverName: 'Mr. Robert Taylor',
    busNumber: 'Bus #08',
    destinationSchool: 'Eighth Street Middle School',
    description: 'Long-distance south corridor starting from Omega, GA serving Len Lastinger, G.O. Bailey, and Middle School.',
    stops: [
      {
        id: 'stop-tift-08-1',
        name: 'Omega Elementary & Community Center',
        address: '150 College Ave, Omega, GA 31775',
        coordinates: { lat: 31.3430, lng: -83.5930 },
        scheduledTime: '07:05 AM',
        notes: 'Early morning rural pickup'
      },
      {
        id: 'stop-tift-08-2',
        name: 'G.O. Bailey Elementary School',
        address: '1430 Newton Dr, Tifton, GA 31794',
        coordinates: { lat: 31.4310, lng: -83.5110 },
        scheduledTime: '07:30 AM',
        notes: 'Newton Dr bus zone'
      },
      {
        id: 'stop-tift-08-3',
        name: 'Len Lastinger Elementary School',
        address: '1210 Lake Dr, Tifton, GA 31794',
        coordinates: { lat: 31.4390, lng: -83.5040 },
        scheduledTime: '07:42 AM',
        notes: 'Lake Dr entrance'
      },
      {
        id: 'stop-tift-08-4',
        name: 'Eighth Street Middle School',
        address: '700 W 8th St, Tifton, GA 31794',
        coordinates: { lat: 31.4530, lng: -83.5130 },
        scheduledTime: '07:55 AM',
        notes: 'Drop-off bay'
      }
    ],
    path: PRECOMPUTED_ROAD_PATHS['tift-route-08'] || [
      { lat: 31.3430, lng: -83.5930 },
      { lat: 31.4310, lng: -83.5110 },
      { lat: 31.4390, lng: -83.5040 },
      { lat: 31.4530, lng: -83.5130 }
    ]
  },
  {
    id: 'tift-route-31',
    routeNumber: 'Route 31',
    name: 'Northeast Middle & ABAC Corridor',
    county: 'Tift County',
    color: '#7c3aed', // Purple
    driverName: 'Mrs. Evelyn Jenkins',
    busNumber: 'Bus #31',
    destinationSchool: 'Northeast Middle School',
    description: 'Serves Moore Hwy / ABAC area, Annie Belle Clark Elementary, Northeast Middle campus, and TCHS.',
    stops: [
      {
        id: 'stop-tift-31-1',
        name: 'ABAC / Moore Highway Transit Point',
        address: '2802 Moore Hwy, Tifton, GA',
        coordinates: { lat: 31.4780, lng: -83.5270 },
        scheduledTime: '07:18 AM',
        notes: 'Campus edge stop'
      },
      {
        id: 'stop-tift-31-2',
        name: 'Annie Belle Clark Elementary',
        address: '1464 Carpenter Rd S, Tifton, GA',
        coordinates: { lat: 31.4750, lng: -83.5120 },
        scheduledTime: '07:32 AM',
        notes: 'South Carpenter bus lane'
      },
      {
        id: 'stop-tift-31-3',
        name: 'Northeast Middle School (Fulwood Campus)',
        address: '3021 Fulwood Rd, Tifton, GA 31794',
        coordinates: { lat: 31.4690, lng: -83.4980 },
        scheduledTime: '07:45 AM',
        notes: 'Fulwood Rd main middle school stop'
      },
      {
        id: 'stop-tift-31-4',
        name: 'Tift County High School (Blue Devil Way)',
        address: 'One Blue Devil Way, Tifton, GA 31794',
        coordinates: { lat: 31.4645, lng: -83.5290 },
        scheduledTime: '08:02 AM',
        notes: 'High school athletic concourse'
      }
    ],
    path: PRECOMPUTED_ROAD_PATHS['tift-route-31'] || [
      { lat: 31.4780, lng: -83.5270 },
      { lat: 31.4750, lng: -83.5120 },
      { lat: 31.4690, lng: -83.4980 },
      { lat: 31.4645, lng: -83.5290 }
    ]
  }
];

