---
paths:
  - "**/*.{ts,tsx}"
---

# Async and interfaces

Two constructs each have two spellings, and our lint rules prefer opposite ones. Satisfying one violates the other, and they autofix into each other, so `bun run fix` flips the code back and forth.

❌ Never disable either rule. The conflict means the construct is wrong, not the syntax — rewrite it so the choice stops mattering.

## Await and return in a named async function

`promise-function-async` requires `async`; `require-await` flags an `async` function that never awaits. Await the result and return it, so the function is genuinely async, and its frame survives in a stack trace.

## Give an empty interface the member it stands for

`consistent-type-definitions` requires an `interface`; `no-empty-interface` and `no-empty-object-type` flag one declaring nothing, and aliasing one alias to another collapses a recursive type into `any`. Declare the interface with the index-signature member it actually has.

Extending exactly one type is allowed. That's how a brand is hung on a type, or a declaration left open to augmentation.

## Pass an async arrow callback plain

On a callback that just forwards a promise, the rules form a cycle with no exit: the plain form trips `promise-function-async`, adding `async` trips `require-await`, and adding `await` trips `return-await`. So `promise-function-async` has `checkArrowFunctions: false`.

Pass the plain callback, and let `Promise.all` collect the promises:

```ts
const values = await Promise.all(names.map((name) => read(name)));
```

❌ Don't dodge this with an `await` inside a `for` loop. Independent calls should run in parallel, which is what `no-await-in-loop` enforces.
