# jj-gh

A [jj](https://github.com/jj-vcs/jj) subcommand for working with GitHub that supports stacking.

> [!WARNING]
> `jj-gh` is in early development, and its commands may change. So far it is largely vibe coded.

## Usage

Run `jj gh --help` to list the commands.

## Install

`jj-gh` runs on [bun](https://bun.sh), and calls `jj`. Both must be on `PATH`.

### For one repository

With [mise](https://mise.jdx.dev), in the repository's `mise.toml`, where `A.B.C` is a bun version and `X.Y.Z` a [released version](https://www.npmjs.com/package/jj-gh?activeTab=versions) of `jj-gh`:

```toml
[tools]
bun = "A.B.C"

[tools."npm:jj-gh"]
version = "X.Y.Z"
# mise holds back a package that is new or rarely downloaded, and this approves it.
allow_low_downloads = true
```

Then make it a jj subcommand. The alias isn't committed, so run this once in each checkout:

```
jj config set --repo aliases.gh '["util", "exec", "--", "jj-gh"]'
```

### For every repository

```
bun install --global jj-gh
jj config set --user aliases.gh '["util", "exec", "--", "jj-gh"]'
```

To update it later:

```
bun update --global --latest jj-gh
```

## GitHub access

`jj-gh` reads the repository from the `origin` remote. It takes its token from `GH_TOKEN` or `GITHUB_TOKEN`, and otherwise from `gh auth token`.

It uses only GitHub's REST API, so that it works in a [Claude Code](https://claude.com/claude-code) cloud session. There, GitHub is reached through a proxy that allows REST calls for the session's repository and blocks GraphQL, which `gh pr` depends on.

## Development

```
bun install
bun run check    # format, lint, types, tests and build
bun run fix      # format and lint fixes
```

To release, run `bun run release:patch`, `release:minor` or `release:major` in a pull request, which raises `version` in `package.json`. Once it is merged and the checks pass on `main`, the same workflow publishes that version to npm and tags it.
