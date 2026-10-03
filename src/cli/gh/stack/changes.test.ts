import { afterAll, describe, expect, it } from "bun:test";

import { Effect } from "effect";

import { removeScratchRepositories, scratchRepository } from "../../../testing/scratch-repository";
import { NotAStack, stackChanges } from "./changes";

afterAll(removeScratchRepositories);

describe("stackBookmarks", () => {
  it("lists the bookmarks bottom to top", async () => {
    const repository = scratchRepository();
    repository.stack("a", "b");
    const stack = await Effect.runPromise(stackChanges("@").pipe(Effect.provide(repository.layer)));
    expect(stack.map(({ bookmark }) => bookmark)).toEqual(["a", "b"]);
    expect(stack.map(({ description }) => description)).toEqual(["a\n", "b\n"]);
  });

  it("fails on a stack with two heads", async () => {
    const repository = scratchRepository();
    repository.stack("a", "b");
    repository.jj("new", "a", "-m", "c");
    const failure = await Effect.runPromise(
      Effect.flip(stackChanges("@")).pipe(Effect.provide(repository.layer)),
    );
    expect(failure).toBeInstanceOf(NotAStack);
    expect(failure.message).toContain("several heads");
  });

  it("fails on a change with no bookmark", async () => {
    const repository = scratchRepository();
    repository.stack("a", "b");
    repository.jj("bookmark", "delete", "a");
    const failure = await Effect.runPromise(
      Effect.flip(stackChanges("@")).pipe(Effect.provide(repository.layer)),
    );
    expect(failure.message).toContain("needs a bookmark");
  });

  it("fails on a change with two bookmarks", async () => {
    const repository = scratchRepository();
    repository.stack("a", "b");
    repository.jj("bookmark", "create", "extra", "-r", "a");
    const failure = await Effect.runPromise(
      Effect.flip(stackChanges("@")).pipe(Effect.provide(repository.layer)),
    );
    expect(failure.message).toContain("several bookmarks");
  });
});
