# Skill Desktop

A desktop app to install and manage [agent skills](https://github.com/anthropics/skills) across local coding agents (Claude Code, Codex, Gemini, Cursor).

Browse a repository, pick the skills you want, and install them into the agents and scope (global or per-project) you choose — by symlink so they track upstream, or as an independent copy.

## Requirements

- Node.js, pnpm
- Rust toolchain (`rustup`)
- The `git` CLI on your `PATH` (used to clone source repositories)
- Tauri 2 prerequisites for your platform — see the [Tauri setup guide](https://v2.tauri.app/start/prerequisites/)

## Develop

```bash
pnpm install
pnpm tauri dev
```

## Scripts

```bash
pnpm dev      # vite dev server (frontend only)
pnpm build    # type-check + production build of the frontend
pnpm test     # vitest unit tests
pnpm tauri dev    # run the full desktop app
pnpm tauri build  # produce a shippable bundle
```

Rust unit tests live alongside the source and run with `cargo test` inside `src-tauri/`.

## How install works

Paste any git URL — GitHub.com, GitHub Enterprise, GitLab, Gitea, self-hosted, `git@`, `ssh://`, `file://`, or `owner/repo` shorthand (defaults to github.com). A `#ref` fragment pins to a branch/tag/commit. Skill Desktop clones with shallow depth via your local `git`, scans for `SKILL.md` files, and writes the selected skills into the agent directories for the scope you picked. No lockfile is written — agent directories are the source of truth.

## License

MIT
