'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface FavoritesContextType {
  favoriteTeams: string[];
  favoritePlayers: string[];
  favoriteCompetitions: string[];
  // BACKLOG-464 item 3: each resolves true ONLY when the server confirmed the
  // write. false = anonymous viewer (local-only, nothing saved server-side) or the
  // write failed (the optimistic change has already been rolled back). Callers
  // that tell the user "you'll get alerts" must wait for true.
  toggleTeam: (teamId: string) => Promise<boolean>;
  togglePlayer: (playerId: string) => Promise<boolean>;
  toggleCompetition: (competitionId: string) => Promise<boolean>;
  isFavoriteTeam: (teamId: string) => boolean;
  isFavoritePlayer: (playerId: string) => boolean;
  isFavoriteCompetition: (competitionId: string) => boolean;
  // Fan Account Blueprint, ADR-001 Decision 1: per-team alert control,
  // independent of the favorite/unfavorite star itself. Defaults true for any
  // team not yet in the map (matches the DB column's own default).
  isTeamNotificationsEnabled: (teamId: string) => boolean;
  setTeamNotifications: (teamId: string, enabled: boolean) => Promise<void>;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

type FavoriteKind = 'team' | 'player' | 'competition';

const FAV_STORAGE_KEYS: Record<FavoriteKind, string> = {
  team: 'brixsport_fav_teams',
  player: 'brixsport_fav_players',
  competition: 'brixsport_fav_competitions',
};

// BACKLOG-365 item 1: the "you'll get alerts" consequence note, at the moment
// of favoriting -- deferred from Phase 2 (BACKLOG-363, the /favourites toggle
// itself) because this moment happens away from /favourites, in 3 different
// call sites (match page, match overlay, search overlay). One shared message
// here so those 3 don't each drift their own copy, the same duplication that
// caused BACKLOG-353 in the first place.
export function getFollowTeamNotification(teamName: string, isNowFollowing: boolean) {
  return isNowFollowing
    ? {
        title: 'Team Followed',
        message: `You'll get alerts for every ${teamName} match. Turn this off anytime in Favourites.`,
        type: 'match' as const,
      }
    : {
        title: 'Team Unfollowed',
        message: `You won't get match alerts for ${teamName} anymore.`,
        type: 'match' as const,
      };
}

