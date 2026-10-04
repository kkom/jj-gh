import { Context, Data, Effect, Layer, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export class JjFailed extends Data.TaggedError("JjFailed")<{ readonly message: string }> {}

export class Jj extends Context.Service<
  Jj,
  {
    /** Runs a jj command that reads the repository, and returns what it printed. */
    readonly read: (args: readonly string[]) => Effect.Effect<string, JjFailed>;
    /** Runs a jj command that changes something, showing its output as it goes. */
    readonly run: (args: readonly string[]) => Effect.Effect<void, JjFailed>;
  }
>()("jj-gh/Jj") {}

// What jj printed says what went wrong, so it's the message. The command is named only where jj
// printed nothing to this program: it failed to start, or its output went to the terminal.
const failed = (args: readonly string[], detail: string): JjFailed =>
  new JjFailed({
    message:
      detail.trim() === "" ? `jj ${args.join(" ")} failed` : detail.trim().replace(/^Error: /u, ""),
  });

interface JjOptions {
  readonly cwd?: string;
  /** Added to the environment jj inherits. */
  readonly env?: Readonly<Record<string, string>>;
  /** Discards what `run` commands print, which otherwise goes to the terminal. */
  readonly quiet?: boolean;
}

export const jjLayer = ({ cwd, env, quiet = false }: JjOptions = {}): Layer.Layer<
  Jj,
  never,
  ChildProcessSpawner.ChildProcessSpawner
> =>
  Layer.effect(
    Jj,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const location = { cwd, env, extendEnv: true };
      const output = quiet ? "ignore" : "inherit";

      const read = (args: readonly string[]): Effect.Effect<string, JjFailed> =>
        Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* spawner.spawn(ChildProcess.make("jj", args, location));
            const [stdout, stderr, code] = yield* Effect.all(
              [
                Stream.mkString(Stream.decodeText(handle.stdout)),
                Stream.mkString(Stream.decodeText(handle.stderr)),
                handle.exitCode,
              ],
              { concurrency: "unbounded" },
            );
            return code === 0 ? stdout : yield* failed(args, stderr);
          }),
        ).pipe(
          Effect.catchTag("PlatformError", (error) => Effect.fail(failed(args, error.message))),
        );

      const run = (args: readonly string[]): Effect.Effect<void, JjFailed> =>
        spawner
          .exitCode(ChildProcess.make("jj", args, { ...location, stderr: output, stdout: output }))
          .pipe(
            Effect.catchTag("PlatformError", (error) => Effect.fail(failed(args, error.message))),
            Effect.flatMap((code) => (code === 0 ? Effect.void : Effect.fail(failed(args, "")))),
          );

      return { read, run };
    }),
  );

export const JjLive = jjLayer();
