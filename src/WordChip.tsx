import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WordChipProps {
  id: number;
  word: string;
  isInvalid?: boolean;
  isEditing?: boolean;
  isDestroyed?: boolean;
  isDragging?: boolean;
  disabled?: boolean;
  onUpdate?: (newText: string) => void;
  onCommit?: () => void;
}

const WordChip: React.FC<WordChipProps> = ({ id, word, isInvalid, isEditing, isDestroyed, isDragging, disabled, onUpdate, onCommit }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: isEditing || disabled });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : undefined,
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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`word-chip ${isDestroyed ? 'destroyed' : ''} ${isInvalid ? 'invalid' : ''}`}
    >
      {word}
    </div>
  );
};

export default WordChip;
