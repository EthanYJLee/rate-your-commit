<div align="center">

# RateYourCommit

**Make developer contribution visible — and explainable. An open-source performance-visibility tool for dev teams.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](#license)
[![Self-hosted](https://img.shields.io/badge/deploy-docker%20compose-2496ED.svg)](#get-started-in-5-minutes)
[![Version](https://img.shields.io/badge/version-0.0.1-lightgrey.svg)](#roadmap)

<b>English</b> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a> · <a href="README.zh.md">中文</a> · <a href="README.es.md">Español</a>

[Why](#does-this-sound-familiar) · [Features](#key-features) · [Get Started](#get-started-in-5-minutes) · [AI Policy](#where-we-use-ai-and-where-we-dont) · [Roadmap](#roadmap)

</div>

---

## Does this sound familiar?

If you run a small-to-medium dev org, you've probably hit moments like these.

- "I know so-and-so is doing great work, but if someone pushed back, I couldn't actually point to why."
- "People have multiple GitHub/GitLab accounts, so nothing adds up when we try to tally who did what."
- "Every review cycle we grade people on gut feel, and if someone disputes it, we have nothing concrete to say."
- "We looked at performance-management SaaS, but shipping our code/HR data to someone else's servers makes us uneasy."

RateYourCommit exists to solve this as **self-hosted, open-source** software.

## Key Features

- **🔗 Automatic identity matching** — Even if one person commits under several git accounts/emails, RateYourCommit finds the candidates and merges them into a single identity. (Rule-based matching; a human always clicks to confirm.)
- **📊 Explainable scorecards** — Delivery, code quality, and collaboration metrics are computed using weights your organization sets. Every formula is fully disclosed and can be hand-checked in a spreadsheet.
- **🧹 Automatic outlier exclusion** — Things like "committed an entire vendored library" are auto-detected and excluded from scoring.
- **🔌 Connector architecture** — Plug in the tools you already use: GitHub, GitLab, Jira, Linear, and more. Adding a new integration is just one more plugin.
- **🔒 Fully self-hosted** — Neither your code nor your evaluation data ever leaves your own servers.

## Where We Use AI (and Where We Don't)

This is the single most important principle in this project.

> **We never use AI for any calculation that directly affects compensation or grading.** Everything is rules and statistics a human can verify by hand.

AI (an LLM) is used, optionally, in exactly two places — both purely reference-only helpers that never touch the final score (summarizing commit messages, summarizing peer-review comments). Even these are planned to support a choice between a local, in-house LLM and an external API. See [`docs/AI-POLICY.md`](docs/AI-POLICY.md) for details.

## Get Started in 5 Minutes

```bash
git clone https://github.com/<your-username>/rate-your-commit
cd rate-your-commit
cp .env.example .env       # minimal setup: GitHub token, etc.
docker compose up -d       # spins up web + worker + postgres together
```

Open `http://localhost:3000` → connect a repo → check your first dashboard a few minutes later. You don't need a dedicated ops person — one developer on your team is enough. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture.

## Screenshots

> _(Public repo in progress — real dashboard screenshots will be added with the first release.)_

## Roadmap

- [x] **0.0.1** — Screen design, architecture design, license/governance, README, initial repo scaffolding
- [x] **v1.0** — Identity mapping + Git/issue-tracker integration + personal scorecard (GitHub connector)
- [x] **v1.1** — GitLab / Jira / Linear connectors
- [x] **v1.2** — Email/password login, role-based access control (admin/member), CSRF protection (current version)
- [x] **v1.3** — Team hierarchy, dashboard risk alerts, compensation-grade confirm/finalize workflow
- [ ] v2.0 — Peer evaluation (360°) module
- [ ] v2.1 — Per-project performance aggregation screen, two-stage compensation approval (PM → HR)
- [ ] RateYourCommit Cloud — managed hosting + LLM-assisted features (paid)

## Contributing

We've just finished the initial scaffolding. Please leave your thoughts as an issue, or follow `CONTRIBUTING.md` to get involved. **PRs touching the scoring logic (`packages/scoring`) always require approval from at least one code owner** — this project's trust comes from the promise that "the calculation is transparent."

## License

[GNU AGPL v3.0](LICENSE). You're free to self-host, modify, and redistribute, but if you operate this code as a network service, you must also publish your modified source. This choice keeps the open-source core permanently free.

---

<div align="center">
<sub>If this project looks useful to you, please star it — how many teams need this is exactly what informs our next round of investment.</sub>
</div>
