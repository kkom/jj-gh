---
name: autonomous-development
description: Run a long, autonomous development session to completion — align on design, track work as session tasks, keep an hourly reminder firing, develop through locally stacked PRs with review loops, merge downstack work as it converges, and clean up after.
---

# Autonomous development

A session that runs for hours without a human watching. The human sets the direction once; the session keeps itself going, merges as it goes, and calls the human back only where judgment is theirs.

## 1. Align on the design

Agree the design with the human before writing code: scope, approach, what is out of scope. Elicit background rather than hypothesizing it. Do not start step 2 until this is settled.

## 2. Record the work as session tasks

Create one session task (TaskCreate) per piece of work discovered so far, with dependencies between them. This list is the plan the session returns to after every interruption, so keep it current: mark tasks in progress and completed as they move.

## 3. Schedule the hourly reminder

Create a recurring Routine with `create_trigger` on the Claude Code Remote MCP server, hourly, bound to this session (the default). The prompt contains no detail of the work, only the process: continue autonomously per the autonomous-development skill, check the task list, keep going to completion. The session's own context is where the work lives; a reminder that restates it goes stale.

## 4. Develop through stacked PRs

Follow `.claude/rules/jj.md` for the mechanics. The loop:

1. Write a handful of PRs as a stack of jj changes, one bookmark each. Keep them local — do not push until review has converged, so CI is not run for drafts.
2. From the topmost completed change, run `/code-review` and then `/simplify`.
3. Absorb each finding into the change it belongs to — `jj edit` it, or `jj squash --into` it from the working copy — and jj rebases whatever sits above.
4. Return to step 2. Point the reviewers at what changed and tell them what earlier rounds found and fixed, but ask them to step back and review the whole, not only the guidance — a reviewer steered too hard finds only what it was told to look for.
5. When a round returns only trivial findings, the changes are ready: `jj gh stack submit`, set descriptions per the PR template, publish, and merge from the bottom with `jj gh stack merge <PR #>`, which syncs the rest.

Merge downstack work as soon as it is ready. Do not hold the bottom of a stack for the top, and do not wait for the whole task to finish.

## 5. Releases

Publishing to npm is the human's decision. Don't raise the version or run the Release workflow unless the design agreed in step 1 includes a release.

## 6. Discovered work

Add a session task for each piece of work found along the way. Decide whether it is yours to do — then start it — or needs human judgment, per step 7.

## 7. Human judgment

Set aside what needs the human, continue with everything that does not, and notify them once, with whatever notification tool the session has: what the question is, what you assumed meanwhile, and that they should join the session when they can. Consider the human's local time of day before sending: a prompt at night is unlikely to be answered soon, so it is not a reason to wait, and it is not a reason to send more than one.

## 8. Clean up

When the work is done, leave nothing behind that existed only for the session or has been made redundant by its outcome. At least:

- Update the README and the rules that the change made wrong.
- Close pull requests left open by changes dropped from a stack.

## 9. Stop the reminder

Delete the hourly Routine with `delete_trigger` so it stops waking the session. If the session is resumed, create a new one.
