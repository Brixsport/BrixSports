/**
 * Calculate reading time for an article
 * @param content - HTML or plain text content
 * @param wordsPerMinute - Average reading speed (default: 200)
 * @returns Reading time in minutes
 */
export function calculateReadingTime(content: string, wordsPerMinute: number = 200): number {
    // Strip HTML tags
    const text = content.replace(/<[^>]*>/g, '');

    // Count words
    const words = text.trim().split(/\s+/).length;

    // Calculate reading time
    const minutes = Math.ceil(words / wordsPerMinute);

    return minutes;
}

/**
 * Format reading time for display
 * @param minutes - Reading time in minutes
 * @returns Formatted string (e.g., "5 min read")
 */
export function formatReadingTime(minutes: number): string {
    if (minutes < 1) return 'Less than 1 min read';
    if (minutes === 1) return '1 min read';
    return `${minutes} min read`;
}

/**
 * Get reading time with formatted string
 * @param content - HTML or plain text content
 * @returns Object with minutes and formatted string
 */
export function getReadingTime(content: string) {
    const minutes = calculateReadingTime(content);
    const formatted = formatReadingTime(minutes);

    return {
        minutes,
        formatted,
    };
}
