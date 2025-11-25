import React, { useState, useRef, useLayoutEffect } from 'react';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import WordChip from './WordChip';
import prefixTextRaw from './1663_prefix.txt?raw';

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
    const [showPrefix, setShowPrefix] = useState(false);
    const chipsAreaRef = useRef<HTMLDivElement>(null);
    const [prevTop, setPrevTop] = useState<number | null>(null);

    const togglePrefix = () => {
        if (chipsAreaRef.current) {
            const rect = chipsAreaRef.current.getBoundingClientRect();
            setPrevTop(rect.top);
        }
        setShowPrefix(!showPrefix);
    };

    useLayoutEffect(() => {
        if (prevTop !== null && chipsAreaRef.current) {
            const newRect = chipsAreaRef.current.getBoundingClientRect();
            const delta = newRect.top - prevTop;
            if (delta !== 0) {
                window.scrollBy({ top: delta, behavior: 'instant' });
            }
            setPrevTop(null);
        }
    }, [showPrefix, prevTop]);

    return (
        <div className="word-row">
            <SortableContext items={words} strategy={horizontalListSortingStrategy}>
                <div className="word-chip-container">
                    <div className="prefix-container">
                        <button
                            className="prefix-toggle-btn"
                            onClick={togglePrefix}
                            title={showPrefix ? "Hide prefix" : "Show prefix"}
                        >
                            {showPrefix ? "▲" : "▼"}
                        </button>
                        {showPrefix && (
                            <div className="prefix-content">
                                {prefixTextRaw}
                            </div>
                        )}
                    </div>
                    <div className="chips-area" ref={chipsAreaRef}>
                        {words.map((word, index) => {
                            const isFirstI = index === 0 && word.text === 'I';
                            const isLastBang = index === words.length - 1 && word.text === '!!';
                            const isDisabled = isFirstI || isLastBang;

                            return (
                                <WordChip
                                    key={word.id}
                                    id={word.id}
                                    word={word.text}
                                    isInvalid={invalidIds.has(word.id)}
                                    isEditing={word.isEditing}
                                    isDestroyed={word.isDestroyed}
                                    isDragging={activeId === word.id}
                                    disabled={isDisabled}
                                    onUpdate={(text) => onWordUpdate(word.id, text)}
                                    onCommit={() => onWordCommit(word.id)}
                                />
                            );
                        })}
                    </div>
                </div>
            </SortableContext>
        </div>
    );
};

export default SentenceBuilder;
