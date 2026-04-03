import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, child, serverTimestamp, onValue, goOnline } from 'firebase/database';
import { getAuth } from 'firebase/auth';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
const databaseURL = firebaseConfig.databaseURL || `https://${firebaseConfig.projectId}.firebaseio.com`;
export const db = getDatabase(app, databaseURL);
export const auth = getAuth(app);

// Connection test
async function testConnection() {
  console.log("Testing Realtime Database connection to:", databaseURL);
  
  // Force online
  goOnline(db);

  try {
    const dbRef = ref(db, '.info/connected');
    // Use onValue for the connection test instead of get()
    const unsubscribe = onValue(dbRef, (snap) => {
      const connected = snap.val();
      console.log("Realtime Database connection status updated:", connected);
      if (connected === true) {
        console.log("Realtime Database is ONLINE.");
      } else {
        console.warn("Realtime Database is OFFLINE. Attempting to force online...");
        goOnline(db);
      }
    });

    // Still use a timeout to log if it's taking too long
    setTimeout(() => {
      console.log("Connection test still waiting for initial status...");
    }, 10000);

  } catch (error: any) {
    console.error("Realtime Database connection error:", error.message);
  }
}

testConnection();
