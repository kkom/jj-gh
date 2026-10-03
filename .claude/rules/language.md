# Language

Applies to prose everywhere: rules, READMEs, code comments, PR descriptions, and other documentation.

The naming sections at the end also apply to names in code: types, functions, variables, files, RPC methods, tool names, bindings and database columns.

## Write plain statements

Say what happens, in the words you'd use to explain it to a colleague. That's because the reader should get the point on the first read, not decode it.

- ❌ "A capability written off stops being attempted, and the work silently narrows around it."
- ✅ "Once you decide something is unavailable you stop trying it, and quietly do less than was asked."

## Avoid aphorisms, inversions and wordplay

Rewrite them as the plain claim they stand for. That's because they sound insightful while hiding what's actually meant — and the plain version is often shorter.

Aphorism:

- ❌ "A batch is shared fate: its entries share a call, a latency and a failure."
- ✅ "Entries in a batch are executed in a single call, share latency, and all fail or pass together."

Inversion:

- ❌ "A probe run elsewhere doesn't weakly answer the question. It confidently answers a different one."
- ✅ "A probe run outside workerd tests a different runtime, so its result may not hold in workerd."

Wordplay:

- ❌ "A hard-wrapped file is wrapped for nobody."
- ✅ "Editors wrap lines anyway."

## Don't give code and checks intentions

Say what they actually do: a check fails, reports or reads a file. That's because verbs like "holds X to Y", "refuses", "vouches for" or "looks ahead" leave the reader guessing at the mechanism.

- ❌ "The test holds every invocation of turbo to what it resolves to."
- ✅ "The test checks that every invocation of turbo resolves to the packages it should."

## Name the concrete thing

Use the actual file, command, type or value, not a category word like "surface", "seam", "edge" or "shape" — unless that word is defined nearby. That's because an abstract noun makes the reader work out what it refers to.

- ❌ "A check that sweeps a surface reads that surface each time it runs."
- ✅ "A check that covers every item of some kind should find those items itself each time it runs."

## Show an example

Prefer a short snippet or a ❌/✅ pair to a paragraph of description. That's because an example is quicker to read and harder to misunderstand.

## Keep sentences short

One idea per sentence. That's because a sentence held together by a dash, a colon and a semicolon is hard to follow — split it instead.

## Keep it short

Write what the reader needs to act, and stop. Cut background, history, hedging and a closing summary of what was just said. That's because every extra sentence is one more the reader has to get through to find the one that matters.

- ❌ A paragraph on how a convention came about, before the convention.
- ✅ The convention, then one sentence of reason.

## Don't repeat things

Make each point once. Don't restate it in other words a paragraph later, or open and close a section with the same idea. That's because repetition makes text longer without making it clearer, and the reader starts skimming.

- ❌ "Run turbo from the root. … Remember, turbo must always be started from the repository root."
- ✅ "Run turbo from the root." — once.

## Point to the document that owns an idea

Where another document already explains something, link to it rather than restating it. That's because two copies drift apart.

## Name things for what they are

Use the plain word for what a type, function, file or value is or does. No metaphors, analogies or wordplay. That's because a reader has to learn what a metaphor stands for before the name tells them anything.

- ❌ `runEdge`, for running an Effect as a promise
- ✅ `runPromise`
- ❌ `answersOnly`, for keeping typed failures and turning the rest into defects
- ✅ `keepTypedFailures`

## Don't name functions as phrases

Name a function for what it does or returns. That's because a phrase reads well at the call site it was written for, and is opaque everywhere else.

- ❌ `overAFreshSocketIfNeeded`
- ✅ `retryOnConnectionReset`
- ❌ `understood`
- ✅ `isSupportedQuery`

## Use one word for each concept

Call a concept the same thing everywhere — types, functions, schemas, RPC methods, tool names and prose. That's because a reader who sees two words assumes two things.

- ❌ An expected failure called `Refused`, `Refusal`, `RefusalError` and `ToolRefusal` in different places
- ✅ One name for it, used everywhere
- ❌ An MCP tool and the RPC method behind it named differently, like `archive_project` and `softDelete`
- ✅ `archive_project` and `archiveProject`

## Use each word for one concept

Don't reuse a name for something different. That's because a reader who sees one word assumes one thing.

- ❌ `Problem` for both an HTTP problem response and a set of schema terms
- ✅ `ProblemResponse` and `SchemaTerms`
- ❌ `held` as the variable name for a value in one function, a key in another and a message in a third
- ✅ `value`, `key`, `message`

## Keep a consistent word order

Pick one order for compound names, and use it everywhere. That's because a mixed order makes related names hard to find and compare.

- ❌ `createUser` beside `groupCreate`
- ✅ `createUser` and `createGroup`
