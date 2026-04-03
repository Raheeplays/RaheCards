/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue,
  off,
  query,
  orderByChild,
  equalTo,
  serverTimestamp,
  runTransaction,
  goOnline
} from 'firebase/database';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { handleDatabaseError, OperationType } from './utils/firebaseErrors';
import { UserProfile, GameRoom, Player, CardData } from './types';
import { CARDS } from './constants';
import { 
  Trophy, 
  User, 
  Key, 
  Play, 
  Users, 
  Monitor, 
  MessageSquare, 
  Star, 
  ArrowLeft,
  LogOut,
  LogOut as LogOutIcon,
  Loader2,
  ShieldAlert,
  X,
  RefreshCw
} from 'lucide-react';

// Components
import GameScreen from './components/GameScreen';
import AuthScreen from './components/AuthScreen';
import MainMenu from './components/MainMenu';
import FeedbackScreen from './components/FeedbackScreen';
import SplashScreen from './components/SplashScreen';
import CardManager from './components/CardManager';
import DatabaseManager from './components/DatabaseManager';
import TestingManager from './components/TestingManager';

export default function App() {
  const [view, setView] = useState<'splash' | 'auth' | 'menu' | 'game' | 'feedback' | 'admin' | 'db_manager' | 'testing'>('splash');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [cards, setCards] = useState<CardData[]>([]);
  const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
  const [activeRoomKeys, setActiveRoomKeys] = useState<string[]>([]);
  const [showCustomRoomModal, setShowCustomRoomModal] = useState(false);
  const [customKey, setCustomKey] = useState('');

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const getIsAdmin = () => {
    if (user?.role === 'admin' || user?.name?.toLowerCase() === 'rahee') return true;
    const savedProfile = localStorage.getItem('rahee_profile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        if (parsed.role === 'admin' || parsed.name?.toLowerCase() === 'rahee') return true;
      } catch (e) {}
    }
    return false;
  };
  const isAdmin = getIsAdmin();

  const getDisplayError = (err: string | null) => {
    const actualErr = err || authError;
    if (!actualErr) return null;
    if (isAdmin) return actualErr;
    
    // List of "safe" errors that are part of the normal flow
    const safeErrors = [
      'Waiting For Approval By Rahee',
      'Invalid Rahee Key or Name',
      'Wrong Name for this Key',
      'Unregistered Key.',
      'Name "Rahee" is reserved for Admin',
      'Key already taken',
      'Invalid or expired room key',
      'Room is already playing or finished',
      'This room is already full (Max 32 Players)'
    ];
    
    if (safeErrors.includes(actualErr)) return actualErr;
    
    return 'Server Down';
  };

  useEffect(() => {
    // Connection status listener
    const connectedRef = ref(db, '.info/connected');
    const unsubscribeConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        console.log("Connected to Realtime Database");
        setIsOffline(false);
      } else {
        console.warn("Disconnected from Realtime Database");
        setIsOffline(true);
      }
    });

    // Ensure we are online
    goOnline(db);

    // Ensure user is authenticated anonymously for database access
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsAuthReady(true);
        setAuthError(null);
        // Once auth is ready, check for existing session
        await checkSession();
      } else {
        setIsAuthReady(false);
        signInAnonymously(auth).catch(err => {
          console.error("Anonymous auth failed:", err);
          if (err.code === 'auth/admin-restricted-operation') {
            setAuthError('Anonymous Authentication is disabled in Firebase Console. Please enable it in Authentication > Sign-in method.');
          }
        });
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeConnected();
    };
  }, []);

  const checkSession = async () => {
    const savedProfile = localStorage.getItem('rahee_profile');
    if (!savedProfile) return;

    setLoading(true);
    console.log("Checking session for saved profile...");
    try {
      let parsed: any = null;
      try {
        parsed = JSON.parse(savedProfile);
        const uid = parsed.uid || parsed.raheeKey;
        if (!uid) {
          console.warn("No UID found in saved profile");
          localStorage.removeItem('rahee_profile');
          setView('auth');
          setLoading(false);
          return;
        }

        console.log("Fetching user data for UID:", uid);
        const userRef = ref(db, `users/${uid}`);
        
        // Use onValue for a more resilient check
        return new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            off(userRef);
            reject(new Error('Session Check Timeout'));
          }, 30000); // Increased to 30s

          onValue(userRef, (snap) => {
            clearTimeout(timeoutId);
            if (snap.exists()) {
              const userData = snap.val() as UserProfile;
              console.log("User data found:", userData.name);
              if (userData.isApproved === false && userData.name.toLowerCase() !== 'rahee') {
                setError('Waiting For Approval By Rahee');
                localStorage.removeItem('rahee_profile');
                setView('auth');
              } else {
                const profileWithUid = { ...userData, uid: snap.key };
                setUser(profileWithUid);
                setView('menu');
              }
            } else {
              console.warn("User data not found in database");
              localStorage.removeItem('rahee_profile');
              setView('auth');
            }
            resolve();
          }, (err) => {
            clearTimeout(timeoutId);
            reject(err);
          }, { onlyOnce: true });
        });
      } catch (err: any) {
        console.error("Session check error:", err);
        if (err.message === 'Session Check Timeout') {
          setError('Connection Timeout. Please check your internet and refresh.');
        } else {
          localStorage.removeItem('rahee_profile');
          setView('auth');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial splash delay
    const timer = setTimeout(() => {
      if (view === 'splash') setView('auth');
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    // Fetch cards from Database
    const cardsRef = ref(db, 'cards');
    const unsubscribeCards = onValue(cardsRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const fetchedCards: CardData[] = Object.keys(data).map(key => ({ ...data[key], id: key } as CardData));
        
        // If some cards are missing, only an admin should add them
        if (fetchedCards.length < CARDS.length && isAdmin) {
          const existingIds = new Set(fetchedCards.map(c => c.id));
          for (const card of CARDS) {
            if (!existingIds.has(card.id)) {
              try {
                await set(ref(db, `cards/${card.id}`), card);
              } catch (err: any) {
                console.error("Error setting card:", err);
                handleDatabaseError(err, OperationType.WRITE, `cards/${card.id}`);
              }
            }
          }
        } else {
          setCards(fetchedCards.sort((a, b) => Number(a.id) - Number(b.id)));
        }
      } else if (isAdmin) {
        // Seed initial cards
        for (const card of CARDS) {
          await set(ref(db, `cards/${card.id}`), card);
        }
      } else {
        // Fallback to local cards if none in DB and not admin
        setCards([...CARDS].sort((a, b) => Number(a.id) - Number(b.id)));
      }
    }, (err: any) => {
      console.error("Cards listener error:", err);
      
      // Fallback to local cards if error
      if (cards.length === 0) {
        setCards([...CARDS].sort((a, b) => Number(a.id) - Number(b.id)));
      }
      
      handleDatabaseError(err, OperationType.LIST, 'cards');
    });

    const connectedRef = ref(db, '.info/connected');
    const unsubscribeConnected = onValue(connectedRef, (snap) => {
      setIsOffline(!snap.val());
    });

    return () => {
      off(cardsRef, 'value', unsubscribeCards);
      off(connectedRef, 'value', unsubscribeConnected);
    };
  }, [isAuthReady, isAdmin]);

  useEffect(() => {
    if (!isAuthReady) return;
    
    // Bootstrap check: Ensure default admin exists
    const adminRef = ref(db, 'users/786');
    get(adminRef).then((snap) => {
      if (!snap.exists()) {
        console.log("Admin user not found. Bootstrapping Rahee...");
        set(ref(db, 'users/786'), {
          name: 'Rahee',
          raheeKey: '786',
          role: 'admin',
          isApproved: true,
          createdAt: serverTimestamp()
        }).catch(err => console.error("Bootstrap error:", err));
      }
    }).catch(err => console.error("Check admin error:", err));
  }, [isAuthReady]);

  useEffect(() => {
    if (!user || !isAuthReady) {
      setActiveRoom(null);
      return;
    }

    const myUid = user.uid || user.raheeKey;
    const roomsRef = ref(db, 'rooms');
    
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const roomsData = Object.keys(data).map(key => ({ ...data[key], id: key } as GameRoom));
        
        const myRooms = roomsData.filter(r => 
          r.status !== 'finished' && r.players && r.players.some(p => p.uid === myUid)
        );
        
        if (myRooms.length > 0) {
          // Sort by most recent
          myRooms.sort((a, b) => {
            const aTime = (a.createdAt as number) || 0;
            const bTime = (b.createdAt as number) || 0;
            return bTime - aTime;
          });
          setActiveRoom(myRooms[0]);
        } else {
          setActiveRoom(null);
        }

        // Collect all active room keys
        const allKeys = roomsData.map(r => r.roomKey).filter(Boolean);
        setActiveRoomKeys(allKeys);
      } else {
        setActiveRoom(null);
        setActiveRoomKeys([]);
      }
    }, (err: any) => {
      console.error("Active room listener error:", err);
      handleDatabaseError(err, OperationType.LIST, 'rooms');
    });

    return () => off(roomsRef, 'value', unsubscribe);
  }, [user, isAuthReady]);

  const handleLogin = async (name: string, key: string) => {
    setError(null);
    setLoading(true);
    console.log(`Attempting login for ${name} with key ${key}...`);
    try {
      const userRef = ref(db, `users/${key}`);
      
      // Use onValue for a more resilient check
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          off(userRef);
          reject(new Error('Login Timeout'));
        }, 30000); // Increased to 30s

        onValue(userRef, async (userSnap) => {
          clearTimeout(timeoutId);
          try {
            if (userSnap && userSnap.exists()) {
              const userData = userSnap.val() as UserProfile;
              console.log("User found:", userData);
              
              if (userData.name === name) {
                if (userData.isApproved === false && userData.name.toLowerCase() !== 'rahee') {
                  console.warn("User not approved");
                  setError('Waiting For Approval By Rahee');
                  setLoading(false);
                  resolve();
                  return;
                }
                
                const profileWithUid = { ...userData, uid: userSnap.key };
                setUser(profileWithUid);
                localStorage.setItem('rahee_profile', JSON.stringify(profileWithUid));
                
                const authLogsRef = ref(db, 'auth_logs');
                push(authLogsRef, {
                  type: 'login',
                  status: 'success',
                  name,
                  raheeKey: key,
                  uid: userSnap.key,
                  userAgent: navigator.userAgent,
                  platform: navigator.platform,
                  timestamp: serverTimestamp()
                }).catch(err => console.error("Failed to log auth:", err));
                
                console.log("Login successful, redirecting to menu...");
                setView('menu');
                setLoading(false);
                
                // Update last login in background
                update(userRef, { lastLogin: serverTimestamp() })
                  .catch(err => console.error("Failed to update last login:", err));
              } else {
                console.warn("Name mismatch:", userData.name, "vs", name);
                setError('Wrong Name for this Key');
              }
            } else {
              // Auto-register Rahee if using the correct admin key
              const adminKeys = ['786', 'aiza', '181855', 'rahee', 'admin'];
              if (name.toLowerCase() === 'rahee' && adminKeys.includes(key.toLowerCase())) {
                console.log("Admin key detected but not registered. Auto-registering...");
                const adminProfile: UserProfile = {
                  name: 'Rahee',
                  raheeKey: key,
                  wins: 0,
                  losses: 0,
                  role: 'admin',
                  uid: '786',
                  isApproved: true
                };
                await set(ref(db, 'users/786'), {
                  ...adminProfile,
                  createdAt: serverTimestamp()
                });
                setUser(adminProfile);
                localStorage.setItem('rahee_profile', JSON.stringify(adminProfile));
                setView('menu');
                resolve();
                return;
              }
              console.warn("User not found with key:", key);
              setError('Unregistered Key.');
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        }, (err) => {
          clearTimeout(timeoutId);
          reject(err);
        }, { onlyOnce: true });
      });
    } catch (err: any) {
      console.error("Login error details:", err);
      setError('Connection Error: ' + (err.message || 'Unknown error'));
      handleDatabaseError(err, OperationType.GET, `users/${key}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (name: string, key: string) => {
    setError(null);
    setLoading(true);
    console.log(`Attempting signup for ${name} with key ${key}...`);
    
    try {
      // Prevent impersonation of Rahee
      const adminKeys = ['786', 'aiza', '181855', 'rahee', 'admin'];
      if (name.toLowerCase() === 'rahee' && !adminKeys.includes(key.toLowerCase())) {
        setError('Name "Rahee" is reserved for Admin');
        setLoading(false);
        return;
      }

      const userRef = ref(db, `users/${key}`);
      
      // Use onValue for a more resilient check
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          off(userRef);
          reject(new Error('Signup Timeout'));
        }, 30000); // Increased to 30s

        onValue(userRef, async (userSnap) => {
          clearTimeout(timeoutId);
          try {
            if (userSnap.exists()) {
              console.warn("Key already taken:", key);
              setError('Key already taken');
              setLoading(false);
              resolve();
              return;
            }

            const isRahee = name.toLowerCase() === 'rahee';
            const newProfile: UserProfile = {
              name,
              raheeKey: key,
              wins: 0,
              losses: 0,
              role: isRahee ? 'admin' : 'user',
              uid: key,
              isApproved: isRahee // Admin is auto-approved
            };

            await set(userRef, {
              ...newProfile,
              createdAt: serverTimestamp()
            });

            console.log("User created:", newProfile);

            if (!isRahee) {
              console.log("Signup successful, waiting for approval...");
              setError('Waiting For Approval By Rahee');
              setLoading(false);
              resolve();
              return;
            }

            setUser(newProfile);
            localStorage.setItem('rahee_profile', JSON.stringify(newProfile));
            
            const authLogsRef = ref(db, 'auth_logs');
            push(authLogsRef, {
              type: 'signup',
              status: 'success',
              name,
              raheeKey: key,
              uid: key,
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              timestamp: serverTimestamp()
            }).catch(err => console.error("Failed to log auth:", err));
            
            console.log("Signup successful, redirecting to menu...");
            setView('menu');
            setLoading(false);
            resolve();
          } catch (err) {
            reject(err);
          }
        }, (err) => {
          clearTimeout(timeoutId);
          reject(err);
        }, { onlyOnce: true });
      });
    } catch (err: any) {
      console.error("Signup error details:", err);
      setError('Signup Failed: ' + (err.message || 'Unknown error'));
      handleDatabaseError(err, OperationType.WRITE, `users/${key}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('rahee_profile');
    setView('auth');
  };

  const generateRoomKey = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = '';
    for (let i = 0; i < 6; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const logGameEvent = async (roomId: string, mode: 'solo' | '1v1' | 'multi', status: 'started' | 'finished') => {
    if (!user) return;
    try {
      const gameLogsRef = ref(db, 'game_logs');
      await push(gameLogsRef, {
        uid: user.uid || user.raheeKey,
        userName: user.name,
        mode,
        timestamp: serverTimestamp(),
        roomId,
        status
      });
    } catch (err) {
      console.error("Failed to log game event:", err);
    }
  };

  const createRoom = async () => {
    if (!user || cards.length === 0) return;
    setLoading(true);
    const roomKey = generateRoomKey();
    const myUid = user.uid || user.raheeKey;
    
    const newRoomData = {
      roomKey,
      hostUid: myUid,
      status: 'waiting',
      mode: 'multi' as const,
      players: [{
        uid: myUid,
        name: user.name,
        deck: [], // Cards dealt on start
        ready: true
      }],
      currentTurn: '',
      createdAt: serverTimestamp()
    };

    try {
      const roomsRef = ref(db, 'rooms');
      const newRoomRef = push(roomsRef);
      await set(newRoomRef, newRoomData);
      setRoom({ ...newRoomData, id: newRoomRef.key } as any);
      logGameEvent(newRoomRef.key!, 'multi', 'started');
      setView('game');
    } catch (err: any) {
      console.error(err);
      setError('Failed to create room');
      handleDatabaseError(err, OperationType.WRITE, 'rooms');
    } finally {
      setLoading(false);
    }
  };

  const joinRoomWithKey = async (key: string) => {
    if (!user || !key) return;
    setLoading(true);
    setError(null);

    try {
      const roomsRef = ref(db, 'rooms');
      const q = query(roomsRef, orderByChild('roomKey'), equalTo(key.toUpperCase()));
      const snap = await get(q);

      if (!snap.exists()) {
        setError('Invalid or expired room key');
        return;
      }

      const rooms = snap.val();
      const roomId = Object.keys(rooms)[0];
      const roomData = rooms[roomId] as GameRoom;

      const myUid = user.uid || user.raheeKey;
      const isAlreadyIn = roomData.players && roomData.players.some(p => p.uid === myUid);
      
      if (isAlreadyIn && roomData.status !== 'finished') {
        setRoom({ ...roomData, id: roomId });
        setView('game');
        return;
      }

      if (roomData.status !== 'waiting') {
        setError('Room is already playing or finished');
        return;
      }

      if (roomData.players && roomData.players.length >= 32) {
        setError('This room is already full (Max 32 Players)');
        return;
      }

      const newPlayer = {
        uid: myUid,
        name: user.name,
        deck: [],
        ready: true
      };

      const updatedPlayers = roomData.players ? [...roomData.players, newPlayer] : [newPlayer];
      await update(ref(db, `rooms/${roomId}`), {
        players: updatedPlayers
      });

      setRoom({ ...roomData, players: updatedPlayers, id: roomId });
      logGameEvent(roomId, roomData.mode, 'started');
      setView('game');
    } catch (err: any) {
      console.error(err);
      setError('Failed to join room');
      handleDatabaseError(err, OperationType.WRITE, 'rooms');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (mode: 'solo' | '1v1' | 'multi') => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const myUid = user.uid || user.raheeKey;

      if (mode === 'solo') {
        const deckSource = cards.length > 0 ? cards : CARDS;
        const allCardIds = [...deckSource].map(c => c.id).sort(() => Math.random() - 0.5);
        const half = Math.ceil(allCardIds.length / 2);
        
        const humanPlayer: Player = {
          uid: myUid,
          name: user.name,
          deck: allCardIds.slice(0, half),
          ready: true
        };
        const aiPlayer: Player = {
          uid: 'ai_bot',
          name: 'AI',
          deck: allCardIds.slice(half),
          ready: true
        };
        const newRoom: GameRoom = {
          id: 'solo_' + Date.now(),
          roomKey: 'SOLO',
          hostUid: myUid,
          status: 'playing',
          mode: 'solo',
          players: [humanPlayer, aiPlayer],
          currentTurn: humanPlayer.uid,
          createdAt: Date.now()
        };
        setRoom(newRoom);
        logGameEvent(newRoom.id, 'solo', 'started');
        setView('game');
        return;
      }

      const roomsRef = ref(db, 'rooms');
      const roomsSnap = await get(roomsRef);
      
      let roomsData: GameRoom[] = [];
      if (roomsSnap.exists()) {
        const data = roomsSnap.val();
        roomsData = Object.keys(data).map(key => ({ ...data[key], id: key } as GameRoom));
      }
      
      // Check if I'm already in any of these rooms (even if they are already playing)
      const myRoom = roomsData.find(r => r.status !== 'finished' && r.players && r.players.some(p => p.uid === myUid));
      if (myRoom) {
        setRoom(myRoom);
        setView('game');
        return;
      }

      // Find a room that is waiting, not full, and matches the mode
      const availableRooms = roomsData.filter(r => 
        r.status === 'waiting' &&
        r.mode === mode && 
        (!r.players || r.players.length < (mode === '1v1' ? 2 : 32))
      );
      
      if (availableRooms.length > 0) {
        // Try to join the first available room
        const roomToJoin = availableRooms[0];
        
        const newPlayer = {
          uid: myUid,
          name: user.name,
          deck: [],
          ready: true
        };
        
        try {
          const updatedPlayers = roomToJoin.players ? [...roomToJoin.players, newPlayer] : [newPlayer];
          
          // If 1v1 and we now have 2 players, start the game automatically
          if (mode === '1v1' && updatedPlayers.length === 2) {
            const deckSource = cards.length > 0 ? cards : CARDS;
            const allCardIds = [...deckSource].map(c => c.id).sort(() => Math.random() - 0.5);
            const half = Math.ceil(allCardIds.length / 2);
            
            const playersWithDecks = updatedPlayers.map((p, idx) => ({
              ...p,
              deck: idx === 0 ? allCardIds.slice(0, half) : allCardIds.slice(half)
            }));

            await update(ref(db, `rooms/${roomToJoin.id}`), {
              players: playersWithDecks,
              status: 'playing',
              currentTurn: playersWithDecks[0].uid,
              startedAt: serverTimestamp()
            });

            setRoom({ 
              ...roomToJoin, 
              players: playersWithDecks, 
              status: 'playing', 
              currentTurn: playersWithDecks[0].uid 
            });
          } else {
            await update(ref(db, `rooms/${roomToJoin.id}`), {
              players: updatedPlayers
            });
            setRoom({ ...roomToJoin, players: updatedPlayers });
          }
          
          logGameEvent(roomToJoin.id, mode, 'started');
          setView('game');
          return;
        } catch (err: any) {
          // If update fails (e.g. room became full), try again or create new
          console.error("Join failed, retrying...", err);
          await createNewRoom(myUid, mode);
        }
      } else {
        const myUid = user.uid || user.raheeKey;
        await createNewRoom(mode);
      }
    } catch (err: any) {
      console.error("Matchmaking error:", err);
      setError('Matchmaking failed');
    } finally {
      setLoading(false);
    }
  };

  const createNewRoom = async (mode: '1v1' | 'multi', customKey?: string) => {
    const roomKey = customKey || generateRoomKey();
    const myUid = user?.uid || user?.raheeKey;
    if (!myUid) return;

    const newRoomData = {
      roomKey,
      status: 'waiting',
      mode,
      hostUid: myUid,
      players: [{
        uid: myUid,
        name: user.name,
        deck: [],
        ready: true
      }],
      currentTurn: '',
      createdAt: serverTimestamp()
    };
    
    try {
      const roomsRef = ref(db, 'rooms');
      const newRoomRef = push(roomsRef);
      await set(newRoomRef, newRoomData);
      
      setRoom({ ...newRoomData, id: newRoomRef.key } as any);
      logGameEvent(newRoomRef.key!, mode, 'started');
      setView('game');
    } catch (err: any) {
      console.error("Create room error:", err);
      setError('Failed to create room');
      handleDatabaseError(err, OperationType.WRITE, 'rooms');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-rahee/30">
      {error && view !== 'auth' && (
        <div className="fixed top-4 left-4 right-4 z-[110] bg-red-500/90 backdrop-blur-sm text-white p-3 rounded-xl shadow-2xl flex items-center justify-between border border-red-400/50 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-4 h-4 text-white" />
            <span className="text-xs font-bold uppercase tracking-wider">{getDisplayError(error)}</span>
          </div>
          <button 
            onClick={() => setError(null)}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {isOffline && (
        <div className="fixed bottom-4 left-4 right-4 z-[100] bg-red-500/90 backdrop-blur-sm text-white p-3 rounded-xl shadow-2xl flex items-center justify-between border border-red-400/50 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-bold uppercase tracking-wider">Database Offline</span>
          </div>
          <button 
            onClick={() => {
              goOnline(db);
              window.location.reload();
            }}
            className="px-4 py-1.5 bg-white text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 active:scale-95 transition-all shadow-sm"
          >
            RECONNECT
          </button>
        </div>
      )}
      <AnimatePresence mode="wait">
        {view === 'splash' && !authError && (
          <SplashScreen 
            key="splash-screen"
            onComplete={() => setView('auth')} 
          />
        )}
        {view === 'auth' && (
          <AuthScreen 
            key="auth-screen"
            onLogin={handleLogin} 
            onSignup={handleSignup} 
            error={getDisplayError(error)} 
            loading={loading}
          />
        )}
        {view === 'menu' && user && (
          <MainMenu 
            key="menu-screen"
            user={user} 
            onJoinRoom={joinRoom} 
            onCreateRoom={createRoom}
            onJoinWithKey={joinRoomWithKey}
            onLogout={handleLogout}
            onFeedback={() => setView('feedback')}
            isAdmin={isAdmin}
            onAdminClick={() => setView('admin')}
            onDbManagerClick={() => setView('db_manager')}
            onTestingClick={() => setView('testing')}
            onCreateCustomRoom={() => setShowCustomRoomModal(true)}
            activeRoom={activeRoom}
            activeRoomKeys={activeRoomKeys}
            isQuotaExceeded={isQuotaExceeded}
            onExitRoom={async () => {
              if (activeRoom) {
                try {
                  const myUid = user.uid || user.raheeKey;
                  await runTransaction(ref(db, `rooms/${activeRoom.id}`), (currentRoomData) => {
                    if (currentRoomData) {
                      const currentPlayers = currentRoomData.players || [];
                      const updatedPlayers = currentPlayers.filter((p: any) => p.uid !== myUid);
                      
                      if (updatedPlayers.length === 0) {
                        currentRoomData.status = 'finished';
                        // Log game finished for the last player
                        logGameEvent(activeRoom.id, activeRoom.mode, 'finished');
                      } else {
                        currentRoomData.players = updatedPlayers;
                        // If the host left, assign a new host
                        if (currentRoomData.hostUid === myUid) {
                          currentRoomData.hostUid = updatedPlayers[0].uid;
                        }
                      }
                    }
                    return currentRoomData;
                  });
                  
                  setActiveRoom(null);
                } catch (err) {
                  console.error("Failed to exit room:", err);
                  handleDatabaseError(err, OperationType.UPDATE, `rooms/${activeRoom.id}`);
                }
              }
            }}
            onResumeRoom={() => {
              if (activeRoom) {
                setRoom(activeRoom);
                setView('game');
              }
            }}
          />
        )}
        {view === 'admin' && user && isAdmin && (
          <CardManager 
            key="admin-screen"
            onBack={() => setView('menu')}
            cards={cards}
          />
        )}
        {view === 'db_manager' && user && isAdmin && (
          <DatabaseManager 
            key="db-manager-screen"
            onBack={() => setView('menu')}
          />
        )}
        {view === 'testing' && user && isAdmin && (
          <TestingManager 
            onBack={() => setView('menu')}
          />
        )}
        {view === 'game' && room && user && (
          <GameScreen 
            key="game-screen"
            room={room} 
            user={user} 
            cards={cards}
            onExit={() => { setRoom(null); setView('menu'); }} 
            isAdmin={isAdmin}
            setIsQuotaExceeded={setIsQuotaExceeded}
          />
        )}
        {view === 'feedback' && user && (
          <FeedbackScreen 
            key="feedback-screen"
            user={user} 
            onBack={() => setView('menu')} 
          />
        )}
      </AnimatePresence>

      {/* Custom Room Modal */}
      <AnimatePresence>
        {showCustomRoomModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-[#151a21] border border-white/10 p-8 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Create Custom Room</h3>
                <button onClick={() => setShowCustomRoomModal(false)} className="text-zinc-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              
              <p className="text-zinc-400 text-sm mb-6">
                Enter a custom room key (one or more letters).
              </p>

              <div className="space-y-4">
                <input 
                  type="text"
                  placeholder="CUSTOM KEY"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
                  className="w-full bg-black/40 border border-white/10 rounded-lg py-4 px-4 text-center text-2xl font-mono tracking-widest focus:border-rahee outline-none transition-all"
                />
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowCustomRoomModal(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      if (customKey.trim()) {
                        createNewRoom('multi', customKey.trim());
                        setShowCustomRoomModal(false);
                        setCustomKey('');
                      }
                    }}
                    disabled={!customKey.trim()}
                    className="flex-[2] bg-rahee hover:bg-rahee/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transition-all"
                  >
                    Create Room
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
