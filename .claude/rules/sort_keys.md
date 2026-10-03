---
paths:
  - "**/*.{ts,tsx}"
---

# Sorted keys

## Fix the order, not the rule

`sort-keys` keeps object literals alphabetical, and almost everywhere key order has no meaning.

## Disable it where the order is the meaning

Disable the rule at that site with `// oxlint-disable-next-line sort-keys`, and a comment naming what the order means.

❌ Don't contort key names so alphabetical order happens to agree. The constraint stays invisible, and the next rename breaks it silently.
