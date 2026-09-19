export interface SportPreset {
  id: string;
  name: string;
  slug: string;
  category: 'TEAM' | 'INDIVIDUAL_DOUBLES';
  icon: string;
  defaultPlayersPerTeam: { min: number; max: number; typical: number };
  defaultMatchDurationMinutes: number;
  scoringFormat: {
    unit: string;
    pointsForWin: number;
    pointsForDraw: number;
    pointsForLoss: number;
    tieBreaker: 'GOAL_DIFF' | 'RUN_RATE' | 'SET_DIFF' | 'HEAD_TO_HEAD';
    periods: { name: string; count: number };
  };
}

export const SPORTS_PRESETS: SportPreset[] = [
  {
    id: 'football',
    name: 'Football (Soccer)',
    slug: 'football',
    category: 'TEAM',
    icon: 'Trophy',
    defaultPlayersPerTeam: { min: 7, max: 18, typical: 11 },
    defaultMatchDurationMinutes: 90,
    scoringFormat: {
      unit: 'Goals',
      pointsForWin: 3,
      pointsForDraw: 1,
      pointsForLoss: 0,
      tieBreaker: 'GOAL_DIFF',
      periods: { name: 'Half', count: 2 },
    },
  },
  {
    id: 'cricket',
    name: 'Cricket (T20 / Limited Overs)',
    slug: 'cricket',
    category: 'TEAM',
    icon: 'Award',
    defaultPlayersPerTeam: { min: 11, max: 16, typical: 11 },
    defaultMatchDurationMinutes: 180,
    scoringFormat: {
      unit: 'Runs',
      pointsForWin: 2,
      pointsForDraw: 1,
      pointsForLoss: 0,
      tieBreaker: 'RUN_RATE',
      periods: { name: 'Innings', count: 2 },
    },
  },
  {
    id: 'basketball',
    name: 'Basketball (5v5 / 3x3)',
    slug: 'basketball',
    category: 'TEAM',
    icon: 'Target',
    defaultPlayersPerTeam: { min: 3, max: 12, typical: 5 },
    defaultMatchDurationMinutes: 48,
    scoringFormat: {
      unit: 'Points',
      pointsForWin: 2,
      pointsForDraw: 0,
      pointsForLoss: 1,
      tieBreaker: 'SET_DIFF',
      periods: { name: 'Quarter', count: 4 },
    },
  },
  {
    id: 'badminton',
    name: 'Badminton (Singles / Doubles)',
    slug: 'badminton',
    category: 'INDIVIDUAL_DOUBLES',
    icon: 'Zap',
    defaultPlayersPerTeam: { min: 1, max: 2, typical: 2 },
    defaultMatchDurationMinutes: 40,
    scoringFormat: {
      unit: 'Sets',
      pointsForWin: 2,
      pointsForDraw: 0,
      pointsForLoss: 0,
      tieBreaker: 'SET_DIFF',
      periods: { name: 'Set', count: 3 },
    },
  },
  {
    id: 'pickleball',
    name: 'Pickleball',
    slug: 'pickleball',
    category: 'INDIVIDUAL_DOUBLES',
    icon: 'CircleDot',
    defaultPlayersPerTeam: { min: 1, max: 2, typical: 2 },
    defaultMatchDurationMinutes: 30,
    scoringFormat: {
      unit: 'Points',
      pointsForWin: 2,
      pointsForDraw: 0,
      pointsForLoss: 0,
      tieBreaker: 'SET_DIFF',
      periods: { name: 'Game', count: 3 },
    },
  },
  {
    id: 'volleyball',
    name: 'Volleyball',
    slug: 'volleyball',
    category: 'TEAM',
    icon: 'Flame',
    defaultPlayersPerTeam: { min: 6, max: 12, typical: 6 },
    defaultMatchDurationMinutes: 60,
    scoringFormat: {
      unit: 'Sets',
      pointsForWin: 2,
      pointsForDraw: 0,
      pointsForLoss: 0,
      tieBreaker: 'SET_DIFF',
      periods: { name: 'Set', count: 3 },
    },
  },
];
