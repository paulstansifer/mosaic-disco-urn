import React from 'react';

interface LetterPoolProps {
    letterPool: string;
}

const LetterPool: React.FC<LetterPoolProps> = ({ letterPool }) => {
    // Dynamically calculate the number of lines for the letter pool display
    const totalChars = letterPool.length; // includes spaces as placeholders
    const desiredLines = Math.min(5, Math.ceil(Math.sqrt(totalChars)));
    const baseLength = Math.floor(totalChars / desiredLines);
    const lineLengths: number[] = [];
    for (let i = 0; i < desiredLines; i++) {
        // Alternate longer lines (baseLength+1) to keep pattern n / n+1
        const addOne = i % 2 === 0 ? 1 : 0;
        lineLengths.push(baseLength + addOne);
    }
    const poolLines: string[] = [];
    let currentIndex = 0;
    for (const len of lineLengths) {
        poolLines.push(letterPool.slice(currentIndex, currentIndex + len));
        currentIndex += len;
    }

    return (
        <div className="letter-pool">
            {poolLines.map((line, index) => (
                <div key={index} className="pool-line">
                    {line.split('').join(' ')}
                </div>
            ))}
        </div>
    );
};

export default LetterPool;
