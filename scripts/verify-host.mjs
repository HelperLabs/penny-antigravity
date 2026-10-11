#!/usr/bin/env node
// Native Antigravity contract verification with synthetic loopback services.
// This starts the pinned CLI in print mode, never a signed-in Penny session.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { spawn } from "node:child_process";

const [binaryArg, packageArg, ...extra] = process.argv.slice(2);
if (!binaryArg || !packageArg || extra.length) {
  throw new Error("Usage: node scripts/verify-host.mjs <Antigravity 1.3.3 binary> <plugin-root>");
}
const binary = fs.realpathSync(path.resolve(binaryArg));
const packageRoot = fs.realpathSync(path.resolve(packageArg));
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const manifest = readJson(path.join(packageRoot, "plugin.json"));
assert.equal(manifest.name, "penny-antigravity");
const mcpConfig = readJson(path.join(packageRoot, "mcp_config.json"));
assert.deepEqual(Object.keys(mcpConfig.mcpServers), ["MyPenny"]);
assert.deepEqual(Object.keys(mcpConfig.mcpServers.MyPenny), ["serverUrl"]);
const skill = fs.readFileSync(path.join(packageRoot, "skills/mypenny/SKILL.md"), "utf8");
assert.match(skill, /^name: MyPenny$/m);
const rule = fs.readFileSync(path.join(packageRoot, "rules/mypenny.md"), "utf8");
assert.match(rule, /^trigger: always_on$/m);
const hooks = readJson(path.join(packageRoot, "hooks.json"));
assert.deepEqual(Object.keys(hooks), ["penny"]);
assert.deepEqual(Object.keys(hooks.penny), ["PreInvocation"]);
assert.equal(hooks.penny.PreInvocation.length, 1);

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "penny-agy-contract-")));
const home = path.join(root, "home");
const workspace = path.join(root, "workspace");
const staged = path.join(root, "package");
const groups = new Set();
const counts = { modelRequests: 0, primaryRequests: 0, mcpInitializations: 0, mcpToolLists: 0, mcpCapabilityProbes: 0, oauthMetadataProbes: 0, privateToolCalls: 0, unexpectedRequests: 0 };
const requestCounts = new Map();
const rpcMethodCounts = new Map();
const modelPaths = new Set([
  "/v1beta/models/gemini-3.8-flash:streamGenerateContent",
  "/v1beta/models/gemini-3.1-flash-lite-preview:streamGenerateContent",
]);
const oauthMetadataPaths = new Set(["/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-protected-resource"]);
const observed = { skill: false, rule: false, reminder: false, fixtureFailure: false };
const sockets = new Set();
const normalize = text => text.replace(/\s+/g, " ");
const rejectSymlinks = file => {
  const stat = fs.lstatSync(file);
  assert(!stat.isSymbolicLink(), "Runtime package must not contain symlinks");
  if (stat.isDirectory()) for (const name of fs.readdirSync(file)) rejectSymlinks(path.join(file, name));
};
const allStrings = value => typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(allStrings)
  : value && typeof value === "object" ? Object.values(value).flatMap(allStrings) : [];
