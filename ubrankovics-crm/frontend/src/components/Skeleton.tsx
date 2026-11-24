// Egységes betöltésjelző: amíg az adat nem érkezett meg, nem mutatunk nullát vagy üres állapotot.
export default function Skeleton({ cimke, sorok = 3 }: { cimke: string; sorok?: number }) {
  return (
    <div role="status" aria-label={cimke} className="space-y-3">
      <div className="h-7 w-72 max-w-full animate-pulse rounded bg-[var(--border)]" />
      {Array.from({ length: sorok }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-[var(--radius)] bg-[var(--border)]" />
      ))}
    </div>
  );
}
