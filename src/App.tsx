import { useState, useEffect } from 'react';
import './App.css';
import WordChip from './WordChip';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';

function App() {
  const [words, setWords] = useState<Array<{ id: number; text: string; isEditing?: boolean }>>(
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
          setWords(words.filter(w => w.id !== stolenWord.id).map(w => w.id === id ? { ...w, text: newText } : w));
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

  const handleWordCommit = (id: number) => {
    setWords(words.map(w => w.id === id ? { ...w, isEditing: false } : w));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
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
        setLetterPool(prev => shuffleString(prev));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const poolLines = [];
  const lineLengths = [20, 21, 20, 21, 20];
  let currentIndex = 0;

  for (const length of lineLengths) {
    poolLines.push(letterPool.slice(currentIndex, currentIndex + length));
    currentIndex += length;
  }

  return (
    <div className="app">
      <div className="content-wrapper">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={words} strategy={horizontalListSortingStrategy}>
            <div className="word-chip-container">
              {words.map(word => (
                <WordChip
                  key={word.id}
                  id={word.id}
                  word={word.text}
                  isEditing={word.isEditing}
                  onUpdate={(text) => handleWordUpdate(word.id, text)}
                  onCommit={() => handleWordCommit(word.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="input-section">
          <button className="add-word-btn" onClick={handleAddWord}>+</button>
          <div className="letter-pool">
            {poolLines.map((line, index) => (
              <div key={index} className="pool-line">
                {line.split('').join(' ')}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
