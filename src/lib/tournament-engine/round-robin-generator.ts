import { GeneratedMatch } from './bracket-generator';

export interface RoundRobinParams {
  tournamentId: string;
  stageId?: string;
  groupName?: string;
  teams: { id: string; name: string }[];
}

/**
 * Generates Round Robin fixtures using the standard Berger rotation algorithm.
 * Every team plays every other team once.
 */
export function generateRoundRobinFixtures({
  tournamentId,
  stageId,
  groupName,
  teams,
}: RoundRobinParams): GeneratedMatch[] {
  const teamList = [...teams];
  const isOdd = teamList.length % 2 !== 0;

  // If odd number of teams, add a dummy BYE team (null id)
  if (isOdd) {
    teamList.push({ id: '__BYE__', name: 'BYE' });
  }

  const numTeams = teamList.length;
  const numRounds = numTeams - 1;
  const matchesPerRound = numTeams / 2;

  const matches: GeneratedMatch[] = [];
  let matchNumber = 1;

  // Clone teams for rotation
  const rotatingTeams = [...teamList];

  for (let round = 1; round <= numRounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const homeTeam = rotatingTeams[i];
      const awayTeam = rotatingTeams[numTeams - 1 - i];

      // Skip the match if one of the teams is the dummy BYE team
      if (homeTeam.id === '__BYE__' || awayTeam.id === '__BYE__') {
        continue;
      }

      const matchId = `match-rr-r${round}-m${i + 1}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      matches.push({
        id: matchId,
        tournament_id: tournamentId,
        stage_id: stageId ?? null,
        round_number: round,
        match_number: matchNumber++,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        winner_team_id: null,
        status: 'SCHEDULED',
        start_time: null,
        court_or_pitch: null,
        home_score: '0',
        away_score: '0',
        score_details: {
          groupName: groupName ?? 'Group A',
        },
        next_match_id: null,
        next_match_slot: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Berger rotation: fix index 0, rotate all others clockwise
    const lastTeam = rotatingTeams.pop()!;
    rotatingTeams.splice(1, 0, lastTeam);
  }

  return matches;
}
