import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CaretProps {
    id: string; // Special ID for the caret, e.g., 'caret'
}

const Caret: React.FC<CaretProps> = ({ id }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 20 : 10,
        opacity: isDragging ? 0 : 1,
        cursor: 'grab',
        display: 'inline-flex',
        alignItems: 'center',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="caret-container"
        >
            <svg
                width="14"
                height="20"
                viewBox="0 0 14 20"
                className="caret-svg"
            >
                <path
                    d="M 7 0 L 14 7 L 14 20 L 0 20 L 0 7 Z"
                />
            </svg>
        </div>
    );
};

export default Caret;
