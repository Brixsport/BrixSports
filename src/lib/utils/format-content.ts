/**
 * Formats plain text content into properly structured HTML
 * Handles paragraphs, line breaks, and basic formatting
 */
export function formatNewsContent(content: string): string {
    if (!content) return '';

    // Split content into paragraphs (double line breaks)
    const paragraphs = content
        .split(/\n\n+/)
        .map(para => para.trim())
        .filter(para => para.length > 0);

    // Process each paragraph
    const formattedParagraphs = paragraphs.map(paragraph => {
        // Check if it's a heading (starts with # or is all caps and short)
        if (paragraph.startsWith('# ')) {
            const headingText = paragraph.substring(2).trim();
            return `<h2>${headingText}</h2>`;
        }
        if (paragraph.startsWith('## ')) {
            const headingText = paragraph.substring(3).trim();
            return `<h3>${headingText}</h3>`;
        }
        if (paragraph.startsWith('### ')) {
            const headingText = paragraph.substring(4).trim();
            return `<h4>${headingText}</h4>`;
        }

        // Check if it's a list item
        if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
            const items = paragraph
                .split(/\n/)
                .filter(line => line.trim().length > 0)
                .map(line => {
                    const text = line.replace(/^[-*]\s+/, '').trim();
                    return `<li>${formatInlineText(text)}</li>`;
                })
                .join('');
            return `<ul>${items}</ul>`;
        }

        // Check if it's a numbered list
        if (/^\d+\.\s/.test(paragraph)) {
            const items = paragraph
                .split(/\n/)
                .filter(line => line.trim().length > 0)
                .map(line => {
                    const text = line.replace(/^\d+\.\s+/, '').trim();
                    return `<li>${formatInlineText(text)}</li>`;
                })
                .join('');
            return `<ol>${items}</ol>`;
        }

        // Check if it's a blockquote
        if (paragraph.startsWith('> ')) {
            const quoteText = paragraph.replace(/^>\s+/gm, '').trim();
            return `<blockquote>${formatInlineText(quoteText)}</blockquote>`;
        }

        // Regular paragraph - replace single line breaks with <br>
        const formattedText = paragraph
            .split(/\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => formatInlineText(line))
            .join(' ');

        return `<p>${formattedText}</p>`;
    });

    return formattedParagraphs.join('\n');
}

/**
 * Formats inline text elements (bold, italic, links, etc.)
 */
function formatInlineText(text: string): string {
    let formatted = text;

    // Bold text: **text** or __text__
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic text: *text* or _text_
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');

    // Inline code: `code`
    formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');

    // Links: [text](url)
    formatted = formatted.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    return formatted;
}

/**
 * Extracts plain text from HTML or formatted content
 * Useful for excerpts and previews
 */
export function extractPlainText(content: string, maxLength?: number): string {
    // Remove HTML tags
    const plainText = content
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (maxLength && plainText.length > maxLength) {
        return plainText.substring(0, maxLength) + '...';
    }

    return plainText;
}
