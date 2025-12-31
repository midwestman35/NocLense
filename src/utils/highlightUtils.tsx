import React from 'react';

/**
 * Highlights matches of a query within a text string.
 * Returns an array of React nodes (<span>s and <mark>s).
 */
export const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Quick check if query exists
    if (!lowerText.includes(lowerQuery)) return text;

    const parts = [];
    let lastIndex = 0;
    let index = lowerText.indexOf(lowerQuery);

    while (index !== -1) {
        // Text before match
        if (index > lastIndex) {
            parts.push(text.substring(lastIndex, index));
        }

        // Match
        parts.push(
            <mark key={`${index}`} className="bg-yellow-500/50 text-white rounded-[1px] px-0.5">
                {text.substring(index, index + query.length)}
            </mark>
        );

        lastIndex = index + query.length;
        index = lowerText.indexOf(lowerQuery, lastIndex);
    }

    // Remaining text
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return <>{parts}</>;
};
