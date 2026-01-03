/**
 * Table of Contents utilities for blog articles
 */

export interface ToCItem {
    id: string;
    text: string;
    level: number; // 1-6 for h1-h6
    children?: ToCItem[];
}

/**
 * Generate table of contents from HTML content
 * Extracts h1-h6 headings and creates a hierarchical structure
 */
export function generateTableOfContents(htmlContent: string): ToCItem[] {
    if (!htmlContent) return [];

    // Create a temporary DOM element to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // Get all heading elements
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');

    const toc: ToCItem[] = [];
    const stack: { item: ToCItem; level: number }[] = [];

    headings.forEach((heading, index) => {
        const level = parseInt(heading.tagName.substring(1)); // h1 -> 1, h2 -> 2, etc.
        const text = heading.textContent?.trim() || '';

        // Generate ID from text (slugify)
        const id = heading.id || `heading-${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

        // Add ID to heading if it doesn't have one (for anchor links)
        if (!heading.id) {
            heading.id = id;
        }

        const item: ToCItem = {
            id,
            text,
            level,
        };

        // Build hierarchical structure
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
            stack.pop();
        }

        if (stack.length === 0) {
            toc.push(item);
        } else {
            const parent = stack[stack.length - 1].item;
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push(item);
        }

        stack.push({ item, level });
    });

    return toc;
}

/**
 * Flatten table of contents for simple list display
 */
export function flattenTableOfContents(toc: ToCItem[]): ToCItem[] {
    const flattened: ToCItem[] = [];

    function traverse(items: ToCItem[]) {
        items.forEach(item => {
            flattened.push(item);
            if (item.children) {
                traverse(item.children);
            }
        });
    }

    traverse(toc);
    return flattened;
}

/**
 * Add IDs to headings in HTML content for anchor linking
 */
export function addHeadingIds(htmlContent: string): string {
    if (!htmlContent) return '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');

    headings.forEach((heading, index) => {
        if (!heading.id) {
            const text = heading.textContent?.trim() || '';
            const id = `heading-${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            heading.id = id;
        }
    });

    return doc.body.innerHTML;
}

/**
 * Get estimated position of heading in document (for scroll progress)
 */
export function getHeadingPosition(headingId: string): number {
    const element = document.getElementById(headingId);
    if (!element) return 0;

    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return rect.top + scrollTop;
}

/**
 * Smooth scroll to heading
 */
export function scrollToHeading(headingId: string, offset: number = 80) {
    const element = document.getElementById(headingId);
    if (!element) return;

    const position = getHeadingPosition(headingId);
    window.scrollTo({
        top: position - offset,
        behavior: 'smooth',
    });
}
