import { Match, Team } from '@/types/database.types';

export interface StandingsRow {
  teamId: string;
  teamName: string;
  teamLogo?: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
}

export interface StandingsOptions {
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
}

/**
 * Computes live points table & standings from completed matches.
 */
export function calculateStandings(
  teams: { id: string; name: string; logo_url?: string | null }[],
  matches: Match[],
  options: StandingsOptions = {}
): StandingsRow[] {
  const pointsForWin = options.pointsForWin ?? 3;
  const pointsForDraw = options.pointsForDraw ?? 1;
  const pointsForLoss = options.pointsForLoss ?? 0;

  const table: Record<string, StandingsRow> = {};

  // Initialize table rows for each team
  teams.forEach((team) => {
    table[team.id] = {
      teamId: team.id,
      teamName: team.name,
      teamLogo: team.logo_url,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [],
    };
  });

  // Calculate stats from completed matches
  matches.forEach((match) => {
    if (match.status !== 'COMPLETED') return;
    if (!match.home_team_id || !match.away_team_id) return;

    const homeRow = table[match.home_team_id];
    const awayRow = table[match.away_team_id];

    if (!homeRow || !awayRow) return;

    const homeScoreNum = parseInt(match.home_score, 10) || 0;
    const awayScoreNum = parseInt(match.away_score, 10) || 0;

    homeRow.played += 1;
    awayRow.played += 1;

    homeRow.goalsFor += homeScoreNum;
    homeRow.goalsAgainst += awayScoreNum;

    awayRow.goalsFor += awayScoreNum;
    awayRow.goalsAgainst += homeScoreNum;

    if (homeScoreNum > awayScoreNum) {
      homeRow.won += 1;
      homeRow.points += pointsForWin;
      homeRow.form.push('W');

      awayRow.lost += 1;
      awayRow.points += pointsForLoss;
      awayRow.form.push('L');
    } else if (homeScoreNum < awayScoreNum) {
      awayRow.won += 1;
      awayRow.points += pointsForWin;
      awayRow.form.push('W');

      homeRow.lost += 1;
      homeRow.points += pointsForLoss;
      homeRow.form.push('L');
    } else {
      homeRow.drawn += 1;
      homeRow.points += pointsForDraw;
      homeRow.form.push('D');

      awayRow.drawn += 1;
      awayRow.points += pointsForDraw;
      awayRow.form.push('D');
    }
  });

  // Calculate goal differences and slice recent form
  const result: StandingsRow[] = Object.values(table).map((row) => {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    row.form = row.form.slice(-5);
    return row;
  });

  // Sort by Points DESC -> Goal Difference DESC -> Goals For DESC -> Team Name ASC
  result.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamName.localeCompare(b.teamName);
  });

  return result;
}
