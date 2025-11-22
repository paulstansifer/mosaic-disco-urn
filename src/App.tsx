import { useState, useEffect, useMemo } from 'react';
import './App.css';
import { type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import allowedWordsRaw from './allowed_words.txt?raw';
import LetterPool from './LetterPool';
import SuggestionColumns from './SuggestionColumns';
import SentenceBuilder from './SentenceBuilder';

const ALLOWED_WORDS = allowedWordsRaw.split('\n').map(w => w.trim()).filter(w => w.length > 0);

const canFormWord = (word: string, pool: string) => {
  const poolCounts: Record<string, number> = {};
  for (const char of pool) {
    if (char !== ' ') {
      poolCounts[char] = (poolCounts[char] || 0) + 1;
    }
  }

  for (const char of word) {
    if (!poolCounts[char]) return false;
    poolCounts[char]--;
  }
  return true;
};

function App() {
  const [words, setWords] = useState<Array<{ id: number; text: string; isEditing?: boolean; isDestroyed?: boolean }>>(
    ['Today', 'is', 'a', 'beautiful', 'day', 'to', 'be', 'stomping', 'on', 'things']
      .map((word, index) => ({ id: index + 1, text: word }))
  );

  const INITIAL_POOL = "ttttttttttttooooooooooeeeeeeeeaaaaaaallllllnnnnnnuuuuuuiiiiisssssdddddhhhhhyyyyyIIIrrrfffbbwwkcmvg:,!!";

  const shuffleString = (str: string) => {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  };

  const [letterPool, setLetterPool] = useState(() => shuffleString(INITIAL_POOL));
  const [deletedWords, setDeletedWords] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  const updatePoolRemove = (pool: string, char: string) => {
    const index = pool.indexOf(char);
    if (index === -1) return null;
    return pool.substring(0, index) + ' ' + pool.substring(index + 1);
  };

  const updatePoolAdd = (pool: string, char: string) => {
    const index = pool.indexOf(' ');
    if (index === -1) return pool + char;
    return pool.substring(0, index) + char + pool.substring(index + 1);
  };

  const handleAddWord = () => {
    const newId = Math.max(0, ...words.map(w => w.id)) + 1;
    setWords([...words, { id: newId, text: '', isEditing: true }]);
  };

  const handleWordUpdate = (id: number, newText: string) => {
    const wordIndex = words.findIndex(w => w.id === id);
    if (wordIndex === -1) return;
    const oldText = words[wordIndex].text;

    // 1. Return old letters to a temporary pool
    let currentPool = letterPool;
    for (const char of oldText) {
      currentPool = updatePoolAdd(currentPool, char);
    }

    const wordsToDestroyIds = new Set<number>();
    const parts = newText.split(' ');
    const processedParts: { text: string, isNew: boolean }[] = [];

    // Helper to form string with stealing logic
    const formString = (target: string) => {
      let formed = '';
      for (const char of target) {
        const poolAfterRemove = updatePoolRemove(currentPool, char);
        if (poolAfterRemove !== null) {
          currentPool = poolAfterRemove;
          formed += char;
        } else {
          // Try to steal
          let stolenId = -1;
          // Search reverse to steal from newest words first
          for (let i = words.length - 1; i >= 0; i--) {
            const w = words[i];
            // Don't steal from self (id), or already destroyed/marked words
            if (w.id !== id && !wordsToDestroyIds.has(w.id) && w.text.includes(char)) {
              stolenId = w.id;
              break;
            }
          }

          if (stolenId !== -1) {
            wordsToDestroyIds.add(stolenId);
            const victim = words.find(w => w.id === stolenId)!;
            // Return victim's letters
            for (const c of victim.text) {
              currentPool = updatePoolAdd(currentPool, c);
            }
            // Take the char
            currentPool = updatePoolRemove(currentPool, char)!;
            formed += char;
          }
          // If we can't steal, we skip the char (it doesn't get added)
        }
      }
      return formed;
    };

    // Process all parts of the new text
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      // Skip empty parts resulting from multiple spaces, but always process the first part (even if empty)
      if (i > 0 && part === "") continue;

      const formed = formString(part);
      processedParts.push({ text: formed, isNew: i > 0 });
    }

    // Apply updates to state
    setLetterPool(currentPool);

    setWords(prev => {
      const newWords = [...prev];
      const idx = newWords.findIndex(w => w.id === id);
      if (idx === -1) return prev;

      const replacements: typeof words = [];
      let nextId = Math.max(0, ...newWords.map(w => w.id)) + 1;

      if (processedParts.length > 0) {
        // The first part updates the existing word
        replacements.push({
          ...newWords[idx],
          text: processedParts[0].text,
          isEditing: processedParts.length === 1 // Keep editing if it's the only one
        });

        // Subsequent parts become new words
        for (let i = 1; i < processedParts.length; i++) {
          replacements.push({
            id: nextId++,
            text: processedParts[i].text,
            isEditing: true
          });
        }

        // If we split into multiple words, ensure only the last one is in editing mode
        if (processedParts.length > 1) {
          replacements.forEach((r, i) => {
            r.isEditing = (i === replacements.length - 1);
          });
        }
      } else {
        // Should not strictly happen with split logic, but safe fallback
        replacements.push({ ...newWords[idx], text: '' });
      }

      // Replace the original word with the new sequence
      newWords.splice(idx, 1, ...replacements);

      // Mark destroyed words
      return newWords.map(w => {
        if (wordsToDestroyIds.has(w.id)) {
          return { ...w, isDestroyed: true };
        }
        return w;
      });
    });

    if (wordsToDestroyIds.size > 0) {
      setTimeout(() => {
        setWords(prev => prev.filter(w => !wordsToDestroyIds.has(w.id)));
      }, 500);
    }
  };

  const handleDestroyWord = (id: number) => {
    setWords(prev => prev.map(w => w.id === id ? { ...w, isDestroyed: true } : w));
    setTimeout(() => {
      setWords(prev => prev.filter(w => w.id !== id));
    }, 500); // Animation duration
  };

  const handleWordDelete = (id: number) => {
    const wordToDelete = words.find(w => w.id === id);
    if (!wordToDelete) return;

    // Add to deleted stack
    setDeletedWords(prev => [wordToDelete.text, ...prev].slice(0, 20));

    // Return letters to pool
    let newPool = letterPool;
    for (const char of wordToDelete.text) {
      newPool = updatePoolAdd(newPool, char);
    }
    setLetterPool(newPool);

    // Remove from words list
    handleDestroyWord(id);
  };

  const handleWordCommit = (id: number) => {
    const word = words.find(w => w.id === id);
    if (word && word.text.trim().length === 0) {
      handleDestroyWord(id);
    } else {
      setWords(prev => prev.map(w => w.id === id ? { ...w, isEditing: false } : w));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && over.id === 'trash-drop-zone') {
      handleWordDelete(active.id as number);
      return;
    }

    if (over && active.id !== over.id) {
      setWords((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        setLetterPool(prev => shuffleString(prev.replace(/ /g, ''))); // Remove spaces before shuffling
      } else if (e.key === ' ') {
        e.preventDefault(); // Prevent default space behavior (e.g., scrolling)
        // Commit any currently editing chip and start a new one
        setWords(prev => {
          // Finish editing any chip that is in editing mode
          const updated = prev.map(w => w.isEditing ? { ...w, isEditing: false } : w);
          const newId = Math.max(0, ...updated.map(w => w.id)) + 1;
          // Add a new chip in editing mode
          updated.push({ id: newId, text: '', isEditing: true });
          return updated;
        });
        setLetterPool(prev => prev.replace(/ /g, '')); // Remove spaces after adding new word
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        return;
      }

      e.preventDefault();
      const text = e.clipboardData?.getData('text');
      if (!text) return;

      let currentPool = letterPool;
      const wordsToDestroyIds = new Set<number>();
      const parts = text.split(/\s+/);
      const newWordsToAdd: { text: string }[] = [];

      const formString = (target: string) => {
        let formed = '';
        for (const char of target) {
          const poolAfterRemove = updatePoolRemove(currentPool, char);
          if (poolAfterRemove !== null) {
            currentPool = poolAfterRemove;
            formed += char;
          } else {
            // Try to steal
            let stolenId = -1;
            for (let i = words.length - 1; i >= 0; i--) {
              const w = words[i];
              if (!wordsToDestroyIds.has(w.id) && w.text.includes(char)) {
                stolenId = w.id;
                break;
              }
            }

            if (stolenId !== -1) {
              wordsToDestroyIds.add(stolenId);
              const victim = words.find(w => w.id === stolenId)!;
              for (const c of victim.text) {
                currentPool = updatePoolAdd(currentPool, c);
              }
              currentPool = updatePoolRemove(currentPool, char)!;
              formed += char;
            }
          }
        }
        return formed;
      };

      for (const part of parts) {
        if (!part) continue;
        const formed = formString(part);
        if (formed) {
          newWordsToAdd.push({ text: formed });
        }
      }

      if (newWordsToAdd.length > 0) {
        setLetterPool(currentPool);
        setWords(prev => {
          const newWords = [...prev];
          let nextId = Math.max(0, ...newWords.map(w => w.id)) + 1;

          for (const newWord of newWordsToAdd) {
            newWords.push({
              id: nextId++,
              text: newWord.text,
              isEditing: false
            });
          }

          return newWords.map(w => {
            if (wordsToDestroyIds.has(w.id)) {
              return { ...w, isDestroyed: true };
            }
            return w;
          });
        });

        if (wordsToDestroyIds.size > 0) {
          setTimeout(() => {
            setWords(prev => prev.filter(w => !wordsToDestroyIds.has(w.id)));
          }, 500);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [letterPool, words]);

  const suggestedWords = useMemo(() => {
    const validWords = [];
    for (const word of ALLOWED_WORDS) {
      if (canFormWord(word, letterPool)) {
        validWords.push(word);
        if (validWords.length >= 30) break;
      }
    }
    return validWords;
  }, [letterPool]);

  const handleSuggestedClick = (word: string) => {
    // Add word to words list
    const newId = Math.max(0, ...words.map(w => w.id)) + 1;
    setWords(prev => [...prev, { id: newId, text: word, isEditing: false }]);

    // Remove letters from pool
    let newPool = letterPool;
    for (const char of word) {
      const updated = updatePoolRemove(newPool, char);
      if (updated !== null) {
        newPool = updated;
      }
    }
    // Clear spaces from the pool
    setLetterPool(newPool.replace(/ /g, ''));
  };

  const handleDeletedWordClick = (word: string) => {
    let currentPool = letterPool;
    const wordsToDestroyIds = new Set<number>();

    // Check if we can form the word (including stealing)
    for (const char of word) {
      const poolAfterRemove = updatePoolRemove(currentPool, char);

      if (poolAfterRemove !== null) {
        currentPool = poolAfterRemove;
      } else {
        // Try to steal
        let stolenId = -1;
        for (let i = words.length - 1; i >= 0; i--) {
          if (!wordsToDestroyIds.has(words[i].id) && words[i].text.includes(char)) {
            stolenId = words[i].id;
            break;
          }
        }

        if (stolenId !== -1) {
          wordsToDestroyIds.add(stolenId);
          const victim = words.find(w => w.id === stolenId)!;

          // Return letters to pool
          for (const c of victim.text) {
            currentPool = updatePoolAdd(currentPool, c);
          }

          // Take the char
          currentPool = updatePoolRemove(currentPool, char)!;
        } else {
          // Cannot form word
          return;
        }
      }
    }

    // Success - apply changes
    const newId = Math.max(0, ...words.map(w => w.id)) + 1;

    setWords(prev => {
      const newWords = [...prev, { id: newId, text: word, isEditing: false }];
      return newWords.map(w => {
        if (wordsToDestroyIds.has(w.id)) {
          return { ...w, isDestroyed: true };
        }
        return w;
      });
    });

    setDeletedWords(prev => {
      const index = prev.indexOf(word);
      if (index === -1) return prev;
      const newStack = [...prev];
      newStack.splice(index, 1);
      return newStack;
    });

    setLetterPool(currentPool);

    if (wordsToDestroyIds.size > 0) {
      setTimeout(() => {
        setWords(prev => prev.filter(w => !wordsToDestroyIds.has(w.id)));
      }, 500);
    }
  };

  return (
    <div className="app">
      <div className="content-wrapper">
        <SentenceBuilder
          words={words}
          activeId={activeId}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onWordUpdate={handleWordUpdate}
          onWordCommit={handleWordCommit}
        />

        <div className="input-section">
          <button className="add-word-btn" onClick={handleAddWord}>+</button>
          <LetterPool letterPool={letterPool} />
          <SuggestionColumns
            deletedWords={deletedWords}
            suggestedWords={suggestedWords}
            onDeletedWordClick={handleDeletedWordClick}
            onSuggestedClick={handleSuggestedClick}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
