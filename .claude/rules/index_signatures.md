---
paths:
  - "**/*.{ts,tsx}"
---

# Reading an index signature

## Use a dot for declared keys and a bracket for the rest

Under `noPropertyAccessFromIndexSignature`:

- `record["key"]` — the type doesn't declare the key: a parsed document, a row, a header map, the environment, a regex's named groups.
- `record.key` — the property is declared.

`typescript/dot-notation` is type-aware and enforces both: it rejects a bracket on a declared property, and a dot on an index signature.

## Fix the type when the same keys keep being read

Use a bracket only where the key might really be missing, and handle that case. Where code reads the same fixed keys off one loose value again and again, the type is wrong, not the reads — for example an interface using an index signature for members it could declare, a helper returning `Record<string, unknown>` for a value its source already types, or a fixture typed looser than what it builds.

Declare the keys, or narrow once with the guard or schema that already exists, and read typed fields after that.

## Never cast past the flag

❌ No cast, `any` or expectation directive. Each hides a type that's wrong instead of fixing it.
