import { Schema } from "effect";

export const PullRequestNumberSchema = Schema.Number.pipe(Schema.brand("PullRequestNumber"));
export type PullRequestNumber = typeof PullRequestNumberSchema.Type;

export const StackNumberSchema = Schema.Number.pipe(Schema.brand("StackNumber"));
export type StackNumber = typeof StackNumberSchema.Type;

export interface PullRequest {
  readonly base: string;
  readonly body: string;
  readonly draft: boolean;
  readonly number: PullRequestNumber;
  readonly title: string;
}

/** A stack registered on GitHub, with its open pull requests bottom to top. */
export interface RemoteStack {
  readonly number: StackNumber;
  readonly open: readonly PullRequestNumber[];
}
