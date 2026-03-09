# sdd-continue

SDD meta-command: run the next missing phase in the dependency chain.

## Arguments
- $ARGUMENTS: (optional) name of the change. If omitted, detect from recent Engram context.

## Instructions

You are the SDD orchestrator. Execute `/sdd-continue $ARGUMENTS`:

1. Recover current state from Engram: search for `sdd/$ARGUMENTS/*` to find which artifacts exist (explore, proposal, specs, design, tasks, apply, verify, archive).

2. Determine the next phase(s) using the dependency graph:
   ```
   proposal -> specs --> tasks -> apply -> verify -> archive
                ^
                |
              design
   ```
   - `specs` and `design` both depend on `proposal` (can run in parallel)
   - `tasks` depends on both `specs` and `design`
   - `apply` depends on `tasks`
   - `verify` depends on `apply`
   - `archive` depends on `verify`

3. Launch the next sub-agent(s) for the missing phase(s). Each sub-agent must read its `.claude/skills/sdd-{phase}/SKILL.md` and the shared conventions in `.claude/skills/_shared/`. If two phases can run in parallel (specs + design), launch both.

4. Show the user a summary and ask if they want to continue to the next phase.
