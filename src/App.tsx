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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import allowedWordsRaw from './allowed_words.txt?raw';
import allowedEndWordsRaw from './allowed_end_words.txt?raw';
import LetterPool from './LetterPool';
import SuggestionColumns from './SuggestionColumns';
import SentenceBuilder from './SentenceBuilder';
import SavedSentencesList, { type SavedSentence } from './SavedSentencesList';
import LoginButton from './LoginButton';
import { useAuth } from './AuthContext';
import { db, isFirebaseConfigured } from './firebase';

const ALLOWED_WORDS = allowedWordsRaw.split('\n').map(w => w.trim()).filter(w => w.length > 0);
const ALLOWED_END_WORDS = allowedEndWordsRaw.split('\n').map(w => w.trim()).filter(w => w.length > 0);

const INITIAL_POOL_SOURCE = "ttttttttttttooooooooooeeeeeeeeaaaaaaallllllnnnnnnuuuuuuiiiiisssssdddddhhhhhyyyyyIIIrrrfffbbwwkcmvg:,!!";
const INITIAL_SENTENCE_TEXT = "I !!";

const TIE_GROUPS: string[][] = (() => {
  const counts: Record<string, number> = {};
  const firstPos: Record<string, number> = {};
  for (let i = 0; i < INITIAL_POOL_SOURCE.length; i++) {
    const char = INITIAL_POOL_SOURCE[i];
    counts[char] = (counts[char] || 0) + 1;
    if (!(char in firstPos)) firstPos[char] = i;
  }
  const groups: Record<number, string[]> = {};
  // Only include letters and common punctuation in the theory of ties
  const validChars = Object.keys(counts).filter(c => /[a-zA-Z]/.test(c));
  validChars.forEach(c => {
    const n = counts[c];
    if (!groups[n]) groups[n] = [];
    groups[n].push(c);
  });
  return Object.values(groups).filter(g => g.length > 1);
})();

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

const maybeAddExclamationPoints = (sentence: string, pool: string) => {
  const remaining = pool.replace(/ /g, '');
  if (remaining.length > 0 && remaining.split('').every(c => c === '!')) {
    if (sentence.endsWith('!!')) return sentence;
    const needsSpace = !sentence.endsWith(' ') && !sentence.endsWith('!');
    return sentence + (needsSpace ? ' ' : '') + remaining;
  }
  return sentence;
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
      title="Drag a word here to delete it"
    >
      <span className="material-icons-outlined">delete</span>
    </div>
  );
}

const getInsertionIndex = (currentWords: Array<{ id: number | string; text: string; isEditing?: boolean; isDestroyed?: boolean }>) => {
  const bangIndex = currentWords.findIndex(w => w.text === "!!");
  if (bangIndex === -1) return currentWords.length;

  const wordBeforeBang = currentWords[bangIndex - 1];
  if (wordBeforeBang && wordBeforeBang.text.endsWith("w")) {
    return Math.max(0, bangIndex - 1);
  }
  return bangIndex;
};

