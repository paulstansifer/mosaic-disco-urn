import { useState } from 'react';
import './App.css';
import WordChip from './WordChip';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';

function App() {
  const [words, setWords] = useState(
    ['Today', 'is', 'a', 'beautiful', 'day', 'to', 'be', 'stomping', 'on', 'things']
    .map((word, index) => ({ id: index + 1, text: word }))
  );

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

  return (
    <div className="app">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={words} strategy={horizontalListSortingStrategy}>
          <div className="word-chip-container">
            {words.map(word => (
              <WordChip key={word.id} id={word.id} word={word.text} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default App;
