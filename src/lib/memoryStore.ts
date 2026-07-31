export interface MemoryItem {
  id: string;
  text: string;
  category?: string;
  createdAt: number;
}

const STORAGE_KEY = 'yui_long_term_memories_v1';

type MemoryListener = (memory: MemoryItem) => void;
const listeners: Set<MemoryListener> = new Set();

export function subscribeMemorySaved(listener: MemoryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAllMemories(): MemoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MemoryItem[];
  } catch (err) {
    console.error('Failed to read memories from storage:', err);
    return [];
  }
}

export function saveMemory(text: string, category: string = 'general'): MemoryItem {
  const memories = getAllMemories();
  
  // Avoid exact duplicates created in quick succession
  const existing = memories.find(m => m.text.trim().toLowerCase() === text.trim().toLowerCase());
  if (existing) {
    return existing;
  }

  const newMemory: MemoryItem = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    text: text.trim(),
    category,
    createdAt: Date.now(),
  };

  const updated = [newMemory, ...memories];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save memory:', err);
  }

  // Notify UI subscribers
  listeners.forEach((listener) => {
    try {
      listener(newMemory);
    } catch (e) {
      console.error('Error in memory listener:', e);
    }
  });

  return newMemory;
}

export function deleteMemory(id: string): boolean {
  const memories = getAllMemories();
  const filtered = memories.filter((m) => m.id !== id);
  if (filtered.length !== memories.length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }
  return false;
}

export function deleteMemoryByQuery(query: string): { success: boolean; count: number; deleted: string[] } {
  const memories = getAllMemories();
  if (!query) return { success: false, count: 0, deleted: [] };
  const lower = query.toLowerCase().trim();
  const deletedTexts: string[] = [];
  const remaining = memories.filter((m) => {
    const matches = m.text.toLowerCase().includes(lower) || lower.includes(m.text.toLowerCase());
    if (matches) {
      deletedTexts.push(m.text);
      return false;
    }
    return true;
  });

  if (deletedTexts.length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    return { success: true, count: deletedTexts.length, deleted: deletedTexts };
  }

  return { success: false, count: 0, deleted: [] };
}

export function searchMemories(query: string): MemoryItem[] {
  const memories = getAllMemories();
  if (!query) return memories;
  const lower = query.toLowerCase();
  return memories.filter((m) => m.text.toLowerCase().includes(lower));
}