function App() {
  const { user } = useAuth();
  const [initialState] = useState(() => {
    let currentPool = INITIAL_POOL_SOURCE;
    let sentenceText = INITIAL_SENTENCE_TEXT;

    if (window.location.hash) {
      try {
        const decoded = decodeURIComponent(window.location.hash.substring(1)).replace(/_/g, ' ');
        // Verify we can form this sentence
        let tempPool = INITIAL_POOL_SOURCE;
        let possible = true;
        // Simple check: can we remove all chars?
        for (const char of decoded) {
          if (char === ' ') continue;
          const res = updatePoolRemove(tempPool, char);
          if (res === null) {
            possible = false;
            break;
          }
          tempPool = res;
        }

        if (possible) {
          sentenceText = maybeAddExclamationPoints(decoded, tempPool);
        }
      } catch (e) {
        console.error("Failed to parse initial sentence from hash", e);
      }
    }

    const wordsList = sentenceText.split(/((?:[,:]|!!|\s+))/).filter(w => w.trim().length > 0);
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

  const [words, setWords] = useState<Array<{ id: number | string; text: string; isEditing?: boolean; isDestroyed?: boolean }>>(initialState.words);
  const [letterPool, setLetterPool] = useState(initialState.pool);
  const [deletedWords, setDeletedWords] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<number | string | null>(null);
  const [savedSentences, setSavedSentences] = useState<SavedSentence[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ messages: string[], invalidIds: Set<number | string> }>({ messages: [], invalidIds: new Set() });
  const [hasInteracted, setHasInteracted] = useState(false);
  const [caretIndex, setCaretIndex] = useState<number>(() => getInsertionIndex(initialState.words));

  const isConsistentWithTheoryOfTies = useMemo(() => {
    // Collect all characters from current words in order
    const characters: { char: string, index: number }[] = [];
    let charIndex = 0;
    for (const word of words) {
      if (word.isDestroyed) continue;
      // Use original casing for comparison as the pool has both 'I' and 'i'
      for (const char of word.text) {
        characters.push({ char, index: charIndex++ });
      }
    }

    if (characters.length === 0) return false;

    // Map each character to its first appearance index
    const firstAppearances = new Map<string, number>();
    for (const item of characters) {
      if (!firstAppearances.has(item.char)) {
        firstAppearances.set(item.char, item.index);
      }
    }

    for (const group of TIE_GROUPS) {
      let lastAppearanceIndex = -1;
      let missingLetterInGroup = false;

      for (const char of group) {
        const firstIdx = firstAppearances.get(char);

        if (firstIdx === undefined) {
          missingLetterInGroup = true;
        } else {
          if (missingLetterInGroup) {
            return false;
          }
          if (firstIdx < lastAppearanceIndex) {
            return false;
          }
          lastAppearanceIndex = firstIdx;
        }
      }
    }
    return true;
  }, [words]);

  const sentenceItems = useMemo(() => {
    const isEditingAny = words.some(w => w.isEditing);
    if (isEditingAny) return words;

    const items = [...words];
    items.splice(caretIndex, 0, { id: 'caret', text: '', isCaret: true } as any);
    return items;
  }, [words, caretIndex]);

  useEffect(() => {
    const validateSentence = () => {
      const newErrors: string[] = [];
      const newInvalidIds = new Set<number | string>();

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

      const fundamentalIndex = words.findIndex(w => w.text === "fundamental");
      if (fundamentalIndex === -1) {
        newErrors.push("The word 'fundamental' must be present.");
      } else {
        // Rule 2: The eight-letter word must be adjacent to "fundamental".
        if (eightLetterWords.length === 1) {
          const eightLetterWord = eightLetterWords[0];
          const eightLetterIndex = words.findIndex(w => w.id === eightLetterWord.id);

          if (Math.abs(eightLetterIndex - fundamentalIndex) !== 1) {
            newErrors.push("The eight-letter word must be next to 'fundamental'.");
            newInvalidIds.add(eightLetterWord.id);
            const fundamentalWord = words[fundamentalIndex];
            if (fundamentalWord) newInvalidIds.add(fundamentalWord.id);
          }
        }
      }

      // Rule 3: "!!" must be at the end.
      const lastWord = words[words.length - 1];
      if (!lastWord || lastWord.text !== "!!") {
        newErrors.push("The punchline must end with '!!'");
        const bangWord = words.find(w => w.text === "!!");
        if (bangWord) newInvalidIds.add(bangWord.id);
      }

      // Rule 4: The word before "!!" must end in "w".
      if (lastWord && lastWord.text === "!!") {
        const secondToLastWord = words[words.length - 2];
        if (!secondToLastWord || !secondToLastWord.text.endsWith("w")) {
          newErrors.push("The last word must end in 'w'.");
          if (secondToLastWord) newInvalidIds.add(secondToLastWord.id);
        }
      }

      // Rule 5: ":" must come before ",".
      const colonIndex = words.findIndex(w => w.text === ":");
      const commaIndex = words.findIndex(w => w.text === ",");

      if (colonIndex !== -1 && commaIndex !== -1 && colonIndex > commaIndex) {
        newErrors.push("The colon must come before the comma.");
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

  useEffect(() => {
    if (!user || !db) return;

    const syncFromFirestore = async () => {
      const docRef = doc(db!, 'users', user.uid);
      const snap = await getDoc(docRef);
      const firestoreSentences: SavedSentence[] = snap.exists()
        ? (snap.data().sentences ?? [])
        : [];

      const localSentences = getSavedSentencesFromCookie();
      const merged = [...firestoreSentences];
      for (const s of localSentences) {
        if (!merged.some(m => m.text === s.text)) {
          merged.push(s);
        }
      }

      setSavedSentences(merged);
      saveSentencesToCookie(merged);
      await setDoc(docRef, { sentences: merged });
    };

    syncFromFirestore().catch(console.error);
  }, [user]);

  const syncToFirestore = (sentences: SavedSentence[]) => {
    if (!user || !db) return;
    setDoc(doc(db!, 'users', user.uid), { sentences }).catch(console.error);
  };

  const handleSaveSentence = () => {
    let sentenceText = words.map(w => w.text).join(' ').trim();
    sentenceText = sentenceText.replace(/\s+([,:]|!!)/g, '$1');

    if (!sentenceText) return;
    if (savedSentences.some(s => s.text === sentenceText)) return;

    const sortedPool = letterPool.replace(/ /g, '').split('').sort().join('');
    const newEntry: SavedSentence = { text: sentenceText, pool: sortedPool };
    const newSentences = [newEntry, ...savedSentences];

    setSavedSentences(newSentences);
    saveSentencesToCookie(newSentences);
    syncToFirestore(newSentences);
  };

  const handleAddWord = () => {
    setHasInteracted(true);
    setWords(prev => {
      const numericIds = prev.map(w => typeof w.id === 'number' ? w.id : 0);
      const newId = Math.max(0, ...numericIds) + 1;
      const insertIdx = caretIndex;
      const newWords = [...prev];
      newWords.splice(insertIdx, 0, { id: newId, text: '', isEditing: true });
      return newWords;
    });
    setCaretIndex(prev => prev + 1);
  };

  const handleWordUpdate = (id: number | string, newText: string) => {
    const wordIndex = words.findIndex(w => w.id === id);
    if (wordIndex === -1) return;
    const oldText = words[wordIndex].text;

    // 1. Return old letters to a temporary pool
    let currentPool = letterPool;
    for (const char of oldText) {
      currentPool = updatePoolAdd(currentPool, char);
    }

    const wordsToDestroyIds = new Set<number | string>();
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
          let stolenId: number | string = -1;
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
      // Skip empty parts resulting from multiple spaces
      if (i > 0 && part === "") continue;

      const formed = formString(part);
      processedParts.push({ text: formed, isNew: i > 0 });
    }

    // Filter out empty parts, but keep if it's the only part (for the current editing word)
    const finalParts = processedParts.filter((p, i) => p.text.length > 0 || (i === 0 && processedParts.length === 1));

    // Apply updates to state
    setLetterPool(currentPool);

    setWords(prev => {
      const newWords = [...prev];
      const idx = newWords.findIndex(w => w.id === id);
      if (idx === -1) return prev;

      const replacements: typeof words = [];
      const numericIds = newWords.map(w => typeof w.id === 'number' ? w.id : 0);
      let nextId = Math.max(0, ...numericIds) + 1;

      if (finalParts.length > 0) {
        // The first part updates the existing word
        replacements.push({
          ...newWords[idx],
          text: finalParts[0].text,
          isEditing: finalParts.length === 1 && processedParts.length === 1
        });

        // Subsequent parts become new words
        for (let i = 1; i < finalParts.length; i++) {
          replacements.push({
            id: nextId++,
            text: finalParts[i].text,
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
        // Fallback for safety
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

    // Adjust caret position for added and destroyed words
    const addedWordsCount = finalParts.length - 1;
    const wordsToDestroy = words.filter(w => wordsToDestroyIds.has(w.id));
    const destroyedBeforeCaretCount = wordsToDestroy.filter(w => {
      const idx = words.indexOf(w);
      return idx !== -1 && idx < caretIndex;
    }).length;

    const totalShift = (wordIndex < caretIndex ? addedWordsCount : 0) - destroyedBeforeCaretCount;
    if (totalShift !== 0) {
      setCaretIndex(prev => Math.max(0, prev + totalShift));
    }

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

  const handleDestroyWord = (id: number | string) => {
    const index = words.findIndex(w => w.id === id);
    if (index !== -1 && index < caretIndex) {
      setCaretIndex(prev => Math.max(0, prev - 1));
    }
    setWords(prev => prev.map(w => w.id === id ? { ...w, isDestroyed: true } : w));
    setTimeout(() => {
      setWords(prev => prev.filter(w => w.id !== id));
    }, 500); // Animation duration
  };

  const handleWordDelete = (id: number | string) => {
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

  const handleWordCommit = (id: number | string) => {
    const index = words.findIndex(w => w.id === id);
    if (index === -1) return;
    const word = words[index];
    if (word && word.text.trim().length === 0) {
      handleDestroyWord(id);
    } else {
      setWords(prev => prev.map(w => w.id === id ? { ...w, isEditing: false } : w));
      setCaretIndex(index + 1);
    }
  };

  const handleWordBackspaceEmpty = (id: number | string) => {
    const wordIndex = words.findIndex(w => w.id === id);
    if (wordIndex === -1) return;

    const prevWordId = (wordIndex > 0) ? words[wordIndex - 1].id : null;
    const isPrevFirstI = (wordIndex === 1 && words[0].text === 'I');

    handleDestroyWord(id);

    if (prevWordId && !isPrevFirstI) {
      const prevWord = words[wordIndex - 1];
      const newText = prevWord.text.slice(0, -1);
      handleWordUpdate(prevWord.id, newText);
      setWords(prev => prev.map(w => w.id === prevWordId ? { ...w, isEditing: true } : w));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string | number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && over.id === 'trash-drop-zone') {
      if (active.id !== 'caret') {
        handleWordDelete(active.id);
      }
      return;
    }

    if (over && active.id === 'caret') {
      const overIndex = sentenceItems.findIndex((item) => item.id === over.id);
      if (overIndex !== -1) {
        setCaretIndex(overIndex);
      } else if (over.id === 'caret-end') {
        setCaretIndex(words.length);
      }
      return;
    }

    if (over && active.id !== over.id) {
      const oldIndex = sentenceItems.findIndex((item) => item.id === active.id);
      const newIndex = sentenceItems.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const newUnifiedOrder = arrayMove(sentenceItems, oldIndex, newIndex);

      // Separate the caret back out
      const newCaretIdx = newUnifiedOrder.findIndex(item => (item as any).isCaret);
      const newWords = newUnifiedOrder.filter(item => !(item as any).isCaret) as typeof words;

      setWords(newWords);
      if (newCaretIdx !== -1) {
        setCaretIndex(newCaretIdx);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isEditingAny = words.some(w => w.isEditing);
      if (isEditingAny) return;

      if (e.key === 'Enter') {
        setLetterPool(prev => shuffleString(prev.replace(/ /g, '')));
      } else if (e.key === ' ') {
        setHasInteracted(true);
        e.preventDefault();
        setWords(prev => {
          const updated = prev.map(w => w.isEditing ? { ...w, isEditing: false } : w);
          const numericIds = updated.map(w => typeof w.id === 'number' ? w.id : 0);
          const newId = Math.max(0, ...numericIds) + 1;
          const insertIdx = caretIndex;
          updated.splice(insertIdx, 0, { id: newId, text: '', isEditing: true });
          return updated;
        });
        setCaretIndex(prev => prev + 1);
      } else if (e.key === 'Backspace') {
        if (caretIndex > 0) {
          const wordToEdit = words[caretIndex - 1];
          if (wordToEdit) {
            const index = caretIndex - 1;
            const isFirstI = index === 0 && wordToEdit.text === 'I';
            const isLastBang = index === words.length - 1 && wordToEdit.text === '!!';

            if (!isFirstI && !isLastBang) {
              e.preventDefault();
              const newText = wordToEdit.text.slice(0, -1);
              handleWordUpdate(wordToEdit.id, newText);
              setWords(prev => prev.map(w => w.id === wordToEdit.id ? { ...w, isEditing: true } : w));
            }
          }
        }
      } else if (e.key.length === 1 && /^[a-zA-Z,:]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const char = e.key;
        // Try to take the character from the pool
        const poolRes = updatePoolRemove(letterPool, char);
        if (poolRes !== null) {
          e.preventDefault();
          setHasInteracted(true);
          setLetterPool(poolRes);
          setWords(prev => {
            const updated = prev.map(w => w.isEditing ? { ...w, isEditing: false } : w);
            const numericIds = updated.map(w => typeof w.id === 'number' ? w.id : 0);
            const newId = Math.max(0, ...numericIds) + 1;
            const insertIdx = caretIndex;
            updated.splice(insertIdx, 0, { id: newId, text: char, isEditing: true });
            return updated;
          });
          setCaretIndex(prev => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        setCaretIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCaretIndex(prev => Math.min(words.length, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [words, caretIndex]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
        return;
      }

      e.preventDefault();
      const text = e.clipboardData?.getData('text');
      if (!text) return;

      let currentPool = letterPool;
      words.forEach(w => {
        if (!w.isDestroyed) {
          for (const char of w.text) {
            currentPool = updatePoolAdd(currentPool, char);
          }
        }
      });

      const parts = text.split(/((?:[,:]|!!|\s+))/).filter(p => p.trim().length > 0);
      const newWordsToAdd: { id: number, text: string, isEditing: boolean }[] = [];

      let nextId = 1;

      for (const part of parts) {
        let formed = '';
        for (const char of part) {
          const poolAfterRemove = updatePoolRemove(currentPool, char);
          if (poolAfterRemove !== null) {
            currentPool = poolAfterRemove;
            formed += char;
          }
        }

        if (formed.length > 0) {
          newWordsToAdd.push({
            id: nextId++,
            text: formed,
            isEditing: false
          });
        }
      }

      if (newWordsToAdd.length > 0) {
        setLetterPool(currentPool);
        setWords(newWordsToAdd);
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
        if (validWords.length >= 90) break;
      }
    }
    return validWords;
  }, [letterPool]);

  const suggestedEndWords = useMemo(() => {
    const validWords = [];
    for (const word of ALLOWED_END_WORDS) {
      if (canFormWord(word, letterPool)) {
        validWords.push(word);
        if (validWords.length >= 30) break;
      }
    }
    return validWords;
  }, [letterPool]);

  const handleSuggestedClick = (word: string) => {
    setWords(prev => {
      const numericIds = prev.map(w => typeof w.id === 'number' ? w.id : 0);
      const newId = Math.max(0, ...numericIds) + 1;
      const insertIdx = caretIndex;
      const newWords = [...prev];
      newWords.splice(insertIdx, 0, { id: newId, text: word, isEditing: false });
      return newWords;
    });
    setCaretIndex(prev => prev + 1);

    let newPool = letterPool;
    for (const char of word) {
      const updated = updatePoolRemove(newPool, char);
      if (updated !== null) {
        newPool = updated;
      }
    }
    setLetterPool(newPool);
  };

  const handleDeletedWordClick = (word: string) => {
    let currentPool = letterPool;
    const wordsToDestroyIds = new Set<number | string>();

    for (const char of word) {
      const poolAfterRemove = updatePoolRemove(currentPool, char);

      if (poolAfterRemove !== null) {
        currentPool = poolAfterRemove;
      } else {
        let stolenId: number | string = -1;
        for (let i = words.length - 1; i >= 0; i--) {
          if (!wordsToDestroyIds.has(words[i].id) && words[i].text.includes(char)) {
            stolenId = words[i].id;
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
        } else {
          return;
        }
      }
    }

    setWords(prev => {
      const numericIds = prev.map(w => typeof w.id === 'number' ? w.id : 0);
      const newId = Math.max(0, ...numericIds) + 1;
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

    // Adjust caret for stolen words and new insertion
    const wordsToDestroy = words.filter(w => wordsToDestroyIds.has(w.id));
    const destroyedBeforeCaretCount = wordsToDestroy.filter(w => {
      const idx = words.indexOf(w);
      return idx !== -1 && idx < caretIndex;
    }).length;

    const insertIdx = getInsertionIndex(words);
    const addedBeforeCaret = insertIdx <= caretIndex;
    const totalShift = (addedBeforeCaret ? 1 : 0) - destroyedBeforeCaretCount;

    if (totalShift !== 0) {
      setCaretIndex(prev => Math.max(0, prev + totalShift));
    }

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
    let finalSentence = newSentence;

    // Preliminary check to see if we can form the original sentence
    let prelimPool = totalPool;
    let possible = true;
    for (const char of newSentence) {
      if (char === ' ') continue;
      const res = updatePoolRemove(prelimPool, char);
      if (res === null) {
        possible = false;
        break;
      }
      prelimPool = res;
    }

    if (possible) {
      finalSentence = maybeAddExclamationPoints(newSentence, prelimPool);
    }

    const newWordsList = finalSentence.split(/((?:[,:]|!!|\s+))/).filter(w => w.trim().length > 0);

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
    const newSentences = savedSentences.filter(s => s.text !== sentenceToDelete);
    setSavedSentences(newSentences);
    saveSentencesToCookie(newSentences);
    syncToFirestore(newSentences);
  };

  const handleShare = async () => {
    let sentenceText = words.map(w => w.text).join(' ').trim();
    sentenceText = sentenceText.replace(/\s+([,:]|!!)/g, '$1');
    const shareText = sentenceText.replace(/!!$/, '').trim().replace(/ /g, '_');
    const url = `${window.location.origin}${window.location.pathname}#${encodeURIComponent(shareText)}`;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for environments without clipboard API or when it's not available
        console.warn('Clipboard API not available');
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleCopyText = async () => {
    let sentenceText = words.map(w => w.text).join(' ').trim();
    sentenceText = sentenceText.replace(/\s+([,:]|!!)/g, '$1');
    try {
      await navigator.clipboard.writeText(sentenceText);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleShuffle = () => {
    setLetterPool(prev => shuffleString(prev.replace(/ /g, '')));
  };

  const handleClearAll = () => {
    let newPool = letterPool;
    words.forEach(w => {
      if (w.isDestroyed) return;
      for (const char of w.text) {
        newPool = updatePoolAdd(newPool, char);
      }
    });
    const resetWords = [
      { id: 1, text: "I", isEditing: false },
      { id: 2, text: "!!", isEditing: false }
    ];
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
    setCaretIndex(1);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 0, tolerance: 5 } })
  );

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0.5' } },
    }),
  };

  return (
    <div className="app">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="content-wrapper">
          {isFirebaseConfigured && <LoginButton />}
          <div className="main-sentence-row">
            <button className="add-word-side-btn" onClick={handleAddWord}>+</button>
            <SentenceBuilder
              items={sentenceItems}
              activeId={activeId}
              invalidIds={validationErrors.invalidIds}
              onWordUpdate={handleWordUpdate}
              onWordCommit={handleWordCommit}
              onWordBackspaceEmpty={handleWordBackspaceEmpty}
            />
            <TrashDropZone />
          </div>

          {validationErrors.messages.length > 0 && (
            <div className="validation-errors">
              {validationErrors.messages.map((error, idx) => (
                <div key={idx}>{error}</div>
              ))}
            </div>
          )}

          <div className="status-messages">
            {isConsistentWithTheoryOfTies && (
              <div className="theory-of-ties-note">
                Consistent with the {' '}
                <span className="theory-link" title="The 'theory of ties' suggests that for each letter frequency group in the original pool, the first appearance of each letter in the sentence should follow their relative order in that original string.">
                  'theory of ties'
                </span>.
              </div>
            )}
            {letterPool.replace(/ /g, '').length === 0 && validationErrors.messages.length === 0 && (
              <div className="solution-message">
                For all we know, that's the solution!
              </div>
            )}
          </div>

          <div className="input-section">
            <div className="button-container">
              <button className="save-btn" onClick={handleSaveSentence} title="Save sentence"><span className="material-icons-outlined">save</span></button>
              <button className="share-btn" onClick={handleShare} title="Copy link to sentence"><span className="material-icons-outlined">link</span></button>
              <button className="copy-text-btn" onClick={handleCopyText} title="Copy sentence text"><span className="material-icons-outlined">content_copy</span></button>
              <button className="clear-btn" onClick={handleClearAll} title="Clear all words"><span className="material-icons-outlined">delete_sweep</span></button>
            </div>
            {!hasInteracted && (
              <div className="interactive-hint" style={{ fontStyle: 'italic', marginTop: '1rem', color: '#666' }}>
                Click "+" or press the spacebar to write a new word
              </div>
            )}
            <div className="pool-area">
              <button className="shuffle-btn-portrait" onClick={handleShuffle} title="Shuffle letter pool"><span className="material-icons-outlined">shuffle</span></button>
              <LetterPool letterPool={letterPool} />
            </div>
          </div>

          <SuggestionColumns
            suggestedWords={suggestedWords}
            suggestedEndWords={suggestedEndWords}
            deletedWords={deletedWords}
            onSuggestedClick={handleSuggestedClick}
            onDeletedWordClick={handleDeletedWordClick}
          />

          <SavedSentencesList
            sentences={savedSentences}
            onDelete={handleDeleteSavedSentence}
            onSelect={handleLoadSentence}
          />

          <DragOverlay dropAnimation={dropAnimation}>
            {activeId ? (
              activeId === 'caret' ? (
                /* Caret preview - simplified */
                <div className="caret-container">
                  <svg width="14" height="20" viewBox="0 0 14 20" className="caret-svg">
                    <path d="M 7 0 L 14 7 L 14 20 L 0 20 L 0 7 Z" />
                  </svg>
                </div>
              ) : (
                <div className="word-chip">
                  {words.find((w) => w.id === activeId)?.text}
                </div>
              )
            ) : null}
          </DragOverlay>
          <div className="about">

            <p><a href="https://qwantz.com">Dinosaur Comics</a> is a long-running webcomic by Ryan North. In 2010, the <a href="https://www.qwantz.com/index.php?comic=1663">1663rd comic</a> discussed the way that some scientists used to use anagrams as a sort of <a href="https://en.wikipedia.org/wiki/Commitment_scheme">commitment scheme</a> to claim priority on good ideas. The punchline to the comic was given in anagram form, and Ryan North later provided some <a href="https://www.qwantz.com/index.php?comic=1665">hints</a> to narrow the search space, but the puzzle, known as the "Qwantzle", has remained unsolved for more than 15 years.</p>

            <p>"Mosaic Disco Urn" is an anagram of "Dinosaur Comics". It is inspired by <a href="https://cathode.church/@c9a">Ell Bradshaw</a>'s <a href="https://www.afifthofnothing.com/anacryptogram.html">implementation</a>, but I was lazy, and <a href="https://github.com/paulstansifer/mosaic-disco-urn"> it's mostly written by LLMs</a>. I feel bad about that, so here's a <a href="https://github.com/paulstansifer/mosaic-disco-urn/tree/main/public/3d-image/mosaic_disco_urn.pov">hand-made rendering of a mosaic disco urn</a>:</p>

            <p><center><img src="3d-image/mosaic_disco_urn.png" alt="a mosaic disco urn" /></center></p>
          </div>
        </div>
      </DndContext>
    </div>

  );
}

export default App;
