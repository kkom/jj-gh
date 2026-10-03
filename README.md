# jj-gh

A [jj](https://github.com/jj-vcs/jj) subcommand for working with GitHub. It uses only GitHub's REST API.

## `jj gh stack`

Publishes a stack of jj changes as a GitHub stack of pull requests. Each change becomes one pull request, on the branch its bookmark names, targeting the branch of the change below it.

| Command                    | What it does                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `jj gh stack check`        | Prints the stack's branches bottom to top, or says why it isn't a stack                             |
| `jj gh stack submit`       | Pushes the stack, opens the missing pull requests as drafts, and registers them as one GitHub stack |
| `jj gh stack merge <PR #>` | Squash-merges the stack up to and including that pull request, then syncs                           |
| `jj gh stack sync`         | Rebases the stack onto the fetched trunk, drops what merged, and republishes                        |

The stack is every change connected to the working copy through mutable changes. It must be a chain: one head, no merges, no conflicts, and exactly one bookmark on each change.

## Install

`jj-gh` runs on [bun](https://bun.sh), and calls `jj`. Both must be on `PATH`.

With [mise](https://mise.jdx.dev), in `mise.toml`:

```toml
[tools]
bun = "latest"
"npm:jj-gh" = "latest"
```

Or with bun directly:

```
bun install --global jj-gh
```

Then make it a jj subcommand:

```
jj config set --user aliases.gh '["util", "exec", "--", "jj-gh"]'
```

## GitHub access

`jj-gh` reads the repository from the `origin` remote. It takes its token from `GH_TOKEN` or `GITHUB_TOKEN`, and otherwise from `gh auth token`.

## Development

```
bun install
bun run check    # format, lint, types, tests and build
bun run fix      # format and lint fixes
```

To release, run `bun run release:patch`, `release:minor` or `release:major` in a pull request, which raises `version` in `package.json`. Merge it, and run the Release workflow on `main`. It publishes that version to npm and tags it.
