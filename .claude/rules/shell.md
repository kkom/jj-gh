# Shell commands

## Run commands in their bare form

`my_command`, not `my_command 2>&1 | tail -20`.

- ❌ Don't append `2>&1` — Claude Code already captures stdout and stderr.
- ❌ Don't pipe into `tail` or `head` — long output is already truncated.

That's because the shell operators they bring (`|`, `>`, `&`) break allowlist matching, and cause needless permission prompts.

## Read the saved file for long output

Claude Code saves long output to a file and previews the first ~2KB. If what you need, such as an error summary, isn't in the preview, read the file path the result shows.

## Read and edit files with the Read, Edit and Write tools

Open a file with Read and change it with Edit or Write, not with `cat`, `sed` or a script run through Bash. Find files with Grep and Glob.

- ❌ `sed -n 40,90p src/db/create.ts`, then a Python script that rewrites it
- ✅ Read `src/db/create.ts`, then Edit it

That's because conditional rules load only when Claude reads or changes a file they apply to with the Read, Edit or Write tool. Work done through the shell never loads them, however many files it touches.
