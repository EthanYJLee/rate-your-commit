# Contributing to RateYourCommit

아직 초기 단계 프로젝트입니다. 큰 기능 추가 전에는 먼저 이슈를 열어 방향을 맞춰주세요.

## 개발 환경

- Node.js 20+
- npm (workspaces 사용, 별도 pnpm/yarn 설치 불필요)

```bash
npm install
npm run dev -w apps/web
```

## 저장소 구조

`docs/ARCHITECTURE.md`를 먼저 읽어주세요. 요약:

- `apps/web` — Next.js 클라이언트 + API
- `apps/worker` — 외부 연동 동기화 잡
- `packages/connectors` — GitHub/GitLab/Jira 등 어댑터
- `packages/scoring` — 점수 계산 순수 함수 (신뢰 핵심)
- `packages/db` — Prisma 스키마

## 채점 로직(`packages/scoring`) 관련 PR 규칙

이 프로젝트의 신뢰는 "점수 계산이 투명하다"는 약속에서 나옵니다. 그래서 `packages/scoring`을 건드리는 PR은:

1. 반드시 순수 함수로 유지 — 외부 I/O(DB, 네트워크, 파일시스템) 호출 금지
2. 관련 단위 테스트를 함께 포함
3. 코드오너 1인 이상의 승인 필요

## AI 보조 기능 관련 PR 규칙

`packages/ai-assist`는 `packages/scoring`과 완전히 분리되어 있어야 합니다. LLM 호출 결과가 최종 점수 계산에 직접 들어가는 PR은 받지 않습니다 (설계 원칙은 `docs/AI-POLICY.md` 참고).

## 커밋 메시지

특별한 컨벤션을 강제하지 않지만, 무엇을 왜 바꿨는지 알 수 있게 써주세요.

## 라이선스

기여한 코드는 프로젝트의 라이선스(AGPL-3.0)를 따릅니다.
