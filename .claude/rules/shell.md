# Shell commands

## Run commands in their bare form

`my_command`, not `my_command 2>&1 | tail -20`.

- ❌ Don't append `2>&1` — Claude Code already captures stdout and stderr.
- ❌ Don't pipe into `tail` or `head` — long output is already truncated.

That's because the shell operators they bring (`|`, `>`, `&`) break allowlist matching, and cause needless permission prompts.

## Read the saved file for long output

Claude Code saves long output to a file and previews the first ~2KB. If what you need, such as an error summary, isn't in the preview, read the file path the result shows.
