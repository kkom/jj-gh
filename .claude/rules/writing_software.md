# Writing software

## Choose the simple, regular solution

Look for one general rule that handles every case, rather than adding a special case for each problem as it appears.

That's because each special case is cheap on its own, but together they make code that nobody can reason about as a whole. A special case solves the problem in front of you and makes the next change harder.

- ❌ An `if` for the one table whose name contains a dot
- ✅ Quoting every table name
- ❌ A separate code path for a list of one item
- ✅ One code path that handles a list of any length

## Ask before you drop a case for simplicity

The general solution sometimes doesn't handle a case that a special case would. That trade can be right, but the human decides it. So name the case that goes unhandled and ask, rather than adding the special case or dropping the case without saying.

## Make complete fixes and implementations

AI agents write most of the code, so writing it is cheap. Fix the root cause and implement things properly. When a task runs into existing code that's broken, awkward or missing something, fix or improve that code too. Put that fix in its own change below the task's.

That's because a partial workaround leaves an identified problem unsolved.

- ❌ Catching an error at the one call site that fails
- ✅ Fixing the function that raises it
- ❌ A new option that the API accepts and the CLI doesn't
- ✅ The option in every interface that takes the others
- ❌ "Leaves the other callers as they are for now"
- ✅ Updating every caller
- ❌ Working around a broken helper inside the feature's change
- ✅ Fixing the helper in a change below the feature's
