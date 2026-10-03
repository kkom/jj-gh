# jj and stacked pull requests

A stack is a linear chain of pull requests on top of the trunk (`main`), each targeting the branch below it, so reviewers see only that layer's diff. Toward the trunk is "downstack", away from it "upstack". GitHub registers such a chain as a stack of its own, and merges it atomically.

Locally a stack is a chain of jj changes, one per pull request, each with the bookmark that names its branch. jj is colocated with git, so each bookmark is also a git branch. Still, make every change to history through jj. `jj gh` does all the work on GitHub. Here it's a jj alias for this repository's own CLI, run from source, so a change to the CLI takes effect in the next command. Set it once per checkout, from the checkout's root:

```
jj config set --repo aliases.gh "[\"util\", \"exec\", \"--\", \"bun\", \"$PWD/src/main.ts\"]"
```

It uses only the REST API, stacks included, and signs in with `GH_TOKEN` or the token `gh auth login` stored.

```
◯ top-change        claude/top
@ edited-change     claude/middle
◯ bottom-change     claude/bottom
◆ main (trunk)
```

## What a good stack looks like

Every stack is based on `main`. Related work is split into granular pull requests, each with one clear goal, and each change depends on or relates to the ones below it — unrelated work is a separate stack, started with `jj new main`. A change is understandable without reading the ones above it, and includes the tests for its own code. Reverting upstack changes leaves a working CLI.

Each pull request is one change, amended in place for as long as it lives.

## What `jj gh stack check` checks

jj allows any history, but a GitHub stack must be a chain. So `check` fails on a change with two children, a merge, or a change with no bookmark or several. Its other commands run the same check before they touch the remote. The stack is every change connected to the working copy through mutable changes. Separate stacks meet only at the trunk, which is immutable, so each one is found on its own.

## Commands

All of them run from any directory of the checkout, and `jj help <command>` covers the flags.

| Command                                     | What it does                                                       |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `jj new main -m "<message>"`                | Starts a stack, or a separate one                                  |
| `jj bookmark create claude/<name> -r @`     | Names the change's branch                                          |
| `jj new -m "<message>"`                     | Adds a change on top of the working copy                           |
| `jj edit <change>`                          | Edits a change in place, wherever it sits                          |
| `jj describe -r <change> -m "<message>"`    | Rewords a change                                                   |
| `jj squash --from @ --into <change> <path>` | Moves edits from the working copy into a change below              |
| `jj split -r <change> <path>...`            | Splits a change in two, the named paths going first                |
| `jj rebase -r <change> -B <other>`          | Moves a change to just below another                               |
| `jj abandon <change>`                       | Drops a change, rebasing its descendants onto its parent           |
| `jj log -r 'trunk()::'`                     | Shows the stacks                                                   |
| `jj undo`                                   | Undoes the last operation, whatever it was                         |
| `jj gh stack submit`                        | Pushes the stack and makes its pull requests one GitHub stack      |
| `jj gh stack merge <PR #>`                  | Merges the stack up to and including that pull request, then syncs |
| `jj gh stack sync`                          | Rebases onto the fetched trunk, drops what merged, republishes     |

## Building and changing a stack

`jj edit <change>` makes a change the working copy, and every edit from then on is part of it — there is no staging and no amend. Everything upstack is rebased onto the edit as it happens. If that causes a conflict, jj records it in the change instead of stopping. Clear it with `jj resolve` or by editing the file.

jj records every file in the checkout that isn't ignored, so a scratch file written inside it becomes part of the change being edited. Scratch work belongs outside the checkout.

`jj gh stack sync` keeps a stack current with `main`; the longer it lags, the worse the conflicts.

## Publishing

`submit` pushes every branch of the stack, opens the missing pull requests as drafts titled and described by their changes, points each at the branch below it, and registers them as one GitHub stack. A stack of one is a single pull request, which GitHub has no stack for. The PR template isn't used, so set each description afterwards with `gh api -X PATCH repos/{owner}/{repo}/pulls/<n> -F body=@<file>`. Then publish the pull requests with `gh pr ready`, as `github.md` describes.

GitHub rejects a base change on a pull request that is in a stack, and can only add pull requests to a stack's top. So when a reorder, a dropped change or an insertion moves any base, `submit` dissolves the stack, moves the bases, and registers the stack again under a new number. The pull requests themselves stay open.

Before pushing, `submit` also points each pull request whose base is moving at the trunk. That's because GitHub closes a pull request as merged as soon as its head is reachable from its base, which the push would otherwise cause for a pull request that moved below its old base.

A change dropped from the stack leaves its pull request open, for closing by hand.

## Merging

`merge` squash-merges everything up to and including the pull request named, in one operation that merges all of it or none of it, and GitHub rebases the pull requests above onto the result itself. `merge` then runs `sync`, which fetches and rebases the local stack onto the new trunk. A merged change is empty after the rebase, so it's abandoned, and `sync` forgets its bookmark, whether or not GitHub has deleted the branch yet. `sync` then republishes what was already on GitHub, and leaves unpublished changes local.

Don't use the `gh stack` extension. Its local commands keep their own record of the stack in `.git/gh-stack` and move branches without jj knowing, and `jj gh` already does its GitHub work over REST.
