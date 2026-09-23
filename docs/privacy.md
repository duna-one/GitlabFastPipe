# Privacy policy

Effective date: September 23, 2026.

Gitlab Fast Pipe is a Chrome extension that displays repository-defined pipeline
variable presets on GitLab's **Run pipeline** page.

## Data the extension handles

When enabled for an HTTPS GitLab origin approved by the user, the extension
reads the selected ref, the preset JSON file, and the Variables fields on the
current GitLab page. It uses this information only to display presets and fill
the current GitLab form after the user chooses a preset.

## Data collection and sharing

Gitlab Fast Pipe does not collect, store, sell, transfer, or transmit personal
data, project data, preset values, browsing activity, or analytics to the
developer or to third parties. It has no telemetry, advertising, or remote-code
loading.

The extension does not request, retain, or log GitLab passwords, cookies, or
personal access tokens. It uses the browser's existing GitLab session solely to
read the preset file from the approved GitLab origin.

## Permissions

The extension requests access only to HTTPS GitLab origins explicitly approved
by the user. This permission is needed to add the preset panel to the Run
pipeline page and read the preset file from that origin. The user can revoke
the permission at any time in Chrome's extension settings.

## Changes

Material changes to this policy will be published in this document before a
release that changes the extension's data handling.
