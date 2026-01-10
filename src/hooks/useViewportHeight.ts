import { useEffect } from 'react';

export function useViewportHeight() {
    useEffect(() => {
        function updateVh() {
            // Account for mobile address bar
            const windowHeight = window.innerHeight;
            document.documentElement.style.setProperty('--vh', `${windowHeight * 0.01}px`);
        }

        updateVh();
        window.addEventListener('resize', updateVh);
        window.addEventListener('orientationchange', updateVh);

        return () => {
            window.removeEventListener('resize', updateVh);
            window.removeEventListener('orientationchange', updateVh);
        };
    }, []);
}
