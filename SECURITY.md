# Security

This plugin reads provider account data to show coding-plan usage. Handle it accordingly.

## Secrets

- Z.ai / MiniMax API keys are resolved from the DSH credential store (`ZAI_API_KEY`, `MINIMAX_API_KEY`) — the same references the pi-ai providers use. A key pasted into a card is stored in a plugin-scoped record (`coding-plan-usage/zai-key`, `coding-plan-usage/minimax-key`), never in configuration files.
- The Qwen console cookie is stored in `coding-plan-usage/qwen-session`.
- No secret is ever returned to the settings page or logged. Routes return only numbers, plan names, and status codes. Error strings are scrubbed of `sk-…`, `Bearer …`, and `sec_token=…`.

## Network

- Requests go only to the provider's own hosts: `home.qwencloud.com` / `cs-data.qwencloud.com`, `api.z.ai`, `api.minimax.io` / `api.minimaxi.com`.
- Plugin routes are exact paths and require the signed-in browser session.
  - On DSH 0.2.2-rc.2 and later, each route declares `auth: 'required'`. WebServer admits the request before this plugin runs: `Host` must be loopback, the listener bind address, or a configured `trustedHosts` entry, and the browser session cookie must be present.
  - On the current 0.2.2 nightly, the handler calls `connection.requestRejection` directly. That is the same Host and session-cookie fence.
  - A composition with neither service rejects a missing, `null`, or cross-site `Origin`. An unmarked request is not treated as local, so another local process cannot start the Qwen login browser or delete a stored credential through these routes.
- Responses are method-checked and `no-store`. A closed socket cannot turn a finished provider call into an unhandled exception.

## Qwen sign-in browser

- Uses a dedicated profile under `~/.dsh/coding-plan-usage/edge-profile`, not your everyday browser. Do not share that folder.
- The remote debugger binds `127.0.0.1` only, and is launched with `--remote-allow-origins=http://127.0.0.1:1`. Node's WebSocket client (no Origin header) is accepted; a browser page (which always sends an Origin) is refused, so a malicious site cannot reach the debugger even via DNS rebinding.
- The window is killed by PID tree as soon as the cookie is captured, on cancel, on timeout, and when the plugin unmounts.

## Sign-out

Deletes the relevant credential record only. It does not revoke anything server-side, does not delete your provider account, and does not delete the inference API key configured for the model provider.

Do not paste access tokens, refresh tokens, API keys, or `~/.dsh/.credentials.yaml` into issues. Report security problems privately to the repository owner.
