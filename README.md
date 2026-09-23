# Gitlab Fast Pipe

Gitlab Fast Pipe is a Manifest V3 Chrome extension that adds reusable variable
presets to GitLab's **Run pipeline** page. Presets are read from the selected
Git ref. Select one or more tiles to fill GitLab's existing Variables fields;
click a selected tile again to remove it. The user reviews the values and
starts the pipeline with GitLab's normal button.

The extension does not store GitLab credentials, call GitLab's pipeline API,
or send project data to another service.

## Presets

Keep presets in the target repository at
`.gitlab-fast-pipe/presets.json`. Gitlab Fast Pipe reads that file from the ref
currently selected in GitLab. A complete example is available in
[`examples/presets.json`](examples/presets.json).

```json
{
  "schemaVersion": 1,
  "presets": [
    {
      "id": "server",
      "title": "Server",
      "description": "Build the server components.",
      "variables": [{ "key": "SERVER", "value": "1" }]
    }
  ]
}
```

Preset IDs and variable keys must be unique within their respective lists.
Titles, descriptions, and keys are non-empty strings; a variable value is a
string and may be empty.

## Development

Install dependencies and use the project scripts:

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

See [development notes](docs/development.md), the
[preset format](docs/presets.md), and the
[GitLab compatibility checks](docs/compatibility.md).

## Releases

A tag matching `vX.Y.Z` runs the release workflow. It checks that the tag,
`package.json`, and built manifest use the same version, verifies the package,
then uploads and submits the ZIP through Chrome Web Store API V2. The workflow
uses GitHub OIDC and Google Workload Identity Federation; it has no stored
Google key. Setup requirements are in [the release guide](docs/release.md).

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. For private
security reports, follow [SECURITY.md](SECURITY.md). The public
[privacy policy](docs/privacy.md) is suitable for the Chrome Web Store listing.

## License

This project is licensed under the [MIT License](LICENSE).
