#!/usr/bin/env bun
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect, Layer, Option } from "effect";
import { Argument, CliError, Command } from "effect/cli";
import { FetchHttpClient } from "effect/http";

import manifest from "../package.json" with { type: "json" };
import { GitHubLive } from "./github";
import { Jj, JjLive } from "./jj";
import { repositoryFromUrl } from "./plan";
import { stackBranches, submit } from "./stack";
import { merge, sync } from "./sync";

const userError = (message: string): CliError.UserError =>
  new CliError.UserError({ cause: message, userMessage: message });

// Every failure the commands raise is one a person can act on, so each is shown as a message
// rather than a stack trace.
const asUserError = <A, R>(
  program: Effect.Effect<A, { readonly _tag: string; readonly message: string }, R>,
): Effect.Effect<A, CliError.UserError, R> =>
  program.pipe(Effect.mapError(({ message }) => userError(message)));

// The GitHub repository behind the `origin` remote, which jj reads whether or not the
// workspace is a git checkout.
const github = Layer.unwrap(
  Effect.gen(function* () {
    const jj = yield* Jj;
    const remotes = yield* jj.read(["git", "remote", "list"]);
    const origin = remotes.split("\n").find((line) => line.startsWith("origin "));
    const repository = repositoryFromUrl(origin?.slice("origin ".length) ?? "");
    if (Option.isNone(repository)) {
      return yield* userError("the `origin` remote isn't a GitHub repository");
    }
    return GitHubLive(repository.value);
  }).pipe(asUserError),
);

const check = Command.make("check", {}, () =>
  asUserError(stackBranches).pipe(Effect.flatMap((branches) => Console.log(branches.join("\n")))),
).pipe(
  Command.withDescription("Print the stack's branches bottom to top, or say why it isn't a stack"),
);

const submitCommand = Command.make("submit", {}, () =>
  asUserError(submit).pipe(Effect.provide(github)),
).pipe(Command.withDescription("Push the stack and make its pull requests one GitHub stack"));

const mergeCommand = Command.make(
  "merge",
  {
    pullRequest: Argument.Int("pull-request").pipe(
      Argument.withDescription("The top pull request to merge"),
    ),
  },
  ({ pullRequest }) => asUserError(merge(pullRequest)).pipe(Effect.provide(github)),
).pipe(
  Command.withDescription("Squash-merge the stack up to and including a pull request, then sync"),
);

const syncCommand = Command.make("sync", {}, () =>
  asUserError(sync).pipe(Effect.provide(github)),
).pipe(
  Command.withDescription(
    "Rebase the stack onto the fetched trunk, drop what merged, and republish",
  ),
);

const stack = Command.make("stack").pipe(
  Command.withSubcommands([check, mergeCommand, submitCommand, syncCommand]),
  Command.withDescription(
    "Publish the jj stack containing the working copy as a GitHub stack of pull requests",
  ),
);

const jjGh = Command.make("jj gh").pipe(
  Command.withSubcommands([stack]),
  Command.withDescription("Do jj's work on GitHub"),
);

BunRuntime.runMain(
  Command.run(jjGh, { version: manifest.version }).pipe(
    Effect.provide(JjLive),
    Effect.provide([BunServices.layer, FetchHttpClient.layer]),
  ),
);
