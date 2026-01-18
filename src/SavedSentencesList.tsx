import React from 'react';

export interface SavedSentence {
    text: string;
    pool: string;
}

interface SavedSentencesListProps {
    sentences: SavedSentence[];
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
                        <a
                            href={`#${encodeURIComponent(sentence.text)}`}
                            className="saved-sentence-text"
                            onClick={() => {
                                // We don't preventDefault here so the URL updates,
                                // but we also fire onSelect to update state immediately
                                // since the app doesn't listen to hash changes dynamically.
                                onSelect(sentence.text);
                            }}
                            title="Click to load this sentence"
                        >
                            {sentence.text}
                            {sentence.pool && (
                                <span style={{ color: 'gray', marginLeft: '1rem', fontSize: '0.9em' }}>
                                    {sentence.pool}
                                </span>
                            )}
                        </a>
                        <button
                            className="delete-saved-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(sentence.text);
                            }}
                            title="Delete saved sentence"
                        >
                            <span className="material-icons-outlined">delete</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SavedSentencesList;
