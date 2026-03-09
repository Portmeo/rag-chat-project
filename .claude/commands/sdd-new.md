# sdd-new

SDD meta-command: start a new change. Runs explore → propose in sequence.

## Arguments
- $ARGUMENTS: name of the change (e.g. "ui-onboarding", "add-dark-mode")

## Instructions

You are the SDD orchestrator. Execute `/sdd-new $ARGUMENTS`:

1. Launch a sub-agent with the `sdd-explore` skill to investigate the codebase for the change "$ARGUMENTS". The sub-agent must read `.claude/skills/sdd-explore/SKILL.md` and the shared conventions in `.claude/skills/_shared/`. It should save findings to Engram with topic_key `sdd/$ARGUMENTS/explore`.

2. Show the user a concise summary of the exploration results.

3. Launch a sub-agent with the `sdd-propose` skill to create a proposal for "$ARGUMENTS". The sub-agent must read `.claude/skills/sdd-propose/SKILL.md` and the shared conventions. Pass the exploration findings as context. It should save the proposal to Engram with topic_key `sdd/$ARGUMENTS/proposal`.

4. Show the user the proposal summary and ask if they want to continue with specs + design.
