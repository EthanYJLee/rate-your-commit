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
        아직 저장소 연결 전입니다. 설정을 마치면 이 화면이 팀 대시보드로
        바뀝니다. 자세한 내용은{" "}
        <a href="https://github.com/">docs/ARCHITECTURE.md</a>를 참고하세요.
      </p>
    </main>
  );
}
