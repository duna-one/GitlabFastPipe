# Development

## Prerequisites

- Node.js 24 and npm.
- Google Chrome or another Chromium browser for manual extension testing.
- Access to a test GitLab project when testing authenticated preset loading.

## Install and validate

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run test:browser
npm run build
npm run package
npm run check:zip
```

Browser tests install Playwright's bundled Chromium in CI. If that browser is
unavailable locally, run them with an installed Chrome executable:

```sh
GFP_USE_SYSTEM_CHROME=1 npm run test:browser
```

The workflow contract expects `npm run build` to create
`dist/manifest.json`, `npm run package` to create `gitlab-fast-pipe.zip` in the
repository root, and `npm run check:zip` to validate that ZIP. Keep these
paths in sync with `.github/workflows/ci.yml` and `release.yml` if the build
layout changes.

## Manual testing

1. Run `npm run build`.
2. Open `chrome://extensions`, enable Developer mode, and select **Load
   unpacked**.
3. Select the generated `dist` directory.
4. Grant access only to an HTTPS test GitLab origin.
5. Open that project's **Run pipeline** page and select a ref containing
   `.gitlab-fast-pipe/presets.json`.
6. Verify preset loading, field insertion, conflicts with manually-added
   variables, clear selection, a ref switch, and each error state.

Use only test values in manual checks. The extension deliberately relies on the
browser's current GitLab session and must not ask for, persist, or log a token
or cookie.