const reply = (res, status, value) => {
  if (value === undefined) { res.writeHead(status); res.end(); return; }
  const body = JSON.stringify(value);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    // Diagnostics retain method/path counts only, never query strings, headers
    // or request bodies. The temporary services contain no account data.
    const requestKey = `${req.method} ${url.pathname}`;
    requestCounts.set(requestKey, (requestCounts.get(requestKey) ?? 0) + 1);
    // The native client checks whether this remote server supports OAuth, even
    // though the synthetic MCP server needs no account or token. Both exact
    // discovery fallbacks must report unavailable, never advertise an issuer.
    if (req.method === "GET" && !url.search && oauthMetadataPaths.has(url.pathname)) {
      counts.oauthMetadataProbes++; reply(res, 404); return;
    }
    if (url.pathname === "/mcp" && ["GET", "HEAD", "DELETE"].includes(req.method)) {
      res.writeHead(405, { Allow: "POST" }); res.end(); return;
    }
    if (req.method !== "POST") { counts.unexpectedRequests++; reply(res, 404); return; }
    let body = "";
    for await (const chunk of req) {
      body += chunk.toString("utf8");
      if (Buffer.byteLength(body) > 4 * 1024 * 1024) throw new Error("Fixture request limit exceeded");
    }
    const input = JSON.parse(body);
    if (url.pathname === "/mcp") {
      const method = typeof input.method === "string" && /^[a-zA-Z0-9_/.-]{1,80}$/.test(input.method) ? input.method : "invalid-method";
      rpcMethodCounts.set(method, (rpcMethodCounts.get(method) ?? 0) + 1);
      if (input.id === undefined) {
        if (!["notifications/initialized", "notifications/roots/list_changed"].includes(method)) counts.unexpectedRequests++;
        reply(res, 202); return;
      }
      let result;
      switch (input.method) {
        case "server/discover":
          // Antigravity's optional capability probe precedes ordinary MCP
          // initialization. Keep the fixture a minimal standard MCP server.
          counts.mcpCapabilityProbes++;
          reply(res, 200, { jsonrpc: "2.0", id: input.id, error: { code: -32601, message: "Optional server discovery is unsupported" } }); return;
        case "initialize":
          counts.mcpInitializations++;
          result = { protocolVersion: input.params?.protocolVersion ?? "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "penny-synthetic-contract", version: "0.0.0" } };
          break;
        case "tools/list":
          counts.mcpToolLists++;
          result = { tools: ["penny_session_start", "penny_read", "penny_write", "penny_edit", "penny_delete"].map(name => ({
            name, description: "Synthetic contract fixture; no private data or execution.",
            inputSchema: { type: "object", properties: {} },
            annotations: { readOnlyHint: ["penny_session_start", "penny_read"].includes(name) },
          })) };
          break;
        case "tools/call":
        case "resources/read":
        case "prompts/get":
          counts.privateToolCalls++;
          reply(res, 200, { jsonrpc: "2.0", id: input.id, error: { code: -32601, message: "Synthetic fixture forbids tool execution" } }); return;
        case "resources/list": result = { resources: [] }; break;
        case "resources/templates/list": result = { resourceTemplates: [] }; break;
        case "prompts/list": result = { prompts: [] }; break;
        case "ping": result = {}; break;
        default:
          counts.unexpectedRequests++;
          reply(res, 200, { jsonrpc: "2.0", id: input.id, error: { code: -32601, message: "Unknown synthetic method" } }); return;
      }
      reply(res, 200, { jsonrpc: "2.0", id: input.id, result }); return;
    }
    if (!modelPaths.has(url.pathname) || url.search !== "?alt=sse") {
      counts.unexpectedRequests++; reply(res, 404); return;
    }
    counts.modelRequests++;
    const primary = url.pathname === "/v1beta/models/gemini-3.8-flash:streamGenerateContent";
    if (primary) {
      counts.primaryRequests++;
      const text = normalize(allStrings(input).join(" "));
      observed.skill ||= text.includes("MyPenny") && text.includes("You are this user's personal assistant, and Penny is the set of tools");
      observed.rule ||= text.includes("Do not bypass tool permissions with hook decisions or blanket permission overrides.");
      observed.reminder ||= text.includes("Penny: Use the MyPenny skill only in a private, human-directed foreground conversation");
    }
    // The fixture deliberately emits no function calls, including auxiliary
    // title/summary requests. This does not assess a real model's compliance.
    const response = { candidates: [{ content: { role: "model", parts: [{ text: primary ? "PENNY_NATIVE_SYNTHETIC_OK" : "Synthetic contract check" }] }, finishReason: "STOP", index: 0 }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 } };
    const payload = `data: ${JSON.stringify(response)}\n\n`;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Content-Length": Buffer.byteLength(payload) }); res.end(payload);
  } catch {
    observed.fixtureFailure = true;
    if (!res.headersSent) reply(res, 500, { error: "Synthetic fixture failure" }); else res.destroy();
  }
});
server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
const stopGroup = pid => {
  try { process.kill(-pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
};

let env;
const run = (args, timeout = 30000) => new Promise((resolve, reject) => {
  const child = spawn(binary, args, { cwd: workspace, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  if (child.pid) groups.add(child.pid);
  let stdout = "", stderr = "", timedOut = false, overflow = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") reject(error); }
  }, timeout);
  const collect = stream => chunk => {
    if (stream === "stdout") stdout += chunk.toString("utf8"); else stderr += chunk.toString("utf8");
    if (stdout.length + stderr.length > 1024 * 1024) {
      overflow = true;
      try { process.kill(-child.pid, "SIGKILL"); } catch { /* close reports failure */ }
    }
  };
  child.stdout.on("data", collect("stdout")); child.stderr.on("data", collect("stderr"));
  child.on("error", error => { clearTimeout(timer); reject(error); });
  child.on("close", code => {
    clearTimeout(timer);
    if (child.pid) stopGroup(child.pid);
    if (timedOut || overflow || code !== 0) reject(new Error(`Native command failed (exit ${code}, timeout ${timedOut}, outputLimit ${overflow})`));
    else resolve({ stdout, stderr });
  });
});

try {
  for (const dir of [home, workspace, staged, path.join(root, "tmp"), path.join(home, ".gemini/antigravity-cli")]) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Stage only runtime components; never copy an account, env file, repository
  // metadata, local proof directory or node_modules into the native home.
  for (const component of ["plugin.json", "mcp_config.json", "hooks.json", "rules", "skills"]) {
    rejectSymlinks(path.join(packageRoot, component));
    fs.cpSync(path.join(packageRoot, component), path.join(staged, component), { recursive: true });
  }
  fs.writeFileSync(path.join(home, ".gemini/antigravity-cli/settings.json"), JSON.stringify({
    modelProvider: "gemini", enableTelemetry: false, notifications: false, showFeedbackSurvey: false,
    permissions: { ask: ["mcp(*)"], allow: [], deny: [] },
  }), { mode: 0o600 });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  mcpConfig.mcpServers.MyPenny.serverUrl = `${baseUrl}/mcp`;
  fs.writeFileSync(path.join(staged, "mcp_config.json"), `${JSON.stringify(mcpConfig, null, 2)}\n`);
  env = {
    HOME: home, PATH: [path.dirname(process.execPath), "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(path.delimiter),
    XDG_CONFIG_HOME: path.join(home, "xdg-config"), XDG_DATA_HOME: path.join(home, "xdg-data"), XDG_CACHE_HOME: path.join(home, "xdg-cache"),
    TMPDIR: path.join(root, "tmp"), LANG: "C.UTF-8", TERM: "xterm-256color", NO_COLOR: "1",
    GEMINI_API_KEY: "penny-synthetic-loopback-fixture", GOOGLE_GEMINI_BASE_URL: baseUrl, AGY_CLI_DISABLE_AUTO_UPDATE: "1",
  };
  assert.equal((await run(["--version"])).stdout.trim(), "1.3.3", "Expected the reviewed Antigravity release");
  const validation = await run(["plugin", "validate", staged]);
  const cleanOutput = `${validation.stdout}\n${validation.stderr}`.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  for (const component of ["skills", "mcpServers", "hooks"]) assert.match(cleanOutput, new RegExp(`${component}\\s*:\\s*1 processed`), `Native validation did not load one ${component}`);
  await run(["plugin", "install", staged]);
  const turn = await run(["--model", "gemini-3.8-flash", "--effort", "low", "--print-timeout", "30s", "-p", "Reply with the harmless synthetic test marker; do not call tools."], 45000);
  assert(turn.stdout.includes("PENNY_NATIVE_SYNTHETIC_OK"), "Native synthetic turn did not finish");
  assert(counts.primaryRequests > 0, "Native CLI did not use the loopback model");
  assert(counts.mcpInitializations > 0 && counts.mcpToolLists > 0, "Native CLI did not discover the synthetic MCP server");
  assert(observed.skill && observed.rule && observed.reminder, "Native request omitted the skill, rule or PreInvocation reminder");
  assert.equal(counts.privateToolCalls, 0, "Plain synthetic turn attempted a private tool");
  assert.equal(counts.unexpectedRequests, 0, `Unexpected loopback request; method/path counts: ${JSON.stringify(Object.fromEntries(requestCounts))}; RPC method counts: ${JSON.stringify(Object.fromEntries(rpcMethodCounts))}`);
  assert.equal(observed.fixtureFailure, false, "Synthetic fixture failed");
  console.log(JSON.stringify({ host: "Antigravity CLI 1.3.3", nativeValidation: true, skills: 1, rules: 1, hooks: 1, mcpServers: 1,
    modelRequests: counts.modelRequests, mcpCapabilityProbes: counts.mcpCapabilityProbes, oauthMetadataProbes: counts.oauthMetadataProbes,
    unexpectedRequests: counts.unexpectedRequests, privateToolCalls: counts.privateToolCalls, nativeRuleAndReminderConsumed: true,
    scope: "Native synthetic print-mode loading with isolated home and loopback model/MCP; no OAuth, live Penny data, real-model compliance or interactive approval verification" }));
} finally {
  for (const pid of groups) {
    try { process.kill(-pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  }
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(root, { recursive: true, force: true });
}
