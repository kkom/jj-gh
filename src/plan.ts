import { Option } from "effect";

export interface PullRequest {
  readonly base: string;
  readonly number: number;
}

/** A stack registered on GitHub, with its open pull requests bottom to top. */
export interface RemoteStack {
  readonly number: number;
  readonly open: readonly number[];
}

/** The base each branch targets: the trunk under the bottom one, the branch below otherwise. */
export const basesFor = (branches: readonly string[], trunk: string): readonly string[] => [
  trunk,
  ...branches.slice(0, -1),
];

export type Registration =
  | { readonly _tag: "Append"; readonly pullRequests: readonly number[]; readonly stack: number }
  | { readonly _tag: "Create"; readonly pullRequests: readonly number[] }
  | { readonly _tag: "Replace"; readonly pullRequests: readonly number[]; readonly stack: number }
  | { readonly _tag: "Single" }
  | { readonly _tag: "UpToDate"; readonly stack: number };

/**
 * What makes the pull requests, bottom to top, exactly the open part of one GitHub stack.
 * GitHub can only append to a stack, so a stack in any other order is replaced: dissolved,
 * then created again. A single pull request can't be a stack at all.
 */
export const registrationFor = (
  existing: Option.Option<RemoteStack>,
  wanted: readonly number[],
): Registration => {
  if (Option.isNone(existing)) {
    return wanted.length > 1 ? { _tag: "Create", pullRequests: wanted } : { _tag: "Single" };
  }
  const { number, open } = existing.value;
  const isPrefix =
    open.length > 0 && open.every((pullRequest, index) => wanted[index] === pullRequest);
  if (isPrefix && open.length === wanted.length) {
    return { _tag: "UpToDate", stack: number };
  }
  return isPrefix
    ? { _tag: "Append", pullRequests: wanted.slice(open.length), stack: number }
    : { _tag: "Replace", pullRequests: wanted, stack: number };
};

/** Owner and name of a GitHub repository, read from a remote's URL. */
export interface Repository {
  readonly name: string;
  readonly owner: string;
}

export const repositoryFromUrl = (url: string): Option.Option<Repository> => {
  const match = /github\.com[:/](?<owner>[^/]+)\/(?<name>[^/]+?)(?:\.git)?\/?$/u.exec(url.trim());
  const owner = match?.groups?.["owner"];
  const name = match?.groups?.["name"];
  return owner === undefined || name === undefined ? Option.none() : Option.some({ name, owner });
};

/** A change's description split the way a pull request takes it: the first line, then the rest. */
export const titleAndBody = (
  description: string,
): { readonly body: string; readonly title: string } => {
  const [title = "", ...rest] = description.trimEnd().split("\n");
  return { body: rest.join("\n").trim(), title };
};
