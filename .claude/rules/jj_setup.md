# jj in this checkout

## The `jj gh` alias

Here `jj gh` is a jj alias for this repository's own CLI, run from source, so a change to the CLI takes effect in the next command. Set it once per checkout, from the checkout's root:

```
jj config set --repo aliases.gh "[\"util\", \"exec\", \"--\", \"bun\", \"$PWD/src/main.ts\"]"
```
