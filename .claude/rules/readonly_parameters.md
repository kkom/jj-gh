---
paths:
  - "**/*.{ts,tsx}"
---

# Readonly parameters

`typescript/prefer-readonly-parameter-types` is configured in `.oxlintrc.jsonc`. When it fires, fix the code, in this order:

1. Our own types get `readonly` members, arrays included (`readonly T[]`).
2. Third-party types get an `allow` entry, as do the few of ours the rule cannot see are readonly.
3. Genuinely mutable state gets reshaped, not annotated. A helper taking an array to push into is an out-parameter: give the collector ownership and return a readonly view.

Two traps in `allow`: package specifiers work but file specifiers are silently ignored, and matching is on the annotation as written — so a local alias of a third-party class only matches via the deprecated bare-string form.

`ignoreInferredTypes` is on, since those parameters are typed by the callee. `treatMethodsAsReadonly` is off: it works by exempting `Map` and `Set`, which are mutable through exactly the methods it would excuse.
