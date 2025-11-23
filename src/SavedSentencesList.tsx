import React from 'react';

interface SavedSentencesListProps {
    sentences: string[];
    onSelect: (sentence: string) => void;
    onDelete: (sentence: string) => void;
}

const SavedSentencesList: React.FC<SavedSentencesListProps> = ({ sentences, onSelect, onDelete }) => {
    if (sentences.length === 0) {
        return null;
    }

    return (
        <div className="saved-sentences-container">
            <h3>Saved Sentences</h3>
            <ul className="saved-sentences-list">
                {sentences.map((sentence, index) => (
                    <li key={index} className="saved-sentence-item">
                        <span
                            className="saved-sentence-text"
                            onClick={() => onSelect(sentence)}
                            title="Click to load this sentence"
                        >
                            {sentence}
                        </span>
                        <button
                            className="delete-saved-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(sentence);
                            }}
                            title="Delete saved sentence"
                        >
                            🗑️
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SavedSentencesList;
