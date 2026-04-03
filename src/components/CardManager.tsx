import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ref, set, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { handleDatabaseError, OperationType } from '../utils/firebaseErrors';
import { CardData } from '../types';
import { STAT_LABELS, STAT_KEYS } from '../constants';
import Card from './Card';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Image as ImageIcon,
  Search,
  ChevronRight,
  Layout
} from 'lucide-react';

interface CardManagerProps {
  key?: string;
  onBack: () => void;
  cards: CardData[];
}

export default function CardManager({ onBack, cards }: CardManagerProps) {
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const filteredCards = cards.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.includes(searchTerm)
  );

  const handleSave = async (card: CardData) => {
    setLoading(true);
    try {
      if (isAdding) {
        await set(ref(db, `cards/${card.id}`), card);
      } else {
        await update(ref(db, `cards/${card.id}`), { ...card });
      }
      setEditingCard(null);
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to save card:', err);
      handleDatabaseError(err, isAdding ? OperationType.WRITE : OperationType.UPDATE, `cards/${card.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await remove(ref(db, `cards/${id}`));
      setEditingCard(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete card:', err);
      handleDatabaseError(err, OperationType.DELETE, `cards/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const startAdding = () => {
    const nextId = (Math.max(...cards.map(c => Number(c.id)), 0) + 1).toString();
    setEditingCard({
      id: nextId,
      name: '',
      symbol: '♤',
      rank: 'A',
      image: `https://picsum.photos/seed/${nextId}/400/300`,
      details: 'New card description',
      stats: { no: Number(nextId), speed: 1000, skill: 1000, power: 1000, xp: 1000 }
    });
    setIsAdding(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) { // 500KB limit for base64 in Firestore
      alert('Image is too large. Please choose an image smaller than 500KB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (editingCard) {
        setEditingCard({ ...editingCard, image: reader.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    if (editingCard) {
      setEditingCard({ ...editingCard, image: 'https://picsum.photos/seed/placeholder/400/300' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-white/5 bg-zinc-900/50 sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rahee Cards Manager</h1>
            <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Admin Panel</p>
          </div>
        </div>
        <button 
          onClick={startAdding}
          className="bg-rahee hover:bg-rahee/90 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-rahee/20"
        >
          <Plus className="w-5 h-5" />
          Add New Card
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Removed Horizontal Swipable Gallery */}

        <div className="flex-1 flex overflow-hidden relative">
          {/* Sidebar List */}
        <div className={`w-full md:w-80 border-r border-white/5 flex flex-col bg-zinc-900/20 transition-all ${editingCard ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text"
                placeholder="Search cards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:border-rahee outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredCards.map(card => (
              <div
                key={card.id}
                onClick={() => { setEditingCard(card); setIsAdding(false); setShowDeleteConfirm(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group cursor-pointer ${editingCard?.id === card.id ? 'bg-rahee/10 border border-rahee/20' : 'hover:bg-white/5 border border-transparent'}`}
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                  <img src={card.image || 'https://picsum.photos/seed/placeholder/400/300'} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-sm font-bold truncate">{card.name}</p>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-tighter">ID: {card.id} • {card.symbol}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[8px] bg-zinc-800 px-1 rounded text-zinc-400">SPD: {card.stats.speed}</span>
                    <span className="text-[8px] bg-zinc-800 px-1 rounded text-zinc-400">PWR: {card.stats.power}</span>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-12 scale-[0.2] origin-right pointer-events-none">
                  <Card card={card} />
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform ${editingCard?.id === card.id ? 'text-rahee translate-x-1' : 'text-zinc-700 group-hover:text-zinc-500'}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Editor Area */}
        <div className={`flex-1 overflow-y-auto bg-[#0a0a0a] ${editingCard ? 'block' : 'hidden md:block'}`}>
          <AnimatePresence mode="wait">
            {editingCard ? (
              <motion.div 
                key={editingCard.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-4 md:p-8 max-w-5xl mx-auto"
              >
                {/* Mobile Back Button */}
                <button 
                  onClick={() => setEditingCard(null)}
                  className="md:hidden flex items-center gap-2 text-zinc-500 mb-6 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Back to List</span>
                </button>

                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-black tracking-tighter uppercase">
                    {isAdding ? 'Create Card' : 'Edit Card'}
                  </h2>
                  {!isAdding && (
                    <div className="flex items-center gap-2">
                      {showDeleteConfirm ? (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 p-1 rounded-lg">
                          <span className="text-[10px] font-bold text-red-500 px-2 uppercase">Delete?</span>
                          <button 
                            onClick={() => handleDelete(editingCard.id)}
                            className="bg-red-500 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-red-600 transition-colors"
                          >
                            Yes
                          </button>
                          <button 
                            onClick={() => setShowDeleteConfirm(false)}
                            className="bg-zinc-800 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-zinc-700 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setShowDeleteConfirm(true)}
                          className="text-red-500 hover:text-red-400 p-2 transition-colors"
                        >
                          <Trash2 className="w-6 h-6" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left: Visuals & Preview */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="sticky top-24 space-y-6">
                      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block text-center">Live Card Preview</label>
                        <div className="flex justify-center perspective-1000">
                          <motion.div
                            initial={{ rotateY: -10, scale: 0.95 }}
                            animate={{ rotateY: 0, scale: 1 }}
                            className="w-full max-w-[260px]"
                          >
                            <Card card={editingCard} />
                          </motion.div>
                        </div>
                      </div>

                      <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 space-y-4">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Image Management</label>
                        <div className="aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 relative group">
                          <img src={editingCard.image || 'https://picsum.photos/seed/placeholder/400/300'} alt={editingCard.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-zinc-200 transition-colors">
                              <Plus className="w-3 h-3" />
                              Replace
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleFileChange}
                              />
                            </label>
                            <button 
                              onClick={removeImage}
                              className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-red-600 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              Reset
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] font-bold text-zinc-600 uppercase">Image URL</label>
                          </div>
                          <input 
                            type="text"
                            value={editingCard.image}
                            onChange={(e) => setEditingCard({ ...editingCard, image: e.target.value })}
                            placeholder="https://..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:border-rahee outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Info & Stats */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Card ID</label>
                        <input 
                          type="text"
                          value={editingCard.id}
                          disabled={!isAdding}
                          onChange={(e) => setEditingCard({ ...editingCard, id: e.target.value })}
                          className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 px-4 text-sm focus:border-rahee outline-none disabled:opacity-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Symbol</label>
                        <input 
                          type="text"
                          value={editingCard.symbol}
                          onChange={(e) => setEditingCard({ ...editingCard, symbol: e.target.value })}
                          className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 px-4 text-sm focus:border-rahee outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Rank (Letter)</label>
                        <input 
                          type="text"
                          value={editingCard.rank || ''}
                          onChange={(e) => setEditingCard({ ...editingCard, rank: e.target.value })}
                          placeholder="e.g. A, K, Q"
                          className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 px-4 text-sm focus:border-rahee outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Card Name</label>
                      <input 
                        type="text"
                        value={editingCard.name}
                        onChange={(e) => setEditingCard({ ...editingCard, name: e.target.value })}
                        className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 px-4 text-lg font-bold focus:border-rahee outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Description</label>
                      <textarea 
                        value={editingCard.details}
                        onChange={(e) => setEditingCard({ ...editingCard, details: e.target.value })}
                        rows={3}
                        className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 px-4 text-sm focus:border-rahee outline-none resize-none"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Stats</label>
                      <div className="grid grid-cols-2 gap-4">
                        {STAT_KEYS.map(key => (
                          <div key={key} className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-600 uppercase">{STAT_LABELS[key]}</label>
                            <input 
                              type="number"
                              value={editingCard.stats[key]}
                              onChange={(e) => setEditingCard({
                                ...editingCard,
                                stats: { ...editingCard.stats, [key]: Number(e.target.value) }
                              })}
                              className="w-full bg-zinc-900 border border-white/10 rounded-xl py-2 px-3 text-sm focus:border-rahee outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6 flex gap-4">
                      <button 
                        onClick={() => { setEditingCard(null); setIsAdding(false); }}
                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleSave(editingCard)}
                        disabled={loading}
                        className="flex-[2] bg-rahee hover:bg-rahee/90 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                      >
                        {loading ? <Plus className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {isAdding ? 'Create Card' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 p-12 text-center">
                <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6">
                  <Edit2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-zinc-400 mb-2">Select a card to edit</h3>
                <p className="max-w-xs text-sm">Choose a card from the list on the left or create a new one to start managing the Rahee Cards database.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  </div>
);
}
