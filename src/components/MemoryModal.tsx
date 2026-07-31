import React, { useState, useEffect } from 'react';
import { MemoryItem, getAllMemories, deleteMemory, saveMemory } from '../lib/memoryStore';
import { Brain, Trash2, Plus, Search, X, Heart, Lock } from 'lucide-react';

interface MemoryModalProps {
  isOpen: boolean;
  isTanmayVerified: boolean;
  onClose: () => void;
  onMemoriesUpdated: () => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  isTanmayVerified,
  onClose,
  onMemoriesUpdated,
}) => {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMemoryText, setNewMemoryText] = useState('');

  const loadMemories = () => {
    setMemories(getAllMemories());
    onMemoriesUpdated();
  };

  useEffect(() => {
    if (isOpen) {
      loadMemories();
    }
  }, [isOpen]);

  const handleDelete = (id: string) => {
    deleteMemory(id);
    loadMemories();
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;
    saveMemory(newMemoryText, 'manual');
    setNewMemoryText('');
    loadMemories();
  };

  const filteredMemories = memories.filter((m) =>
    m.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl border border-sky-500/30 bg-slate-900/95 p-6 shadow-[0_20px_60px_rgba(14,165,233,0.25)] text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-300">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-sky-100">Yui's Long-Term Memories</h3>
              <p className="text-xs text-slate-400">
                {isTanmayVerified
                  ? 'Persistent recall for तन्मय भैया'
                  : 'Protected memory chamber'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lock Notice if not verified as Tanmay */}
        {!isTanmayVerified ? (
          <div className="my-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
            <Lock className="h-8 w-8 text-amber-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-amber-200">Memories Locked</h4>
            <p className="text-xs text-slate-300 mt-1">
              Yui keeps her creator's memories private. Verify as तन्मय भैया in voice chat to view or modify memories.
            </p>
          </div>
        ) : (
          <>
            {/* Add Memory Input */}
            <form onSubmit={handleAddMemory} className="mt-4 flex space-x-2">
              <input
                type="text"
                placeholder="Teach Yui something to remember..."
                value={newMemoryText}
                onChange={(e) => setNewMemoryText(e.target.value)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
              />
              <button
                type="submit"
                className="flex items-center space-x-1.5 rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors shadow-md"
              >
                <Plus className="h-4 w-4" />
                <span>Save</span>
              </button>
            </form>

            {/* Search Filter */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-sky-500/50 focus:outline-none"
              />
            </div>

            {/* Memory Items List */}
            <div className="mt-4 max-h-64 overflow-y-auto space-y-2 pr-1">
              {filteredMemories.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  {searchQuery ? 'No memories matching search.' : 'No memories saved yet. Ask Yui to remember something!'}
                </div>
              ) : (
                filteredMemories.map((mem) => (
                  <div
                    key={mem.id}
                    className="flex items-start justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 hover:border-sky-500/30 transition-all"
                  >
                    <div className="flex-1 pr-3">
                      <p className="text-xs text-slate-200 font-medium leading-relaxed">{mem.text}</p>
                      <div className="mt-1 flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                        <span>{new Date(mem.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="capitalize text-sky-400/80">{mem.category || 'general'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(mem.id)}
                      title="Delete Memory"
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-5 border-t border-slate-800 pt-3 flex justify-between items-center text-[11px] text-slate-400">
          <div className="flex items-center space-x-1">
            <Heart className="h-3 w-3 text-pink-400 fill-pink-400/30" />
            <span>Yui Memory Core v1</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
