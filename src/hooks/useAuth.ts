// Was a standalone hook with its own auth check: GET /api/auth/me with no
// credentials/cookie option and no localStorage Bearer-token fallback --
// unlike AuthContext's checkAuth, which tries the cookie then falls back to
// the stored token (the exact fallback this project's own auth history
// depends on, see BUG-044/BUG-057/BUG-217 in known-issues.md). Any page still
// on this hook -- including /profile/settings, the page holding the
// matchAlerts/notifications preference toggles -- would silently read as
// logged out for a real, logged-in user whose session cookie hadn't (yet, or
// ever) been set, even though the rest of the app correctly saw them as
// authenticated via AuthContext. Re-exported from the one real auth source so
// no call site's import needs to change.
export { useAuth } from '@/contexts/AuthContext';
