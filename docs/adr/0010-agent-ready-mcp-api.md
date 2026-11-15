# 0010. Agent-ready API: read-only MCP tools with the user's own token

- Status: accepted
- Date: 2026-10-13
- Deciders: Ayanbergen Saduakassov

## Context
The M3 plan called for an agent-ready API: analyze/evidence as read-only, tenant-scoped MCP tools that return Evidence ids, plus our own skill packs. M4 added supplier dossiers worth exposing the same way.

## Decision
1. Official MCP Python SDK `mcp==2.2.0` (MIT; v2.3.0 is inside the 14-day cooldown), mounted on the existing API at `/mcp/`, stateless JSON transport. FastMCP (third party) is not needed: the SDK's `MCPServer` covers it.
2. Auth = the user's Supabase access token through the SDK's resource-server hooks (our verifier). Every tool runs in the caller's RLS transaction, so an agent can never see more than the user can in the web app.
3. Six read-only tools (organizations, reports, findings, evidence, suppliers, dossier). Untrusted text is returned under `data`; numbers carry Evidence ids or their source rows.
4. Skill packs (`packages/agent-skills/skills/`) are our own text, written from the patterns of Apache/MIT skills; nothing copied.

## Alternatives considered
Per-organization API tokens now (more control, needs a token table, admin UI and rotation: D37); a separate MCP process (more deployment surface for no gain today).

## Consequences
Agents act with a user's full read rights and the token's one-hour lifetime. Rate limiting and narrower scopes arrive with D37.
