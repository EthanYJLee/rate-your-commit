## What does this PR do?

<!-- Brief description. Link a related issue if one exists. -->

## Checklist

- [ ] Tests added/updated for the change
- [ ] `npm test` passes locally
- [ ] `npm run build -w apps/web` passes locally
- [ ] If this touches `packages/scoring`: stayed pure (no DB/network/filesystem
      I/O), includes unit tests, and is ready for a code-owner review
      (see CONTRIBUTING.md)
- [ ] If this touches auth/RBAC/CSRF (`apps/web/auth.ts`, `lib/request-guard.ts`,
      `proxy.ts`): called out explicitly in the description, since these are
      security-sensitive
- [ ] Docs updated if behavior visible to users/self-hosters changed
      (README, `.env.example`, `docs/ARCHITECTURE.md`)
