// Supported sports in PlayNear — ONLY these 4 are allowed.
// DO NOT add any other sports.

export type SupportedSportSlug = 'cricket' | 'football' | 'kabaddi' | 'volleyball';

export interface SupportedSport {
  slug: SupportedSportSlug;
  name: string;
  emoji: string;
  label: string; // emoji + name combined
  positions?: string[]; // default positions/roles
}

export const SUPPORTED_SPORTS: SupportedSport[] = [
  {
    slug: 'cricket',
    name: 'Cricket',
    emoji: '🏏',
    label: '🏏 Cricket',
    positions: ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'],
  },
  {
    slug: 'football',
    name: 'Football',
    emoji: '⚽',
    label: '⚽ Football',
    positions: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Striker'],
  },
  {
    slug: 'kabaddi',
    name: 'Kabaddi',
    emoji: '🤼',
    label: '🤼 Kabaddi',
    positions: ['Raider', 'Defender', 'All-rounder'],
  },
  {
    slug: 'volleyball',
    name: 'Volleyball',
    emoji: '🏐',
    label: '🏐 Volleyball',
    positions: ['Outside Hitter', 'Middle Blocker', 'Setter', 'Libero', 'Opposite Hitter'],
  },
];

export const SUPPORTED_SPORT_SLUGS: SupportedSportSlug[] = SUPPORTED_SPORTS.map(s => s.slug);

export function getSportBySlug(slug: string): SupportedSport | undefined {
  return SUPPORTED_SPORTS.find(s => s.slug === slug);
}

export function getSportEmoji(slug: string): string {
  return getSportBySlug(slug)?.emoji ?? '🏆';
}

export function getSportLabel(slug: string): string {
  return getSportBySlug(slug)?.label ?? slug;
}

export function getSportPositions(slug: string): string[] {
  return getSportBySlug(slug)?.positions ?? [];
}
