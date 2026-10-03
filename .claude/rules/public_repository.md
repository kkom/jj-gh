# This repository is public

## Never mention a private repository

Don't name or describe a private repository anywhere here: code, comments, tests, fixtures, configuration, documentation, commit messages, branch names, pull request titles and descriptions, review comments and issues.

That holds even where the work was inspired by a private repository, copied from one, or is kept aligned with one. Describe the change on its own terms, without saying where it came from.

That's because everything pushed here is readable by anyone, and can't be fully taken back. GitHub keeps the edit history of a pull request description, and a commit replaced by a force-push stays reachable by its SHA.

- ❌ "Moved from `packages/some-cli` in the private monorepo."
- ✅ "Adds the CLI."
- ❌ A test fixture using a private repository's URL.
- ✅ A fixture using this repository's URL, or a made-up one.
- ❌ "Keeps the lint rules in line with our other repositories."
- ✅ No mention at all.

## What counts as mentioning

- The repository's name, owner or URL.
- Its paths, package names, internal service names and hostnames.
- Markers its tooling reads, and configuration entries that only make sense there.
- The fact that such a repository exists, or that something here matches it.

## Check before the first push

Search the files, the commit messages and the pull request text for the names above before pushing a branch or publishing a description. Configuration copied from elsewhere gets trimmed to what this repository uses.
