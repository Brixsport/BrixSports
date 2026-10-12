// Serializes a JSON-LD object for embedding inside a <script type="application/ld+json"> tag.
// Plain JSON.stringify leaves "<" untouched, so a value containing "</script><script>" would end
// the tag early and run attacker-controlled markup. Escaping "<" (and the two line separators
// that break some JS parsers) keeps the output valid JSON with identical parsed content.
export function serializeJsonLd(data: unknown): string {
    return JSON.stringify(data)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
