import React from 'react';
import { motion } from 'motion/react';
import { User, Users, Monitor, Star, LogOut, Play, X, Key } from 'lucide-react';
import { UserProfile, GameRoom } from '../types';

interface MainMenuProps {
  key?: string;
  user: UserProfile;
  onJoinRoom: (mode: 'solo' | '1v1' | 'multi') => void;
  onCreateRoom: () => void;
  onJoinWithKey: (key: string) => void;
  onLogout: () => void;
  onFeedback: () => void;
  isAdmin?: boolean;
  onAdminClick?: () => void;
  onDbManagerClick?: () => void;
  onTestingClick?: () => void;
  onCreateCustomRoom?: () => void;
  activeRoom?: GameRoom | null;
  onExitRoom?: () => void;
  onResumeRoom?: () => void;
  isQuotaExceeded?: boolean;
  activeRoomKeys?: string[];
}

export default function MainMenu({ 
  user, 
  onJoinRoom, 
  onCreateRoom, 
  onJoinWithKey, 
  onLogout, 
  onFeedback,
  isAdmin,
  onAdminClick,
  onDbManagerClick,
  onTestingClick,
  onCreateCustomRoom,
  activeRoom,
  onExitRoom,
  onResumeRoom,
  isQuotaExceeded,
  activeRoomKeys = []
}: MainMenuProps) {
  const [menuState, setMenuState] = React.useState<'initial' | 'multiplayer' | 'join' | 'admin'>('initial');
  const [joinKey, setJoinKey] = React.useState('');
  const [showResumePrompt, setShowResumePrompt] = React.useState<{ mode: 'solo' | '1v1' | 'multi', room: GameRoom } | null>(null);

  const handleModeClick = (mode: 'solo' | '1v1' | 'multi') => {
    if (activeRoom) {
      if (activeRoom.mode === mode) {
        setShowResumePrompt({ mode, room: activeRoom });
        return;
      }
    }

    if (mode === 'multi') {
      setMenuState('multiplayer');
    } else {
      onJoinRoom(mode);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-[#0f1419] flex flex-col relative font-sans"
    >
      {/* Top Right Header */}
      <div className="absolute top-8 right-10 flex items-center gap-4 text-zinc-400">
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest leading-none mb-1">Welcome</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white italic">{user.name}</span>
            {isAdmin && (
              <span className="text-[9px] bg-rahee/20 text-rahee px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">
                Admin
              </span>
            )}
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-zinc-400 hover:text-white"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Central Menu Card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-[440px] bg-[#151a21] border border-white/5 p-12 rounded-2xl shadow-2xl flex flex-col items-center"
        >
          <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">
            Main Menu
          </h2>
          
          <p className="text-zinc-500 text-sm mb-10">
            {menuState === 'initial' ? 'Choose your game mode' : menuState === 'multiplayer' ? 'Multiplayer Mode' : 'Join a Room'}
          </p>

          <div className="w-full space-y-0.5">
            {menuState === 'initial' && (
              <>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleModeClick('solo')}
                  className="w-full bg-rahee hover:bg-rahee/90 text-white font-semibold py-4 rounded-t-xl transition-all flex items-center justify-center gap-3"
                >
                  <Monitor className="w-5 h-5" />
                  Solo vs. AI
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleModeClick('1v1')}
                  disabled={isQuotaExceeded}
                  className={`w-full bg-rahee hover:bg-rahee/90 text-white font-semibold py-4 transition-all flex items-center justify-center gap-3 ${isQuotaExceeded ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <User className="w-5 h-5" />
                  Dual Player 1v1
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleModeClick('multi')}
                  disabled={isQuotaExceeded}
                  className={`w-full bg-rahee hover:bg-rahee/90 text-white font-semibold py-4 rounded-b-xl transition-all flex items-center justify-center gap-3 ${isQuotaExceeded ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Users className="w-5 h-5" />
                  Multiplayer
                </motion.button>
                {isAdmin && (
                  <button 
                    onClick={() => setMenuState('admin')}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 mt-4 shadow-lg shadow-amber-500/20"
                  >
                    <Star className="w-5 h-5 fill-current" />
                    Rahee Cards
                  </button>
                )}
              </>
            )}

            {menuState === 'admin' && (
              <div className="space-y-3">
                <button 
                  onClick={onAdminClick}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                  <Star className="w-5 h-5 fill-current" />
                  Cards Manager
                </button>

                <button 
                  onClick={onDbManagerClick}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                  <Monitor className="w-5 h-5" />
                  Database Manager
                </button>

                <button 
                  onClick={onTestingClick}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3"
                >
                  <Star className="w-5 h-5 fill-current" />
                  Testing Dashboard
                </button>

                <button 
                  onClick={onCreateCustomRoom}
                  className="w-full bg-rahee hover:bg-rahee/90 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-rahee/20"
                >
                  <Key className="w-5 h-5" />
                  Custom Room Key
                </button>

                <button 
                  onClick={() => setMenuState('initial')}
                  className="w-full text-zinc-500 hover:text-white text-sm font-medium py-2 transition-colors"
                >
                  Back to Main
                </button>
              </div>
            )}

            {menuState === 'multiplayer' && (
              <div className="flex flex-col gap-3">
                <button 
                  onClick={onCreateRoom}
                  className="w-full bg-rahee hover:bg-rahee/90 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-rahee/20"
                >
                  <Users className="w-5 h-5" />
                  Create Room
                </button>

                <button 
                  onClick={() => setMenuState('join')}
                  className="w-full bg-[#1d2126] hover:bg-[#252a30] text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 border border-white/5"
                >
                  <Users className="w-5 h-5" />
                  Join Room
                </button>

                <button 
                  onClick={() => setMenuState('initial')}
                  className="w-full text-zinc-500 hover:text-white text-sm font-medium py-2 transition-colors mt-2"
                >
                  Back to Main Menu
                </button>
              </div>
            )}

            {menuState === 'join' && (
              <div className="space-y-3">
                <div className="space-y-4">
                  <input 
                    type="text"
                    placeholder="Enter Room Key"
                    value={joinKey}
                    onChange={(e) => setJoinKey(e.target.value.toUpperCase())}
                    className="w-full bg-black/40 border border-white/10 rounded-lg py-4 px-4 text-center text-2xl font-mono tracking-widest focus:border-rahee outline-none transition-all"
                    maxLength={6}
                  />
                  <div className="flex gap-3">
                    <button 
                      onClick={() => { setMenuState('multiplayer'); setJoinKey(''); }}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => onJoinWithKey(joinKey)}
                      disabled={joinKey.length !== 6 && !activeRoomKeys.includes(joinKey)}
                      className="flex-[2] bg-rahee hover:bg-rahee/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transition-all"
                    >
                      Join Room
                    </button>
                  </div>
                </div>
              </div>
            )}

            {menuState === 'initial' && (
              <div className="pt-6">
                <button 
                  onClick={onFeedback}
                  className="w-full bg-[#1d2126] hover:bg-[#252a30] text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-3 border border-white/5"
                >
                  <Star className="w-5 h-5" />
                  Feedback
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Resume Prompt Modal */}
      {showResumePrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-[#151a21] border border-white/10 p-8 rounded-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-rahee animate-pulse" />
                <h3 className="text-xl font-bold text-white">Active Game Found</h3>
              </div>
              <button onClick={() => setShowResumePrompt(null)} className="text-zinc-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              You have an active game session in this mode. Would you like to resume your progress or start a new game?
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  onResumeRoom?.();
                  setShowResumePrompt(null);
                }}
                className="w-full bg-rahee hover:bg-rahee/90 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3"
              >
                <Play size={18} fill="currentColor" />
                Resume Game
              </button>
              <button 
                onClick={() => {
                  onExitRoom?.();
                  setShowResumePrompt(null);
                  if (showResumePrompt.mode === 'multi') {
                    setMenuState('multiplayer');
                  } else {
                    onJoinRoom(showResumePrompt.mode as any);
                  }
                }}
                className="w-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-bold py-4 rounded-xl transition-all"
              >
                Start New Game
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
