import { afterAll, beforeEach, describe, expect, it } from "bun:test";

import { Effect } from "effect";

import {
  addCommitOnGitHub,
  moveTrunkOnGitHub,
  rebaseOnGitHub,
  pushedStack,
  removeScratchRepositories,
  type ScratchRepository,
  squashMergeOnGitHub,
} from "../../testing/scratch-repository";
import { stackChanges } from "./stack/changes";
import { sync } from "./sync";

afterAll(removeScratchRepositories);

const syncIn = (repository: ScratchRepository): Promise<void> =>
  Effect.runPromise(sync().pipe(Effect.provide(repository.layer)));

const files = (repository: ScratchRepository, revision: string): readonly string[] =>
  repository
    .jj("file", "list", "-r", revision)
    .split("\n")
    .filter((file) => file !== "");

// Changes a file of the change `a`, which the working copy sits two changes above.
const editLocally = (repository: ScratchRepository): void => {
  repository.jj("edit", "a");
  repository.write("local.txt", "local\n");
  repository.jj("new", "b");
};

describe("sync", () => {
  let repository = pushedStack("a", "b");

  beforeEach(() => {
    repository = pushedStack("a", "b");
  });

  it("rebases every stack onto the moved trunk, and pushes nothing", async () => {
    repository.jj("new", "main", "-m", "c");
    repository.jj("bookmark", "create", "c", "-r", "@");
    const pushed = repository.branches();
    moveTrunkOnGitHub(repository);
    await syncIn(repository);
    expect(files(repository, "b")).toContain("trunk.txt");
    expect(files(repository, "c")).toContain("trunk.txt");
    expect(repository.branches()).toEqual({ ...pushed, main: repository.branches()["main"] ?? "" });
  });

  it("leaves a stack that conflicts with the moved trunk where it was", async () => {
    repository.jj("new", "main", "-m", "c");
    repository.jj("bookmark", "create", "c", "-r", "@");
    repository.write("trunk.txt", "c's own\n");
    repository.jj("new", "b");
    moveTrunkOnGitHub(repository);
    await syncIn(repository);
    expect(repository.jj("log", "--no-graph", "-r", "conflicts()", "-T", "change_id")).toBe("");
    expect(repository.jj("log", "--no-graph", "-r", "c-", "-T", "description")).toBe("base\n");
    expect(files(repository, "b")).toContain("trunk.txt");
  });

  // GitHub can delete a merged branch after the fetch, which leaves its bookmark on the trunk.
  it("abandons a merged change and forgets its bookmark, with the branch still on GitHub", async () => {
    squashMergeOnGitHub(repository, "a", { deleted: false });
    await syncIn(repository);
    expect(repository.log()).toEqual(["b [b]"]);
    expect(repository.jj("bookmark", "list", "--all-remotes", "a")).toBe("");
  });

  it("takes the rest of a stack as GitHub rebased it after a merge", async () => {
    squashMergeOnGitHub(repository, "a", { above: ["b"] });
    await syncIn(repository);
    expect(repository.log()).toEqual(["b [b]"]);
    expect(files(repository, "b")).toEqual(["a.txt", "b.txt", "base.txt"]);
  });

  describe("when a branch changed on GitHub", () => {
    it("folds a commit GitHub added into an untouched local change", async () => {
      addCommitOnGitHub(repository, "a");
      await syncIn(repository);
      expect(repository.log()).toEqual(["a [a]", "b [b]"]);
      expect(files(repository, "a")).toEqual(["a.txt", "base.txt", "suggestion.txt"]);
    });

    it("folds a commit GitHub added into a local change that was edited too", async () => {
      editLocally(repository);
      addCommitOnGitHub(repository, "a");
      await syncIn(repository);
      expect(repository.log()).toEqual(["a [a]", "b [b]"]);
      expect(files(repository, "a")).toEqual(["a.txt", "base.txt", "local.txt", "suggestion.txt"]);
    });

    it("folds commits GitHub added to two branches of one stack", async () => {
      addCommitOnGitHub(repository, "a", "for-a.txt");
      addCommitOnGitHub(repository, "b", "for-b.txt");
      await syncIn(repository);
      expect(repository.log()).toEqual(["a [a]", "b [b]"]);
      expect(files(repository, "a")).toEqual(["a.txt", "base.txt", "for-a.txt"]);
      expect(files(repository, "b")).toEqual([
        "a.txt",
        "b.txt",
        "base.txt",
        "for-a.txt",
        "for-b.txt",
      ]);
    });

    it("takes a branch GitHub rebased where the local change is untouched", async () => {
      rebaseOnGitHub(repository, "a");
      await syncIn(repository);
      expect(repository.log()).toEqual(["a [a]", "b [b]"]);
      expect(files(repository, "b")).toEqual(["a.txt", "b.txt", "base.txt", "trunk.txt"]);
    });

    it("keeps an edited local change where GitHub only rebased the branch", async () => {
      editLocally(repository);
      rebaseOnGitHub(repository, "a");
      await syncIn(repository);
      expect(repository.log()).toEqual(["a [a]", "b [b]"]);
      expect(files(repository, "a")).toEqual(["a.txt", "base.txt", "local.txt", "trunk.txt"]);
    });

    it("fails after rebasing where both sides changed and GitHub rewrote the branch", async () => {
      editLocally(repository);
      rebaseOnGitHub(repository, "a", { extra: true });
      const failure = await Effect.runPromise(
        Effect.flip(sync()).pipe(Effect.provide(repository.layer)),
      );
      expect(failure.message).toContain("weren't combined:\na\n");
      expect(files(repository, "b")).toContain("trunk.txt");
      const check = await Effect.runPromise(
        Effect.flip(stackChanges("@")).pipe(Effect.provide(repository.layer)),
      );
      expect(check.message).toContain("point at two changes");
    });
  });
});
