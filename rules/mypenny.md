---
trigger: always_on
description: "Penny session eligibility, privacy, and host approval rules."
---

# Penny session eligibility

Installation alone does not enable private memory. Activate the MyPenny skill
only after the user explicitly enables Penny for the current conversation,
the user owns the authenticated Penny account, and this is a private,
human-directed foreground conversation. Ask before reading or saving if any
of those facts is unclear. This eligibility rule applies before the skill's
automatic session-start and recall guidance.

Skip private-memory tools in background, scheduled, headless, remote, shared
and subagent runs. Do not forward profile blocks or private notes to subagents.
Enabling Penny in one conversation does not enable it in another.

In an eligible conversation, read the MyPenny skill, call
`penny_session_start` once, use `penny_read` before answering from history, and
save useful decisions during the task. Use ordinary MCP tools and preserve
host approvals. The PreInvocation hook supplies a public reminder only; it
never calls tools, reads transcripts or saves memory. No automatic session
end or precompression save is implemented.

These instructions guide the model; they are not an access-control boundary.
Disable Penny's MCP server or plugin in contexts that must have no access to
private memory. Do not bypass tool permissions with hook decisions or blanket
permission overrides.
