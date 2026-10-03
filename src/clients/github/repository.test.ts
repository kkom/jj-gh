import { describe, expect, it } from "bun:test";

import { Option } from "effect";

import { repositoryFromUrl } from "./repository";

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
