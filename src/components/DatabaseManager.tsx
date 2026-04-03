import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ref, onValue, update, remove, get, set, off } from 'firebase/database';
import { handleDatabaseError, OperationType } from '../utils/firebaseErrors';
import { db } from '../firebase';
import { 
  ArrowLeft, 
  Database, 
  Users, 
  MessageSquare, 
  History, 
  Gamepad2, 
  Search, 
  Trash2, 
  Edit2, 
  Save, 
  X,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Menu,
  Filter,
  Eye,
  LayoutGrid,
  List as ListIcon,
  CheckCircle,
  XCircle,
  Key,
  Activity
} from 'lucide-react';

interface DatabaseManagerProps {
  key?: string;
  onBack: () => void;
}

type CollectionName = 'users' | 'rooms' | 'feedback' | 'auth_logs' | 'cards' | 'game_logs';

export default function DatabaseManager({ onBack }: DatabaseManagerProps) {
  const [activeCollection, setActiveCollection] = useState<CollectionName>('users');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showIds, setShowIds] = useState(true);
  const [compactView, setCompactView] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [changingKeyId, setChangingKeyId] = useState<string | null>(null);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  const collections: { name: CollectionName; icon: any; label: string }[] = [
    { name: 'users', icon: Users, label: 'Players' },
    { name: 'rooms', icon: Gamepad2, label: 'Game Rooms' },
    { name: 'cards', icon: Database, label: 'Cards' },
    { name: 'feedback', icon: MessageSquare, label: 'Feedback' },
    { name: 'auth_logs', icon: History, label: 'Auth Logs' },
    { name: 'game_logs', icon: Activity, label: 'Game Logs' },
  ];

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedIds([]);
    
    const collectionRef = ref(db, activeCollection);
    const unsubscribe = onValue(collectionRef, (snapshot) => {
      const data = snapshot.val();
      const docs = data ? Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      })) : [];
      
      // Sort by createdAt or timestamp desc if they exist
      docs.sort((a, b) => {
        const aTime = a.createdAt || a.timestamp || 0;
        const bTime = b.createdAt || b.timestamp || 0;
        return bTime - aTime;
      });
      setDocuments(docs);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to load collection. Check permissions.");
      setLoading(false);
      handleDatabaseError(err, OperationType.LIST, activeCollection);
    });

    return () => off(collectionRef, 'value', unsubscribe);
  }, [activeCollection]);

  const handleDelete = async (id: string) => {
    try {
      await remove(ref(db, `${activeCollection}/${id}`));
      setDeletingId(null);
    } catch (err) {
      console.error(err);
      handleDatabaseError(err, OperationType.DELETE, `${activeCollection}/${id}`);
    }
  };

  const handleUpdate = async (id: string, data: any) => {
    try {
      await update(ref(db, `${activeCollection}/${id}`), data);
      setEditingDoc(null);
    } catch (err) {
      console.error(err);
      handleDatabaseError(err, OperationType.UPDATE, `${activeCollection}/${id}`);
    }
  };

  const handleChangeKey = async (oldId: string, newId: string) => {
    if (!newId || newId === oldId) {
      setChangingKeyId(null);
      return;
    }

    setLoading(true);
    try {
      const oldRef = ref(db, `${activeCollection}/${oldId}`);
      const snapshot = await get(oldRef);
      const data = snapshot.val();

      if (data) {
        // Prepare new data with updated raheeKey if it exists
        const newData = { ...data };
        if (activeCollection === 'users') {
          newData.raheeKey = newId;
        }

        // Write to new path
        await set(ref(db, `${activeCollection}/${newId}`), newData);
        // Delete old path
        await remove(oldRef);
        
        setChangingKeyId(null);
        setNewKeyInput('');
      }
    } catch (err) {
      console.error(err);
      setError("Failed to change key.");
      handleDatabaseError(err, OperationType.UPDATE, `${activeCollection}/${oldId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} documents?`)) return;
    setIsBulkActionLoading(true);
    try {
      const updates: any = {};
      selectedIds.forEach(id => {
        updates[`${activeCollection}/${id}`] = null;
      });
      await update(ref(db), updates);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      setError("Bulk delete failed.");
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkUpdate = async (data: any) => {
    setIsBulkActionLoading(true);
    try {
      const updates: any = {};
      selectedIds.forEach(id => {
        // For Realtime DB bulk update, we need to merge with existing data or use specific paths
        // Here we update specific fields for each document
        Object.keys(data).forEach(key => {
          updates[`${activeCollection}/${id}/${key}`] = data[key];
        });
      });
      await update(ref(db), updates);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      setError("Bulk update failed.");
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredDocs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDocs.map(d => d.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredDocs = documents.filter(doc => 
    JSON.stringify(doc).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'object') {
      return JSON.stringify(val);
    }
    if (typeof val === 'number' && val > 1000000000000) return new Date(val).toLocaleString();
    return String(val);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 flex items-center justify-between border-b border-white/5 bg-zinc-900/50 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-2 hover:bg-white/5 rounded-lg transition-colors md:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg transition-colors hidden md:block">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight">Database</h1>
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Admin Explorer</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center bg-white/5 rounded-lg p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-rahee text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-rahee text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
             <RefreshCw className={`w-4 h-4 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
             <span className="hidden sm:inline text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Sync</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar / Drawer */}
        <AnimatePresence>
          {(isSidebarOpen || window.innerWidth >= 768) && (
            <motion.div 
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`
                fixed inset-y-0 left-0 z-40 w-72 bg-zinc-900 border-r border-white/5 flex flex-col
                md:relative md:translate-x-0 md:bg-zinc-900/20 md:z-0
                ${isSidebarOpen ? 'shadow-2xl' : ''}
              `}
            >
              <div className="p-6 md:hidden flex items-center justify-between border-b border-white/5">
                <span className="font-black uppercase tracking-tighter text-rahee text-xl">Collections</span>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-1 flex-1 overflow-y-auto">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 mb-2">Select Data Source</p>
                {collections.map(col => (
                  <button
                    key={col.name}
                    onClick={() => { 
                      setActiveCollection(col.name); 
                      setEditingDoc(null);
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all group ${activeCollection === col.name ? 'bg-rahee text-white shadow-lg shadow-rahee/20' : 'text-zinc-400 hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-3">
                      <col.icon className={`w-5 h-5 ${activeCollection === col.name ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                      <span className="font-bold text-sm">{col.label}</span>
                    </div>
                    {activeCollection === col.name && <ChevronRight className="w-4 h-4" />}
                  </button>
                ))}

                <div className="mt-8 pt-8 border-t border-white/5">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 mb-4">View Options</p>
                  <div className="space-y-4 px-3">
                    <button 
                      onClick={() => setShowIds(!showIds)}
                      className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      <span>Show IDs</span>
                      <div className={`w-8 h-4 rounded-full relative transition-colors ${showIds ? 'bg-rahee' : 'bg-zinc-800'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showIds ? 'right-0.5' : 'left-0.5'}`} />
                      </div>
                    </button>
                    <button 
                      onClick={() => setCompactView(!compactView)}
                      className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      <span>Compact View</span>
                      <div className={`w-8 h-4 rounded-full relative transition-colors ${compactView ? 'bg-rahee' : 'bg-zinc-800'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${compactView ? 'right-0.5' : 'left-0.5'}`} />
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/5 md:hidden">
                <button 
                  onClick={onBack}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Menu
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backdrop for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#050505]">
          <div className="p-4 border-b border-white/5 bg-zinc-900/10 flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text"
                placeholder={`Search ${activeCollection}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:border-rahee outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={toggleSelectAll}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl text-xs font-bold transition-colors ${selectedIds.length > 0 ? 'bg-rahee/10 border-rahee text-rahee' : 'bg-zinc-900/50 border-white/10 text-zinc-400 hover:text-white'}`}
              >
                {selectedIds.length === filteredDocs.length ? 'Deselect All' : 'Select All'}
              </button>
              <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900/50 border border-white/10 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-colors">
                <Filter className="w-3.5 h-3.5" />
                Filter
              </button>
              <div className="flex md:hidden items-center bg-white/5 rounded-xl p-1">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-rahee text-white' : 'text-zinc-500'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-rahee text-white' : 'text-zinc-500'}`}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 md:p-6 pb-24">
            {selectedIds.length > 0 && (
              <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-rahee/30 rounded-2xl p-4 shadow-2xl flex items-center gap-4 min-w-[300px]"
              >
                <div className="flex flex-col pr-4 border-r border-white/10">
                  <span className="text-xs font-bold text-rahee uppercase tracking-widest">{selectedIds.length} Selected</span>
                  <button onClick={() => setSelectedIds([])} className="text-[10px] text-zinc-500 hover:text-white transition-colors text-left">Clear Selection</button>
                </div>
                <div className="flex items-center gap-2">
                  {activeCollection === 'users' && (
                    <>
                      <button 
                        disabled={isBulkActionLoading}
                        onClick={() => handleBulkUpdate({ isApproved: true })}
                        className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-all disabled:opacity-50"
                        title="Approve All"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button 
                        disabled={isBulkActionLoading}
                        onClick={() => handleBulkUpdate({ isApproved: false })}
                        className="p-2 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 rounded-lg transition-all disabled:opacity-50"
                        title="Deny All"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <button 
                    disabled={isBulkActionLoading}
                    onClick={handleBulkDelete}
                    className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-all disabled:opacity-50"
                    title="Delete All"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                {isBulkActionLoading && <RefreshCw className="w-4 h-4 text-rahee animate-spin ml-2" />}
              </motion.div>
            )}

            {error ? (
              <div className="h-full flex flex-col items-center justify-center text-red-500 gap-4">
                <AlertCircle className="w-12 h-12" />
                <p className="font-bold">{error}</p>
                <button onClick={() => window.location.reload()} className="text-sm underline">Retry</button>
              </div>
            ) : loading && documents.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="w-10 h-10 text-rahee animate-spin" />
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse">Syncing Data...</p>
                </div>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-3"}>
                {filteredDocs.map(docData => (
                  <motion.div 
                    layout
                    key={docData.id} 
                    className={`bg-zinc-900/30 border rounded-2xl overflow-hidden group hover:border-rahee/30 transition-all ${selectedIds.includes(docData.id) ? 'border-rahee/50 ring-1 ring-rahee/20' : 'border-white/5'} ${viewMode === 'list' ? 'flex flex-col sm:flex-row sm:items-center' : ''}`}
                  >
                    <div className={`p-4 flex items-center justify-between bg-white/5 ${viewMode === 'list' ? 'sm:w-64 sm:border-r sm:border-white/5' : ''}`}>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => toggleSelect(docData.id)}
                          className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${selectedIds.includes(docData.id) ? 'bg-rahee border-rahee' : 'border-white/20 hover:border-rahee/50'}`}
                        >
                          {selectedIds.includes(docData.id) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                        </button>
                        {showIds && (
                          <>
                            <div className="w-8 h-8 bg-rahee/10 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold text-rahee">
                              ID
                            </div>
                            <span className="text-xs font-mono text-zinc-300 font-bold truncate max-w-[120px]">{docData.id}</span>
                          </>
                        )}
                        {!showIds && (
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-rahee" />
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Document</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {activeCollection === 'users' && docData.name?.toLowerCase() !== 'rahee' && (
                          <>
                            {docData.isApproved ? (
                              <button 
                                onClick={() => handleUpdate(docData.id, { isApproved: false })}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 hover:text-red-400 transition-colors"
                                title="Deny Access"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleUpdate(docData.id, { isApproved: true })}
                                className="p-2 hover:bg-green-500/10 rounded-lg text-green-500 hover:text-green-400 transition-colors"
                                title="Approve Access"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                        <button 
                          onClick={() => setEditingDoc(editingDoc?.id === docData.id ? null : docData)}
                          className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {activeCollection === 'users' && (
                          <button 
                            onClick={() => {
                              setChangingKeyId(changingKeyId === docData.id ? null : docData.id);
                              setNewKeyInput(docData.id);
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                            title="Change Key"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {deletingId === docData.id ? (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleDelete(docData.id)}
                              className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded hover:bg-red-600 transition-colors"
                            >
                              Confirm
                            </button>
                            <button 
                              onClick={() => setDeletingId(null)}
                              className="p-1 hover:bg-white/10 rounded text-zinc-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeletingId(docData.id)}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className={`p-4 flex-1 ${compactView ? 'py-2' : ''} ${viewMode === 'list' ? 'grid grid-cols-2 md:grid-cols-4 gap-4' : 'grid grid-cols-2 gap-3'}`}>
                      {activeCollection === 'users' && (
                        <div className="col-span-full mb-2">
                          {docData.isApproved ? (
                            <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold rounded-full uppercase tracking-widest">Approved</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-[10px] font-bold rounded-full uppercase tracking-widest">Pending Approval</span>
                          )}
                        </div>
                      )}
                      {activeCollection === 'game_logs' && (
                        <div className="col-span-full mb-2 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${docData.status === 'started' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
                            {docData.status}
                          </span>
                          <span className="px-2 py-0.5 bg-white/5 text-zinc-400 text-[10px] font-bold rounded-full uppercase tracking-widest">
                            {docData.mode}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-bold ml-auto">
                            {formatValue(docData.timestamp)}
                          </span>
                        </div>
                      )}
                      {Object.entries(docData).map(([key, value]) => (
                        key !== 'id' && (
                          <div key={key} className={`space-y-1 ${compactView ? 'flex items-center gap-2 space-y-0' : ''}`}>
                            <p className={`text-[9px] font-bold text-zinc-600 uppercase tracking-widest truncate ${compactView ? 'w-20' : ''}`}>{key}</p>
                            <div className={`text-[11px] text-zinc-400 font-medium break-all line-clamp-2 ${compactView ? 'truncate' : ''}`}>
                              {formatValue(value)}
                            </div>
                          </div>
                        )
                      ))}
                    </div>

                    <AnimatePresence>
                      {editingDoc?.id === docData.id && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="w-full overflow-hidden border-t border-white/5 bg-black/40"
                        >
                          <div className="p-4 md:p-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-rahee uppercase tracking-widest">Edit Document</p>
                              <button onClick={() => setEditingDoc(null)} className="p-1 hover:bg-white/5 rounded">
                                <X className="w-4 h-4 text-zinc-500" />
                              </button>
                            </div>
                            <textarea 
                              defaultValue={JSON.stringify(docData, (k, v) => k === 'id' ? undefined : v, 2)}
                              id={`edit-${docData.id}`}
                              className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-mono text-zinc-400 h-48 focus:border-rahee outline-none resize-none"
                            />
                            <div className="flex gap-3">
                              <button 
                                onClick={() => setEditingDoc(null)}
                                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => {
                                  const textarea = document.getElementById(`edit-${docData.id}`) as HTMLTextAreaElement;
                                  try {
                                    const parsed = JSON.parse(textarea.value);
                                    handleUpdate(docData.id, parsed);
                                  } catch (e) {
                                    alert('Invalid JSON');
                                  }
                                }}
                                className="flex-1 py-2.5 bg-rahee hover:bg-rahee/90 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                              >
                                <Save className="w-4 h-4" />
                                Save
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {changingKeyId === docData.id && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="w-full overflow-hidden border-t border-white/5 bg-black/40"
                        >
                          <div className="p-4 md:p-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-rahee uppercase tracking-widest">Change User Key</p>
                              <button onClick={() => setChangingKeyId(null)} className="p-1 hover:bg-white/5 rounded">
                                <X className="w-4 h-4 text-zinc-500" />
                              </button>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">New Key (ID)</label>
                              <input 
                                type="text"
                                value={newKeyInput}
                                onChange={(e) => setNewKeyInput(e.target.value)}
                                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-sm font-mono text-white focus:border-rahee outline-none"
                                placeholder="Enter new key..."
                              />
                              <p className="text-[10px] text-zinc-500 italic">Warning: This will move the user data to the new key path.</p>
                            </div>
                            <div className="flex gap-3">
                              <button 
                                onClick={() => setChangingKeyId(null)}
                                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleChangeKey(docData.id, newKeyInput)}
                                className="flex-1 py-2.5 bg-rahee hover:bg-rahee/90 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                              >
                                <RefreshCw className="w-4 h-4" />
                                Update Key
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
                
                {filteredDocs.length === 0 && (
                  <div className="py-20 text-center text-zinc-600 col-span-full">
                    <Database className="w-16 h-16 mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-medium">No documents found matching your search</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
