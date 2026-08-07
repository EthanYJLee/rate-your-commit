# Security Policy

RateYourCommit is self-hosted software that handles internal performance
and compensation data, so we treat security reports seriously and
appreciate responsible disclosure.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, use [GitHub Security Advisories](../../security/advisories/new)
for this repository to report privately. Include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce (a minimal repro is very helpful).
- The affected version/commit, if known.

We aim to acknowledge reports within a few days. Since this is an early-stage
project without a dedicated security team, response times may vary — thank
you for your patience.

## Scope

Particularly relevant given what this app handles:

- Authentication/authorization (`apps/web/auth.ts`, `apps/web/lib/request-guard.ts`,
  `apps/web/proxy.ts`) — role-based access control and session handling.
- Anything that could leak one employee's data to another who shouldn't see it.
- Anything that could let a non-admin escalate to admin.

## Out of Scope

- Vulnerabilities that require you to already control the deployment's
  environment variables, database, or a maintainer/admin account.
- Denial of service via resource exhaustion in a self-hosted, single-tenant
  deployment (not applicable in the same way it would be for a multi-tenant
  SaaS).
