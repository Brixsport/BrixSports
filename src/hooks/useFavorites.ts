'use client';

import { useState, useEffect } from 'react';

export function useFavorites() {
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([]);
  const [favoritePlayers, setFavoritePlayers] = useState<string[]>([]);
  const [favoriteCompetitions, setFavoriteCompetitions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync with API on mount if logged in
  useEffect(() => {
    const fetchFavorites = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        // Fallback to local storage
        try {
          const savedTeams = localStorage.getItem('brixsport_fav_teams');
          const savedPlayers = localStorage.getItem('brixsport_fav_players');
          const savedCompetitions = localStorage.getItem('brixsport_fav_competitions');
          if (savedTeams) setFavoriteTeams(JSON.parse(savedTeams));
          if (savedPlayers) setFavoritePlayers(JSON.parse(savedPlayers));
          if (savedCompetitions) setFavoriteCompetitions(JSON.parse(savedCompetitions));
        } catch (e) {
          console.error("Error parsing local favorites", e);
        }
        return;
      }

      try {
        setLoading(true);
        // Fetch teams
        const teamsRes = await fetch('/api/users/favorites?type=team', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (teamsRes.ok) {
          const teamsData = await teamsRes.json();
          if (teamsData.favorites) {
            setFavoriteTeams(teamsData.favorites.map((f: any) => f.favoriteId));
          }
        }

        // Fetch players
        const playersRes = await fetch('/api/users/favorites?type=player', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (playersRes.ok) {
          const playersData = await playersRes.json();
          if (playersData.favorites) {
            setFavoritePlayers(playersData.favorites.map((f: any) => f.favoriteId));
          }
        }

        // Fetch competitions
        const competitionsRes = await fetch('/api/users/favorites?type=competition', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (competitionsRes.ok) {
          const competitionsData = await competitionsRes.json();
          if (competitionsData.favorites) {
            setFavoriteCompetitions(competitionsData.favorites.map((f: any) => f.favoriteId));
          }
        }

      } catch (error) {
        console.error("Failed to sync favorites:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  const toggleTeam = async (teamId: string) => {
    // Optimistic update
    const isRemoving = favoriteTeams.includes(teamId);
    const newTeams = isRemoving
      ? favoriteTeams.filter(id => id !== teamId)
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

        const body = isRemoving ? undefined : JSON.stringify({
          favoriteType: 'team',
          favoriteId: teamId
        });

        await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body
        });
      } catch (error) {
        console.error("Failed to update favorite team:", error);
        // Revert on error? For now, keep optimistic
      }
    }
  };

  const togglePlayer = async (playerId: string) => {
    // Optimistic update
    const isRemoving = favoritePlayers.includes(playerId);
    const newPlayers = isRemoving
      ? favoritePlayers.filter(id => id !== playerId)
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

        const body = isRemoving ? undefined : JSON.stringify({
          favoriteType: 'player',
          favoriteId: playerId
        });

        await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body
        });
      } catch (error) {
        console.error("Failed to update favorite player:", error);
      }
    }
  };

  const toggleCompetition = async (competitionId: string) => {
    // Optimistic update
    const isRemoving = favoriteCompetitions.includes(competitionId);
    const newCompetitions = isRemoving
      ? favoriteCompetitions.filter(id => id !== competitionId)
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

        const body = isRemoving ? undefined : JSON.stringify({
          favoriteType: 'competition',
          favoriteId: competitionId
        });

        await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body
        });
      } catch (error) {
        console.error("Failed to update favorite competition:", error);
      }
    }
  };

  const isFavoriteTeam = (teamId: string) => favoriteTeams.includes(teamId);
  const isFavoritePlayer = (playerId: string) => favoritePlayers.includes(playerId);
  const isFavoriteCompetition = (competitionId: string) => favoriteCompetitions.includes(competitionId);

  return {
    favoriteTeams,
    favoritePlayers,
    favoriteCompetitions,
    toggleTeam,
    togglePlayer,
    toggleCompetition,
    isFavoriteTeam,
    isFavoritePlayer,
    isFavoriteCompetition,
    loading
  };
}
