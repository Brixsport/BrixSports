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
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

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
          if (data.favorites) setFavoriteTeams(data.favorites.map((f: any) => f.favoriteId));
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
