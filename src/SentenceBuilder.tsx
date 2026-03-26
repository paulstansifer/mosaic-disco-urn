import React, { useState, useRef, useLayoutEffect } from 'react';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import WordChip from './WordChip';
import Caret from './Caret';
import prefixTextRaw from './1663_prefix.txt?raw';

interface SentenceBuilderProps {
    items: Array<{
        id: number | string;
        text: string;
        isCaret?: boolean;
        isEditing?: boolean;
        isDestroyed?: boolean;
    }>;
    activeId: number | string | null;
    invalidIds: Set<number | string>;
    onWordUpdate: (id: number | string, newText: string) => void;
    onWordCommit: (id: number | string) => void;
    onWordBackspaceEmpty?: (id: number | string) => void;
}

const SentenceBuilder: React.FC<SentenceBuilderProps> = ({
    items,
    activeId,
    invalidIds,
    onWordUpdate,
    onWordCommit,
    onWordBackspaceEmpty,
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
            <SortableContext items={items} strategy={horizontalListSortingStrategy}>
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
                        {items.map((item, index) => {
                            if (item.isCaret) {
                                return <Caret key={item.id} id={item.id as string} />;
                            }

                            const isFirstI = index === 0 && item.text === 'I';
                            const isLastBang = index === items.length - 1 && item.text === '!!';
                            const isDisabled = isFirstI || isLastBang;

                            return (
                                <WordChip
                                    key={item.id}
                                    id={item.id}
                                    word={item.text}
                                    isInvalid={invalidIds.has(item.id)}
                                    isEditing={item.isEditing}
                                    isDestroyed={item.isDestroyed}
                                    isDragging={activeId === item.id}
                                    disabled={isDisabled}
                                    onUpdate={(text) => onWordUpdate(item.id, text)}
                                    onCommit={() => onWordCommit(item.id)}
                                    onBackspaceEmpty={() => onWordBackspaceEmpty?.(item.id)}
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
