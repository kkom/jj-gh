# Terminology

## Use "change", "bookmark" and "branch" for three different things

- A change is the work itself: edits and a description, as a commit is in git. It becomes one pull request.
- A bookmark is a label attached to a change. A change can have none, one or several.
- A branch is what GitHub has. `jj git push` creates a branch with the bookmark's name.

That's because each word tells a reader where the value lives. A bookmark may not be pushed yet, so calling it a branch claims more than is known.

- ❌ `stackBranches`, for names read from jj.
- ✅ `stackBookmarks`
- ❌ "Merge a bookmark's pull request."
- ✅ "Merge the pull requests of a change and the ones below it."
- ✅ `openPullRequest(branch)` and a pull request's `head` and `base`. These are GitHub's.

## Keep the name "bookmark" until the value reaches the GitHub client

That's because copying it into a `branch` variable gives one value two names.

- ❌ `const branch = bookmark;`
- ✅ `github.openPullRequest(bookmark)`
