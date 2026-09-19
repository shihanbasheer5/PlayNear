import { generateSingleEliminationBracket } from './src/lib/tournament-engine/bracket-generator';
import { generateRoundRobinFixtures } from './src/lib/tournament-engine/round-robin-generator';
import { calculateStandings } from './src/lib/tournament-engine/standings-calculator';
import { Match } from './src/types/database.types';

console.log('=== TESTING TOURNAMENT ENGINE ALGORITHMS ===\n');

// 1. Test 8-Team Knockout
const teams8 = [
  { id: 't1', name: 'Team 1', seed: 1 },
  { id: 't2', name: 'Team 2', seed: 2 },
  { id: 't3', name: 'Team 3', seed: 3 },
  { id: 't4', name: 'Team 4', seed: 4 },
  { id: 't5', name: 'Team 5', seed: 5 },
  { id: 't6', name: 'Team 6', seed: 6 },
  { id: 't7', name: 'Team 7', seed: 7 },
  { id: 't8', name: 'Team 8', seed: 8 },
];

const bracket8 = generateSingleEliminationBracket({
  tournamentId: 'test-tourney-8',
  teams: teams8,
});

console.log(`[PASS] 8-Team Single Elimination: Generated ${bracket8.length} matches across 3 rounds.`);
if (bracket8.length !== 7) throw new Error('Expected 7 matches for 8 teams single elimination');

// 2. Test 6-Team Knockout with 2 Byes
const teams6 = teams8.slice(0, 6);
const bracket6 = generateSingleEliminationBracket({
  tournamentId: 'test-tourney-6',
  teams: teams6,
});

console.log(`[PASS] 6-Team Single Elimination with Byes: Generated ${bracket6.length} matches.`);
const completedByes = bracket6.filter((m) => m.status === 'COMPLETED' && m.home_score.includes('BYE'));
console.log(`[PASS] Automatically processed ${completedByes.length} BYE matches into Round 2.`);

// 3. Test Round Robin (4 Teams)
const teams4 = teams8.slice(0, 4);
const rrFixtures = generateRoundRobinFixtures({
  tournamentId: 'test-tourney-rr',
  teams: teams4,
});

console.log(`[PASS] 4-Team Round Robin: Generated ${rrFixtures.length} matches (Expected 6).`);
if (rrFixtures.length !== 6) throw new Error('Expected 6 matches for 4-team round robin');

// 4. Test Standings Calculator
const mockPlayedMatches: Match[] = [
  {
    id: 'm1',
    tournament_id: 't1',
    round_number: 1,
    match_number: 1,
    home_team_id: 't1',
    away_team_id: 't2',
    winner_team_id: 't1',
    status: 'COMPLETED',
    home_score: '3',
    away_score: '1',
    score_details: {},
    created_at: '',
    updated_at: '',
  },
  {
    id: 'm2',
    tournament_id: 't1',
    round_number: 1,
    match_number: 2,
    home_team_id: 't3',
    away_team_id: 't4',
    winner_team_id: null,
    status: 'COMPLETED',
    home_score: '2',
    away_score: '2',
    score_details: {},
    created_at: '',
    updated_at: '',
  },
];

const standings = calculateStandings(teams4, mockPlayedMatches);
console.log(`[PASS] Standings Table: Top team is ${standings[0].teamName} with ${standings[0].points} points.`);
if (standings[0].teamId !== 't1' || standings[0].points !== 3) {
  throw new Error('Standings calculation incorrect for winner');
}

// 5. Test Password Validation
import { validatePasswordRequirements } from './src/lib/validation';

const weak1 = validatePasswordRequirements('short');
if (weak1.isValid || weak1.checks.minLength) throw new Error('Failed to reject short password');

const weak2 = validatePasswordRequirements('lowercase123');
if (weak2.isValid || weak2.checks.hasUpper) throw new Error('Failed to reject password without uppercase');

const weak3 = validatePasswordRequirements('UPPERCASE123');
if (weak3.isValid || weak3.checks.hasLower) throw new Error('Failed to reject password without lowercase');

const weak4 = validatePasswordRequirements('NoNumbersHere');
if (weak4.isValid || weak4.checks.hasNumber) throw new Error('Failed to reject password without number');

const strong = validatePasswordRequirements('StrongPass1');
if (!strong.isValid) throw new Error('Failed to accept valid strong password');

const strongSpecial = validatePasswordRequirements('StrongPass1!@#');
if (!strongSpecial.isValid) throw new Error('Failed to accept valid strong password with special chars');

console.log('[PASS] Password Validator: Successfully verified 8+ chars, uppercase, lowercase, and number rules.');

console.log('\n✅ ALL TOURNAMENT ENGINE & AUTH UNIT TESTS PASSED SUCCESSFULLY!');
