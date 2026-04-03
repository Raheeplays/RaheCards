import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Trophy, ShieldAlert, Star, Layout, Play, CheckCircle2, AlertCircle, Monitor } from 'lucide-react';
import Card from './Card';
import { CARDS } from '../constants';

interface TestingManagerProps {
  onBack: () => void;
}

type TestState = 'victory' | 'defeat' | 'round_win' | 'round_lose' | 'round_draw' | 'splash' | null;

export default function TestingManager({ onBack }: TestingManagerProps) {
  const [activeTest, setActiveTest] = useState<TestState>(null);
  const [editMode, setEditMode] = useState(false);
  
  // Editable Layout State
  const [layoutConfig, setLayoutConfig] = useState({
    victoryTitle: 'Victory!',
    victorySub: 'You have conquered the Rahee realm!',
    defeatTitle: 'Defeat',
    defeatSub: 'Better luck next time, warrior.',
    splashTitle: 'Rahee Cards',
    accentColor: '#FF6321',
    roundWinText: 'Round Win!',
    roundLoseText: 'Round Lose',
    roundDrawText: 'Draw',
    cardImageSize: 160,
    cardImageRoundness: 9999,
    cardImageAspectRatio: '1/1'
  });
  
  const testCard = CARDS[0];

  const renderTestOverlay = () => {
    switch (activeTest) {
      case 'splash':
        return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
          >
            <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="relative"
              >
                <div 
                  className="w-32 h-32 rounded-[2.5rem] rotate-12 flex items-center justify-center shadow-[0_0_50px_rgba(255,99,33,0.3)]"
                  style={{ backgroundColor: layoutConfig.accentColor }}
                >
                  <Trophy className="w-16 h-16 text-white -rotate-12" />
                </div>
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 blur-3xl -z-10"
                  style={{ backgroundColor: layoutConfig.accentColor }}
                />
              </motion.div>
              
              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-12 text-6xl font-black text-white uppercase italic tracking-tighter"
              >
                {layoutConfig.splashTitle}
              </motion.h1>
              
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: 200 }}
                transition={{ delay: 1, duration: 1.5 }}
                className="h-1 mt-4 rounded-full"
                style={{ backgroundColor: layoutConfig.accentColor }}
              />
              
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.5 }}
                onClick={() => setActiveTest(null)}
                className="mt-12 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Close Preview
              </motion.button>
            </div>
          </motion.div>
        );
      case 'round_win':
      case 'round_lose':
      case 'round_draw':
        return (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none"
          >
            <div 
              className="px-12 py-6 rounded-full text-4xl font-black uppercase tracking-tighter shadow-2xl backdrop-blur-md border-4"
              style={{ 
                backgroundColor: activeTest === 'round_win' ? `${layoutConfig.accentColor}33` : activeTest === 'round_lose' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(113, 113, 122, 0.2)',
                borderColor: activeTest === 'round_win' ? layoutConfig.accentColor : activeTest === 'round_lose' ? '#ef4444' : '#71717a',
                color: activeTest === 'round_win' ? layoutConfig.accentColor : activeTest === 'round_lose' ? '#f87171' : '#a1a1aa'
              }}
            >
              {activeTest === 'round_win' ? layoutConfig.roundWinText : activeTest === 'round_lose' ? layoutConfig.roundLoseText : layoutConfig.roundDrawText}
            </div>
          </motion.div>
        );
      case 'victory':
      case 'defeat':
        const isVictory = activeTest === 'victory';
        return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-[#151a21] border border-white/5 rounded-[3rem] p-10 text-center shadow-2xl relative overflow-hidden"
            >
              {/* Background Glow */}
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 blur-[100px] opacity-20 -z-10"
                style={{ backgroundColor: isVictory ? layoutConfig.accentColor : '#ef4444' }}
              />

              <div 
                className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: isVictory ? `${layoutConfig.accentColor}22` : 'rgba(239, 68, 68, 0.1)' }}
              >
                {isVictory ? (
                  <Trophy className="w-10 h-10" style={{ color: layoutConfig.accentColor }} />
                ) : (
                  <ShieldAlert className="w-10 h-10 text-red-500" />
                )}
              </div>

              <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">
                {isVictory ? layoutConfig.victoryTitle : layoutConfig.defeatTitle}
              </h2>
              <p className="text-zinc-500 text-sm font-medium mb-10">
                {isVictory ? layoutConfig.victorySub : layoutConfig.defeatSub}
              </p>

              <button 
                onClick={() => setActiveTest(null)}
                className="w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg"
                style={{ backgroundColor: isVictory ? layoutConfig.accentColor : '#ef4444' }}
              >
                Return to Dashboard
              </button>
            </motion.div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col font-sans">
      {/* Header */}
      <div className="p-6 md:p-10 flex items-center justify-between border-b border-white/5 bg-[#0f1419]/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all active:scale-95 group"
          >
            <ArrowLeft className="w-6 h-6 text-zinc-400 group-hover:text-white" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic flex items-center gap-3">
              Testing Dashboard
              <span className="text-[10px] not-italic bg-rahee/20 text-rahee px-2 py-1 rounded-lg font-black tracking-widest uppercase">Admin</span>
            </h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Check Game Layouts & UI States</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <Layout className="w-4 h-4" />
            Game Layout Previews
          </h2>
          <button 
            onClick={() => setEditMode(!editMode)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all
              ${editMode ? 'bg-rahee text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}
            `}
          >
            {editMode ? 'Finish Editing' : 'Edit Layout Content'}
          </button>
        </div>

        {editMode && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12 p-6 bg-white/5 rounded-3xl border border-white/5"
          >
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Splash Title</label>
              <input 
                type="text" 
                value={layoutConfig.splashTitle}
                onChange={(e) => setLayoutConfig({...layoutConfig, splashTitle: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-rahee outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Accent Color</label>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={layoutConfig.accentColor}
                  onChange={(e) => setLayoutConfig({...layoutConfig, accentColor: e.target.value})}
                  className="w-10 h-10 bg-transparent border-none outline-none cursor-pointer"
                />
                <input 
                  type="text" 
                  value={layoutConfig.accentColor}
                  onChange={(e) => setLayoutConfig({...layoutConfig, accentColor: e.target.value})}
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-rahee outline-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Victory Title</label>
              <input 
                type="text" 
                value={layoutConfig.victoryTitle}
                onChange={(e) => setLayoutConfig({...layoutConfig, victoryTitle: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-rahee outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Victory Subtitle</label>
              <input 
                type="text" 
                value={layoutConfig.victorySub}
                onChange={(e) => setLayoutConfig({...layoutConfig, victorySub: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-rahee outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Defeat Title</label>
              <input 
                type="text" 
                value={layoutConfig.defeatTitle}
                onChange={(e) => setLayoutConfig({...layoutConfig, defeatTitle: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-rahee outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Defeat Subtitle</label>
              <input 
                type="text" 
                value={layoutConfig.defeatSub}
                onChange={(e) => setLayoutConfig({...layoutConfig, defeatSub: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-rahee outline-none"
              />
            </div>

            <div className="col-span-full border-t border-white/5 mt-4 pt-4">
              <h3 className="text-[10px] font-black text-rahee uppercase tracking-widest mb-4">Card Image Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Image Size ({layoutConfig.cardImageSize}px)</label>
                  <input 
                    type="range" 
                    min="80" 
                    max="240" 
                    step="10"
                    value={layoutConfig.cardImageSize}
                    onChange={(e) => setLayoutConfig({...layoutConfig, cardImageSize: Number(e.target.value)})}
                    className="w-full accent-rahee"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Image Roundness</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="120" 
                    step="4"
                    value={layoutConfig.cardImageRoundness === 9999 ? 120 : layoutConfig.cardImageRoundness}
                    onChange={(e) => setLayoutConfig({...layoutConfig, cardImageRoundness: Number(e.target.value) === 120 ? 9999 : Number(e.target.value)})}
                    className="w-full accent-rahee"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Aspect Ratio</label>
                  <select 
                    value={layoutConfig.cardImageAspectRatio}
                    onChange={(e) => setLayoutConfig({...layoutConfig, cardImageAspectRatio: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-rahee outline-none"
                  >
                    <option value="1/1">1:1 (Square/Circle)</option>
                    <option value="4/3">4:3 (Landscape)</option>
                    <option value="3/4">3:4 (Portrait)</option>
                    <option value="16/9">16:9 (Wide)</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          <TestCard 
            title="Splash Screen" 
            description="The initial loading screen with Rahee branding and animation."
            icon={<Monitor className="text-rahee" />}
            onClick={() => setActiveTest('splash')}
          />

          <TestCard 
            title="Victory Screen" 
            description="Full screen victory celebration with trophy and custom message."
            icon={<Trophy className="text-rahee" />}
            onClick={() => setActiveTest('victory')}
          />
          
          <TestCard 
            title="Defeat Screen" 
            description="Full screen defeat modal for when the game is lost."
            icon={<ShieldAlert className="text-red-500" />}
            onClick={() => setActiveTest('defeat')}
          />

          <TestCard 
            title="Round Win" 
            description="Floating overlay for individual round victories."
            icon={<CheckCircle2 className="text-emerald-500" />}
            onClick={() => {
              setActiveTest('round_win');
              setTimeout(() => setActiveTest(null), 3000);
            }}
          />

          <TestCard 
            title="Round Lose" 
            description="Floating overlay for individual round losses."
            icon={<AlertCircle className="text-red-400" />}
            onClick={() => {
              setActiveTest('round_lose');
              setTimeout(() => setActiveTest(null), 3000);
            }}
          />

          <TestCard 
            title="Round Draw" 
            description="Floating overlay for tied rounds."
            icon={<Star className="text-zinc-400" />}
            onClick={() => {
              setActiveTest('round_draw');
              setTimeout(() => setActiveTest(null), 3000);
            }}
          />

          {/* Card Preview */}
          <div className="col-span-full mt-12 mb-6">
            <h2 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Star className="w-4 h-4" />
              Card Component Test
            </h2>
            <div className="max-w-xs mx-auto">
              <Card 
                card={testCard} 
                isRevealed={true}
                imageConfig={{
                  size: layoutConfig.cardImageSize,
                  roundness: layoutConfig.cardImageRoundness,
                  aspectRatio: layoutConfig.cardImageAspectRatio
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {renderTestOverlay()}
      </AnimatePresence>
    </div>
  );
}

function TestCard({ title, description, icon, onClick }: { title: string, description: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-[#151a21] border border-white/5 p-8 rounded-[2.5rem] text-left hover:border-rahee/30 transition-all group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
        {icon}
      </div>
      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-rahee/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-black text-white uppercase tracking-tighter italic mb-2">{title}</h3>
      <p className="text-zinc-500 text-xs leading-relaxed font-medium">{description}</p>
      
      <div className="mt-8 flex items-center gap-2 text-rahee text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
        Run Test <Play className="w-3 h-3 fill-current" />
      </div>
    </motion.button>
  );
}
