import type { operations } from "@octokit/openapi-types";
import { Config, Context, Data, Effect, Layer, Option, Redacted, Schedule, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import type { PullRequest, RemoteStack, Repository } from "./plan";

export class GitHubFailed extends Data.TaggedError("GitHubFailed")<{ readonly message: string }> {}

/** How a stack merge ended: merged now, or queued to merge once the queue reaches it. */
export type MergeOutcome = "enqueued" | "merged";

export class GitHub extends Context.Service<
  GitHub,
  {
    readonly addToStack: (
      stack: number,
      pullRequests: readonly number[],
    ) => Effect.Effect<void, GitHubFailed>;
    readonly createPullRequest: (pullRequest: {
      readonly base: string;
      readonly body: string;
      readonly head: string;
      readonly title: string;
    }) => Effect.Effect<number, GitHubFailed>;
    readonly createStack: (pullRequests: readonly number[]) => Effect.Effect<number, GitHubFailed>;
    readonly defaultBranch: Effect.Effect<string, GitHubFailed>;
    /** Merges the pull request through its stack, together with everything below it. */
    readonly mergeStack: (pullRequest: number) => Effect.Effect<MergeOutcome, GitHubFailed>;
    readonly mergePullRequest: (pullRequest: number) => Effect.Effect<void, GitHubFailed>;
    readonly openPullRequest: (
      branch: string,
    ) => Effect.Effect<Option.Option<PullRequest>, GitHubFailed>;
    readonly setBase: (pullRequest: number, base: string) => Effect.Effect<void, GitHubFailed>;
    readonly stackOf: (
      pullRequest: number,
    ) => Effect.Effect<Option.Option<RemoteStack>, GitHubFailed>;
    /** Dissolves the stack. Its pull requests stay open. */
    readonly unstack: (stack: number) => Effect.Effect<void, GitHubFailed>;
  }
>()("jj-gh/GitHub") {}

// GitHub's own description of its REST API, keyed by operation id as its documentation names them.
type Operation = keyof operations;
type Json<T> = T extends { readonly content: { readonly "application/json": infer A } } ? A : never;
type Success<O extends Operation> = keyof operations[O]["responses"] & (200 | 201 | 202);
type ResponseBody<O extends Operation> = Json<operations[O]["responses"][Success<O>]>;
type RequestBody<O extends Operation> = operations[O] extends { readonly requestBody?: infer B }
  ? Json<NonNullable<B>>
  : never;

/** The schema, provided every response GitHub documents for the operation decodes with it. */
type ResponseSchema<O extends Operation, S extends Schema.Top> = S &
  ([ResponseBody<O>] extends [S["Encoded"]] ? unknown : { readonly mismatch: O });

/**
 * A schema for the fields read from an operation's response, which doesn't compile unless
 * GitHub's documented response decodes with it. The rest of the response is ignored.
 */
const responseOf =
  <O extends Operation>() =>
  <S extends Schema.Top>(schema: ResponseSchema<O, S>): S =>
    schema;

/** Sets the JSON body GitHub documents for the operation. */
const bodyOf = <O extends Operation>(body: RequestBody<O>) =>
  HttpClientRequest.bodyJsonUnsafe(body);

const Numbered = Schema.Struct({ number: Schema.Number });
const CreatedPullRequest = responseOf<"pulls/create">()(Numbered);
const CreatedStack = responseOf<"pull-request-stacks/create">()(Numbered);
const PullRequests = responseOf<"pulls/list">()(
  Schema.Array(
    Schema.Struct({ base: Schema.Struct({ ref: Schema.String }), number: Schema.Number }),
  ),
);
const StackedPullRequest = Schema.Struct({
  number: Schema.Number,
  state: Schema.Literals(["closed", "open"]),
});
const Stacks = responseOf<"pull-request-stacks/list">()(
  Schema.Array(
    Schema.Struct({ number: Schema.Number, pull_requests: Schema.Array(StackedPullRequest) }),
  ),
);
const RepositoryDetails = responseOf<"repos/get">()(
  Schema.Struct({ default_branch: Schema.String }),
);
const MergeRequest = Schema.Struct({
  details: Schema.Struct({
    message: Schema.String,
    uuid: Schema.optionalKey(Schema.String),
  }),
  status: Schema.Literals(["enqueued", "failed", "merged", "pending"]),
});
const StartedMerge = responseOf<"pulls/merge-async">()(MergeRequest);
const MergeResult = responseOf<"pulls/get-merge-async-result">()(MergeRequest);

/**
 * The token for api.github.com: `GH_TOKEN` or `GITHUB_TOKEN` where the environment sets one,
 * as CI and Claude Code cloud sessions do, and otherwise the one `gh auth login` stored.
 * In a cloud session the value is a placeholder, and the egress proxy adds the real credential.
 */
const token = Effect.gen(function* () {
  const fromEnvironment = yield* Config.option(
    Config.Redacted("GH_TOKEN").pipe(Config.orElse(() => Config.Redacted("GITHUB_TOKEN"))),
  );
  if (Option.isSome(fromEnvironment)) {
    return fromEnvironment.value;
  }
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const stored = yield* spawner.string(ChildProcess.make("gh", ["auth", "token"]));
  return Redacted.make(stored.trim());
}).pipe(
  Effect.mapError(
    () => new GitHubFailed({ message: "no GitHub token: set GH_TOKEN, or run `gh auth login`" }),
  ),
);

export const GitHubLive = (
  repository: Repository,
): Layer.Layer<
  GitHub,
  GitHubFailed,
  ChildProcessSpawner.ChildProcessSpawner | HttpClient.HttpClient
> => {
  // A cloud session's proxy only allows paths under the repository, so every call starts there.
  const repo = (path: string): string => `/repos/${repository.owner}/${repository.name}${path}`;
  return Layer.effect(
    GitHub,
    Effect.gen(function* () {
      const bearer = yield* token;
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequest((request) =>
          request.pipe(
            HttpClientRequest.prependUrl("https://api.github.com"),
            HttpClientRequest.acceptJson,
            HttpClientRequest.bearerToken(bearer),
            HttpClientRequest.setHeaders({
              "user-agent": "jj-gh",
              "x-github-api-version": "2022-11-28",
            }),
          ),
        ),
      );

      // An error response keeps GitHub's own words, since they say what to change: a 422 naming
      // the field it rejected, or the proxy naming a route a cloud session can't use.
      const send = (request: HttpClientRequest.HttpClientRequest) =>
        client.execute(request).pipe(
          Effect.flatMap((response) =>
            response.status < 400
              ? Effect.succeed(response)
              : response.text.pipe(
                  Effect.orElseSucceed(() => ""),
                  Effect.flatMap((text) =>
                    Effect.fail(
                      new GitHubFailed({
                        message: `${request.method} ${request.url} returned ${response.status}: ${text}`,
                      }),
                    ),
                  ),
                ),
          ),
          Effect.catchTag("HttpClientError", (error) =>
            Effect.fail(new GitHubFailed({ message: error.message })),
          ),
        );

      const json =
        <S extends Schema.Top>(schema: S) =>
        (request: HttpClientRequest.HttpClientRequest) =>
          send(request).pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
            Effect.catchTags({
              HttpClientError: (error) => Effect.fail(new GitHubFailed({ message: error.message })),
              SchemaError: (error) =>
                Effect.fail(
                  new GitHubFailed({
                    message: `unexpected response to ${request.url}: ${error.message}`,
                  }),
                ),
            }),
          );

      const stackOf = (pullRequest: number) =>
        json(Stacks)(HttpClientRequest.get(repo(`/stacks?pull_request=${pullRequest}`))).pipe(
          Effect.map((stacks) =>
            Option.map(Option.fromNullishOr(stacks[0]), (stack) => ({
              number: stack.number,
              open: stack.pull_requests
                .filter(({ state }) => state === "open")
                .map(({ number }) => number),
            })),
          ),
        );

      const mergeRequest = (path: string) => json(MergeResult)(HttpClientRequest.get(repo(path)));

      return {
        addToStack: (stack, pullRequests) =>
          send(
            HttpClientRequest.post(repo(`/stacks/${stack}/add`)).pipe(
              bodyOf<"pull-request-stacks/add">({ pull_requests: [...pullRequests] }),
            ),
          ).pipe(Effect.asVoid),
        createPullRequest: ({ base, body, head, title }) =>
          json(CreatedPullRequest)(
            HttpClientRequest.post(repo("/pulls")).pipe(
              bodyOf<"pulls/create">({ base, body, draft: true, head, title }),
            ),
          ).pipe(Effect.map(({ number }) => number)),
        createStack: (pullRequests) =>
          json(CreatedStack)(
            HttpClientRequest.post(repo("/stacks")).pipe(
              bodyOf<"pull-request-stacks/create">({ pull_requests: [...pullRequests] }),
            ),
          ).pipe(Effect.map(({ number }) => number)),
        defaultBranch: json(RepositoryDetails)(HttpClientRequest.get(repo(""))).pipe(
          Effect.map(({ default_branch }) => default_branch),
        ),
        mergePullRequest: (pullRequest) =>
          send(
            HttpClientRequest.put(repo(`/pulls/${pullRequest}/merge`)).pipe(
              bodyOf<"pulls/merge">({ merge_method: "squash" }),
            ),
          ).pipe(Effect.asVoid),
        mergeStack: (pullRequest) =>
          Effect.gen(function* () {
            const started = yield* json(StartedMerge)(
              HttpClientRequest.put(repo(`/pulls/${pullRequest}/merge-async`)).pipe(
                bodyOf<"pulls/merge-async">({
                  merge_action: "default",
                  merge_method: "squash",
                }),
              ),
            );
            const { uuid } = started.details;
            if (uuid === undefined) {
              return yield* new GitHubFailed({
                message: `merging #${pullRequest} returned no request to follow`,
              });
            }
            const settled = yield* mergeRequest(`/pulls/${pullRequest}/merge-async/${uuid}`).pipe(
              Effect.repeat({
                schedule: Schedule.spaced("5 seconds"),
                until: ({ status }) => status !== "pending",
              }),
            );
            if (settled.status === "merged" || settled.status === "enqueued") {
              return settled.status;
            }
            return yield* new GitHubFailed({
              message: `merging #${pullRequest} ended ${settled.status}: ${settled.details.message}`,
            });
          }),
        openPullRequest: (branch) =>
          json(PullRequests)(
            HttpClientRequest.get(
              repo(`/pulls?state=open&head=${repository.owner}:${encodeURIComponent(branch)}`),
            ),
          ).pipe(
            Effect.map((found) =>
              Option.map(Option.fromNullishOr(found[0]), ({ base, number }) => ({
                base: base.ref,
                number,
              })),
            ),
          ),
        setBase: (pullRequest, base) =>
          send(
            HttpClientRequest.patch(repo(`/pulls/${pullRequest}`)).pipe(
              bodyOf<"pulls/update">({ base }),
            ),
          ).pipe(Effect.asVoid),
        stackOf,
        unstack: (stack) =>
          send(HttpClientRequest.post(repo(`/stacks/${stack}/unstack`))).pipe(Effect.asVoid),
      };
    }),
  );
};
