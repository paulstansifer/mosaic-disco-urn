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
import SavedSentencesList, { type SavedSentence } from './SavedSentencesList';

const ALLOWED_WORDS = allowedWordsRaw.split('\n').map(w => w.trim()).filter(w => w.length > 0);
const ALLOWED_END_WORDS = allowedEndWordsRaw.split('\n').map(w => w.trim()).filter(w => w.length > 0);

const INITIAL_POOL_SOURCE = "ttttttttttttooooooooooeeeeeeeeaaaaaaallllllnnnnnnuuuuuuiiiiisssssdddddhhhhhyyyyyIIIrrrfffbbwwkcmvg:,!!";
const INITIAL_SENTENCE_TEXT = "I !!";

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

const getSavedSentencesFromCookie = (): SavedSentence[] => {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${COOKIE_NAME}=`);
    if (parts.length === 2) {
      const cookieVal = parts.pop()?.split(';').shift();
      if (cookieVal) {
        const parsed = JSON.parse(decodeURIComponent(cookieVal));
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => {
            if (typeof item === 'string') {
              return { text: item, pool: '' };
            }
            return item;
          });
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse saved sentences cookie", e);
  }
  return [];
};

const saveSentencesToCookie = (sentences: SavedSentence[]) => {
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
  const [savedSentences, setSavedSentences] = useState<SavedSentence[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ messages: string[], invalidIds: Set<number> }>({ messages: [], invalidIds: new Set() });

  useEffect(() => {
    const validateSentence = () => {
      const newErrors: string[] = [];
      const newInvalidIds = new Set<number>();

      // Rule: First word must be "I"
      const firstWord = words[0];
      if (!firstWord || firstWord.text !== "I") {
        newErrors.push("The first word must be 'I'.");
        if (firstWord) newInvalidIds.add(firstWord.id);
      }

      // Rule: Every word must be a valid word
      const punctuation = new Set([':', ',', '!!', 'I']);
      words.forEach(word => {
        if (!punctuation.has(word.text) && !ALLOWED_WORDS.includes(word.text.toLowerCase()) && !ALLOWED_END_WORDS.includes(word.text.toLowerCase())) {
          newErrors.push(`"${word.text}" is not a valid word.`);
          newInvalidIds.add(word.id);
        }
      });

      // Rule 1: There must be one eight-letter word.
      const eightLetterWords = words.filter(w => w.text.length === 8);
      if (eightLetterWords.length !== 1) {
        newErrors.push("There must be exactly one eight-letter word.");
        eightLetterWords.forEach(w => newInvalidIds.add(w.id));
      }

      // Rule 2: The eight-letter word must be adjacent to "fundamental".
      if (eightLetterWords.length === 1) {
        const eightLetterWord = eightLetterWords[0];
        const eightLetterIndex = words.findIndex(w => w.id === eightLetterWord.id);
        const fundamentalIndex = words.findIndex(w => w.text === "fundamental");

        if (fundamentalIndex === -1) {
          newErrors.push("The word 'fundamental' is missing.");
        } else if (Math.abs(eightLetterIndex - fundamentalIndex) !== 1) {
          newErrors.push("The eight-letter word must be next to 'fundamental'.");
          newInvalidIds.add(eightLetterWord.id);
          const fundamentalWord = words[fundamentalIndex];
          if (fundamentalWord) newInvalidIds.add(fundamentalWord.id);
        }
      }

      // Rule 3: "!!" must be at the end.
      const lastWord = words[words.length - 1];
      if (!lastWord || lastWord.text !== "!!") {
        newErrors.push("'!!' must be at the very end of the sentence.");
        if (words.find(w => w.text === "!!")) {
          const bangWord = words.find(w => w.text === "!!");
          if (bangWord) newInvalidIds.add(bangWord.id);
        }
      }

      // Rule 4: The word before "!!" must end in "w".
      if (lastWord && lastWord.text === "!!") {
        const secondToLastWord = words[words.length - 2];
        if (!secondToLastWord || !secondToLastWord.text.endsWith("w")) {
          newErrors.push("The word before '!!' must end in 'w'.");
          if (secondToLastWord) newInvalidIds.add(secondToLastWord.id);
        }
      }

      // Rule 5: ":" must come before ",".
      const colonIndex = words.findIndex(w => w.text === ":");
      const commaIndex = words.findIndex(w => w.text === ",");

      if (colonIndex !== -1 && commaIndex !== -1 && colonIndex > commaIndex) {
        newErrors.push("':' must come before ','.");
        const colonWord = words[colonIndex];
        const commaWord = words[commaIndex];
        if (colonWord) newInvalidIds.add(colonWord.id);
        if (commaWord) newInvalidIds.add(commaWord.id);
      }

      setValidationErrors({ messages: newErrors, invalidIds: newInvalidIds });
    };

    validateSentence();
  }, [words]);

  useEffect(() => {
    const poolCount = letterPool.replace(/ /g, '').length;
    const sentenceCount = words.reduce((acc, w) => acc + w.text.replace(/ /g, '').length, 0);
    const total = poolCount + sentenceCount;

    if (total !== 102) {
      console.error(`Invariant failed: Total characters is ${total}, expected 102.`);
    }
  }, [letterPool, words]);

  useEffect(() => {
    setSavedSentences(getSavedSentencesFromCookie());
  }, []);

  const handleSaveSentence = () => {
    let sentenceText = words.map(w => w.text).join(' ').trim();
    // Remove spaces before punctuation
    sentenceText = sentenceText.replace(/\s+([,:]|!!)/g, '$1');

    if (!sentenceText) return;

    const sortedPool = letterPool.replace(/ /g, '').split('').sort().join('');

    setSavedSentences(prev => {
      if (prev.some(s => s.text === sentenceText)) return prev;
      const newEntry: SavedSentence = { text: sentenceText, pool: sortedPool };
      const newSentences = [newEntry, ...prev];
      saveSentencesToCookie(newSentences);
      return newSentences;
    });
  };

  const getInsertionIndex = (currentWords: typeof words) => {
    const bangIndex = currentWords.findIndex(w => w.text === "!!");
    if (bangIndex === -1) return currentWords.length;

    const wordBeforeBang = currentWords[bangIndex - 1];
    if (wordBeforeBang && wordBeforeBang.text.endsWith("w")) {
      return Math.max(0, bangIndex - 1);
    }
    return bangIndex;
  };

  const handleAddWord = () => {
    setWords(prev => {
      const newId = Math.max(0, ...prev.map(w => w.id)) + 1;
      const insertIdx = getInsertionIndex(prev);
      const newWords = [...prev];
      newWords.splice(insertIdx, 0, { id: newId, text: '', isEditing: true });
      return newWords;
    });
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
    const parts = newText.split(/((?:[,:]|!!|\s+))/).filter(p => p.length === 0 || p.trim().length > 0);
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
      const destroyedWords = words.filter(w => wordsToDestroyIds.has(w.id));
      setDeletedWords(prev => {
        const newTexts = destroyedWords
          .map(w => w.text)
          .filter(t => t.trim().length > 0);
        const combined = [...newTexts, ...prev];
        const unique = Array.from(new Set(combined));
        return unique.slice(0, 20);
      });

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

    const index = words.indexOf(wordToDelete);
    const isFirstI = index === 0 && wordToDelete.text === 'I';
    const isLastBang = index === words.length - 1 && wordToDelete.text === '!!';

    if (isFirstI || isLastBang) return;

    // Add to deleted stack
    if (wordToDelete.text.trim().length > 0) {
      setDeletedWords(prev => {
        const combined = [wordToDelete.text, ...prev];
        const unique = Array.from(new Set(combined));
        return unique.slice(0, 20);
      });
    }

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
          const insertIdx = getInsertionIndex(updated);
          updated.splice(insertIdx, 0, { id: newId, text: '', isEditing: true });
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

      // 1. Reclaim all letters from current words
      let currentPool = letterPool;
      words.forEach(w => {
        if (!w.isDestroyed) {
          for (const char of w.text) {
            currentPool = updatePoolAdd(currentPool, char);
          }
        }
      });

      // 2. Process pasted text
      const parts = text.split(/((?:[,:]|!!|\s+))/).filter(p => p.trim().length > 0);
      const newWordsToAdd: { id: number, text: string, isEditing: boolean }[] = [];

      // 3. Form new words
      let nextId = 1;

      for (const part of parts) {
        let formed = '';
        for (const char of part) {
          const poolAfterRemove = updatePoolRemove(currentPool, char);
          if (poolAfterRemove !== null) {
            currentPool = poolAfterRemove;
            formed += char;
          }
          // If we can't find the char, we skip it (best effort paste)
        }

        if (formed.length > 0) {
          newWordsToAdd.push({
            id: nextId++,
            text: formed,
            isEditing: false
          });
        }
      }

      // 4. Update state
      if (newWordsToAdd.length > 0) {
        setLetterPool(currentPool);
        setWords(newWordsToAdd);
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
    setWords(prev => {
      const newId = Math.max(0, ...prev.map(w => w.id)) + 1;
      const insertIdx = getInsertionIndex(prev);
      const newWords = [...prev];
      newWords.splice(insertIdx, 0, { id: newId, text: word, isEditing: false });
      return newWords;
    });

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
    setWords(prev => {
      const newId = Math.max(0, ...prev.map(w => w.id)) + 1;
      const insertIdx = getInsertionIndex(prev);
      const newWords = [...prev];
      newWords.splice(insertIdx, 0, { id: newId, text: word, isEditing: false });

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
      if (w.isDestroyed) return;
      for (const char of w.text) {
        totalPool = updatePoolAdd(totalPool, char);
      }
    });

    let tempPool = totalPool;
    const newWordsList = newSentence.split(/((?:[,:]|!!|\s+))/).filter(w => w.trim().length > 0);

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
      const newSentences = prev.filter(s => s.text !== sentenceToDelete);
      saveSentencesToCookie(newSentences);
      return newSentences;
    });
  };

  const handleClearAll = () => {
    let newPool = letterPool;

    // Return all letters from current words to the pool
    words.forEach(w => {
      if (w.isDestroyed) return;
      for (const char of w.text) {
        newPool = updatePoolAdd(newPool, char);
      }
    });

    // Define the reset state
    const resetWords = [
      { id: 1, text: "I", isEditing: false },
      { id: 2, text: "!!", isEditing: false }
    ];

    // Consume letters for the reset words
    for (const w of resetWords) {
      for (const char of w.text) {
        const updated = updatePoolRemove(newPool, char);
        if (updated !== null) {
          newPool = updated;
        }
      }
    }

    setWords(resetWords);
    setLetterPool(newPool.replace(/ /g, ''));
  };

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 0,
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
            invalidIds={validationErrors.invalidIds}
            onWordUpdate={handleWordUpdate}
            onWordCommit={handleWordCommit}
          />
          <div className="validation-errors">
            {validationErrors.messages.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>

          <div className="input-section">
            <div className="button-container">
              <button className="add-word-btn" onClick={handleAddWord}>+</button>
              <button className="save-btn" onClick={handleSaveSentence} title="Save Sentence">
                💾
              </button>
              <TrashDropZone />
              <button className="clear-btn" onClick={handleClearAll} title="Clear All">
                🧹
              </button>
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
          <div className="about">
            <hr />
            <a href="https://qwantz.com">Dinosaur Comics</a> is a long-running webcomic by Ryan North. In 2010, the <a href="https://www.qwantz.com/index.php?comic=1663">1663rd comic</a> discussed the way that some scientists used to use anagrams as a sort of <a href="https://en.wikipedia.org/wiki/Commitment_scheme">commitment scheme</a> to claim priority on good ideas. But the punchline to the comic was given in anagram form. Fans of the comic tried to unscramble it, and Ryan North later provided some <a href="https://www.qwantz.com/index.php?comic=1665">hints</a> to narrow the search space. (The fact that the 11-letter word is "fundamental" is not listed there; I'm pretty sure Ryan North tweeted it, but he regularly deleted old tweets back then, so I have no direct evidence!)
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
