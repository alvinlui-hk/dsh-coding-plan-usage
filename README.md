# Coding Plan usage for DeepSeek Harness

Show your coding-plan quotas in DeepSeek Harness. Three cards appear at the bottom of **Settings → Models**:

- **Qwen Token Plan** — monthly / 5-hour / weekly quota, whichever Qwen returns.
- **Z.ai GLM Coding Plan** — session (5h), weekly token usage, and web-search count.
- **MiniMax Coding Plan** — session and weekly prompt usage.

This is an unofficial plugin. It is not affiliated with Alibaba/Qwen, Z.ai (Zhipu), MiniMax, or DeepSeek. The usage endpoints are undocumented provider APIs and can change.

## How each provider authenticates

- **Z.ai and MiniMax** use the provider **API key**. If you already configured the `zai` / `minimax` model provider in DSH, the plugin reads `ZAI_API_KEY` / `MINIMAX_API_KEY` from the DSH credential store automatically — nothing to paste. Otherwise each card has a paste box that stores the key locally.
- **Qwen** cannot use the inference API key for quota. Sign-in opens a dedicated Edge/Chrome window (not your everyday browser), you log in to Qwen Cloud there, and the plugin reads only `qwencloud.com` cookies, then closes the window.

## Install

From npm (one-click, shows in the in-app Plugin Center):

```text
dsh plugin --profile desktop add @alvinlui-hk/dsh-coding-plan-usage
```

Or from a DSH session, ask the agent to install this repository:

```text
dsh plugin --profile desktop add github:alvinlui-hk/dsh-coding-plan-usage
```

That needs `git` on `PATH`. Without Git, use the tarball:

```text
dsh plugin --profile desktop add https://codeload.github.com/alvinlui-hk/dsh-coding-plan-usage/tar.gz/refs/heads/main
```

Use `--profile web` instead of `--profile desktop` if that is the profile with the Web UI. Then restart DeepSeek Harness and open **Settings → Models**.

## Requirements

- DeepSeek Harness `0.2.1` or later, with a Web UI profile. Verified on `0.2.1-rc.2`, `0.2.1-rc.3`, `0.2.2-rc.1`, and the `0.2.2` nightly. Routes require the signed-in browser session; see [SECURITY.md](SECURITY.md).
- Z.ai: a GLM Coding Plan and its API key. MiniMax: a Coding Plan and its API key.
- Qwen: a Qwen Cloud Token Plan, plus Microsoft Edge or Google Chrome for the sign-in window.

## Privacy

See [SECURITY.md](SECURITY.md). In short: secrets stay in the local DSH credential store, requests go only to each provider's own API, the Qwen debugger listens on `127.0.0.1` and refuses browser origins, and sign-out deletes the stored record.

## License

[MIT](LICENSE)
