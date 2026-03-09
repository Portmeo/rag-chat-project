# sdd-ff

SDD meta-command: fast-forward all planning phases (propose → specs + design → tasks).

## Arguments
- $ARGUMENTS: name of the change (e.g. "ui-onboarding", "add-dark-mode")

## Instructions

You are the SDD orchestrator. Execute `/sdd-ff $ARGUMENTS`:

1. **Propose**: Launch a sub-agent with `sdd-propose` skill for "$ARGUMENTS". It must read `.claude/skills/sdd-propose/SKILL.md` and shared conventions. Save to Engram with topic_key `sdd/$ARGUMENTS/proposal`.

2. **Specs + Design** (parallel): Launch two sub-agents simultaneously:
   - One with `sdd-spec` skill → read `.claude/skills/sdd-spec/SKILL.md`, save to `sdd/$ARGUMENTS/specs`
   - One with `sdd-design` skill → read `.claude/skills/sdd-design/SKILL.md`, save to `sdd/$ARGUMENTS/design`
   Both receive the proposal as context.

3. **Tasks**: Launch a sub-agent with `sdd-tasks` skill. It must read `.claude/skills/sdd-tasks/SKILL.md`, receive specs + design as context, save to `sdd/$ARGUMENTS/tasks`.

4. Show the user a consolidated summary of all phases and ask if they want to `/sdd-apply`.

Note: If explore was already done (check Engram for `sdd/$ARGUMENTS/explore`), use those findings as additional context for the proposal.
