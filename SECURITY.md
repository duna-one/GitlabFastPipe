# Security policy

## Supported versions

Security fixes are applied to the latest released version and the current
default branch.

## Reporting a vulnerability

Do not report vulnerabilities in public issues. Send a private report to the
repository maintainers through the repository's private security-advisory
channel, including reproduction steps, impact, and affected versions.

Do not include GitLab cookies, access tokens, preset values from private
projects, or other credentials in the report. The maintainers will acknowledge
the report and coordinate disclosure after a fix is available.

## Scope

In scope are the browser extension, its packaged artifact, the GitHub Actions
workflows, and the Chrome Web Store publishing integration. GitLab instances
and user-managed preset content are outside this repository's operational
control, though input-handling vulnerabilities in the extension are in scope.
