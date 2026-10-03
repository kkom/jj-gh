import { describe, expect, it } from "bun:test";

import { Effect, Layer, Option } from "effect";

import { GitHub } from "./github";
import { Jj } from "./jj";
import type { PullRequest, RemoteStack } from "./plan";
import { NotAStack, stackBranches, submit } from "./stack";
import { sync } from "./sync";

interface JjOutputs {
  readonly bookmarks: string;
  readonly changes?: string;
  readonly inStack?: string;
  readonly onTrunk?: string;
  readonly heads?: string;
  readonly merges?: string;
}

// What each read returns, found by the revset or subcommand it names.
const outputFor = (outputs: JjOutputs, args: readonly string[]): string => {
  const names = (prefix: string): boolean => args.some((arg) => arg.startsWith(prefix));
  if (args.includes("--reversed")) {
    return outputs.bookmarks;
  }
  if (names("heads(")) {
    return outputs.heads ?? "abc top\n";
  }
  if (names("merges()")) {
    return outputs.merges ?? "";
  }
  if (names("conflicts()")) {
    return "";
  }
  if (args[0] === "bookmark" && args.includes("-r")) {
    return (args.includes("::trunk()") ? outputs.onTrunk : outputs.inStack) ?? "";
  }
  if (args[0] === "bookmark") {
    return "tracked\n";
  }
  return args.includes("description")
    ? "A change\n\nWhy it's made.\n"
    : (outputs.changes ?? "abc a change\n");
};

// A jj whose reads return `outputFor`, and which records the commands it runs.
const fakeJj = (outputs: JjOutputs) => {
  const ran: string[] = [];
  const layer = Layer.succeed(Jj, {
    read: (args) => Effect.succeed(outputFor(outputs, args)),
    run: (args) =>
      Effect.sync(() => {
        ran.push(args.join(" "));
      }),
  });
  return { layer, ran };
};

// A GitHub with the given open pull requests and stack, recording every call that changes something.
const fakeGitHub = (
  open: Readonly<Record<string, PullRequest>>,
  stack: Option.Option<RemoteStack>,
) => {
  const calls: string[] = [];
  let registered = stack;
  const record = (call: string) =>
    Effect.sync(() => {
      calls.push(call);
    });
  const layer = Layer.succeed(GitHub, {
    addToStack: (number, pullRequests) => record(`add ${pullRequests.join(",")} to #${number}`),
    createPullRequest: ({ base, head }) => record(`open ${head} on ${base}`).pipe(Effect.as(99)),
    createStack: (pullRequests) =>
      record(`create stack ${pullRequests.join(",")}`).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            registered = Option.some({ number: 8, open: pullRequests });
          }),
        ),
        Effect.as(8),
      ),
    defaultBranch: Effect.succeed("main"),
    mergePullRequest: () => Effect.die("unused"),
    mergeStack: () => Effect.die("unused"),
    openPullRequest: (branch) => Effect.succeed(Option.fromNullishOr(open[branch])),
    setBase: (number, base) => record(`base #${number} → ${base}`),
    stackOf: () => Effect.sync(() => registered),
    unstack: (number) =>
      record(`unstack #${number}`).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            registered = Option.none();
          }),
        ),
      ),
  });
  return { calls, layer };
};

describe("stackBranches", () => {
  it("lists the bookmarks bottom to top", async () => {
    const jj = fakeJj({ bookmarks: "a\nb\n" });
    expect(await Effect.runPromise(stackBranches.pipe(Effect.provide(jj.layer)))).toEqual([
      "a",
      "b",
    ]);
  });

  it("fails on a stack with two heads", async () => {
    const jj = fakeJj({ bookmarks: "a\nb\n", heads: "abc one\ndef two\n" });
    const failure = await Effect.runPromise(
      Effect.flip(stackBranches).pipe(Effect.provide(jj.layer)),
    );
    expect(failure).toBeInstanceOf(NotAStack);
  });

  it("fails on a change with no bookmark", async () => {
    const jj = fakeJj({ bookmarks: "a\n\nb\n" });
    const failure = await Effect.runPromise(
      Effect.flip(stackBranches).pipe(Effect.provide(jj.layer)),
    );
    expect(failure.message).toContain("needs a bookmark");
  });

  it("fails on a change with two bookmarks", async () => {
    const jj = fakeJj({ bookmarks: "a extra\nb\n" });
    const failure = await Effect.runPromise(
      Effect.flip(stackBranches).pipe(Effect.provide(jj.layer)),
    );
    expect(failure.message).toContain("several bookmarks");
  });
});

