---
paths:
  - "**/*.{ts,tsx}"
---

# Matching a discriminated union

## Branch with `Match` and `Match.exhaustive`

Use Effect's `Match.value(...).pipe(Match.when(...), Match.exhaustive)`.

❌ Not an `if` chain, and not a `switch` with a `default` that quietly absorbs the case nobody thought about.

`Match.exhaustive` makes an unhandled variant a **compile error**, so adding one to the union points at every place that now has to say what it means. An `if` chain falls through to its last branch instead, and the damage is silent: a CHECK constraint simply absent, a DDL op planning the wrong statements, a grant subject matching nothing.

```ts
return Match.value(type).pipe(
  Match.when({ type: "boolean" }, () => `${column} IN (0, 1)`),
  Match.when({ type: "enum" }, (enumType) => inValues(column, enumType.values)),
  // Variants that share a result are listed together rather than defaulted.
  Match.whenOr({ type: "integer" }, { type: "real" }, { type: "text" }, () => null),
  Match.exhaustive,
);
```

Each handler receives the **narrowed** member, so `enumType.values` is reachable without a cast.

## Use `Match.orElse` only for open input

Where the input is genuinely open-ended — a string from the wire, a keyword we don't model. ❌ Never as a shortcut past variants we own: if our own union grows, we want the compiler to say so.

## Parse unknown input with a schema

`Match` matches a value whose type is already known. It doesn't validate an `unknown` off the network.
