// Moved to a shared context (FavoritesProvider, mounted once in the root layout)
// so the 12 call sites of this hook -- including GlobalNotificationListener,
// which is mounted on every route -- share one fetch and one state, instead of
// each holding its own copy and firing its own duplicate GET /api/users/favorites
// calls. Re-exported from here so no call site's import needs to change.
export { useFavorites } from '@/contexts/FavoritesContext';
