<div align="center">

<img src="src-tauri/icons/icon.png" width="140" alt="Skill Desktop" />

# Skill Desktop

**Install agent skills without opening a terminal.**

Until now, adding a skill to Claude Code, Codex, Gemini, Cursor, GitHub Copilot, or Windsurf meant a CLI — `claude add`, a marketplace command, copy-pasting folders by hand. Skill Desktop is the GUI for that. Browse, pick, install. Same skills, same folders, no terminal required.

[![Release](https://img.shields.io/github/v/release/skill-desktop-labs/skill-desktop?color=blue&label=Release)](https://github.com/skill-desktop-labs/skill-desktop/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS-black)](https://github.com/skill-desktop-labs/skill-desktop/releases/latest)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri-orange)](https://tauri.app)

[Download for macOS](https://github.com/skill-desktop-labs/skill-desktop/releases/latest) · [Report a bug](https://github.com/skill-desktop-labs/skill-desktop/issues/new?labels=bug) · [Request a feature](https://github.com/skill-desktop-labs/skill-desktop/issues/new?labels=enhancement)

</div>

---

## Why

Agent skills are the fastest way to teach a coding agent a new trick — turn a PDF, ship a PR, generate brand assets, whatever. But every agent ships its own CLI, its own folder layout, its own install quirk. Six agents on one laptop means six install paths to memorize, and most of them live in a terminal window that not everyone wants to open.

Skill Desktop is the one installer that works for all of them. Paste a repo URL, pick the agents and the scope, done. The same folders the CLIs would have written to — nothing invented, nothing locked in.

## What it does

**Six agents, one window.** Install a skill into one agent or all six at once.

| Agent | Skills folder |
| --- | --- |
| Claude Code | `.claude/skills` |
| Codex | `.agents/skills` (canonical, shared) |
| Gemini | `.agents/skills` (canonical, shared) |
| Cursor | `.agents/skills` (canonical, shared) |
| GitHub Copilot | `.agents/skills` (canonical, shared) |
| Windsurf | `.windsurf/skills` |

**Any git source.** `owner/repo` shorthand, `github.com/owner/repo`, GitHub Enterprise, GitLab, Gitea, self-hosted, `git@`, `ssh://`, `file://`. Pin to a branch, tag, or commit with `#ref` — for example `vercel-labs/agent-skills#main`.

**Symlink or copy.** Symlink mode writes one canonical copy and links each agent's folder to it, so a single update propagates everywhere. Copy mode writes independent folders per agent — fork the skill, edit it, the upstream stays untouched.

**Global or per-project.** Install machine-wide, or scope to a specific project directory. Toggle in the UI.

**No lockfile.** Agent directories are the source of truth. Nothing writes a `skills-lock.json` behind your back — if you delete a folder, it's gone.

**Auto-updates.** New versions ship through GitHub Releases; the app notifies you and installs on next launch.

## Install

### macOS (Universal — Apple silicon and Intel)

Download the latest `.dmg` from the [releases page](https://github.com/skill-desktop-labs/skill-desktop/releases/latest), drag to **Applications**, open.

### Build from source

Requires Node.js, [pnpm](https://pnpm.io), a Rust toolchain via [rustup](https://rustup.rs), the `git` CLI on your `PATH`, and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
git clone https://github.com/skill-desktop-labs/skill-desktop.git
cd skill-desktop
pnpm install
pnpm tauri dev      # run the app
pnpm tauri build    # produce a shippable bundle
```

## Quick start

1. **Paste a repo URL.** Anything from `vercel-labs/agent-skills` to a private `git@gitlab.internal:team/skills.git`.
2. **Pick the skills** you want from what Skill Desktop found.
3. **Pick the agents and scope** — global, or a project folder.
4. **Install.** Symlink by default; switch to copy if you want to fork.

## How install works

1. You paste a URL. Skill Desktop parses `owner/repo` shorthand, `#ref` fragments, `/tree/<ref>/<subpath>` URLs, and explicit `https://` / `ssh://` / `git@` / `file://` forms — same rules as the Vercel `skills` CLI.
2. A shallow clone runs through your local `git` into a temp directory.
3. Skill Desktop walks the clone, finds every `SKILL.md`, and shows you the name and description parsed from its YAML front-matter.
4. On install, the selected skill folders land in each agent's own dir (or the shared canonical `.agents/skills` dir, for universal agents). Symlink mode writes one real copy and symlinks the rest; copy mode writes independent folders.

Skill Desktop never edits your agent configs. It only places folders — the same folders the CLIs would write to, no extra metadata.

## Roadmap

- Windows and Linux builds
- Skill update detection (is a newer upstream available?)
- Skill search across multiple source repos
- Bulk install / uninstall

## License

[MIT](./LICENSE) — © HoJin Lee
