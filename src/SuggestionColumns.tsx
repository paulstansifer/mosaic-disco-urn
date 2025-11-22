import React from 'react';

interface SuggestionColumnsProps {
    deletedWords: string[];
    suggestedWords: string[];
    onDeletedWordClick: (word: string) => void;
    onSuggestedClick: (word: string) => void;
}

const SuggestionColumns: React.FC<SuggestionColumnsProps> = ({
    deletedWords,
    suggestedWords,
    onDeletedWordClick,
    onSuggestedClick,
}) => {
    return (
        <div className="suggestions-grid">
            <div className="suggestion-col center">
                {deletedWords.map((word, index) => (
                    <button
                        key={`deleted-${index}`}
                        className="suggestion-chip"
                        style={{ opacity: 0.7 }}
                        onClick={() => onDeletedWordClick(word)}
                    >
                        {word}
                    </button>
                ))}
            </div>
            <div className="suggestion-col center">
                {suggestedWords.map((word, index) => (
                    <button
                        key={`${word}-${index}`}
                        className="suggestion-chip"
                        onClick={() => onSuggestedClick(word)}
                    >
                        {word}
                    </button>
                ))}
            </div>
            <div className="suggestion-col"></div>
        </div>
    );
};

export default SuggestionColumns;
