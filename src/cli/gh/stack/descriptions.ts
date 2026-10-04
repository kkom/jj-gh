import { Console, Data, Effect, Match, Option } from "effect";

import { Git, type GitFailed } from "../../../clients/git";
import type { PullRequest } from "../../../clients/github/types";
import { Jj, type JjFailed } from "../../../clients/jj";
import { bookmarkRevset, lines, readLog, type StackChange } from "./changes";
import { descriptionFrom, descriptionSyncFor, normalizedDescription } from "./plan";

export class DescriptionConflict extends Data.TaggedError("DescriptionConflict")<{
  readonly message: string;
}> {}

interface DescriptionOptions {
  readonly overwriteDescriptions: boolean;
  readonly pushedDescription: string;
}

/** The description of each commit, by commit id, read in one command. */
export const descriptionsOf = (
  commits: readonly string[],
): Effect.Effect<ReadonlyMap<string, string>, JjFailed, Jj> =>
  commits.length === 0
    ? Effect.succeed(new Map<string, string>())
    : readLog(
        commits.join(" | "),
        String.raw`commit_id ++ "\t" ++ description.escape_json() ++ "\n"`,
      ).pipe(
        Effect.map(
          (output) =>
            new Map(
              lines(output).map((line): [string, string] => {
                const [commit = "", json = '""'] = line.split("\t");
                const parsed: unknown = JSON.parse(json);
                return [commit, typeof parsed === "string" ? parsed : ""];
              }),
            ),
        ),
      );

/**
 * Makes a change's description and its pull request's title and body the same text. An edit made
 * on GitHub alone is written into the change here. Any other difference returns the description
 * to send to GitHub once the bookmark is pushed.
 *
 * `pushedDescription` is the description of the commit last pushed, which both sides agreed on
 * then. A bookmark never pushed has none, and an empty text is merged from.
 */
export const syncDescription = (
  { bookmark, description }: StackChange,
  pullRequest: PullRequest,
  { overwriteDescriptions, pushedDescription }: DescriptionOptions,
): Effect.Effect<Option.Option<string>, DescriptionConflict | GitFailed | JjFailed, Git | Jj> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const jj = yield* Jj;
    const describe = (text: string) =>
      jj.run(["describe", "-r", bookmarkRevset(bookmark), "-m", text]);
    const local = normalizedDescription(description);
    const onGitHub = normalizedDescription(descriptionFrom(pullRequest));
    const pushed = normalizedDescription(pushedDescription);

    return yield* Match.value(descriptionSyncFor({ local, onGitHub, pushed })).pipe(
      Match.tag("InSync", () => Effect.succeed(Option.none<string>())),
      Match.tag("TakeGitHub", () =>
        describe(onGitHub).pipe(
          Effect.andThen(
            Console.error(`took the description of #${pullRequest.number} from GitHub`),
          ),
          Effect.as(Option.none<string>()),
        ),
      ),
      Match.tag("SendLocal", () => Effect.succeed(Option.some(local))),
      Match.tag("Merge", () =>
        Effect.gen(function* () {
          if (overwriteDescriptions) {
            return Option.some(local);
          }
          const merged = yield* git.mergeText({ base: pushed, local, remote: onGitHub });
          if (merged.conflicted) {
            return yield* new DescriptionConflict({
              message: [
                `the description of ${bookmark} changed here and in #${pullRequest.number}, in the same lines:`,
                "",
                merged.text,
                "",
                `Write the one to keep with \`jj describe -r ${bookmark}\`, then run \`jj gh submit --overwrite-descriptions\`.`,
              ].join("\n"),
            });
          }
          yield* describe(merged.text);
          return Option.some(merged.text);
        }),
      ),
      Match.exhaustive,
    );
  });
