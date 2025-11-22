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

    if (newText.length > oldText.length) {
      // Character added
      let char = '';
      for (let i = 0; i < newText.length; i++) {
        if (newText[i] !== oldText[i]) {
          char = newText[i];
          break;
        }
      }
      if (!char) return;

      // Try to take from pool
      let newPool = updatePoolRemove(letterPool, char);

      if (newPool !== null) {
        setLetterPool(newPool);
        setWords(words.map(w => w.id === id ? { ...w, text: newText } : w));
      } else {
        // Steal logic
        const wordsCopy = [...words];
        let stolenIndex = -1;
        // Search reverse, excluding current
        for (let i = wordsCopy.length - 1; i >= 0; i--) {
          if (wordsCopy[i].id !== id && wordsCopy[i].text.includes(char)) {
            stolenIndex = i;
            break;
          }
        }

        if (stolenIndex !== -1) {
          const stolenWord = wordsCopy[stolenIndex];
          let tempPool = letterPool;
          // Return stolen letters
          for (const c of stolenWord.text) {
            tempPool = updatePoolAdd(tempPool, c);
          }
          // Take needed char
          tempPool = updatePoolRemove(tempPool, char)!;

          setLetterPool(tempPool);
          setWords(prev => prev.map(w => {
            if (w.id === stolenWord.id) {
              return { ...w, isDestroyed: true };
            }
            if (w.id === id) {
              return { ...w, text: newText };
            }
            return w;
          }));

          setTimeout(() => {
            setWords(prev => prev.filter(w => w.id !== stolenWord.id));
          }, 500);
        }
      }
    } else if (newText.length < oldText.length) {
      // Character removed
      let char = '';
      for (let i = 0; i < oldText.length; i++) {
        if (oldText[i] !== newText[i]) {
          char = oldText[i];
          break;
        }
      }
      if (char) {
        setLetterPool(prev => updatePoolAdd(prev, char));
        setWords(words.map(w => w.id === id ? { ...w, text: newText } : w));
      }
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
    // Add word back to words list
    const newId = Math.max(0, ...words.map(w => w.id)) + 1;
    setWords(prev => [...prev, { id: newId, text: word, isEditing: false }]);

    // Remove from deleted stack
    setDeletedWords(prev => {
      const index = prev.indexOf(word);
      if (index === -1) return prev;
      const newStack = [...prev];
      newStack.splice(index, 1);
      return newStack;
    });

    // Remove letters from pool (since they were returned when deleted)
    let newPool = letterPool;
    for (const char of word) {
      const updated = updatePoolRemove(newPool, char);
      if (updated !== null) {
        newPool = updated;
      }
    }
    setLetterPool(newPool);
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
