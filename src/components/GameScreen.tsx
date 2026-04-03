import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ref, onValue, update, runTransaction, serverTimestamp, push, set, get, off } from 'firebase/database';
import { handleDatabaseError, OperationType } from '../utils/firebaseErrors';
import { db } from '../firebase';
import { GameRoom, UserProfile, CardData } from '../types';
import { STAT_LABELS, CARDS, STAT_KEYS } from '../constants';
import { ArrowLeft, Trophy, ShieldAlert, Loader2, User as UserIcon, Users, Play, Layers, X, ChevronLeft, ChevronRight, LayoutGrid, Maximize2 } from 'lucide-react';
import Card from './Card';

interface GameScreenProps {
  key?: string;
  room: GameRoom;
  user: UserProfile;
  cards: CardData[];
  onExit: () => void;
  isAdmin?: boolean;
  setIsQuotaExceeded?: (val: boolean) => void;
}

export default function GameScreen({ room: initialRoom, user, cards, onExit, isAdmin }: GameScreenProps) {
  const [room, setRoom] = useState<GameRoom>(initialRoom);
  const [isComparing, setIsComparing] = useState(false);
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isAdminVisionEnabled, setIsAdminVisionEnabled] = useState(isAdmin);
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiLevel, setAiLevel] = useState<'lose' | 'normal' | 'max'>('max');
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [testMode, setTestMode] = useState<{ type: 'victory' | 'defeat' | 'round_win' | 'round_lose' | 'round_draw' | null }>({ type: null });

  const logGameEvent = async (status: 'started' | 'finished') => {
    if (!user) return;
    try {
      const gameLogsRef = ref(db, 'game_logs');
      await push(gameLogsRef, {
        uid: user.uid || user.raheeKey,
        userName: user.name,
        mode: room.mode,
        timestamp: serverTimestamp(),
        roomId: room.id,
        status
      });
    } catch (err) {
      console.error("Failed to log game event:", err);
    }
  };
  const [selectedStat, setSelectedStat] = useState<keyof CardData['stats'] | null>(null);
  const [showDeckView, setShowDeckView] = useState(false);
  const [deckViewMode, setDeckViewMode] = useState<'grid' | 'preview'>('grid');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [animatingCard, setAnimatingCard] = useState<{ id: string, from: 'me' | 'opponent', to: 'me' | 'opponent' } | null>(null);

  // Robust player identification
  const myUid = user.uid || user.raheeKey;
  const me = room.players?.find(p => p.uid === myUid);
  
  // For multiplayer, opponents are everyone else
  const opponents = room.players?.filter(p => p.uid !== myUid) || [];
  // For 1v1 logic, we still use 'opponent' as the first one found
  const opponent = opponents[0];
  
  const isHost = room.hostUid === myUid;

  // Use the found player (either by UID or name fallback)
  const activeMe = me || room.players?.find(p => p.name === user.name);

  // Sync isAiMode and aiLevel to DB
  useEffect(() => {
    if (room.id.startsWith('solo_') || !activeMe) return;
    
    const updateAiMode = async () => {
      try {
        const updatedPlayers = (room.players || []).map(p => {
          if (p.uid === activeMe.uid) return { ...p, isAiMode, aiLevel };
          return p;
        });
        await update(ref(db, `rooms/${room.id}`), { players: updatedPlayers });
      } catch (err) {
        console.error("Failed to sync AI Mode state:", err);
      }
    };
    
    updateAiMode();
  }, [isAiMode, aiLevel, room.id, activeMe?.uid]);

  const isMyTurn = activeMe ? (room.currentTurn === activeMe.uid || (room.id.startsWith('solo_') && room.currentTurn === 'human')) : false;

  const getCard = (id: string | undefined) => {
    if (!id) return undefined;
    return cards.find(c => c.id === id) || CARDS.find(c => c.id === id);
  };

  useEffect(() => {
    if (room.id.startsWith('solo_')) return;

    const roomRef = ref(db, `rooms/${room.id}`);
    const unsubscribe = onValue(roomRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val() as GameRoom;
        setRoom({ ...data, id: snap.key! });
        
        // Sync comparison state from Realtime DB
        if (data.comparison) {
          const initiatorUid = data.comparison.playerUid;
          const stat = data.comparison.stat;
          setSelectedStat(stat);
          setIsComparing(true);

          if (activeMe && initiatorUid !== activeMe.uid) {
            // Determine result for the non-initiator
            const myCardId = activeMe.deck ? activeMe.deck[0] : null;
            const initiator = data.players ? data.players.find(p => p.uid === initiatorUid) : null;
            const initiatorCardId = initiator?.deck ? initiator.deck[0] : null;
            
            const myCard = myCardId ? getCard(myCardId) : null;
            const initiatorCard = initiatorCardId ? getCard(initiatorCardId) : null;
            
            if (myCard && initiatorCard) {
              let roundResult: 'win' | 'lose' | 'draw' = 'draw';
              if (myCard.stats[stat] > initiatorCard.stats[stat]) roundResult = 'win';
              else if (myCard.stats[stat] < initiatorCard.stats[stat]) roundResult = 'lose';
              
              setResult(roundResult);
              setShowResult(true);
            }
          }
        } else {
          // No comparison active in DB
          setIsComparing(false);
          setShowResult(false);
          setResult(null);
          setSelectedStat(null);
        }
      }
    }, (err: any) => {
      console.error("Room listener error:", err);
      handleDatabaseError(err, OperationType.GET, `rooms/${room.id}`);
    });
    return () => off(roomRef, 'value', unsubscribe);
  }, [room.id, activeMe?.uid]);

  // Safety check for player limit - MOVED AFTER HOOKS
  if ((room.players?.length || 0) > 32 && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Room Full</h2>
          <p className="text-zinc-500 mb-6">This room has reached the maximum capacity of 32 players.</p>
          <button onClick={onExit} className="bg-white text-black px-6 py-2 rounded-lg font-bold">
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (!activeMe) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Player Not Found</h2>
          <p className="text-zinc-500 mb-6">We couldn't find your profile in this room. Please try re-joining.</p>
          <div className="flex flex-col gap-3">
            <button onClick={onExit} className="bg-white text-black px-6 py-2 rounded-lg font-bold">
              Back to Menu
            </button>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
              UID: {myUid} | Name: {user.name}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Auto-start for 1v1 mode
  useEffect(() => {
    if (room.mode === '1v1' && room.status === 'waiting' && room.players.length === 2 && isHost) {
      const timer = setTimeout(() => {
        startGame();
      }, 1500); // Small delay for UX
      return () => clearTimeout(timer);
    }
  }, [room.players.length, room.status, room.mode, isHost]);

  // AI Mode Logic: Automatically select winning stat and card
  const runAiModeLogic = async () => {
    if (!isAiMode || !isMyTurn || isComparing || !opponent || !activeMe || !activeMe.deck) return;

    const opponentCardId = opponent.deck[0];
    const opponentCard = getCard(opponentCardId);
    if (!opponentCard) return;

    const myDeck = [...activeMe.deck];
    let bestCardIdx = -1;
    let bestStat: keyof CardData['stats'] | null = null;

    if (aiLevel === 'max') {
      // Search for a winning combination (any card in deck + any stat)
      for (let i = 0; i < myDeck.length; i++) {
        const myCard = getCard(myDeck[i]);
        if (!myCard) continue;

        for (const stat of STAT_KEYS) {
          if (stat === 'no') continue;
          if (myCard.stats[stat] > opponentCard.stats[stat]) {
            bestCardIdx = i;
            bestStat = stat;
            break;
          }
        }
        if (bestStat) break;
      }
    } else if (aiLevel === 'normal') {
      // Pick a random stat from the top card
      bestCardIdx = 0;
      const stats = STAT_KEYS.filter(s => s !== 'no');
      bestStat = stats[Math.floor(Math.random() * stats.length)];
    } else if (aiLevel === 'lose') {
      // If deck is low, pick a losing stat. Otherwise win some.
      if (myDeck.length <= 3) {
        const myCard = getCard(myDeck[0]);
        if (myCard) {
          bestCardIdx = 0;
          // Find a stat that loses
          const stats = STAT_KEYS.filter(s => s !== 'no');
          bestStat = stats.find(s => myCard.stats[s] < opponentCard.stats[s]) || stats[0];
        }
      } else {
        // Randomly win or lose
        bestCardIdx = 0;
        const stats = STAT_KEYS.filter(s => s !== 'no');
        bestStat = stats[Math.floor(Math.random() * stats.length)];
      }
    }

    // If no winning combination found in max mode, pick highest stat
    if (!bestStat && aiLevel === 'max') {
      const currentCard = getCard(myDeck[0]);
      if (currentCard) {
        bestCardIdx = 0;
        const stats = STAT_KEYS.filter(s => s !== 'no');
        bestStat = stats.reduce((prev, curr) => currentCard.stats[curr] > currentCard.stats[prev] ? curr : prev);
      }
    }

    if (bestStat && bestCardIdx !== -1) {
      // If the best card is not at the top, move it
      if (bestCardIdx !== 0) {
        const [winningCard] = myDeck.splice(bestCardIdx, 1);
        myDeck.unshift(winningCard);
        
        const updatedPlayers = (room.players || []).map(p => {
          if (p.uid === activeMe.uid) return { ...p, deck: myDeck };
          return p;
        });

        if (room.id.startsWith('solo_')) {
          setRoom(prev => ({ ...prev, players: updatedPlayers }));
        } else {
          try {
            await update(ref(db, `rooms/${room.id}`), { players: updatedPlayers });
          } catch (err) {
            console.error("AI Mode failed to reorder deck:", err);
          }
        }
      }
      
      // Trigger selection with a small delay for visual feedback
      setTimeout(() => {
        handleStatSelect(bestStat!);
      }, 800);
    }
  };

  useEffect(() => {
    if (isAiMode && isMyTurn && !isComparing && room.status === 'playing') {
      const timer = setTimeout(() => {
        runAiModeLogic();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAiMode, isMyTurn, isComparing, room.status, activeMe?.deck?.[0]]);

  const startGame = async () => {
    if ((!isHost && !isAdmin) || (room.players?.length || 0) < 2) return;
    
    try {
      await runTransaction(ref(db, `rooms/${room.id}`), (currentRoomData) => {
        if (currentRoomData) {
          const currentPlayers = currentRoomData.players;
          if (!currentPlayers || currentPlayers.length < 2) return currentRoomData;

          const deckSource = (cards?.length || 0) > 0 ? cards : CARDS;
          const allCardIds = [...deckSource].map(c => c.id).sort(() => Math.random() - 0.5);
          
          const numPlayers = currentPlayers.length;
          const cardsPerPlayer = Math.floor(allCardIds.length / numPlayers);
          
          const updatedPlayers = currentPlayers.map((player: any, index: number) => {
            const start = index * cardsPerPlayer;
            const end = index === numPlayers - 1 ? allCardIds.length : (index + 1) * cardsPerPlayer;
            return {
              ...player,
              deck: allCardIds.slice(start, end),
              ready: true
            };
          });

          currentRoomData.players = updatedPlayers;
          currentRoomData.status = 'playing';
          currentRoomData.currentTurn = updatedPlayers[0].uid;
          currentRoomData.comparison = null;
          currentRoomData.lastAction = {
            type: 'start_game',
            playerUid: myUid,
            timestamp: { ".sv": "timestamp" } // Realtime DB server timestamp in transaction
          };
        }
        return currentRoomData;
      });
      logGameEvent('started');
    } catch (err) {
      console.error("Failed to start game:", err);
      handleDatabaseError(err, OperationType.UPDATE, `rooms/${room.id}`);
    }
  };

  const handleStatSelect = async (stat: keyof CardData['stats']) => {
    if (!isMyTurn || isComparing) return;

    // AI Mode: If enabled and in Max Mode, pick the best card from Rahee's deck before comparing
    if (isAdmin && isAiMode && aiLevel === 'max') {
      optimizeRaheeDeckForStat(stat);
    }

    setIsComparing(true);
    setSelectedStat(stat);
    
    const myCardId = activeMe?.deck?.[0];
    const myCard = myCardId ? getCard(myCardId) : null;
    if (!myCard || !activeMe) return;

    let myValue = myCard.stats[stat];
    
    // Track deck changes for AI Mode players
    let currentPlayers = [...(room.players || [])];
    
    // Compare against ALL opponents
    let roundResult: 'win' | 'lose' | 'draw' = 'win';
    let highestValue = myValue;
    let winnerUid = activeMe.uid;
    let isDraw = false;

    for (const opp of opponents) {
      const oppCardId = opp.deck?.[0];
      let oppCard = oppCardId ? getCard(oppCardId) : null;
      if (!oppCard) continue;

      let oppValue = oppCard.stats[stat];

      // AI Mode Logic: If opponent has AI Mode on, they MUST win if possible (Max Mode)
      if (opp.isAiMode && opp.aiLevel === 'max') {
        // Find FIRST card in order that beats myCard
        const winningCardId = opp.deck.find(id => {
          const c = getCard(id);
          return c && c.stats[stat] > myValue;
        });

        if (winningCardId) {
          oppCard = getCard(winningCardId);
          oppValue = oppCard!.stats[stat];
          
          // Update their deck in our local tracking
          currentPlayers = currentPlayers.map(p => {
            if (p.uid === opp.uid) {
              const newDeck = [...p.deck];
              const idx = newDeck.indexOf(winningCardId);
              newDeck.splice(idx, 1);
              newDeck.unshift(winningCardId);
              return { ...p, deck: newDeck };
            }
            return p;
          });
        } else {
          // Rahee always wins: If no winning card found, cheat and boost top card
          oppValue = myValue + 1;
        }
      } else if (isAiMode && aiLevel === 'max') {
        // I am the initiator and I have AI Mode on (Max): I MUST win
        if (oppValue >= myValue) {
          myValue = oppValue + 1;
          highestValue = myValue;
        }
      }

      if (oppValue > highestValue) {
        highestValue = oppValue;
        winnerUid = opp.uid;
        roundResult = 'lose';
        isDraw = false;
      } else if (oppValue === highestValue) {
        isDraw = true;
      }
    }

    // If I have AI Mode on (Max), I should be the winner regardless of initial values
    if (isAiMode && aiLevel === 'max' && roundResult !== 'win') {
      roundResult = 'win';
      winnerUid = activeMe.uid;
      isDraw = false;
    }

    // If there's a tie for the highest value, it's a draw regardless of who tied
    if (isDraw) {
      roundResult = 'draw';
      winnerUid = '';
    }

    setResult(roundResult);
    setShowResult(true);

    // Update room immediately to sync comparison state AND any deck changes from AI Mode
    if (!room.id.startsWith('solo_')) {
      try {
        await update(ref(db, `rooms/${room.id}`), {
          players: currentPlayers,
          comparison: {
            stat,
            playerUid: activeMe?.uid,
            startTime: new Date().toISOString()
          }
        });
      } catch (err) {
        console.error("Failed to sync comparison:", err);
        handleDatabaseError(err, OperationType.UPDATE, `rooms/${room.id}`);
      }
    }

    // Delay for animation
    setTimeout(async () => {
      setSelectedStat(null);
      
      // Use the potentially modified players from AI Mode logic
      const updatedPlayers = [...currentPlayers];
      const cardsInPlay: string[] = [];
      
      // Collect top cards from everyone
      updatedPlayers.forEach(p => {
        if ((p.deck?.length || 0) > 0) {
          cardsInPlay.push(p.deck.shift()!);
        }
      });

      if (roundResult === 'win') {
        // I win all cards
        const meIdx = updatedPlayers.findIndex(p => p.uid === activeMe?.uid);
        if (meIdx !== -1) {
          if (!updatedPlayers[meIdx].deck) updatedPlayers[meIdx].deck = [];
          updatedPlayers[meIdx].deck.push(...cardsInPlay);
        }
        // Animation for the first opponent's card (just for visual feedback)
        if (opponents.length > 0) {
          const firstOppWithCard = opponents.find(o => (o.deck?.length || 0) > 0);
          if (firstOppWithCard) {
            setAnimatingCard({ id: firstOppWithCard.deck[0], from: 'opponent', to: 'me' });
          }
        }
      } else if (roundResult === 'lose' && winnerUid) {
        // Someone else wins all cards
        const winnerIdx = updatedPlayers.findIndex(p => p.uid === winnerUid);
        if (winnerIdx !== -1) {
          if (!updatedPlayers[winnerIdx].deck) updatedPlayers[winnerIdx].deck = [];
          updatedPlayers[winnerIdx].deck.push(...cardsInPlay);
        }
        setAnimatingCard({ id: cardsInPlay[0], from: 'me', to: 'opponent' });
      } else {
        // Draw: everyone gets their card back at the bottom
        // We need to give cards back to the players who were in the round
        let cardIdx = 0;
        updatedPlayers.forEach((p, i) => {
          // Only players who had cards in the round get one back
          // We know who had cards because they were shifted from updatedPlayers
          // Wait, updatedPlayers was already shifted.
          // Let's use the original room.players to know who contributed
          if ((room.players?.[i]?.deck?.length || 0) > 0) {
            const card = cardsInPlay[cardIdx++];
            if (card) {
              if (!p.deck) p.deck = [];
              p.deck.push(card);
            }
          }
        });
      }

      setTimeout(() => setAnimatingCard(null), 1000);

      const nextTurn = roundResult === 'win' ? activeMe?.uid : (roundResult === 'lose' ? winnerUid : room.currentTurn);
      
      // Ensure nextTurn is someone who still has cards
      let finalNextTurn = nextTurn;
      const nextPlayer = updatedPlayers.find(p => p.uid === nextTurn);
      if (!nextPlayer || (nextPlayer.deck?.length || 0) === 0) {
        // If the winner is out (shouldn't happen if they won) or it's a draw and current is out
        const someoneWithCards = updatedPlayers.find(p => (p.deck?.length || 0) > 0);
        finalNextTurn = someoneWithCards?.uid || nextTurn;
      }

      let gameStatus = room.status;
      let finalWinner = room.winner || '';

      // Check if anyone has all cards
      const totalCards = (cards?.length || 0) > 0 ? cards.length : CARDS.length;
      const actualWinner = updatedPlayers.find(p => (p.deck?.length || 0) === totalCards);
      
      if (actualWinner) {
        gameStatus = 'finished';
        finalWinner = actualWinner.uid;
        if (activeMe && actualWinner.uid === activeMe.uid) {
          updateStats(true);
          logGameEvent('finished');
        } else {
          updateStats(false);
          logGameEvent('finished');
        }
      } else {
        // Check if I'm out
        const meNow = updatedPlayers.find(p => p.uid === activeMe?.uid);
        if (meNow && (meNow.deck?.length || 0) === 0) {
          // I lost, but game might continue for others
          // For now, let's just finish if anyone is out to keep it simple or handle elimination
        }
      }

      const updateData: any = {
        players: updatedPlayers,
        currentTurn: finalNextTurn,
        status: gameStatus,
        winner: finalWinner,
        comparison: null,
        lastAction: {
          playerUid: activeMe?.uid,
          stat,
          value: myValue,
          result: roundResult
        }
      };

      if (room.id.startsWith('solo_')) {
        setRoom(prev => ({ ...prev, ...updateData }));
        if (nextTurn === 'ai_bot' && gameStatus === 'playing') {
          setTimeout(() => handleAiTurn(updatedPlayers), 2000);
        }
      } else {
        try {
          await update(ref(db, `rooms/${room.id}`), updateData);
        } catch (err) {
          console.error("Failed to update game state:", err);
          handleDatabaseError(err, OperationType.UPDATE, `rooms/${room.id}`);
        }
      }

      setIsComparing(false);
      setShowResult(false);
    }, 3000);
  };

  const handleAiTurn = (players: any[]) => {
    const ai = players.find(p => p.uid === 'ai_bot');
    const human = players.find(p => p.uid !== 'ai_bot');
    
    if (!ai || !human || !(ai.deck?.length > 0) || !(human.deck?.length > 0)) return;

    const aiCardId = ai.deck[0];
    const aiCard = getCard(aiCardId);
    const humanCard = getCard(human.deck[0]);
    
    if (!aiCard || !humanCard) return;

    // Simple AI: pick highest stat (excluding 'no')
    const stats = (Object.keys(aiCard.stats) as Array<keyof CardData['stats']>).filter(s => s !== 'no');
    const bestStat = stats.reduce((prev, curr) => aiCard.stats[curr] > aiCard.stats[prev] ? curr : prev);
    
    // Simulate AI selection
    setIsComparing(true);
    setSelectedStat(bestStat);
    const aiValue = aiCard.stats[bestStat];
    const humanValue = humanCard.stats[bestStat];

    let roundResult: 'win' | 'lose' | 'draw' = 'draw';
    if (aiValue > humanValue) roundResult = 'win'; // AI wins round
    else if (aiValue < humanValue) roundResult = 'lose'; // AI loses round

    setResult(roundResult === 'win' ? 'lose' : (roundResult === 'lose' ? 'win' : 'draw'));
    setShowResult(true);

    setTimeout(() => {
      setSelectedStat(null);
      const newAiDeck = [...(ai.deck || [])];
      const newHumanDeck = [...(human.deck || [])];

      if (roundResult === 'win') {
        const wonCard = newHumanDeck.shift()!;
        newAiDeck.push(newAiDeck.shift()!);
        newAiDeck.push(wonCard);
      } else if (roundResult === 'lose') {
        const lostCard = newAiDeck.shift()!;
        newHumanDeck.push(newHumanDeck.shift()!);
        newHumanDeck.push(lostCard);
      } else {
        newAiDeck.push(newAiDeck.shift()!);
        newHumanDeck.push(newHumanDeck.shift()!);
      }

      const nextTurn = roundResult === 'win' ? 'ai_bot' : (roundResult === 'lose' ? human.uid : 'ai_bot');
      
      let gameStatus = 'playing';
      let winner = '';

      if (newHumanDeck.length === 0) {
        gameStatus = 'finished';
        winner = 'ai_bot';
        updateStats(false);
      } else if (newAiDeck.length === 0) {
        gameStatus = 'finished';
        winner = human.uid;
        updateStats(true);
      }

      const updatedPlayers = [
        { ...human, deck: newHumanDeck },
        { ...ai, deck: newAiDeck }
      ];

      setRoom(prev => ({
        ...prev,
        players: updatedPlayers,
        currentTurn: nextTurn,
        status: gameStatus as any,
        winner,
        lastAction: {
          playerUid: 'ai_bot',
          stat: bestStat,
          value: aiValue,
          result: roundResult
        }
      }));

      setIsComparing(false);
      setShowResult(false);

      if (nextTurn === 'ai_bot' && gameStatus === 'playing') {
        setTimeout(() => handleAiTurn(updatedPlayers), 2000);
      }
    }, 3000);
  };

  const updateStats = async (won: boolean) => {
    const targetUid = user.uid || user.raheeKey;
    try {
      await runTransaction(ref(db, `users/${targetUid}`), (userData) => {
        if (userData) {
          if (won) {
            userData.wins = (userData.wins || 0) + 1;
          } else {
            userData.losses = (userData.losses || 0) + 1;
          }
        }
        return userData;
      });
      // Update local storage too
      const profile = JSON.parse(localStorage.getItem('rahee_profile') || '{}');
      profile.wins = (profile.wins || 0) + (won ? 1 : 0);
      profile.losses = (profile.losses || 0) + (won ? 0 : 1);
      localStorage.setItem('rahee_profile', JSON.stringify(profile));
    } catch (err) {
      console.error('Failed to update stats', err);
      handleDatabaseError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const optimizeRaheeDeckForStat = async (stat: keyof CardData['stats']) => {
    if (!isAdmin || !opponent || !activeMe) return;
    
    const opponentCardId = opponent.deck?.[0];
    const opponentCard = opponentCardId ? getCard(opponentCardId) : null;
    if (!opponentCard) return;

    const myDeck = [...(activeMe.deck || [])];
    // Find a card that beats the opponent's stat
    const winningCardIndex = myDeck.findIndex(id => {
      const c = getCard(id);
      return c && c.stats[stat] > opponentCard.stats[stat];
    });
    
    if (winningCardIndex !== -1) {
      const [bestCard] = myDeck.splice(winningCardIndex, 1);
      myDeck.unshift(bestCard);
      
      const updatedPlayers = (room.players || []).map(p => {
        if (p.uid === activeMe.uid) return { ...p, deck: myDeck };
        return p;
      });

      if (room.id.startsWith('solo_')) {
        setRoom(prev => ({ ...prev, players: updatedPlayers }));
      } else {
        try {
          await update(ref(db, `rooms/${room.id}`), { players: updatedPlayers });
        } catch (err) {
          console.error("Failed to optimize deck:", err);
          handleDatabaseError(err, OperationType.UPDATE, `rooms/${room.id}`);
        }
      }
    }
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!isAdmin || isComparing || !activeMe) return;

    const newDeck = [...(activeMe.deck || [])];
    if (newDeck.length === 0) return;

    if (direction === 'right') {
      newDeck.push(newDeck.shift()!);
    } else {
      newDeck.unshift(newDeck.pop()!);
    }

    const updatedPlayers = (room.players || []).map(p => {
      if (p.uid === activeMe.uid) return { ...p, deck: newDeck };
      return p;
    });

    if (room.id.startsWith('solo_')) {
      setRoom(prev => ({ ...prev, players: updatedPlayers }));
    } else {
      try {
          await update(ref(db, `rooms/${room.id}`), { players: updatedPlayers });
      } catch (err) {
        console.error("Failed to swipe card:", err);
        handleDatabaseError(err, OperationType.UPDATE, `rooms/${room.id}`);
      }
    }
  };

  const reorderOpponentDeck = async (fromIndex: number, toIndex: number) => {
    if (!isAdmin || !opponent || room.id.startsWith('solo_')) return;
    
    const newDeck = [...(opponent.deck || [])];
    if (newDeck.length === 0) return;
    
    const [moved] = newDeck.splice(fromIndex, 1);
    newDeck.splice(toIndex, 0, moved);

    const updatedPlayers = (room.players || []).map(p => {
      if (p.uid === opponent.uid) return { ...p, deck: newDeck };
      return p;
    });

    try {
      await update(ref(db, `rooms/${room.id}`), {
        players: updatedPlayers
      });
    } catch (err) {
      console.error("Failed to reorder deck:", err);
      handleDatabaseError(err, OperationType.UPDATE, `rooms/${room.id}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="min-h-screen flex flex-col bg-black overflow-hidden relative"
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-zinc-900/50 border-b border-white/5 z-10">
        <button onClick={onExit} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Turn</p>
            <p className={`text-sm font-bold ${isMyTurn ? 'text-rahee' : 'text-zinc-400'}`}>
              {isMyTurn ? 'Your Turn' : `${opponent?.name || 'Opponent'}'s Turn`}
            </p>
          </div>
          <div className="w-10 h-10 bg-rahee rounded-lg flex items-center justify-center text-white font-bold">
            {isMyTurn ? '!' : '?'}
          </div>
        </div>
      </div>

      {/* Game Board */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="min-h-full flex flex-col lg:flex-row items-center justify-center p-6 gap-8 lg:gap-16 relative max-w-7xl mx-auto w-full"
        >
          {/* My Area */}
          <motion.div 
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4, type: "spring", damping: 20 }}
            className="w-full max-w-[320px] md:max-w-[360px] flex flex-col items-center gap-4 shrink-0"
          >
            <div className="flex items-center justify-between w-full px-1">
              <div className="flex items-center gap-2 text-rahee">
                <UserIcon className="w-4 h-4" />
                <span className="text-sm font-bold truncate max-w-[150px]">{activeMe?.name} (You)</span>
                <span className="text-xs bg-rahee/10 px-2 py-0.5 rounded-full">{(activeMe?.deck?.length || 0)} Cards</span>
              </div>
              <button 
                onClick={() => setShowDeckView(true)}
                className="p-1.5 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-1.5 text-zinc-500 hover:text-rahee"
                title="View Deck"
              >
                <Layers className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Deck</span>
              </button>
            </div>
            <div className="relative w-full">
              {/* Decorative stack layers to simulate a deck */}
              {(activeMe?.deck?.length || 0) > 1 && (
                <div className="absolute inset-0 translate-y-1 translate-x-1 bg-zinc-800 rounded-2xl border border-white/5 opacity-50" style={{ zIndex: 1 }} />
              )}
              {(activeMe?.deck?.length || 0) > 2 && (
                <div className="absolute inset-0 translate-y-2 translate-x-2 bg-zinc-900 rounded-2xl border border-white/5 opacity-30" style={{ zIndex: 0 }} />
              )}
              
              {(activeMe?.deck?.length || 0) > 0 && (
                <div className="relative z-10">
                  <Card 
                    card={getCard(activeMe.deck[0]) as any} 
                    isTop={true}
                    disabled={!isMyTurn || isComparing}
                    isSelected={selectedStat !== null}
                    highlightedStat={selectedStat}
                    isAdmin={isAdmin}
                    onStatSelect={handleStatSelect}
                    onNotchClick={isAdmin ? () => setIsAdminVisionEnabled(!isAdminVisionEnabled) : undefined}
                    onNotchLongPress={isAdmin ? () => setShowAdminMenu(true) : undefined}
                    onSwipe={isAdmin ? handleSwipe : undefined}
                  />
                </div>
              )}
              
              {(activeMe?.deck?.length || 0) === 0 && (
                <div className="w-full aspect-[5.7/8.9] bg-zinc-900/50 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center">
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">No Cards Left</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* VS Divider for Desktop */}
          <div className="hidden lg:flex flex-col items-center gap-4">
            <div className="h-20 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-zinc-900/50">
              <span className="text-zinc-500 font-black italic text-xl">VS</span>
            </div>
            <div className="h-20 w-px bg-gradient-to-b from-white/20 via-white/20 to-transparent" />
          </div>

          {/* Opponents Area */}
          <motion.div 
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6, type: "spring", damping: 20 }}
            className="w-full max-w-7xl flex flex-col items-center gap-6"
          >
            <div className={`grid gap-6 w-full ${
              opponents.length === 1 
                ? 'max-w-[320px] md:max-w-[360px] grid-cols-1' 
                : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
            }`}>
              {opponents.map((opp, idx) => (
                <div key={opp.uid} className="w-full flex flex-col items-center gap-4 bg-zinc-900/30 p-4 rounded-3xl border border-white/5">
                  <div className="flex items-center justify-between w-full px-1">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <UserIcon className="w-4 h-4" />
                      <span className="text-sm font-bold truncate max-w-[120px]">{opp.name}</span>
                      <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full">{(opp.deck?.length || 0)}</span>
                      {room.currentTurn === opp.uid && <div className="w-2 h-2 rounded-full bg-rahee animate-pulse" />}
                    </div>
                  </div>
                  <div className="relative w-full aspect-[5.7/8.9] flex items-center justify-center">
                    <AnimatePresence mode="wait">
                      {(isAdmin || isComparing) ? (
                        <motion.div 
                          key={`opponent-${opp.uid}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="absolute inset-0"
                        >
                          {/* Decorative stack layers for opponent */}
                          {(opp.deck?.length || 0) > 1 && (
                            <div className="absolute inset-0 translate-y-1 translate-x-1 bg-zinc-800 rounded-2xl border border-white/5 opacity-50" style={{ zIndex: 1 }} />
                          )}
                          
                          {(opp.deck?.length || 0) > 0 && (
                            <div className="relative z-10 h-full">
                              <Card 
                                card={getCard(opp.deck[0]) as any} 
                                isOpponent 
                                isRevealed={(isAdmin && isAdminVisionEnabled) || isComparing} 
                                isTop={true}
                                isSelected={selectedStat !== null}
                                highlightedStat={selectedStat}
                                isAdmin={isAdmin}
                              />
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <div className="w-full h-full bg-zinc-900/50 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center p-4 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                              <Loader2 className="w-8 h-8 text-zinc-700 animate-spin" />
                            </div>
                            <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                              Waiting for Reveal
                            </p>
                          </div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
            
            {opponents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <Users className="w-12 h-12 text-zinc-800 mb-4" />
                <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">Waiting for Opponents...</p>
              </div>
            )}
          </motion.div>

          {/* Center Info Overlay */}
          <AnimatePresence>
            {(showResult || testMode.type === 'round_win' || testMode.type === 'round_lose') && (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
              >
                <div className={`px-12 py-6 rounded-full text-4xl font-black uppercase tracking-tighter shadow-2xl backdrop-blur-md border-4
                  ${(result === 'win' || testMode.type === 'round_win') ? 'bg-rahee/20 border-rahee text-rahee' : 
                    (result === 'lose' || testMode.type === 'round_lose') ? 'bg-red-500/20 border-red-500 text-red-400' : 
                    'bg-zinc-500/20 border-zinc-500 text-zinc-400'}
                `}>
                  {(result === 'win' || testMode.type === 'round_win') ? 'Round Win!' : (result === 'lose' || testMode.type === 'round_lose') ? 'Round Lose' : 'Draw'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Animating Card Overlay */}
          <AnimatePresence>
            {animatingCard && (
              <motion.div
                initial={{ 
                  x: animatingCard.from === 'me' ? -200 : 200, 
                  y: 0, 
                  scale: 0.5, 
                  opacity: 0,
                  rotate: 0
                }}
                animate={{ 
                  x: animatingCard.to === 'me' ? -200 : 200, 
                  y: 400, 
                  scale: 0.3, 
                  opacity: 1,
                  rotate: 15
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none"
              >
                <div className="w-64">
                  <Card card={getCard(animatingCard.id) as any} isRevealed={true} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Game Over Modal */}
      <AnimatePresence>
        {(room.status === 'finished' || testMode.type === 'victory' || testMode.type === 'defeat') && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 p-12 rounded-[3rem] text-center shadow-2xl"
            >
              <div className={`w-24 h-24 mx-auto rounded-3xl flex items-center justify-center mb-8
                ${(activeMe && room.winner === activeMe.uid) || testMode.type === 'victory' ? 'bg-rahee text-white' : 'bg-red-500/20 text-red-500'}
              `}>
                <Trophy className="w-12 h-12" />
              </div>
              <h2 className="text-4xl font-black mb-4 uppercase tracking-tight">
                {(activeMe && room.winner === activeMe.uid) || testMode.type === 'victory' ? 'Victory!' : 'Defeat'}
              </h2>
              <p className="text-zinc-500 mb-12">
                {(activeMe && room.winner === activeMe.uid) || testMode.type === 'victory' 
                  ? 'You have conquered the Rahee realm!' 
                  : 'Better luck next time, warrior.'}
              </p>
              <button 
                onClick={() => {
                  if (testMode.type) {
                    setTestMode({ type: null });
                  } else {
                    onExit();
                  }
                }}
                className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-zinc-200 transition-colors"
              >
                {testMode.type ? 'Close Preview' : 'Back to Menu'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Menu Modal */}
      <AnimatePresence>
        {showAdminMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xs bg-zinc-900 border border-rahee/30 rounded-[2.5rem] p-8 shadow-[0_0_50px_rgba(255,99,33,0.2)]"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-rahee/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-8 h-8 text-rahee" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Rahee Admin</h2>
                <p className="text-zinc-500 text-xs uppercase font-bold tracking-widest mt-1">Control Panel</p>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => setIsAdminVisionEnabled(!isAdminVisionEnabled)}
                  className={`w-full py-4 px-6 rounded-2xl font-black uppercase tracking-tighter flex items-center justify-between transition-all
                    ${isAdminVisionEnabled ? 'bg-rahee text-white' : 'bg-white/5 text-zinc-400'}
                  `}
                >
                  <span>Admin Vision</span>
                  <div className={`w-2 h-2 rounded-full ${isAdminVisionEnabled ? 'bg-white animate-pulse' : 'bg-zinc-600'}`} />
                </button>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">AI Mode</p>
                  <button 
                    onClick={() => setIsAiMode(!isAiMode)}
                    className={`w-full py-4 px-6 rounded-2xl font-black uppercase tracking-tighter flex items-center justify-between transition-all
                      ${isAiMode ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-zinc-400'}
                    `}
                  >
                    <span>{isAiMode ? 'AI Active' : 'AI Inactive'}</span>
                    <div className={`w-2 h-2 rounded-full ${isAiMode ? 'bg-white animate-pulse' : 'bg-zinc-600'}`} />
                  </button>
                  
                  {isAiMode && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {(['lose', 'normal', 'max'] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => setAiLevel(level)}
                          className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border
                            ${aiLevel === level 
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                              : 'bg-white/5 border-transparent text-zinc-500 hover:text-zinc-300'}
                          `}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Quick Tips</p>
                  <ul className="text-[10px] text-zinc-400 space-y-1 font-medium">
                    <li>• Swipe card left/right to change</li>
                    <li>• AI Mode automatically plays for Rahee</li>
                    <li>• Click notch to toggle vision quickly</li>
                  </ul>
                </div>

                <button 
                  onClick={() => setShowAdminMenu(false)}
                  className="w-full py-4 text-zinc-500 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors"
                >
                  Close Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deck View Modal */}
      <AnimatePresence>
        {showDeckView && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[70] flex flex-col p-4 md:p-8"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 max-w-6xl mx-auto w-full">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rahee/10 rounded-2xl flex items-center justify-center">
                  <Layers className="w-6 h-6 text-rahee" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter italic">Your Deck</h2>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{(activeMe?.deck?.length || 0)} Cards Remaining</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
                <button 
                  onClick={() => setDeckViewMode('grid')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${deckViewMode === 'grid' ? 'bg-rahee text-white shadow-lg shadow-rahee/20' : 'text-zinc-500 hover:text-white'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Grid
                </button>
                <button 
                  onClick={() => {
                    setDeckViewMode('preview');
                    setPreviewIndex(0);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${deckViewMode === 'preview' ? 'bg-rahee text-white shadow-lg shadow-rahee/20' : 'text-zinc-500 hover:text-white'}`}
                >
                  <Maximize2 className="w-4 h-4" />
                  Preview
                </button>
              </div>

              <button 
                onClick={() => setShowDeckView(false)}
                className="absolute top-4 right-4 md:static p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all active:scale-95"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col max-w-6xl mx-auto w-full">
              {deckViewMode === 'grid' ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-12">
                  <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:gap-8">
                    {(activeMe?.deck || []).map((cardId, index) => {
                      const card = getCard(cardId);
                      if (!card) return null;
                      return (
                        <motion.div 
                          key={`${cardId}-${index}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="relative group cursor-pointer"
                          onClick={() => {
                            setPreviewIndex(index);
                            setDeckViewMode('preview');
                          }}
                        >
                          <div className="absolute -top-3 -left-3 w-8 h-8 bg-rahee rounded-full flex items-center justify-center text-xs font-black z-10 shadow-xl border-2 border-black">
                            {index + 1}
                          </div>
                          <div className="transform transition-all group-hover:scale-[1.02] duration-300">
                            <Card card={card as any} isRevealed={true} />
                          </div>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-2xl pointer-events-none" />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 md:gap-8">
                  <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12 w-full max-w-4xl justify-center">
                    <div className="flex items-center gap-8 md:hidden order-2">
                      <button 
                        onClick={() => setPreviewIndex(prev => Math.max(0, prev - 1))}
                        disabled={previewIndex === 0}
                        className="p-4 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-full transition-all active:scale-90"
                      >
                        <ChevronLeft className="w-8 h-8 text-white" />
                      </button>
                      <button 
                        onClick={() => setPreviewIndex(prev => Math.min((activeMe?.deck?.length || 0) - 1, prev + 1))}
                        disabled={previewIndex === (activeMe?.deck?.length || 0) - 1}
                        className="p-4 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-full transition-all active:scale-90"
                      >
                        <ChevronRight className="w-8 h-8 text-white" />
                      </button>
                    </div>

                    <button 
                      onClick={() => setPreviewIndex(prev => Math.max(0, prev - 1))}
                      disabled={previewIndex === 0}
                      className="hidden md:block p-4 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-full transition-all active:scale-90"
                    >
                      <ChevronLeft className="w-8 h-8 text-white" />
                    </button>

                    <div className="w-full max-w-[280px] sm:max-w-[320px] md:max-w-[380px] relative order-1 md:order-none">
                      <AnimatePresence mode="wait">
                        {activeMe?.deck?.[previewIndex] && (
                          <motion.div
                            key={activeMe.deck[previewIndex]}
                            initial={{ opacity: 0, x: 50, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -50, scale: 0.9 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                            className="relative"
                          >
                            <div className="absolute -top-4 -left-4 w-12 h-12 bg-rahee rounded-2xl flex flex-col items-center justify-center z-20 shadow-2xl border-4 border-black">
                              <span className="text-[10px] font-bold uppercase text-white/50 leading-none">Pos</span>
                              <span className="text-xl font-black text-white leading-none">{previewIndex + 1}</span>
                            </div>
                            <Card card={getCard(activeMe.deck[previewIndex]) as any} isRevealed={true} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button 
                      onClick={() => setPreviewIndex(prev => Math.min((activeMe?.deck?.length || 0) - 1, prev + 1))}
                      disabled={previewIndex === (activeMe?.deck?.length || 0) - 1}
                      className="hidden md:block p-4 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-full transition-all active:scale-90"
                    >
                      <ChevronRight className="w-8 h-8 text-white" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto max-w-full px-4 py-4 custom-scrollbar order-3">
                    {(activeMe?.deck || []).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPreviewIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all shrink-0 ${previewIndex === idx ? 'bg-rahee w-6' : 'bg-white/20 hover:bg-white/40'}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lobby / Waiting for Opponent */}
      {room.status === 'waiting' && (
        <div className="fixed inset-0 bg-[#0a0a0a] z-40 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-[#151a21] border border-white/5 rounded-3xl p-8 shadow-2xl"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-rahee/10 rounded-2xl mb-4">
                {room.mode === '1v1' ? <UserIcon className="w-8 h-8 text-rahee" /> : <Users className="w-8 h-8 text-rahee" />}
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">
                {room.mode === '1v1' ? 'Dual Player Lobby' : 'Multiplayer Lobby'}
              </h3>
              <p className="text-zinc-500 text-sm">
                {room.mode === '1v1' 
                  ? (room.players.length === 2 ? 'Starting game automatically...' : 'Waiting for opponent...') 
                  : 'Waiting for players to join...'}
              </p>
            </div>

            {/* Removed Multiplayer Mode Active text */}


            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 mb-8 text-center">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
                {room.mode === '1v1' ? 'Matchmaking Active' : (isHost ? 'Room Key' : 'Waiting for Host')}
              </span>
              <div className="text-4xl font-mono font-black text-rahee tracking-[0.2em]">
                {room.mode === '1v1' ? '••••••' : (isHost ? room.roomKey : '••••••')}
              </div>
              {room.mode !== '1v1' && !isHost && (
                <p className="text-[10px] text-zinc-600 mt-2 italic">
                  Only the host can see the room key
                </p>
              )}
              {room.mode === '1v1' && (
                <p className="text-[10px] text-zinc-600 mt-2 italic">
                  Private matchmaking room
                </p>
              )}
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-widest px-2">
                <span>Players ({(room.players?.length || 0)})</span>
                <span>Status</span>
              </div>
              <div className="space-y-2">
                {(room.players || []).map((player, idx) => (
                  <div key={player.uid} className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-rahee/20 rounded-lg flex items-center justify-center text-rahee font-bold text-xs">
                        {idx + 1}
                      </div>
                      <span className="font-medium text-white">
                        {player.name} {player.uid === room.hostUid && <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded ml-1 uppercase">Host</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Ready
                    </div>
                  </div>
                ))}
                {(room.players?.length || 0) < 2 && (
                  <div className="flex items-center justify-center py-8 border-2 border-dashed border-white/5 rounded-xl text-zinc-600 text-sm italic">
                    Waiting for more players...
                  </div>
                )}
              </div>
            </div>

            { (isHost || isAdmin) ? (
              <div className="w-full space-y-3">
                <button 
                  onClick={startGame}
                  disabled={(room.players?.length || 0) < 2}
                  className="w-full bg-rahee disabled:bg-zinc-800 disabled:text-zinc-500 hover:bg-rahee/90 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-rahee/10 flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  {(room.players?.length || 0) < 2 ? 'Waiting for Players...' : (room.players?.length || 0) === 2 ? 'Start 1v1 Game' : `Start ${(room.players?.length || 0)} Player Game`}
                </button>
                {(room.players?.length || 0) >= 2 && (
                  <p className="text-[10px] text-zinc-500 text-center uppercase tracking-widest font-bold">
                    You can wait for more players or start now
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full p-6 bg-zinc-900/50 rounded-2xl border border-white/5 text-center">
                <div className="relative w-12 h-12 mx-auto mb-4">
                  <div className="absolute inset-0 bg-rahee/20 rounded-full animate-ping" />
                  <div className="relative bg-rahee/10 w-full h-full rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-rahee animate-spin" />
                  </div>
                </div>
                <h4 className="text-white font-bold mb-1">Waiting for Host</h4>
                <p className="text-xs text-zinc-500">The host will start the game once everyone is ready.</p>
              </div>
            )}

            <button 
              onClick={onExit}
              className="w-full mt-4 text-zinc-500 hover:text-white text-sm font-medium transition-colors"
            >
              Leave Room
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
