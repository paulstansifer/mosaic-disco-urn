import React from 'react';
import {
    DndContext,
    closestCenter,
    DragOverlay,
    type DragStartEvent,
    type DragEndEvent,
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    useDroppable,
    type DropAnimation,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import WordChip from './WordChip';

// TrashDropZone component (internal to SentenceBuilder)
function TrashDropZone() {
    const { isOver, setNodeRef } = useDroppable({
        id: 'trash-drop-zone',
    });

    return (
        <div
            ref={setNodeRef}
            className={`trash-drop-zone ${isOver ? 'over' : ''}`}
        >
            🗑️
        </div>
    );
}

interface Word {
    id: number;
    text: string;
    isEditing?: boolean;
    isDestroyed?: boolean;
}

interface SentenceBuilderProps {
    words: Word[];
    activeId: number | null;
    onDragStart: (event: DragStartEvent) => void;
    onDragEnd: (event: DragEndEvent) => void;
    onWordUpdate: (id: number, newText: string) => void;
    onWordCommit: (id: number) => void;
    onSave: () => void;
}

const SentenceBuilder: React.FC<SentenceBuilderProps> = ({
    words,
    activeId,
    onDragStart,
    onDragEnd,
    onWordUpdate,
    onWordCommit,
    onSave,
}) => {
    const sensors = useSensors(
        useSensor(MouseSensor),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        }),
    );

    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        >
            <div className="word-row">
                <button className="save-btn" onClick={onSave} title="Save Sentence">
                    💾
                </button>
                <SortableContext items={words} strategy={horizontalListSortingStrategy}>
                    <div className="word-chip-container">
                        {words.map(word => (
                            <WordChip
                                key={word.id}
                                id={word.id}
                                word={word.text}
                                isEditing={word.isEditing}
                                isDestroyed={word.isDestroyed}
                                isDragging={activeId === word.id}
                                onUpdate={(text) => onWordUpdate(word.id, text)}
                                onCommit={() => onWordCommit(word.id)}
                            />
                        ))}
                    </div>
                </SortableContext>
                <TrashDropZone />
            </div>
            <DragOverlay dropAnimation={dropAnimation}>
                {activeId ? (
                    <div className="word-chip" style={{ cursor: 'grabbing' }}>
                        {words.find(w => w.id === activeId)?.text}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default SentenceBuilder;
