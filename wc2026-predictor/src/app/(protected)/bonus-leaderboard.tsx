import type { BonusLeaderboardRow } from "@/lib/bonus-leaderboard";

/**
 * Compact bonus side-game standings, shown beside the main leaderboard. Purely
 * presentational: it ranks everyone who has made a bonus pick by points earned
 * from correct resolved picks. Separate from the main leaderboard and points.
 */
export function BonusLeaderboard({ rows }: { rows: BonusLeaderboardRow[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gold">
        Bonus leaderboard
      </h2>
      <div className="rounded-2xl border border-gold/30 bg-gold/[0.04] p-3 shadow-sm">
        {rows.length === 0 ? (
          <p className="text-sm text-text-muted">
            No bonus picks yet. Make a pick in the bonus box above to get on the
            board.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="px-2 py-1.5 font-medium">#</th>
                <th className="px-2 py-1.5 font-medium">Player</th>
                <th className="px-2 py-1.5 text-center font-medium">Correct</th>
                <th className="px-2 py-1.5 text-right font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-t border-border">
                  <td className="px-2 py-1.5 text-text-muted">{r.rank}</td>
                  <td className="px-2 py-1.5 text-text">{r.displayName}</td>
                  <td className="px-2 py-1.5 text-center text-text-muted">
                    {r.correct}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold text-text">
                    {r.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
