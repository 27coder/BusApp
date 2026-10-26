/**
 * Firebase Cloud Function: Bouncie GPS Integration
 * 
 * Why this is needed:
 * Bouncie uses OAuth2 credentials (client_id, client_secret, authorization_code / refresh_token).
 * Storing these in client-side web code exposes your secrets to everyone inspecting network requests.
 * Instead, this Cloud Function holds the secret securely on Google Cloud / Firebase and syncs 
 * live vehicle coordinates directly into Firestore.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

admin.initializeApp();
const db = admin.firestore();

// Set these using: firebase functions:secrets:set BOUNCIE_CLIENT_ID ...
const BOUNCIE_AUTH_URL = 'https://auth.bouncie.com/oauth/token';
const BOUNCIE_API_URL = 'https://api.bouncie.dev/v1';

/**
 * Scheduled sync worker: runs every 1 minute to fetch latest GPS coordinates from Bouncie
 */
export const syncBouncieVehicles = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  try {
    const clientId = process.env.BOUNCIE_CLIENT_ID;
    const clientSecret = process.env.BOUNCIE_CLIENT_SECRET;
    const apiKey = process.env.BOUNCIE_API_KEY;

    if (!clientId || !clientSecret || !apiKey) {
      console.warn('Bouncie API credentials not configured in Cloud Functions environment.');
      return null;
    }

    // 1. Get OAuth Access Token
    const authResponse = await axios.post(BOUNCIE_AUTH_URL, {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    });
    const accessToken = authResponse.data.access_token;

    // 2. Fetch Active Vehicles from Bouncie
    const vehiclesResponse = await axios.get(`${BOUNCIE_API_URL}/vehicles`, {
      headers: {
        'Authorization': accessToken,
        'API-Key': apiKey
      }
    });

    const vehicles = vehiclesResponse.data;

    // 3. Batch write vehicle status into Firestore
    const batch = db.batch();
    for (const vehicle of vehicles) {
      const busDocRef = db.collection('buses').doc(vehicle.vin || vehicle.imei);
      
      batch.set(busDocRef, {
        vehicleName: vehicle.nickName || 'Bus ' + vehicle.vin.slice(-4),
        vin: vehicle.vin,
        coordinates: {
          lat: vehicle.stats?.location?.lat || 0,
          lng: vehicle.stats?.location?.lon || 0
        },
        speedMph: vehicle.stats?.speed || 0,
        heading: vehicle.stats?.heading || 0,
        fuelPercent: vehicle.stats?.fuelLevel || null,
        batteryStatus: vehicle.stats?.battery?.status || 'Good',
        status: vehicle.stats?.speed > 0 ? 'In Transit' : 'At Stop',
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    await batch.commit();
    console.log(`Synced ${vehicles.length} vehicles from Bouncie GPS.`);
    return null;
  } catch (error) {
    console.error('Error syncing Bouncie GPS data:', error);
    return null;
  }
});
