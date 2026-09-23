# Contributing

## Before opening a pull request

1. Keep each change focused on one user-visible behavior or maintenance task.
2. Add or update tests for behavior changes.
3. Run the full local gate:

   ```sh
   npm run typecheck
   npm run lint
   npm test
   npm run test:browser
   npm run build
   npm run package
   npm run check:zip
   ```

4. Describe the user effect, validation performed, and any remaining test gap
   in the pull request.

## Extension constraints

- Preserve GitLab's native pipeline-start action. The extension must never
  invoke it or call the GitLab pipeline API.
- Treat remote preset JSON and GitLab page content as untrusted input.
- Do not add host permissions for sites that the user did not explicitly grant.
- Do not commit production ZIPs, credentials, access tokens, cookies, or
  captured project data.

## Commit messages

Write commit messages in Russian. Use an imperative summary that states the
change, for example: `Добавить проверку версии пакета`.

## Documentation

Keep user-facing documentation and code comments in English. Update
[`docs/presets.md`](docs/presets.md) whenever the preset schema changes and
[`docs/release.md`](docs/release.md) whenever release inputs change.