const submitWith = (services: Layer.Layer<GitHub | Jj>): Promise<void> =>
  Effect.runPromise(submit.pipe(Effect.provide(services)));

describe("submit", () => {
  it("opens the missing pull requests and registers a new stack", async () => {
    const jj = fakeJj({ bookmarks: "a\nb\n" });
    const github = fakeGitHub({}, Option.none());
    await submitWith(Layer.merge(jj.layer, github.layer));
    expect(jj.ran).toContain("git push --bookmark exact:a --bookmark exact:b");
    expect(github.calls).toEqual(["open a on main", "open b on a", "create stack 99,99"]);
  });

  it("changes nothing on GitHub for a stack already in order", async () => {
    const jj = fakeJj({ bookmarks: "a\nb\n" });
    const github = fakeGitHub(
      { a: { base: "main", number: 1 }, b: { base: "a", number: 2 } },
      Option.some({ number: 7, open: [1, 2] }),
    );
    await submitWith(Layer.merge(jj.layer, github.layer));
    expect(github.calls).toEqual([]);
  });

  it("appends a pull request opened on top", async () => {
    const jj = fakeJj({ bookmarks: "a\nb\nc\n" });
    const github = fakeGitHub(
      { a: { base: "main", number: 1 }, b: { base: "a", number: 2 } },
      Option.some({ number: 7, open: [1, 2] }),
    );
    await submitWith(Layer.merge(jj.layer, github.layer));
    expect(github.calls).toEqual(["open c on b", "add 99 to #7"]);
  });

  // GitHub rejects a base change on a pull request in a stack, and closes a pull request whose
  // head becomes reachable from its base. So the stack goes first, the moved pull request is parked
  // on the trunk before the push, and it gets its new base and a new stack after.
  it("reorders by dissolving, parking on the trunk, pushing, then rebasing and registering", async () => {
    const jj = fakeJj({ bookmarks: "a\nc\nb\n" });
    const github = fakeGitHub(
      { a: { base: "main", number: 1 }, b: { base: "a", number: 2 }, c: { base: "b", number: 3 } },
      Option.some({ number: 7, open: [1, 2, 3] }),
    );
    await submitWith(Layer.merge(jj.layer, github.layer));
    expect(github.calls).toEqual([
      "unstack #7",
      "base #3 → main",
      "base #2 → main",
      "base #3 → a",
      "base #2 → c",
      "create stack 1,3,2",
    ]);
  });
});

describe("sync", () => {
  it("starts a new change on the trunk once every change has merged", async () => {
    const jj = fakeJj({ bookmarks: "", changes: "" });
    const github = fakeGitHub({}, Option.none());
    await Effect.runPromise(sync.pipe(Effect.provide(Layer.merge(jj.layer, github.layer))));
    expect(jj.ran.at(-1)).toBe("new trunk()");
  });

  // GitHub can delete a merged branch after the fetch, which leaves its bookmark on the trunk.
  it("forgets the bookmarks of merged changes, and no other bookmark on the trunk", async () => {
    const jj = fakeJj({ bookmarks: "", changes: "", inStack: "a\nb\n", onTrunk: "a\nmain\n" });
    const github = fakeGitHub({}, Option.none());
    await Effect.runPromise(sync.pipe(Effect.provide(Layer.merge(jj.layer, github.layer))));
    expect(jj.ran.filter((command) => command.startsWith("bookmark forget"))).toEqual([
      "bookmark forget --include-remotes exact:a",
    ]);
  });
});
