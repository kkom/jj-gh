import { describe, expect, it } from "bun:test";

import { Option } from "effect";

import { basesFor, registrationFor, repositoryFromUrl, titleAndBody } from "./plan";

describe("basesFor", () => {
  it("targets the trunk under the bottom and the branch below everywhere else", () => {
    expect(basesFor(["a", "b", "c"], "main")).toEqual(["main", "a", "b"]);
  });
});

const stack = (open: readonly number[]) => Option.some({ number: 7, open });

describe("registrationFor", () => {
  it("creates a stack for two or more pull requests in none", () => {
    expect(registrationFor(Option.none(), [1, 2])).toEqual({
      _tag: "Create",
      pullRequests: [1, 2],
    });
  });

  it("registers nothing for a single pull request", () => {
    expect(registrationFor(Option.none(), [1])).toEqual({ _tag: "Single" });
  });

  it("leaves a stack in the wanted order alone", () => {
    expect(registrationFor(stack([1, 2]), [1, 2])).toEqual({ _tag: "UpToDate", stack: 7 });
  });

  it("appends pull requests added on top", () => {
    expect(registrationFor(stack([1, 2]), [1, 2, 3])).toEqual({
      _tag: "Append",
      pullRequests: [3],
      stack: 7,
    });
  });

  it("replaces a reordered stack", () => {
    expect(registrationFor(stack([1, 2, 3]), [1, 3, 2])).toEqual({
      _tag: "Replace",
      pullRequests: [1, 3, 2],
      stack: 7,
    });
  });

  it("replaces a stack a change was dropped from", () => {
    expect(registrationFor(stack([1, 2, 3]), [1, 3])).toMatchObject({ _tag: "Replace" });
  });

  it("replaces a stack whose every pull request merged", () => {
    expect(registrationFor(stack([]), [4, 5])).toMatchObject({ _tag: "Replace" });
  });
});

describe("repositoryFromUrl", () => {
  it.each(["https://github.com/kkom/jj-gh", "https://github.com/kkom/jj-gh.git"])(
    "reads %s",
    (url) => {
      expect(repositoryFromUrl(url)).toEqual(Option.some({ name: "jj-gh", owner: "kkom" }));
    },
  );

  it("reads nothing from a remote elsewhere", () => {
    expect(repositoryFromUrl("https://gitlab.com/kkom/jj-gh")).toEqual(Option.none());
  });
});

describe("titleAndBody", () => {
  it("takes the first line as the title and the rest as the body", () => {
    expect(titleAndBody("Add a thing\n\nBecause.\n\nTrailer: x\n")).toEqual({
      body: "Because.\n\nTrailer: x",
      title: "Add a thing",
    });
  });
});
