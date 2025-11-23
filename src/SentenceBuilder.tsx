import React from 'react';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import WordChip from './WordChip';

interface Word {
    id: number;
    text: string;
    isEditing?: boolean;
    isDestroyed?: boolean;
}

interface SentenceBuilderProps {
    words: Word[];
    activeId: number | null;
    invalidIds: Set<number>;
    onWordUpdate: (id: number, newText: string) => void;
    onWordCommit: (id: number) => void;
}

const SentenceBuilder: React.FC<SentenceBuilderProps> = ({
    words,
    activeId,
    invalidIds,
    onWordUpdate,
    onWordCommit,
}) => {
    return (
        <div className="word-row">
            <SortableContext items={words} strategy={horizontalListSortingStrategy}>
                <div className="word-chip-container">
                    {words.map(word => (
                        <WordChip
                            key={word.id}
                            id={word.id}
                            word={word.text}
                            isInvalid={invalidIds.has(word.id)}
                            isEditing={word.isEditing}
                            isDestroyed={word.isDestroyed}
                            isDragging={activeId === word.id}
                            onUpdate={(text) => onWordUpdate(word.id, text)}
                            onCommit={() => onWordCommit(word.id)}
                        />
                    ))}
                </div>
            </SortableContext>
        </div>
    );
};

export default SentenceBuilder;
