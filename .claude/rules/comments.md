# Comments

Applies to every language.

## Write non-obvious comments

❌ Avoid redundant comments that re-state what's already obvious from code.
❌ Avoid documenting artifacts of an internal thinking process.
❌ Avoid narrating the change itself - why a field was added, what the previous version did, or what a sibling file does differently. That belongs in the PR description, not the file.
❌ Avoid explaining the absence of something, unless a reader would otherwise add it back by mistake.
✅ When helpful, add section comments to clarify code structure - use judgment.
✅ Do comment a construct that looks wrong but is deliberate, and say what makes it necessary.