// Was a plain hook (src/hooks/useFavorites.ts) with its own state + its own
// fetch-on-mount effect. It's called from 12 different components (match page,
// player page, competitions pages, search overlay, GlobalNotificationListener --
// which is mounted once in the root layout on every route). Every one of those
// was a separate hook instance with its own copy of the 3 GET /api/users/favorites
// calls, so a single page load routinely fired the same request set 2-3x over and
// two components could each hold a different, silently-drifting copy of "is this
// favorited." One shared provider, one fetch, one source of truth for all consumers.
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([]);
  const [favoritePlayers, setFavoritePlayers] = useState<string[]>([]);
  const [favoriteCompetitions, setFavoriteCompetitions] = useState<string[]>([]);
  const [teamNotifications, setTeamNotificationsMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  // BACKLOG-464: request counter + toggles made since the latest fetch started,
  // and whether the previous effect run was authenticated (to detect logout).
  const fetchSeq = useRef(0);
  const opsSinceFetch = useRef<{ type: FavoriteKind; id: string; add: boolean }[]>([]);
  const wasAuthenticatedRef = useRef(false);

  // Re-runs on isAuthenticated flipping (login/logout via the in-app modal, no
  // full page reload) as well as on first mount -- the old per-component hook
  // got this "for free" any time a fresh component mounted post-login; a single
  // app-lifetime provider needs it wired explicitly or a login mid-session would
  // leave favorites stuck on the pre-login (local or empty) data.
  useEffect(() => {
    // BACKLOG-464 item 4: every run supersedes the previous one. A fetch that
    // resolves after a newer run (or a logout) started is discarded, and toggles
    // made while this fetch is in flight are replayed over its result so a slow
    // GET can't revert a star the user just set.
    const seq = ++fetchSeq.current;
    opsSinceFetch.current = [];
    const applyLocalOps = (type: FavoriteKind, serverIds: string[]) =>
      opsSinceFetch.current
        .filter((op) => op.type === type)
        .reduce(
          (acc, op) =>
            op.add ? (acc.includes(op.id) ? acc : [...acc, op.id]) : acc.filter((id) => id !== op.id),
          serverIds
        );

    const fetchFavorites = async () => {
      // BACKLOG-464 item 5: authenticated -> unauthenticated (logout, or a 401
      // from refresh/me) must not leave the previous user's favourites in memory
      // or in the brixsport_fav_* keys for the next (anonymous) person on this device.
      const wasAuthenticated = wasAuthenticatedRef.current;
      wasAuthenticatedRef.current = isAuthenticated;
      if (wasAuthenticated && !isAuthenticated) {
        setFavoriteTeams([]);
        setFavoritePlayers([]);
        setFavoriteCompetitions([]);
        setTeamNotificationsMap({});
        setLoading(false);
        try {
          (Object.keys(FAV_STORAGE_KEYS) as FavoriteKind[]).forEach((k) =>
            localStorage.removeItem(FAV_STORAGE_KEYS[k])
          );
        } catch (e) {
          console.error('Error clearing local favorites on logout', e);
        }
        return;
      }

      const token = localStorage.getItem('authToken');
      if (!token) {
        try {
          const savedTeams = localStorage.getItem('brixsport_fav_teams');
          const savedPlayers = localStorage.getItem('brixsport_fav_players');
          const savedCompetitions = localStorage.getItem('brixsport_fav_competitions');
          if (savedTeams) setFavoriteTeams(JSON.parse(savedTeams));
          if (savedPlayers) setFavoritePlayers(JSON.parse(savedPlayers));
          if (savedCompetitions) setFavoriteCompetitions(JSON.parse(savedCompetitions));
        } catch (e) {
          console.error('Error parsing local favorites', e);
        }
        return;
      }

      try {
        setLoading(true);
        const [teamsRes, playersRes, competitionsRes] = await Promise.all([
          fetch('/api/users/favorites?type=team', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/users/favorites?type=player', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/users/favorites?type=competition', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const teamsData = teamsRes.ok ? await teamsRes.json() : null;
        const playersData = playersRes.ok ? await playersRes.json() : null;
        const competitionsData = competitionsRes.ok ? await competitionsRes.json() : null;

        // Superseded while in flight (newer run, or logout) -- drop the result.
        if (seq !== fetchSeq.current) return;

        if (teamsData?.favorites) {
          setFavoriteTeams(applyLocalOps('team', teamsData.favorites.map((f: any) => f.favoriteId)));
          const notifMap: Record<string, boolean> = {};
          for (const f of teamsData.favorites) {
            // DB default is true; a legacy pre-migration row (or an
            // explicit null) also reads as enabled, matching the same
            // "not explicitly false" rule the send-side query uses.
            notifMap[f.favoriteId] = f.notificationsEnabled !== false;
          }
          setTeamNotificationsMap(notifMap);
        }
        if (playersData?.favorites) {
          setFavoritePlayers(applyLocalOps('player', playersData.favorites.map((f: any) => f.favoriteId)));
        }
        if (competitionsData?.favorites) {
          setFavoriteCompetitions(
            applyLocalOps('competition', competitionsData.favorites.map((f: any) => f.favoriteId))
          );
        }
      } catch (error) {
        console.error('Failed to sync favorites:', error);
      } finally {
        if (seq === fetchSeq.current) setLoading(false);
      }
    };

    fetchFavorites();
  }, [isAuthenticated]);

  // Optimistic local change. Recorded in opsSinceFetch so an in-flight
  // fetchFavorites result is replayed over it instead of clobbering it. Uses a
  // functional update so concurrent toggles never overwrite each other.
  const applyLocal = (type: FavoriteKind, id: string, add: boolean) => {
    opsSinceFetch.current.push({ type, id, add });
    const setter =
      type === 'team' ? setFavoriteTeams : type === 'player' ? setFavoritePlayers : setFavoriteCompetitions;
    setter((prev) => {
      const next = add ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id);
      try {
        localStorage.setItem(FAV_STORAGE_KEYS[type], JSON.stringify(next));
      } catch {
        // storage unavailable -- in-memory state is still correct
      }
      return next;
    });
  };

  // BACKLOG-464 items 3+4: optimistic toggle that checks res.ok and rolls back on
  // failure (same pattern as setTeamNotifications). Resolves true only when the
  // server confirmed the write.
  const toggleFavorite = async (type: FavoriteKind, id: string): Promise<boolean> => {
    const current =
      type === 'team' ? favoriteTeams : type === 'player' ? favoritePlayers : favoriteCompetitions;
    const isRemoving = current.includes(id);
    const seqAtStart = fetchSeq.current;

    applyLocal(type, id, !isRemoving);

    const token = localStorage.getItem('authToken');
    if (!token) return false; // anonymous: local-only, nothing saved server-side

    try {
      const url = isRemoving ? `/api/users/favorites?type=${type}&id=${id}` : '/api/users/favorites';
      const res = await fetch(url, {
        method: isRemoving ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: isRemoving ? undefined : JSON.stringify({ favoriteType: type, favoriteId: id }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return true;
    } catch (error) {
      console.error(`Failed to update favorite ${type}:`, error);
      // Skip the rollback if auth state changed mid-request (login/logout already
      // reset the lists; re-applying would resurrect a stale entry).
      if (seqAtStart === fetchSeq.current) applyLocal(type, id, isRemoving);
      return false;
    }
  };

  const toggleTeam = (teamId: string) => toggleFavorite('team', teamId);
  const togglePlayer = (playerId: string) => toggleFavorite('player', playerId);
  const toggleCompetition = (competitionId: string) => toggleFavorite('competition', competitionId);

  // Fan Account Blueprint, ADR-001 Decision 1. Independent of toggleTeam --
  // this never adds/removes the favorite itself, only its alert preference.
  // Optimistic like the other toggles; no local-storage mirror since this has
  // no meaning for a logged-out fan (they have no server-side favorite row
  // for it to attach to in the first place).
  const setTeamNotifications = async (teamId: string, enabled: boolean) => {
    const previous = teamNotifications[teamId] ?? true;
    setTeamNotificationsMap((prev) => ({ ...prev, [teamId]: enabled }));

    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const res = await fetch('/api/users/favorites', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ favoriteType: 'team', favoriteId: teamId, notificationsEnabled: enabled }),
      });
      if (!res.ok) throw new Error('Request failed');
    } catch (error) {
      console.error('Failed to update team notification preference:', error);
      setTeamNotificationsMap((prev) => ({ ...prev, [teamId]: previous }));
    }
  };

  const value: FavoritesContextType = {
    favoriteTeams,
    favoritePlayers,
    favoriteCompetitions,
    toggleTeam,
    togglePlayer,
    toggleCompetition,
    isFavoriteTeam: (teamId: string) => favoriteTeams.includes(teamId),
    isFavoritePlayer: (playerId: string) => favoritePlayers.includes(playerId),
    isFavoriteCompetition: (competitionId: string) => favoriteCompetitions.includes(competitionId),
    isTeamNotificationsEnabled: (teamId: string) => teamNotifications[teamId] ?? true,
    setTeamNotifications,
    loading,
  };

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
