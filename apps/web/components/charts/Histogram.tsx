import { histogramBuckets } from "../../lib/chart-math";

/** Vertical bar histogram of finalScore distribution (S-01 전사 스코어 분포). */
export function Histogram({ scores }: { scores: number[] }) {
  const buckets = histogramBuckets(scores);
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="histogram">
      {buckets.map((bucket) => (
        <div key={bucket.label} className="histogram__col">
          <span className="histogram__value">{bucket.count}</span>
          <div className="histogram__bar" style={{ height: `${(bucket.count / maxCount) * 100}%` }} />
          <span className="histogram__label">{bucket.label}</span>
        </div>
      ))}
    </div>
  );
}
