import { Match, Stage, Team } from '@/types/database.types';

export interface BracketGenerationParams {
  tournamentId: string;
  stageId?: string;
  teams: { id: string; name: string; seed?: number }[];
}

export interface GeneratedMatch {
  id: string;
  tournament_id: string;
  stage_id?: string | null;
  round_number: number;
  match_number: number;
  home_team_id: string | null;
  away_team_id: string | null;
  winner_team_id: string | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  start_time: string | null;
  court_or_pitch: string | null;
  home_score: string;
  away_score: string;
  score_details: Record<string, unknown>;
  next_match_id: string | null;
  next_match_slot: 'HOME' | 'AWAY' | null;
  created_at: string;
  updated_at: string;
  home_team?: Team | null;
  away_team?: Team | null;
  winner_team?: Team | null;
}

/**
 * Standard tournament seed pairing orders for single elimination brackets
 */
function getStandardSeedOrder(size: number): number[] {
  let rounds = Math.log2(size) - 1;
  let pls = [1, 2];
  for (let i = 0; i < rounds; i++) {
    const nextPls: number[] = [];
    const sum = pls.length * 2 + 1;
    for (let j = 0; j < pls.length; j++) {
      nextPls.push(pls[j]);
      nextPls.push(sum - pls[j]);
    }
    pls = nextPls;
  }
  return pls;
}

/**
 * Generates a full single elimination bracket tree with rounds, matches, and progression pointers.
 */
export function generateSingleEliminationBracket({
  tournamentId,
  stageId,
  teams,
}: BracketGenerationParams): GeneratedMatch[] {
  const teamCount = teams.length;
  if (teamCount < 2) {
    throw new Error('Single elimination requires at least 2 teams');
  }

  // Calculate nearest power of 2
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(teamCount)));
  const totalRounds = Math.log2(bracketSize);

  // Sort teams by seed or default order
  const sortedTeams = [...teams].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));

  // Build seed slots (1-indexed)
  const seedOrder = getStandardSeedOrder(bracketSize);
  const slots: ({ id: string; name: string } | null)[] = seedOrder.map((seed) => {
    return sortedTeams[seed - 1] ?? null; // Null means a BYE
  });

  const matches: GeneratedMatch[] = [];
  const matchesByRound: GeneratedMatch[][] = [];

  let matchCounter = 1;

  // Generate match placeholders for all rounds
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRoundCount = bracketSize / Math.pow(2, round);
    const roundMatches: GeneratedMatch[] = [];

    for (let i = 0; i < matchesInRoundCount; i++) {
      const matchId = `match-r${round}-m${i + 1}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const newMatch: GeneratedMatch = {
        id: matchId,
        tournament_id: tournamentId,
        stage_id: stageId ?? null,
        round_number: round,
        match_number: matchCounter++,
        home_team_id: null,
        away_team_id: null,
        winner_team_id: null,
        status: 'SCHEDULED',
        start_time: null,
        court_or_pitch: null,
        home_score: '0',
        away_score: '0',
        score_details: {},
        next_match_id: null,
        next_match_slot: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      roundMatches.push(newMatch);
    }
    matchesByRound.push(roundMatches);
  }

  // Link progression pointers from round r to round r+1
  for (let r = 0; r < totalRounds - 1; r++) {
    const currentRound = matchesByRound[r];
    const nextRound = matchesByRound[r + 1];

    for (let i = 0; i < currentRound.length; i++) {
      const parentMatchIndex = Math.floor(i / 2);
      const isHome = i % 2 === 0;
      currentRound[i].next_match_id = nextRound[parentMatchIndex].id;
      currentRound[i].next_match_slot = isHome ? 'HOME' : 'AWAY';
    }
  }

  // Populate Round 1 with teams and handle BYEs
  const round1Matches = matchesByRound[0];
  for (let i = 0; i < round1Matches.length; i++) {
    const homeSlot = slots[i * 2];
    const awaySlot = slots[i * 2 + 1];

    const match = round1Matches[i];
    match.home_team_id = homeSlot ? homeSlot.id : null;
    match.away_team_id = awaySlot ? awaySlot.id : null;

    // Check if there is a Bye
    if (homeSlot && !awaySlot) {
      // Home team gets automatic bye to Round 2
      match.winner_team_id = homeSlot.id;
      match.status = 'COMPLETED';
      match.home_score = '1 (BYE)';
      match.away_score = '0';

      if (match.next_match_id && matchesByRound[1]) {
        const nextMatch = matchesByRound[1].find((m) => m.id === match.next_match_id);
        if (nextMatch) {
          if (match.next_match_slot === 'HOME') {
            nextMatch.home_team_id = homeSlot.id;
          } else {
            nextMatch.away_team_id = homeSlot.id;
          }
        }
      }
    } else if (!homeSlot && awaySlot) {
      // Away team gets automatic bye to Round 2
      match.winner_team_id = awaySlot.id;
      match.status = 'COMPLETED';
      match.home_score = '0';
      match.away_score = '1 (BYE)';

      if (match.next_match_id && matchesByRound[1]) {
        const nextMatch = matchesByRound[1].find((m) => m.id === match.next_match_id);
        if (nextMatch) {
          if (match.next_match_slot === 'HOME') {
            nextMatch.home_team_id = awaySlot.id;
          } else {
            nextMatch.away_team_id = awaySlot.id;
          }
        }
      }
    }
  }

  // Flatten all matches into array
  matchesByRound.forEach((round) => {
    matches.push(...round);
  });

  return matches;
}
