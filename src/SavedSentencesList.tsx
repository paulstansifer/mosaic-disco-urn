import React from 'react';

export interface SavedSentence {
    text: string;
    pool: string;
}

interface SavedSentencesListProps {
    sentences: SavedSentence[];
    onSelect: (sentence: string) => void;
    onDelete: (sentence: string) => void;
    authSection?: React.ReactNode;
}

const SavedSentencesList: React.FC<SavedSentencesListProps> = ({ sentences, onSelect, onDelete, authSection }) => {
    if (sentences.length === 0 && !authSection) {
        return null;
    }

    return (
        <div className="saved-sentences-container">
            <h3>Saved Sentences</h3>
            {authSection}
            {sentences.length > 0 && (
                <ul className="saved-sentences-list">
                    {sentences.map((sentence, index) => (
                        <li key={index} className="saved-sentence-item">
                            <a
                                href={`#${encodeURIComponent(sentence.text.replace(/!!$/, '').trim().replace(/ /g, '_'))}`}
                                className="saved-sentence-text"
                                onClick={() => {
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
            )}
        </div>
    );
};

export default SavedSentencesList;
