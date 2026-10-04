import { Context, Data, Effect, FileSystem, Layer, Path, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export class GitFailed extends Data.TaggedError("GitFailed")<{ readonly message: string }> {}

export class Git extends Context.Service<
  Git,
  {
    /**
     * Merges two edits of a text, line by line. Where both changed the same lines, the text has
     * conflict markers around the two versions, labelled `local` and `GitHub`.
     */
    readonly mergeText: (texts: {
      readonly base: string;
      readonly local: string;
      readonly remote: string;
    }) => Effect.Effect<{ readonly conflicted: boolean; readonly text: string }, GitFailed>;
  }
>()("jj-gh/Git") {}

export const GitLive = Layer.effect(
  Git,
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    return {
      mergeText: ({ base, local, remote }) =>
        Effect.scoped(
          Effect.gen(function* () {
            const directory = yield* fs.makeTempDirectoryScoped();
            // `git merge-file` merges lines, and treats a last line with no newline as changed.
            const written = { base: `${base}\n`, github: `${remote}\n`, local: `${local}\n` };
            yield* Effect.all(
              Object.entries(written).map(([name, text]) =>
                fs.writeFileString(path.join(directory, name), text),
              ),
            );
            const handle = yield* spawner.spawn(
              ChildProcess.make(
                "git",
                [
                  "merge-file",
                  "-p",
                  "-L",
                  "local",
                  "-L",
                  "base",
                  "-L",
                  "GitHub",
                  "local",
                  "base",
                  "github",
                ],
                { cwd: directory },
              ),
            );
            const [text, stderr, code] = yield* Effect.all(
              [
                Stream.mkString(Stream.decodeText(handle.stdout)),
                Stream.mkString(Stream.decodeText(handle.stderr)),
                handle.exitCode,
              ],
              { concurrency: "unbounded" },
            );
            // The exit code is the number of conflicts, and 255 for a failure.
            if (code > 127) {
              return yield* new GitFailed({ message: `git merge-file failed: ${stderr.trim()}` });
            }
            return { conflicted: code > 0, text: text.trimEnd() };
          }),
        ).pipe(
          Effect.catchTag("PlatformError", (error) =>
            Effect.fail(new GitFailed({ message: `git merge-file failed: ${error.message}` })),
          ),
        ),
    };
  }),
);
