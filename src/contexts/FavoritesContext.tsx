'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface FavoritesContextType {
  favoriteTeams: string[];
  favoritePlayers: string[];
  favoriteCompetitions: string[];
  toggleTeam: (teamId: string) => Promise<void>;
  togglePlayer: (playerId: string) => Promise<void>;
  toggleCompetition: (competitionId: string) => Promise<void>;
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

  // Re-runs on isAuthenticated flipping (login/logout via the in-app modal, no
  // full page reload) as well as on first mount -- the old per-component hook
  // got this "for free" any time a fresh component mounted post-login; a single
  // app-lifetime provider needs it wired explicitly or a login mid-session would
  // leave favorites stuck on the pre-login (local or empty) data.
  useEffect(() => {
    const fetchFavorites = async () => {
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

        if (teamsRes.ok) {
          const data = await teamsRes.json();
          if (data.favorites) {
            setFavoriteTeams(data.favorites.map((f: any) => f.favoriteId));
            const notifMap: Record<string, boolean> = {};
            for (const f of data.favorites) {
              // DB default is true; a legacy pre-migration row (or an
              // explicit null) also reads as enabled, matching the same
              // "not explicitly false" rule the send-side query uses.
              notifMap[f.favoriteId] = f.notificationsEnabled !== false;
            }
            setTeamNotificationsMap(notifMap);
          }
        }
        if (playersRes.ok) {
          const data = await playersRes.json();
          if (data.favorites) setFavoritePlayers(data.favorites.map((f: any) => f.favoriteId));
        }
        if (competitionsRes.ok) {
          const data = await competitionsRes.json();
          if (data.favorites) setFavoriteCompetitions(data.favorites.map((f: any) => f.favoriteId));
        }
      } catch (error) {
        console.error('Failed to sync favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [isAuthenticated]);

  const toggleTeam = async (teamId: string) => {
    const isRemoving = favoriteTeams.includes(teamId);
    const newTeams = isRemoving
      ? favoriteTeams.filter((id) => id !== teamId)
      : [...favoriteTeams, teamId];

    setFavoriteTeams(newTeams);
    localStorage.setItem('brixsport_fav_teams', JSON.stringify(newTeams));

    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const method = isRemoving ? 'DELETE' : 'POST';
        const url = isRemoving
          ? `/api/users/favorites?type=team&id=${teamId}`
          : '/api/users/favorites';
        const body = isRemoving ? undefined : JSON.stringify({ favoriteType: 'team', favoriteId: teamId });

        await fetch(url, {
          method,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body,
        });
      } catch (error) {
        console.error('Failed to update favorite team:', error);
      }
    }
  };

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

  const togglePlayer = async (playerId: string) => {
    const isRemoving = favoritePlayers.includes(playerId);
    const newPlayers = isRemoving
      ? favoritePlayers.filter((id) => id !== playerId)
      : [...favoritePlayers, playerId];

    setFavoritePlayers(newPlayers);
    localStorage.setItem('brixsport_fav_players', JSON.stringify(newPlayers));

    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const method = isRemoving ? 'DELETE' : 'POST';
        const url = isRemoving
          ? `/api/users/favorites?type=player&id=${playerId}`
          : '/api/users/favorites';
        const body = isRemoving ? undefined : JSON.stringify({ favoriteType: 'player', favoriteId: playerId });

        await fetch(url, {
          method,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body,
        });
      } catch (error) {
        console.error('Failed to update favorite player:', error);
      }
    }
  };

  const toggleCompetition = async (competitionId: string) => {
    const isRemoving = favoriteCompetitions.includes(competitionId);
    const newCompetitions = isRemoving
      ? favoriteCompetitions.filter((id) => id !== competitionId)
      : [...favoriteCompetitions, competitionId];

    setFavoriteCompetitions(newCompetitions);
    localStorage.setItem('brixsport_fav_competitions', JSON.stringify(newCompetitions));

    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const method = isRemoving ? 'DELETE' : 'POST';
        const url = isRemoving
          ? `/api/users/favorites?type=competition&id=${competitionId}`
          : '/api/users/favorites';
        const body = isRemoving ? undefined : JSON.stringify({ favoriteType: 'competition', favoriteId: competitionId });

        await fetch(url, {
          method,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body,
        });
      } catch (error) {
        console.error('Failed to update favorite competition:', error);
      }
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
