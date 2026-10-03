import { Array as EffectArray, Console, Data, Effect, Match, Option } from "effect";

import { GitHub, type GitHubFailed } from "./github";
import { Jj, type JjFailed } from "./jj";
import { basesFor, type PullRequest, registrationFor, titleAndBody } from "./plan";

export class NotAStack extends Data.TaggedError("NotAStack")<{ readonly message: string }> {}

// Every change connected to the working copy through mutable changes. Separate stacks meet only
// at the trunk, which is immutable, so this never reaches into another one. An empty working copy
// with no description is left out: it's the scratch change `jj new` and `jj commit` leave on top,
// or the one another workspace starts from.
export const STACK =
  'reachable(@, mutable()) ~ (working_copies() & empty() & description(exact:""))';

export const lines = (output: string): readonly string[] =>
  output.split("\n").filter((line) => line !== "");

export const changesIn = (revset: string): Effect.Effect<readonly string[], JjFailed, Jj> =>
  Effect.gen(function* () {
    const jj = yield* Jj;
    return lines(
      yield* jj.read([
        "log",
        "--no-graph",
        "-r",
        revset,
        "-T",
        String.raw`change_id.shortest(8) ++ " " ++ description.first_line() ++ "\n"`,
      ]),
    );
  });

const notAStack = (message: string, changes: readonly string[]) =>
  Effect.fail(new NotAStack({ message: [message, ...changes].join("\n") }));

/**
 * The branches of the stack containing the working copy, bottom to top. A GitHub stack must be a
 * chain, but jj allows any history: one head and no merges means the changes form a chain. Each
 * change becomes one pull request, so it needs exactly one bookmark to name its branch.
 */
export const stackBranches: Effect.Effect<readonly string[], JjFailed | NotAStack, Jj> = Effect.gen(
  function* () {
    const jj = yield* Jj;
    if ((yield* changesIn(STACK)).length === 0) {
      return yield* notAStack(
        "the working copy is on no stack; `jj edit` a change of one, or `jj new` on its top",
        [],
      );
    }
    const heads = yield* changesIn(`heads(${STACK})`);
    if (heads.length !== 1) {
      return yield* notAStack(
        "the stack has several heads, and a GitHub stack must be a chain:",
        heads,
      );
    }
    const merges = yield* changesIn(`merges() & (${STACK})`);
    if (merges.length > 0) {
      return yield* notAStack("merge commits can't be pull requests in a stack:", merges);
    }
    const conflicted = yield* changesIn(`conflicts() & (${STACK})`);
    if (conflicted.length > 0) {
      return yield* notAStack("resolve the conflicts first:", conflicted);
    }
    const bookmarks = (yield* jj.read([
      "log",
      "--no-graph",
      "--reversed",
      "-r",
      STACK,
      "-T",
      String.raw`local_bookmarks.map(|b| b.name()).join(" ") ++ "\n"`,
    ]))
      .split("\n")
      .slice(0, -1);
    if (bookmarks.includes("")) {
      return yield* notAStack(
        "every change needs a bookmark naming its branch; these have none:",
        yield* changesIn(`(${STACK}) ~ bookmarks()`),
      );
    }
    const several = bookmarks.filter((names) => names.includes(" "));
    if (several.length > 0) {
      return yield* notAStack(
        "a pull request has one branch, and these changes have several bookmarks:",
        several,
      );
    }
    return bookmarks;
  },
);

export class SeveralStacks extends Data.TaggedError("SeveralStacks")<{
  readonly message: string;
}> {}

/** The one GitHub stack containing any of the pull requests, if there is one. */
const stackContaining = (pullRequests: readonly number[]) =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    const found = yield* Effect.all(pullRequests.map((pullRequest) => github.stackOf(pullRequest)));
    const stacks = EffectArray.dedupeWith(
      found.flatMap((stack) => Option.toArray(stack)),
      (a, b) => a.number === b.number,
    );
    if (stacks.length > 1) {
      return yield* new SeveralStacks({
        message: `the pull requests belong to stacks ${stacks.map(({ number }) => `#${number}`).join(" and ")}; unstack all but one`,
      });
    }
    return Option.fromNullishOr(stacks[0]);
  });

