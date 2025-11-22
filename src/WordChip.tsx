import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WordChipProps {
  id: number;
  word: string;
  isEditing?: boolean;
  isDestroyed?: boolean;
  onUpdate?: (newText: string) => void;
  onCommit?: () => void;
  onClick?: () => void;
}

const WordChip: React.FC<WordChipProps> = ({ id, word, isEditing, isDestroyed, onUpdate, onCommit, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: isEditing });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  if (isEditing) {
    return (
      <div className="word-chip input-chip">
        <input
          autoFocus
          value={word}
          onChange={(e) => onUpdate?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onCommit?.();
            }
          }}
          onBlur={() => onCommit?.()} // Optional: commit on blur
          style={{ width: `${Math.max(word.length, 1)}ch` }}
        />
      </div>
    );
  }

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`word-chip ${isDestroyed ? 'destroyed' : ''}`}
      onClick={onClick}
    >
      {word}
    </button>
  );
};

export default WordChip;
