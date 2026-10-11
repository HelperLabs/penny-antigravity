# Penny for Antigravity

Penny brings your memories and notes, projects, and tasks into Antigravity through OAuth MCP tools. Built by [HelperLabs](https://helperlabs.ai).

This native plugin includes the canonical Penny skill, a conversation eligibility rule, and a static PreInvocation reminder. The release target is **Antigravity CLI 1.3.3** with **Node.js 20 or later** on PATH. Other CLI versions, Antigravity 2.0, and the IDE have not been verified for this release.

## Install

Install from the HelperLabs repository:

```sh
agy plugin install https://github.com/HelperLabs/penny-antigravity
```

For a specific release, download and extract the archive from [GitHub Releases](https://github.com/HelperLabs/penny-antigravity/releases), inspect its files, then install the extracted directory:

```sh
agy plugin install /absolute/path/to/penny-antigravity
```

Review the installed components. Before signing in on macOS or Linux, protect Antigravity's credential directory:

```sh
mkdir -p ~/.gemini/antigravity-cli
chmod 700 ~/.gemini/antigravity-cli
```

In Antigravity, run `/mcp`, select `penny-antigravity_MyPenny`, and choose **Authenticate**. Sign in to your own Penny account, approve the displayed access, then paste the callback code into the CLI. The remote MCP endpoint is `https://app.mypenny.ai/mcp`.

After sign-in, protect the token file too:

```sh
chmod 600 ~/.gemini/antigravity-cli/mcp_oauth_tokens.json
```

CLI 1.3.3 created this file with mode `0644` in our test. The private directory protects its contents even if the host recreates the file. Keep native per-call approvals enabled; the package grants no blanket permissions and contains no credentials. Each person signs in to their own Penny account. Installing this public plugin does not share the publisher's account or memories.

In a private foreground conversation where you own the authenticated Penny account, tell the agent:

> Enable Penny for this conversation. Read the MyPenny skill, start the session, and use Penny when my history would help. Ask before any write or delete that needs approval.

Installation alone does not enable private reads or saves. Enabling Penny in one conversation does not enable it in another.

## What runs

The PreInvocation hook prints one public reminder about eligibility, recall, and saving during the task. It reads no transcript, calls no Penny tool, stores no local memory, and uploads no telemetry. It does not override permissions or ask the host to continue or stop.

Private reads and saves use Antigravity's native MCP calls. Returned memory enters the active conversation and its selected model; a write sends the content chosen for that call to Penny. Antigravity controls its own local history and data-sharing settings. Review those settings before using private memory.

The rule and skill guide the model. They cannot establish who is reading a conversation, prove account ownership, or enforce per-conversation access. Disable Penny's MCP server or plugin in background, headless, scheduled, remote, shared, and subagent contexts that must have no private-memory access. Do not forward private memory to subagents.

There is no automatic profile read, exit save, or guaranteed save before compaction. The agent uses `penny_read` when history matters and saves useful decisions through approved tools while the task is underway.

## Verification

Version 0.1.0 passed the source's 17 focused tests, native CLI 1.3.3 manifest validation, and a synthetic native check of rule and hook ingestion. Native Penny OAuth, refused-write cancellation, an allow-once write, exact-ID content readback, soft-delete, and empty readback also passed. The live test used a deterministic local model; it does not establish general model compliance.

The [public CI workflow](https://github.com/HelperLabs/penny-antigravity/actions) repeats release-input, build, and native loading checks. See its current results and the release evidence below.

`BUILD.json` identifies the canonical skill and source build. The standalone release has no third-party runtime or build dependencies. `release-toolchains.json` pins Node, npm, and checksum-verified official Antigravity host artifacts. Release inputs must be committed and clean before the commit-keyed dependency manifest is generated.

See [VERIFICATION.md](VERIFICATION.md) for the final release evidence and limits. Marketplace submission requests inclusion through [Google's interest form](https://www.antigravity.google/docs/marketplace); it does not guarantee approval.

## Development

```sh
npm ci --ignore-scripts
npm run build
npm test
node scripts/verify-host.mjs /absolute/path/to/antigravity .
npm run security:manifest
```

Support: [support@mypenny.ai](mailto:support@mypenny.ai). Source and releases belong to HelperLabs. License: MIT.
