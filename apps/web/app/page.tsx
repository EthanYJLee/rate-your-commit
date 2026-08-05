export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "4rem 1.5rem",
      }}
    >
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
        RateYourCommit · v0.0.1
      </p>
      <h1 style={{ fontSize: "2rem", lineHeight: 1.25 }}>
        개발팀의 기여를 투명하게, 설명 가능하게
      </h1>
      <p style={{ color: "var(--ink-soft)" }}>
        아직 대시보드 전체는 준비 중입니다. 지금 실제로 동작하는 화면은{" "}
        <a href="/identities">아이덴티티 매핑 큐(S-07)</a>와{" "}
        <a href="/scorecard">개인 스코어카드(S-02)</a> 둘입니다. 자세한 내용은{" "}
        <code>docs/ARCHITECTURE.md</code>를 참고하세요.
      </p>
    </main>
  );
}
