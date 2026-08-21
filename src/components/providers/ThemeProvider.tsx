'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

// Theme mechanism wiring (light-mode initiative, session 51). `next-themes` was
// already an installed dependency and globals.css already had a full light/dark
// CSS variable pair set (shadcn-style, `.dark` class strategy) -- neither was ever
// actually connected to a live provider, so the class never toggled and the whole
// app just rendered whatever hardcoded classes each page happened to use.
// `attribute="class"` matches globals.css's `@custom-variant dark (&:is(.dark *))`.
// `defaultTheme="dark"` preserves current behavior for every page not yet
// retrofitted to the semantic tokens (Sprint 2, screen by screen) --
// `enableSystem={false}` because most of the app still hardcodes dark-only
// classes; auto-following OS light mode before those screens are retrofitted
// would look broken, not themed.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    return (
        <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            {children}
        </NextThemesProvider>
    );
}
