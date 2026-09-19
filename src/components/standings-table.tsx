import { StandingsRow } from "@/lib/tournament-engine/standings-calculator";
import { cn } from "@/lib/utils";

interface StandingsTableProps {
  standings: StandingsRow[];
  title?: string;
}

export function StandingsTable({ standings, title }: StandingsTableProps) {
  if (standings.length === 0) {
    return (
      <div className="p-8 text-center border rounded-xl bg-card text-muted-foreground text-sm">
        No standings data available yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {title && (
        <div className="p-4 border-b border-border font-bold text-sm bg-muted/30">
          {title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
            <tr>
              <th scope="col" className="px-4 py-3 w-12 text-center">Pos</th>
              <th scope="col" className="px-4 py-3">Team</th>
              <th scope="col" className="px-3 py-3 text-center">P</th>
              <th scope="col" className="px-3 py-3 text-center">W</th>
              <th scope="col" className="px-3 py-3 text-center">D</th>
              <th scope="col" className="px-3 py-3 text-center">L</th>
              <th scope="col" className="px-3 py-3 text-center">GF</th>
              <th scope="col" className="px-3 py-3 text-center">GA</th>
              <th scope="col" className="px-3 py-3 text-center">GD</th>
              <th scope="col" className="px-4 py-3 text-center font-bold text-foreground">Pts</th>
              <th scope="col" className="px-4 py-3 text-center">Form</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {standings.map((row, index) => {
              const isTop = index === 0;
              const isPromoted = index < 2;

              return (
                <tr
                  key={row.teamId}
                  className={cn(
                    "hover:bg-muted/40 transition-colors",
                    isTop && "bg-amber-500/5 font-medium"
                  )}
                >
                  <td className="px-4 py-3 text-center font-semibold">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs",
                        index === 0 && "bg-amber-500 text-white font-bold",
                        index === 1 && "bg-slate-300 text-slate-800 font-semibold",
                        index === 2 && "bg-amber-700 text-white font-semibold",
                        index > 2 && "text-muted-foreground"
                      )}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2.5 font-medium">
                    {row.teamLogo ? (
                      <img src={row.teamLogo} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                        {row.teamName.substring(0, 1)}
                      </div>
                    )}
                    <span className="truncate max-w-[160px] sm:max-w-none">{row.teamName}</span>
                  </td>
                  <td className="px-3 py-3 text-center">{row.played}</td>
                  <td className="px-3 py-3 text-center text-emerald-600 font-semibold">{row.won}</td>
                  <td className="px-3 py-3 text-center text-muted-foreground">{row.drawn}</td>
                  <td className="px-3 py-3 text-center text-red-500">{row.lost}</td>
                  <td className="px-3 py-3 text-center text-muted-foreground">{row.goalsFor}</td>
                  <td className="px-3 py-3 text-center text-muted-foreground">{row.goalsAgainst}</td>
                  <td className="px-3 py-3 text-center font-mono">
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-base text-primary font-mono">
                    {row.points}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {row.form.map((f, fIdx) => (
                        <span
                          key={fIdx}
                          className={cn(
                            "w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center text-white",
                            f === "W" && "bg-emerald-600",
                            f === "D" && "bg-amber-500",
                            f === "L" && "bg-red-500"
                          )}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
