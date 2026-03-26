import React, { useLayoutEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WordChipProps {
  id: number | string;
  word: string;
  isInvalid?: boolean;
  isEditing?: boolean;
  isDestroyed?: boolean;
  isDragging?: boolean;
  disabled?: boolean;
  onUpdate?: (newText: string) => void;
  onCommit?: () => void;
  onBackspaceEmpty?: () => void;
}

const WordChip: React.FC<WordChipProps> = ({ id, word, isInvalid, isEditing, isDestroyed, isDragging, disabled, onUpdate, onCommit, onBackspaceEmpty }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: isEditing || disabled });

  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : undefined,
    border: (id === 'caret' ? false : true) && isDragging ? '1px dashed #4CAF50' : undefined,
  };

  if (isEditing) {
    return (
      <div className="word-chip input-chip">
        <input
          ref={inputRef}
          value={word}
          onChange={(e) => onUpdate?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
              e.preventDefault();
              onCommit?.();
            } else if (e.key === 'Backspace' && word === '') {
              e.preventDefault();
              onBackspaceEmpty?.();
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
