import { useState, useEffect } from 'react';
import './App.css';
import WordChip from './WordChip';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';

function App() {
  const [words, setWords] = useState(
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
                <WordChip key={word.id} id={word.id} word={word.text} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="input-section">
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
