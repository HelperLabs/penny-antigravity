# Release verification

Version 0.1.0 targets exact Antigravity CLI 1.3.3.

Confirmed:

- The MyPenny source's 17 focused tests pass.
- The official Darwin ARM64 CLI artifact matches the SHA-512 pinned in `release-toolchains.json` and reports version 1.3.3.
- Native manifest validation and local installation accept one canonical skill, one MCP server, and one PreInvocation hook.
- A separate synthetic native model request includes the named `always_on` rule and hook reminder. Rules are loaded even though the CLI's component summary omits them.
- The standalone native verifier passes with Node 22.15.0 and CLI 1.3.3: one skill, one rule, one hook, one MCP server, two model requests, zero unexpected requests and zero private tool calls. It uses an isolated HOME and loopback model/MCP services, then removes its temporary files and processes.
- Five release-input security tests pass; npm audit reports zero vulnerabilities. Independent review accepted the verifier's exact optional discovery responses and confirmed the runtime payload matches the canonical source.
- Native OAuth/PKCE completed through Antigravity's `/mcp` Authenticate action. Access and refresh tokens were present. The isolated HOME was mode `0700`; the host-created token file was initially `0644` and was changed to `0600`. The install guide protects the credential directory before authentication.
- Native per-call permissions stopped a refused write. A separate allow-once write returned Penny's saved receipt. A bounded `note_links` read at depth 2 with `maxNodes: 1` returned the exact saved ID and synthetic content. Approved soft-delete succeeded, and the same ID returned an empty subgraph afterward.
- Both disposable notes were moved to recoverable Trash. Native processes and the loopback model were stopped; local tokens, OAuth files, and conversation history were removed. All 28 tracked release files were checked against the personal test tokens, with zero matches.
- The live test used the actual interactive Antigravity CLI and Penny service with a deterministic loopback model. No private tool result went to an external model. Test instrumentation was corrected for Penny's `memoryId` receipts, an empty `failed` array on successful deletion, and the difference between a depth-1 neighbor query and a bounded seed read.

Public CI, a fresh public install, and marketplace acceptance are recorded separately after publication. General model compliance, forced token refresh, shared/subagent eligibility, and Antigravity 2.0/IDE behavior require separate tests.

The retained local evidence contains versions, counts, hashes, and pass/fail results, without tokens or private memory. The public plugin contains configuration and public guidance only; every user must authorize their own Penny account.