/** Makes the pull requests, bottom to top, exactly the open part of one GitHub stack. */
const register = (pullRequests: readonly number[]) =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    const registration = registrationFor(yield* stackContaining(pullRequests), pullRequests);
    yield* Match.value(registration).pipe(
      Match.tag("UpToDate", ({ stack }) => Console.error(`stack #${stack} is up to date`)),
      Match.tag("Single", () => Effect.void),
      Match.tag("Append", ({ pullRequests: added, stack }) =>
        github
          .addToStack(stack, added)
          .pipe(Effect.andThen(Console.error(`added ${added.join(", ")} to stack #${stack}`))),
      ),
      Match.tag("Create", ({ pullRequests: all }) =>
        github
          .createStack(all)
          .pipe(Effect.flatMap((stack) => Console.error(`registered stack #${stack}`))),
      ),
      Match.tag("Replace", ({ pullRequests: all, stack }) =>
        github.unstack(stack).pipe(
          Effect.andThen(all.length > 1 ? github.createStack(all) : Effect.succeed(stack)),
          Effect.flatMap((created) => Console.error(`replaced stack #${stack} with #${created}`)),
        ),
      ),
      Match.exhaustive,
    );
  });

/** Pushes the branches, opens the pull requests missing, sets their bases, and registers them as one stack. */
export const publish = (
  branches: readonly string[],
): Effect.Effect<void, GitHubFailed | JjFailed | SeveralStacks, GitHub | Jj> =>
  Effect.gen(function* () {
    const github = yield* GitHub;
    const jj = yield* Jj;
    const trunk = yield* github.defaultBranch;
    const bases = basesFor(branches, trunk);
    const found = yield* Effect.all(branches.map((branch) => github.openPullRequest(branch)));

    // GitHub rejects a base change on a pull request that is in a stack, so a stack whose
    // bases have to move is dissolved first, and registered again at the end.
    const moving = found.flatMap((pullRequest, index) =>
      Option.isSome(pullRequest) && pullRequest.value.base !== bases[index]
        ? [pullRequest.value]
        : [],
    );
    if (moving.length > 0) {
      const stack = yield* stackContaining(moving.map(({ number }) => number));
      if (Option.isSome(stack)) {
        yield* github.unstack(stack.value.number);
      }
    }

    // GitHub closes a pull request as merged once its head is reachable from its base, and pushing
    // a pull request that moved below its old base does exactly that. Pointing it at the trunk first
    // prevents this, because its branch still has commits the trunk doesn't have.
    const current = yield* Effect.all(
      found.map((pullRequest, index) =>
        Option.match(pullRequest, {
          onNone: () => Effect.succeed(Option.none<PullRequest>()),
          onSome: (open) =>
            open.base === bases[index] || open.base === trunk
              ? Effect.succeed(Option.some(open))
              : github
                  .setBase(open.number, trunk)
                  .pipe(Effect.as(Option.some({ ...open, base: trunk }))),
        }),
      ),
    );

    // Jj only creates a branch on the remote for a bookmark that tracks it.
    for (const branch of branches) {
      const tracked = yield* jj.read([
        "bookmark",
        "list",
        "--tracked",
        "--remote",
        "origin",
        "-T",
        String.raw`name ++ "\n"`,
        `exact:${branch}`,
      ]);
      if (tracked.trim() === "") {
        yield* jj.run(["bookmark", "track", `exact:${branch}`, "--remote", "origin"]);
      }
    }
    yield* jj.run([
      "git",
      "push",
      ...branches.flatMap((branch) => ["--bookmark", `exact:${branch}`]),
    ]);

    const numbers = yield* Effect.all(
      branches.map((branch, index) =>
        Effect.gen(function* () {
          const base = bases[index] ?? trunk;
          const existing = current[index] ?? Option.none<PullRequest>();
          if (Option.isNone(existing)) {
            const description = yield* jj.read([
              "log",
              "--no-graph",
              "-r",
              `bookmarks(exact:"${branch}")`,
              "-T",
              "description",
            ]);
            const created = yield* github.createPullRequest({
              ...titleAndBody(description),
              base,
              head: branch,
            });
            yield* Console.error(`opened #${created} for ${branch}`);
            return created;
          }
          if (existing.value.base !== base) {
            yield* github.setBase(existing.value.number, base);
          }
          return existing.value.number;
        }),
      ),
    );

    yield* register(numbers);
  });

export const submit = stackBranches.pipe(Effect.flatMap(publish));
