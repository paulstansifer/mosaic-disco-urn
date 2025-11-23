import { useState, useEffect, useMemo } from 'react';
import './App.css';
import {
    DndContext,
    closestCenter,
    DragOverlay,
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    type DropAnimation,
    defaultDropAnimationSideEffects,
    type DragEndEvent,
    type DragStartEvent,
    useDroppable
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import allowedWordsRaw from './allowed_words.txt?raw';
import allowedEndWordsRaw from './allowed_end_words.txt?raw';
import LetterPool from './LetterPool';
import SuggestionColumns from './SuggestionColumns';
import SentenceBuilder from './SentenceBuilder';
import SavedSentencesList from './SavedSentencesList';

const ALLOWED_WORDS = allowedWordsRaw.split('\n').map(w => w.trim()).filter(w => w.length > 0);
const ALLOWED_END_WORDS = allowedEndWordsRaw.split('\n').map(w => w.trim()).filter(w => w.length > 0);

const INITIAL_POOL_SOURCE = "ttttttttttttooooooooooeeeeeeeeaaaaaaallllllnnnnnnuuuuuuiiiiisssssdddddhhhhhyyyyyIIIrrrfffbbwwkcmvg:,!!";
const INITIAL_SENTENCE_TEXT = "I fundamental !!";

const shuffleString = (str: string) => {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
};

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

const COOKIE_NAME = 'mosaic_saved_sentences';

const getSavedSentencesFromCookie = (): string[] => {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${COOKIE_NAME}=`);
    if (parts.length === 2) {
      const cookieVal = parts.pop()?.split(';').shift();
      if (cookieVal) {
        return JSON.parse(decodeURIComponent(cookieVal));
      }
    }
  } catch (e) {
    console.error("Failed to parse saved sentences cookie", e);
  }
  return [];
};

const saveSentencesToCookie = (sentences: string[]) => {
  const d = new Date();
  d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year
  const expires = "expires=" + d.toUTCString();
  const value = encodeURIComponent(JSON.stringify(sentences));
  document.cookie = COOKIE_NAME + "=" + value + ";" + expires + ";path=/";
};

function TrashDropZone() {
    const { isOver, setNodeRef } = useDroppable({
        id: 'trash-drop-zone',
    });

    return (
        <div
            ref={setNodeRef}
            className={`trash-drop-zone ${isOver ? 'over' : ''}`}
        >
            🗑️
        </div>
    );
}

function App() {
  const [initialState] = useState(() => {
    let currentPool = INITIAL_POOL_SOURCE;
    const wordsList = INITIAL_SENTENCE_TEXT.split(' ').filter(w => w.length > 0);
    const initialWords = wordsList.map((word, index) => ({ id: index + 1, text: word }));

    for (const word of wordsList) {
      for (const char of word) {
        const newPool = updatePoolRemove(currentPool, char);
        if (newPool !== null) {
          currentPool = newPool;
        }
      }
    }

    return {
      words: initialWords,
      pool: shuffleString(currentPool)
    };
  });

  const [words, setWords] = useState<Array<{ id: number; text: string; isEditing?: boolean; isDestroyed?: boolean }>>(initialState.words);
  const [letterPool, setLetterPool] = useState(initialState.pool);
  const [deletedWords, setDeletedWords] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [savedSentences, setSavedSentences] = useState<string[]>([]);

  useEffect(() => {
    setSavedSentences(getSavedSentencesFromCookie());
  }, []);

  const handleSaveSentence = () => {
    const sentence = words.map(w => w.text).join(' ').trim();
    if (!sentence) return;

    setSavedSentences(prev => {
      if (prev.includes(sentence)) return prev;
      const newSentences = [sentence, ...prev];
      saveSentencesToCookie(newSentences);
      return newSentences;
    });
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

  const getSuggestedWords = (wordList: string[], pool: string) => {
    const validWords = [];
    for (const word of wordList) {
      if (canFormWord(word, pool)) {
        validWords.push(word);
        if (validWords.length >= 30) break;
      }
    }
    return validWords;
  };

  const suggestedWords = useMemo(() => {
    return getSuggestedWords(ALLOWED_WORDS, letterPool);
  }, [letterPool]);

  const suggestedEndWords = useMemo(() => {
    return getSuggestedWords(ALLOWED_END_WORDS, letterPool);
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

  const handleLoadSentence = (newSentence: string) => {
    let totalPool = letterPool;
    words.forEach(w => {
      for (const char of w.text) {
        totalPool = updatePoolAdd(totalPool, char);
      }
    });

    let tempPool = totalPool;
    const newWordsList = newSentence.split(' ').filter(w => w.length > 0);

    for (const word of newWordsList) {
      for (const char of word) {
        const res = updatePoolRemove(tempPool, char);
        if (res === null) {
          alert(`Not enough letters to form "${newSentence}"! Missing: ${char}`);
          return;
        }
        tempPool = res;
      }
    }

    const newWordsState = newWordsList.map((word, index) => ({
      id: index + 1,
      text: word,
      isEditing: false
    }));

    setWords(newWordsState);
    setLetterPool(tempPool.replace(/ /g, ''));
  };

  const handleDeleteSavedSentence = (sentenceToDelete: string) => {
    setSavedSentences(prev => {
      const newSentences = prev.filter(s => s !== sentenceToDelete);
      saveSentencesToCookie(newSentences);
      return newSentences;
    });
  };

  const sensors = useSensors(
      useSensor(MouseSensor),
      useSensor(TouchSensor, {
          activationConstraint: {
              delay: 250,
              tolerance: 5,
          },
      }),
  );

  const dropAnimation: DropAnimation = {
      sideEffects: defaultDropAnimationSideEffects({
          styles: {
              active: {
                  opacity: '0.5',
              },
          },
      }),
  };

  return (
    <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
    >
      <div className="app">
        <div className="content-wrapper">
          <SentenceBuilder
            words={words}
            activeId={activeId}
            onWordUpdate={handleWordUpdate}
            onWordCommit={handleWordCommit}
          />

          <div className="input-section">
            <div className="button-container">
            <button className="add-word-btn" onClick={handleAddWord}>+</button>
            <button className="save-btn" onClick={handleSaveSentence} title="Save Sentence">
              💾
            </button>
            <TrashDropZone />
          </div>
          <LetterPool letterPool={letterPool} />
          <SuggestionColumns
            deletedWords={deletedWords}
            suggestedWords={suggestedWords}
            suggestedEndWords={suggestedEndWords}
            onDeletedWordClick={handleDeletedWordClick}
            onSuggestedClick={handleSuggestedClick}
          />
          <SavedSentencesList
            sentences={savedSentences}
            onSelect={handleLoadSentence}
            onDelete={handleDeleteSavedSentence}
          />
        </div>
      </div>
    </div>
    <DragOverlay dropAnimation={dropAnimation}>
        {activeId ? (
            <div className="word-chip" style={{ cursor: 'grabbing' }}>
                {words.find(w => w.id === activeId)?.text}
            </div>
        ) : null}
    </DragOverlay>
    </DndContext>
  );
}

export default App;
