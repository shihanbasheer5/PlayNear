import { Tournament, TournamentStatus } from "@/types/database.types";

/**
 * Checks whether a tournament has reached or passed its start date/time.
 * If true, registration is automatically closed.
 */
export function hasTournamentStarted(startDateStr: string | null | undefined): boolean {
  if (!startDateStr) return false;
  try {
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return false;
    return new Date() >= start;
  } catch {
    return false;
  }
}

/**
 * Checks whether a tournament's registration deadline has passed.
 * Only triggers if the deadline is a genuine timestamp strictly after registration started
 * and before tournament start date.
 */
export function hasRegistrationDeadlinePassed(
  endDateStr: string | null | undefined,
  startDateStr?: string | null | undefined,
  tournStartDateStr?: string | null | undefined
): boolean {
  if (!endDateStr) return false;
  try {
    const end = new Date(endDateStr).getTime();
    if (isNaN(end)) return false;

    // If registration_start_date is known and regEnd is equal to or before regStart,
    // it was an auto-default creation timestamp, NOT a real deadline.
    if (startDateStr) {
      const start = new Date(startDateStr).getTime();
      if (!isNaN(start) && end <= start + 60000) {
        return false;
      }
    }

    // If tournament start date is in the future, an end date in the past without a distinct
    // future deadline is treated as default (registration stays open until tournament starts)
    if (tournStartDateStr) {
      const tournStart = new Date(tournStartDateStr).getTime();
      if (!isNaN(tournStart) && Date.now() < tournStart && end < Date.now()) {
        return false;
      }
    }

    return Date.now() >= end;
  } catch {
    return false;
  }
}

/**
 * Checks whether a tournament has concluded (is over).
 * A tournament is over if:
 * 1. Its status is explicitly COMPLETED.
 * 2. Its tournament_end_date has passed (end of day).
 * 3. Or if no end date is given, its tournament_start_date has passed (end of day).
 */
export function isTournamentOver(tournament: {
  status?: string | null;
  tournament_start_date?: string | null;
  tournament_end_date?: string | null;
} | null | undefined): boolean {
  if (!tournament) return true;
  const rawStatus = (tournament.status || "").toUpperCase();
  if (rawStatus === "COMPLETED" || rawStatus === "FINISHED" || rawStatus === "CANCELLED" || rawStatus === "DELETED") return true;

  const now = new Date();

  // If tournament_end_date is provided, check if that entire day has concluded
  if (tournament.tournament_end_date) {
    try {
      const end = new Date(tournament.tournament_end_date);
      end.setHours(23, 59, 59, 999);
      if (!isNaN(end.getTime()) && now > end) {
        return true;
      }
    } catch {}
  } else if (tournament.tournament_start_date) {
    // Single-day tournament: concludes after the end of tournament_start_date
    try {
      const start = new Date(tournament.tournament_start_date);
      start.setHours(23, 59, 59, 999);
      if (!isNaN(start.getTime()) && now > start) {
        return true;
      }
    } catch {}
  }

  return false;
}

/**
 * Checks whether registration is currently open for a tournament.
 * Registration is strictly CLOSED if:
 * 1. The tournament is over or has already started (tournament_start_date <= now)
 * 2. The tournament has reached maximum capacity (registered_count >= max_teams)
 * 3. The status is not REGISTRATION_OPEN (e.g. DRAFT, ONGOING, COMPLETED, CANCELLED, REGISTRATION_CLOSED)
 * 4. A genuine registration deadline has elapsed before tournament start
 */
export function isTournamentRegistrationOpen(tournament: {
  status?: string | null;
  tournament_start_date?: string | null;
  registration_start_date?: string | null;
  registration_end_date?: string | null;
  max_teams?: number | null;
  registered_count?: number | null;
}): boolean {
  // If tournament is over or has started, registration is automatically closed!
  if (isTournamentOver(tournament) || hasTournamentStarted(tournament.tournament_start_date)) {
    return false;
  }

  // If max capacity reached
  const count =
    typeof tournament.registered_count === "number"
      ? tournament.registered_count
      : typeof (tournament as { approved_teams_count?: number }).approved_teams_count === "number"
      ? (tournament as { approved_teams_count?: number }).approved_teams_count
      : null;

  if (
    typeof tournament.max_teams === "number" &&
    typeof count === "number" &&
    tournament.max_teams > 0 &&
    count >= tournament.max_teams
  ) {
    return false;
  }

  // If explicit non-open status
  if (
    tournament.status === "REGISTRATION_CLOSED" ||
    tournament.status === "COMPLETED" ||
    tournament.status === "CANCELLED" ||
    tournament.status === "DRAFT"
  ) {
    return false;
  }

  // Check valid deadline if one was explicitly configured
  if (
    hasRegistrationDeadlinePassed(
      tournament.registration_end_date,
      tournament.registration_start_date,
      tournament.tournament_start_date
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Computes the dynamic / effective status of a tournament.
 * - If tournament date is over -> COMPLETED
 * - If tournament start date has arrived/passed but not over -> ONGOING (Live)
 * - If tournament start date has not yet arrived -> REGISTRATION_OPEN (unless full capacity reached or manually closed)
 */
export function getEffectiveTournamentStatus(tournament: {
  status?: string | null;
  tournament_start_date?: string | null;
  tournament_end_date?: string | null;
  registration_start_date?: string | null;
  registration_end_date?: string | null;
  max_teams?: number | null;
  registered_count?: number | null;
}): TournamentStatus {
  const rawStatus = (tournament.status || "DRAFT") as TournamentStatus;

  // Preserve explicit CANCELLED or DRAFT
  if (rawStatus === "CANCELLED" || rawStatus === "DRAFT") {
    return rawStatus;
  }

  // 1. If tournament is over -> COMPLETED
  if (isTournamentOver(tournament)) {
    return "COMPLETED";
  }

  // 2. If tournament has started (and not over) -> ONGOING (Live)
  if (hasTournamentStarted(tournament.tournament_start_date)) {
    if (rawStatus === "COMPLETED") {
      return "COMPLETED";
    }
    return "ONGOING";
  }

  // 3. If tournament has NOT started yet (start date is in the future):
  // Check if max teams capacity reached
  const count =
    typeof tournament.registered_count === "number"
      ? tournament.registered_count
      : typeof (tournament as { approved_teams_count?: number }).approved_teams_count === "number"
      ? (tournament as { approved_teams_count?: number }).approved_teams_count
      : null;

  if (
    typeof tournament.max_teams === "number" &&
    typeof count === "number" &&
    tournament.max_teams > 0 &&
    count >= tournament.max_teams
  ) {
    return "REGISTRATION_CLOSED";
  }

  // Check valid deadline if one was explicitly configured
  if (
    hasRegistrationDeadlinePassed(
      tournament.registration_end_date,
      tournament.registration_start_date,
      tournament.tournament_start_date
    )
  ) {
    return "REGISTRATION_CLOSED";
  }

  // If rawStatus was manually set to REGISTRATION_CLOSED, keep it
  if (rawStatus === "REGISTRATION_CLOSED") {
    return "REGISTRATION_CLOSED";
  }

  // Tournament hasn't started yet -> Registration is OPEN!
  return "REGISTRATION_OPEN";
}
