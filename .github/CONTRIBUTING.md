# Contributing

Thanks for contributing.

## Workflow

1. Fork the repository and create a feature branch from `main`.
2. Keep changes focused and atomic.
3. Add or update tests when behavior changes.
4. Run checks locally before opening a PR.

## Local Checks

- `npm run verify:telegram-bot`
- `npx tsc --noEmit`
- `npm test` (when touching tested modules)

## Pull Request Guidelines

- Describe what changed and why.
- Include risk notes and rollback plan for behavior changes.
- Include screenshots/log samples for UI or bot output changes.
- Reference related issues.

## Commit Style

Use conventional-style messages, for example:
- `feat: ...`
- `fix: ...`
- `chore: ...`

## Code Standards

- TypeScript strictness must remain green.
- Use fallback-safe output for Telegram responses.
- Avoid breaking backward compatibility for report payload fields.
