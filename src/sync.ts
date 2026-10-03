import { Console, Effect, Option } from "effect";

import { GitHub, type GitHubFailed } from "./github";
import { Jj, type JjFailed } from "./jj";
import {
  changesIn,
  lines,
  type NotAStack,
  publish,
  type SeveralStacks,
  STACK,
  stackBranches,
} from "./stack";

// `jj bookmark list` also prints a bookmark's remote copy where it points elsewhere, as a merged
// branch's does, so the template keeps the local one alone.
const bookmarksAt = (revset: string) =>
  Effect.gen(function* () {
    const jj = yield* Jj;
    return lines(
      yield* jj.read([
        "bookmark",
        "list",
        "-r",
        revset,
        "-T",
        String.raw`if(!remote, name ++ "\n")`,
      ]),
    );
  });

/**
 * Rebases the stack onto the fetched trunk and republishes what was already on GitHub. A squash
 * merge adds the merged work to the trunk as a new commit, so the original change still sits under
 * the rest of the stack. Rebased onto the trunk it's empty, and `--skip-emptied` abandons it.
 *
 * GitHub deletes a merged branch, but can do so after the fetch, and the bookmark then stays behind on
 * the trunk. So every bookmark that was in the stack and is now on the trunk is forgotten, remote side
 * included, rather than left for the next fetch.
 */
export const sync = Effect.gen(function* () {
  const jj = yield* Jj;
  const inStack = yield* bookmarksAt(STACK);
  yield* jj.run(["git", "fetch"]);
  yield* jj.run([
    "rebase",
    "--source",
    `roots(${STACK})`,
    "--destination",
    "trunk()",
    "--skip-emptied",
  ]);
  const merged = (yield* bookmarksAt("::trunk()")).filter((name) => inStack.includes(name));
  for (const name of merged) {
    yield* jj.run(["bookmark", "forget", "--include-remotes", `exact:${name}`]);
  }
  if ((yield* changesIn(STACK)).length === 0) {
    // The fetch left the working copy on the old trunk, where the merged changes began.
    yield* jj.run(["new", "trunk()"]);
    yield* Console.error("every change of the stack has merged");
    return;
  }
  const branches = yield* stackBranches;
  // Only republish up to the highest branch already on GitHub, so local work above it stays unpublished.
  const published = yield* Effect.all(
    branches.map((branch) =>
      jj.read([
        "log",
        "--no-graph",
        "-r",
        `remote_bookmarks(exact:"${branch}", exact:origin)`,
        "-T",
        '"x"',
      ]),
    ),
  );
  const top = published.findLastIndex((output) => output !== "");
  if (top !== -1) {
    yield* publish(branches.slice(0, top + 1));
  }
});

/**
 * Merges the pull request. One in a stack is merged through the stack API, together with everything
 * below it, or nothing at all. One outside a stack is merged normally. Then syncs.
 */
export const merge = (
  pullRequest: number,
): Effect.Effect<void, GitHubFailed | JjFailed | NotAStack | SeveralStacks, GitHub | Jj> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    if (Option.isSome(yield* github.stackOf(pullRequest))) {
      if ((yield* github.mergeStack(pullRequest)) === "enqueued") {
        yield* Console.error("queued to merge; run `jj gh stack sync` once it has");
        return;
      }
    } else {
      yield* github.mergePullRequest(pullRequest);
    }
    yield* Console.error(`merged up to #${pullRequest}`);
    yield* sync;
  });
