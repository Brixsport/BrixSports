'use client';

import { useState, useEffect } from 'react';

export function useFavorites() {
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([]);
  const [favoritePlayers, setFavoritePlayers] = useState<string[]>([]);

  useEffect(() => {
    const savedTeams = localStorage.getItem('brixsport_fav_teams');
    const savedPlayers = localStorage.getItem('brixsport_fav_players');
    if (savedTeams) setFavoriteTeams(JSON.parse(savedTeams));
    if (savedPlayers) setFavoritePlayers(JSON.parse(savedPlayers));
  }, []);

  const toggleTeam = (teamId: string) => {
    const newTeams = favoriteTeams.includes(teamId)
      ? favoriteTeams.filter(id => id !== teamId)
      : [...favoriteTeams, teamId];
    setFavoriteTeams(newTeams);
    localStorage.setItem('brixsport_fav_teams', JSON.stringify(newTeams));
  };

  const togglePlayer = (playerId: string) => {
    const newPlayers = favoritePlayers.includes(playerId)
      ? favoritePlayers.filter(id => id !== playerId)
      : [...favoritePlayers, playerId];
    setFavoritePlayers(newPlayers);
    localStorage.setItem('brixsport_fav_players', JSON.stringify(newPlayers));
  };

  const isFavoriteTeam = (teamId: string) => favoriteTeams.includes(teamId);
  const isFavoritePlayer = (playerId: string) => favoritePlayers.includes(playerId);

  return {
    favoriteTeams,
    favoritePlayers,
    toggleTeam,
    togglePlayer,
    isFavoriteTeam,
    isFavoritePlayer
  };
}
