# Publishing `@robot-face/sdk` to npm

This package is **publish-ready** at version **0.1.0**. The monorepo does **not** publish automatically unless you configure npm credentials in CI or run publish locally.

## Pre-flight checklist

1. **Version** — bump `packages/robot-face-sdk/package.json` and root `CHANGELOG.md` (semver).
2. **Build** — from repo root:
   ```bash
   npm ci
   npm run build -w @robot-face/sdk
   npm test -w @robot-face/sdk
   ```
3. **Dry-run tarball** (what npm would ship):
   ```bash
   npm pack -w @robot-face/sdk
   tar -tzf robot-face-sdk-0.1.0.tgz
   ```
   Expect: `package/dist/**`, `package/README.md`, `package/LICENSE`, `package/package.json` (no tests or source `.ts`).

## Local publish (manual)

```bash
npm login
npm publish -w @robot-face/sdk --access public
```

`publishConfig.access` is set to `public` for scoped package `@robot-face/sdk`.

## CI / GitHub Release (tags only)

- Pushing a tag `v*` triggers [.github/workflows/release.yml](../../.github/workflows/release.yml) to create a **GitHub Release** (release notes stub).
- **npm publish** is **not** wired by default. To enable in CI, add repository secret `NPM_TOKEN` and uncomment the publish step in `release.yml`.

## Semver policy (0.x)

- **0.1.x** — patch: bug fixes, docs, non-breaking SDK additions.
- **0.2.0** — minor: new adapters, wire message types, or behavior changes that remain backward compatible where documented.
- **1.0.0** — first stable API once OEM bridges and stream protocol are frozen for partners.

Breaking changes require a changelog entry and version bump per [CHANGELOG.md](../../CHANGELOG.md).
