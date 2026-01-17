import React from 'react';
import { type DeletedWord } from './types';

interface SuggestionColumnsProps {
    deletedWords: DeletedWord[];
    suggestedWords: string[];
    suggestedEndWords: string[];
    onDeletedWordClick: (word: DeletedWord, index: number) => void;
    onSuggestedClick: (word: string) => void;
}

const SuggestionColumns: React.FC<SuggestionColumnsProps> = ({
    deletedWords,
    suggestedWords,
    suggestedEndWords,
    onDeletedWordClick,
    onSuggestedClick,
}) => {
    return (
        <div className="suggestions-grid">
            <div className="suggestion-col center">
                {deletedWords.map((deletedWord, index) => (
                    <button
                        key={`deleted-${index}`}
                        className="suggestion-chip"
                        style={{ opacity: 0.7 }}
                        onClick={() => onDeletedWordClick(deletedWord, index)}
                    >
                        {deletedWord.text}
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
            <div className="suggestion-col suggestion-col-narrow">
                {suggestedEndWords.map((word, index) => (
                    <button
                        key={`${word}-${index}`}
                        className="suggestion-chip"
                        onClick={() => onSuggestedClick(word)}
                    >
                        {word}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SuggestionColumns;
