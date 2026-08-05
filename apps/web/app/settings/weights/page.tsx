import { DEFAULT_ORGANIZATION_ID, prisma } from "@rateyourcommit/db";

export const dynamic = "force-dynamic";

const DEFAULT_WEIGHTS = { delivery: 50, quality: 50, collaboration: 0, evaluation: 0 };

const AXIS_FIELDS = [
  { key: "delivery", label: "딜리버리" },
  { key: "quality", label: "품질" },
  { key: "collaboration", label: "협업 (v1 미구현 — 0 권장)" },
  { key: "evaluation", label: "동료평가 (v1 미구현 — 0 권장)" },
] as const;

export default async function WeightSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const current = await prisma.scoreWeightConfig.findFirst({
    where: { organizationId: DEFAULT_ORGANIZATION_ID },
    orderBy: { effectiveFrom: "desc" },
  });
  const weights = current ?? DEFAULT_WEIGHTS;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <p
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: ".75rem",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--accent)",
          fontWeight: 700,
        }}
      >
        조직 설정 · 축 가중치
      </p>
      <h1 style={{ fontSize: "1.75rem", marginBottom: ".5rem" }}>스코어 가중치</h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: "1rem" }}>
        네 축의 합은 반드시 100이어야 합니다. 저장하면{" "}
        {current ? `${current.effectiveFrom.toISOString().slice(0, 10)}부터 적용 중인 값을 덮어쓰지 않고` : ""}{" "}
        새 버전이 지금 시점부터 적용되며, 과거에 계산된 스코어는 그대로 남습니다.
      </p>

      {error && (
        <p
          style={{
            color: "var(--danger, #c0392b)",
            border: "1px solid currentColor",
            borderRadius: 4,
            padding: ".6rem .8rem",
            marginBottom: "1.5rem",
          }}
        >
          {error}
        </p>
      )}

      <form action="/api/settings/weights" method="POST">
        {AXIS_FIELDS.map((field) => (
          <label
            key={field.key}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".8rem" }}
          >
            <span>{field.label}</span>
            <input
              type="number"
              name={field.key}
              defaultValue={weights[field.key]}
              min={0}
              max={100}
              step="0.1"
              required
              style={{ width: "5rem", fontFamily: "ui-monospace, monospace", textAlign: "right" }}
            />
          </label>
        ))}
        <button type="submit" style={{ marginTop: ".5rem" }}>
          저장
        </button>
      </form>
    </main>
  );
}
