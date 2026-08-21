'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const WARNING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const CHECK_INTERVAL_MS = 30 * 1000;

function decodeJwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Loggers have no server-side session table and no refresh endpoint (unlike
 * the viewer/admin auth system's AuthContext.refreshSession()) -- the JWT's
 * own `exp` claim, already sitting in localStorage, is the only signal
 * available. This warns before the token dies mid-match instead of letting
 * a write silently fail with a 401 and no context for why.
 */
export function SessionExpiryBanner() {
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setMinutesLeft(null);
        return;
      }
      const expiresAt = decodeJwtExpiry(token);
      if (!expiresAt) {
        setMinutesLeft(null);
        return;
      }
      const remaining = expiresAt - Date.now();
      setMinutesLeft(remaining > 0 && remaining <= WARNING_THRESHOLD_MS ? Math.ceil(remaining / 60000) : null);
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (minutesLeft === null) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-black px-4 py-2 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg">
      <AlertTriangle size={14} />
      Session expires in {minutesLeft} min{minutesLeft === 1 ? '' : 's'} — save your work, you'll need to log in again
    </div>
  );
}
