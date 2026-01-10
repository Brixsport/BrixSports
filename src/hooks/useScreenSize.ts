import { useState, useEffect } from 'react';

interface ScreenSize {
    width: number;
    height: number;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
}

export function useScreenSize(): ScreenSize {
    const [screenSize, setScreenSize] = useState<ScreenSize>({
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
        isMobile: false,
        isTablet: false,
        isDesktop: false,
    });

    useEffect(() => {
        function handleResize() {
            const width = window.innerWidth;
            setScreenSize({
                width,
                height: window.innerHeight,
                isMobile: width < 768,
                isTablet: width >= 768 && width < 1024,
                isDesktop: width >= 1024,
            });
        }

        handleResize(); // Initial call
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return screenSize;
}
