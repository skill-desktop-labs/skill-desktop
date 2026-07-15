use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// Per-process unique suffix for `discover_from_url` temp dirs, so concurrent
/// discovers never collide on the same path.
static DISCOVER_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

struct ParsedSource {
    clone_url: String,
    r#ref: Option<String>,
    subpath: Option<String>,
}

/// A single URL path segment is safe when it is non-empty and not a
/// path-traversal component.
fn is_safe_segment(s: &str) -> bool {
    !s.is_empty() && s != ".." && s != "." && !s.contains('\\')
}

/// Mirrors the Vercel `skills` CLI `parseSource` behaviour: accept any git
/// host (GitHub.com, internal GHES, GitLab, Gitea, self-hosted, …) over
/// https/http/ssh/file, plus `owner/repo` shorthand (defaults to github.com)
/// and an optional `#ref` fragment to pin a branch/tag/commit. Path-traversal
/// segments are still rejected — that's a defence against accidental clones
/// into attacker-controlled subpaths, not a host restriction.
fn parse_source(input: &str) -> Result<ParsedSource, String> {
    let input = input.trim();
    if input.is_empty() {
        return Err("Please enter a repository URL.".into());
    }

    // Split off `#ref` fragment (skills CLI style). Only honoured for git-like
    // sources — arbitrary URL anchors (e.g. a docs page) are left untouched.
    let (main, fragment) = match input.find('#') {
        Some(i) if looks_like_git_source(&input[..i]) => (&input[..i], Some(&input[i + 1..])),
        _ => (input, None),
    };

    // owner/repo[/sub/path] shorthand → https://github.com/owner/repo.git
    // (skills CLI default). Use `#ref` to pin a branch — `/tree/...` is a
    // URL-only convention and not honoured for shorthand.
    if !main.contains("://")
        && !main.starts_with("git@")
        && !main.starts_with("ssh://")
        && !main.starts_with("file://")
        && !main.starts_with('/')
        && !main.starts_with('.')
        && !main.contains('\\')
        && !main.contains(':')
    {
        let segs: Vec<&str> = main.split('/').filter(|s| !s.is_empty()).collect();
        if segs.len() >= 2 && segs.iter().all(|s| is_safe_segment(s)) {
            let owner = segs[0];
            let repo = segs[1].trim_end_matches(".git");
            let subpath = segs[2..].join("/");
            return Ok(ParsedSource {
                clone_url: format!("https://github.com/{owner}/{repo}.git"),
                r#ref: fragment.map(|s| s.to_string()),
                subpath: if subpath.is_empty() { None } else { Some(subpath) },
            });
        }
    }

    // git@<host>:<owner>/<repo>(.git)
    if let Some(rest) = main.strip_prefix("git@") {
        let Some((host, path)) = rest.split_once(':') else {
            return Err("Check the git@ SSH URL format.".into());
        };
        if host.is_empty() {
            return Err("Check the host.".into());
        }
        let segs: Vec<&str> = path
            .trim_end_matches(".git")
            .split('/')
            .filter(|s| !s.is_empty())
            .collect();
        if segs.len() < 2 || segs.iter().any(|s| !is_safe_segment(s)) {
            return Err("owner/repo format is required.".into());
        }
        return Ok(ParsedSource {
            clone_url: main.to_string(),
            r#ref: fragment.map(|s| s.to_string()),
            subpath: None,
        });
    }

    // ssh://[git@]host[:port]/owner/repo(.git) — pass through as-is.
    if let Some(rest) = main.strip_prefix("ssh://") {
        if rest.trim().is_empty() {
            return Err("Check the ssh:// URL.".into());
        }
        return Ok(ParsedSource {
            clone_url: main.to_string(),
            r#ref: fragment.map(|s| s.to_string()),
            subpath: None,
        });
    }

    // file:///abs/path — pass through as-is.
    if let Some(rest) = main.strip_prefix("file://") {
        if rest.trim().is_empty() {
            return Err("Check the file:// URL.".into());
        }
        return Ok(ParsedSource {
            clone_url: main.to_string(),
            r#ref: None,
            subpath: None,
        });
    }

    // http(s)://host/owner/repo(.git)[/tree/<ref>[/<subpath...>]]
    let scheme = if let Some(s) = main.strip_prefix("https://") {
        ("https", s)
    } else if let Some(s) = main.strip_prefix("http://") {
        ("http", s)
    } else {
        return Err("Only http(s)://, ssh://, git@, file://, or owner/repo formats are supported.".into());
    };
    let (scheme, after) = scheme;

    let mut segs = after.split('/');
    let host = segs.next().unwrap_or("");
    if host.is_empty() {
        return Err("Check the host.".into());
    }
    let rest: Vec<&str> = segs.filter(|s| !s.is_empty()).collect();
    if rest.len() < 2 {
        return Err("owner/repo format is required.".into());
    }
    let owner = rest[0];
    let repo = rest[1].trim_end_matches(".git");
    if !is_safe_segment(owner) || !is_safe_segment(repo) {
        return Err("Invalid repository path.".into());
    }

    // Optional /tree/<ref>/<subpath...> (GitHub/Gitea) — GitLab's `/-/tree/` is
    // not specially handled; the user can paste a clone URL directly instead.
    let (tree_ref, subpath) = if rest.len() >= 4 && rest[2] == "tree" {
        let ref_v = rest[3];
        if !is_safe_segment(ref_v) {
            return Err("Invalid ref.".into());
        }
        let sub_segs = &rest[4..];
        if sub_segs.iter().any(|s| !is_safe_segment(s)) {
            return Err("Invalid subpath.".into());
        }
        let sub = sub_segs.join("/");
        (Some(ref_v.to_string()), if sub.is_empty() { None } else { Some(sub) })
    } else {
        (None, None)
    };
    let r#ref = tree_ref.or_else(|| fragment.map(|s| s.to_string()));

    Ok(ParsedSource {
        clone_url: format!("{scheme}://{host}/{owner}/{repo}.git"),
        r#ref,
        subpath,
    })
}

/// Heuristic match for "the part before a `#` looks git-ish" — used to decide
/// whether to treat a URL fragment as a ref. Mirrors `looksLikeGitSource` in
/// the skills CLI.
fn looks_like_git_source(s: &str) -> bool {
    if s.is_empty() {
        return false;
    }
    if s.starts_with("git@")
        || s.starts_with("ssh://")
        || s.starts_with("https://")
        || s.starts_with("http://")
        || s.starts_with("file://")
    {
        return true;
    }
    // owner/repo shorthand — no scheme, no leading dot/slash, no colon.
    !s.contains(':') && !s.starts_with('.') && !s.starts_with('/') && {
        let segs: Vec<&str> = s.split('/').filter(|x| !x.is_empty()).collect();
        segs.len() >= 2 && segs.iter().all(|x| is_safe_segment(x))
    }
}

// ---------------------------------------------------------------------------
// Skill discovery (git clone + SKILL.md scan)
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DiscoveredSkill {
    name: String,
    description: String,
    skill_path: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DiscoverResult {
    temp_dir: String,
    r#ref: String,
    source_url: String,
    source_type: String,
    skills: Vec<DiscoveredSkill>,
}

fn ensure_git() -> Result<(), String> {
    std::process::Command::new("git")
        .arg("--version")
        .output()
        .map_err(|_| "git is required. Please install git.".to_string())?;
    Ok(())
}

/// Clone `clone_url` into a fresh temp dir and discover SKILL.md files under
/// `subpath` (or the repo root). `ref` narrows the clone branch when given.
fn discover_from_url(
    clone_url: &str,
    r#ref: Option<&str>,
    subpath: Option<&str>,
) -> Result<DiscoverResult, String> {
    ensure_git()?;
    let seq = DISCOVER_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let temp = std::env::temp_dir().join(format!("skill-desktop-{}-{}", std::process::id(), seq));
    // Use a unique dir; if it exists, remove first.
    let _ = std::fs::remove_dir_all(&temp);
    std::fs::create_dir_all(&temp).map_err(|e| e.to_string())?;

    let mut args: Vec<String> = vec!["clone".into(), "--depth".into(), "1".into()];
    if let Some(r) = r#ref {
        args.push("--branch".into());
        args.push(r.to_string());
    }
    args.push(clone_url.to_string());
    args.push(temp.to_string_lossy().to_string());

    let out = std::process::Command::new("git")
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        let _ = std::fs::remove_dir_all(&temp);
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("clone failed: {}", stderr.trim().lines().last().unwrap_or("")));
    }

    let resolved_ref = r#ref
        .map(|s| s.to_string())
        .unwrap_or_else(|| current_branch(&temp).unwrap_or_else(|| "HEAD".into()));

    let scan_root = match subpath {
        Some(s) => temp.join(s),
        None => temp.clone(),
    };
    let mut skills = Vec::new();
    find_skill_md(&temp, &scan_root, &mut skills);
    if skills.is_empty() {
        let _ = std::fs::remove_dir_all(&temp);
        return Err("No skills found in this repository.".into());
    }

    Ok(DiscoverResult {
        temp_dir: temp.to_string_lossy().to_string(),
        r#ref: resolved_ref,
        source_url: clone_url.to_string(),
        source_type: "git".into(),
        skills,
    })
}

fn current_branch(repo: &Path) -> Option<String> {
    let out = std::process::Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(repo)
        .output()
        .ok()?;
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() || s == "HEAD" { None } else { Some(s) }
}

/// Recursively find SKILL.md files under `dir`, recording repo-relative paths
/// (relative to `repo_root`, forward slashes). Skips `.git`/`node_modules`.
fn find_skill_md(repo_root: &Path, dir: &Path, out: &mut Vec<DiscoveredSkill>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_dir() {
            let n = entry.file_name();
            if n == ".git" || n == "node_modules" {
                continue;
            }
            find_skill_md(repo_root, &path, out);
        } else if ft.is_file() && entry.file_name() == "SKILL.md" {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Some((name, description)) = parse_frontmatter(&content) {
                    let rel = path
                        .strip_prefix(repo_root)
                        .unwrap()
                        .to_string_lossy()
                        .replace('\\', "/");
                    out.push(DiscoveredSkill { name, description, skill_path: rel });
                }
            }
        }
    }
}

#[tauri::command]
fn discover_skills(source_url: String) -> Result<DiscoverResult, String> {
    let parsed = parse_source(&source_url)?;
    discover_from_url(&parsed.clone_url, parsed.r#ref.as_deref(), parsed.subpath.as_deref())
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

/// Resolve a config home from an env override (trimmed, non-empty wins) or a
/// `~/<default>` fallback. Shared by agent detection and skill dir resolution.
fn override_or(home: &Path, env: Option<&str>, default: &str) -> PathBuf {
    match env.map(str::trim).filter(|s| !s.is_empty()) {
        Some(dir) => PathBuf::from(dir),
        None => home.join(default),
    }
}

/// Sanitize a skill name into a safe kebab-ish directory name.
/// Mirrors `sanitizeName` in the skills CLI (`installer.ts`).
fn sanitize_name(name: &str) -> String {
    let lower = name.to_lowercase();
    // Replace any run of chars that are NOT [a-z0-9._] with a single '-'.
    let mut out = String::with_capacity(lower.len());
    let mut prev_dash = false;
    for ch in lower.chars() {
        let keep = ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '.' || ch == '_';
        if keep {
            out.push(ch);
            prev_dash = false;
        } else if !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }
    // Trim leading/trailing '.' and '-'.
    let trimmed = out.trim_matches(|c| c == '.' || c == '-');
    let mut result: String = trimmed.chars().take(255).collect();
    if result.is_empty() {
        result = "unnamed-skill".to_string();
    }
    result
}

/// Compute per-agent install status from a resolved home dir and env overrides.
/// Mirrors the skills CLI `detectInstalled` logic: an agent is "installed" when
/// its home config marker directory exists.
fn detect_installed(
    home: &Path,
    claude_env: Option<&str>,
    codex_env: Option<&str>,
    codex_system: &Path,
) -> HashMap<String, bool> {
    let claude = override_or(home, claude_env, ".claude");
    let codex = override_or(home, codex_env, ".codex");

    let mut map = HashMap::new();
    map.insert("claude".to_string(), claude.exists());
    map.insert(
        "codex".to_string(),
        codex.exists() || codex_system.exists(),
    );
    map.insert("gemini".to_string(), home.join(".gemini").exists());
    map.insert("cursor".to_string(), home.join(".cursor").exists());
    map.insert(
        "github-copilot".to_string(),
        home.join(".copilot").exists(),
    );
    map.insert(
        "windsurf".to_string(),
        home.join(".codeium/windsurf").exists(),
    );
    map
}

#[tauri::command]
fn detect_installed_agents(app: tauri::AppHandle) -> HashMap<String, bool> {
    let home = app
        .path()
        .home_dir()
        .unwrap_or_else(|_| PathBuf::from(std::env::var("HOME").unwrap_or_default()));
    let claude_env = std::env::var("CLAUDE_CONFIG_DIR").ok();
    let codex_env = std::env::var("CODEX_HOME").ok();
    detect_installed(
        &home,
        claude_env.as_deref(),
        codex_env.as_deref(),
        Path::new("/etc/codex"),
    )
}

// ---------------------------------------------------------------------------
// Skills detection
//
// Scans, within a scope — the machine-wide "global" scope (rooted at the user's
// home) or a project scope (rooted at a project path) — every agent's own skills
// dir plus the shared canonical `.agents/skills` used by the universal agents
// (codex/gemini/cursor). A skill is a directory (or a symlink to one) containing
// a `SKILL.md` with YAML front-matter (`name`, `description`). The same skill
// found under several agents is merged into one entry listing every agent it
// belongs to.
//
// NOTE: this app does not track install provenance — no source/version/lock
// metadata is recorded; a `SkillInfo` carries only what is discoverable on disk.
// ---------------------------------------------------------------------------

/// Universal agents share the canonical `.agents/skills` directory instead of a
/// per-agent one; a skill found there is attributed to whichever of these is
/// installed. Mirrors `isUniversalAgent` in the skills CLI.
const UNIVERSAL_AGENTS: [&str; 4] = ["codex", "gemini", "cursor", "github-copilot"];

/// One installed skill, serialized to match the TS `Skill` interface
/// (`src/lib/types.ts`).
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SkillInfo {
    id: String,
    name: String,
    description: String,
    agents: Vec<String>,
    method: String,
}

/// A skill found inside a single directory, before cross-agent merge.
struct FoundSkill {
    name: String,
    description: String,
    /// The on-disk entry is a symlink (vs. a real directory).
    is_symlink: bool,
}

/// Extract `name` / `description` from a SKILL.md YAML front-matter block.
/// Returns `None` when there is no leading `--- ... ---` fence or no `name`.
/// Handles the forms that appear in real SKILL.md files: plain/quoted single
/// line values and block scalars (`>`/`|`, with any chomping indicator). Not a
/// full YAML parser — only the top-level `name`/`description` keys are read.
fn parse_frontmatter(content: &str) -> Option<(String, String)> {
    let content = content.trim_start_matches('\u{feff}'); // strip BOM
    let mut lines = content.lines();
    if lines.next()?.trim_end() != "---" {
        return None;
    }
    // The front-matter block: everything up to the closing `---` fence.
    let block: Vec<&str> = lines.take_while(|l| l.trim_end() != "---").collect();

    let mut name: Option<String> = None;
    let mut description: Option<String> = None;
    let mut i = 0;
    while i < block.len() {
        let line = block[i];
        i += 1;
        // Top-level keys only: skip blank and nested / indented lines.
        if line.trim().is_empty() || line.starts_with(char::is_whitespace) {
            continue;
        }
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let key = key.trim();
        if key != "name" && key != "description" {
            continue;
        }
        let value = value.trim();
        let parsed = if value.starts_with('|') || value.starts_with('>') {
            // Block scalar: gather the following blank or more-indented lines.
            let fold = value.starts_with('>');
            let start = i;
            while i < block.len() {
                let l = block[i];
                if !l.trim().is_empty() && !l.starts_with(char::is_whitespace) {
                    break; // next top-level key
                }
                i += 1;
            }
            join_block(&block[start..i], fold)
        } else {
            unquote(value)
        };
        match key {
            "name" => name = Some(parsed),
            "description" => description = Some(parsed),
            _ => {}
        }
    }
    Some((name?, description.unwrap_or_default()))
}

/// Join a YAML block-scalar body: dedent by the least-indented line, then fold
/// (`>`) to a single whitespace-collapsed line or keep (`|`) newlines.
fn join_block(lines: &[&str], fold: bool) -> String {
    let indent = lines
        .iter()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.len() - l.trim_start().len())
        .min()
        .unwrap_or(0);
    let dedented: Vec<&str> = lines
        .iter()
        .map(|l| if l.len() >= indent { &l[indent..] } else { "" }.trim_end())
        .collect();
    if fold {
        dedented.join(" ").split_whitespace().collect::<Vec<_>>().join(" ")
    } else {
        dedented.join("\n").trim().to_string()
    }
}

/// Strip a single pair of matching surrounding quotes, if present.
fn unquote(s: &str) -> String {
    let bytes = s.as_bytes();
    if bytes.len() >= 2 {
        let (first, last) = (bytes[0], bytes[bytes.len() - 1]);
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return s[1..s.len() - 1].to_string();
        }
    }
    s.to_string()
}

/// Scan one agent skills directory. A missing dir yields an empty list. Entries
/// may be real directories or symlinks to directories (the CLI symlinks skills
/// from a canonical location) — both are followed, and `SKILL.md` is required.
fn scan_agent_dir(dir: &Path) -> Vec<FoundSkill> {
    let mut found = Vec::new();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return found;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        // A Dirent's type is "symlink" for links, so resolve with metadata()
        // (which follows) to confirm the target is a directory.
        let is_symlink = std::fs::symlink_metadata(&path)
            .map(|m| m.file_type().is_symlink())
            .unwrap_or(false);
        let is_dir = std::fs::metadata(&path).map(|m| m.is_dir()).unwrap_or(false);
        if !is_dir {
            continue; // skips files and broken symlinks
        }
        let Ok(content) = std::fs::read_to_string(path.join("SKILL.md")) else {
            continue;
        };
        if let Some((name, description)) = parse_frontmatter(&content) {
            found.push(FoundSkill {
                name,
                description,
                is_symlink,
            });
        }
    }
    found
}

/// Deterministic ordering for a skill's `agents` list.
fn agent_rank(agent: &str) -> u8 {
    match agent {
        "claude" => 0,
        "codex" => 1,
        "gemini" => 2,
        "cursor" => 3,
        "github-copilot" => 4,
        "windsurf" => 5,
        _ => u8::MAX,
    }
}

/// Scan every target and merge found skills by name. Each target pairs a
/// directory with the agents a skill there belongs to — a single agent for a
/// per-agent dir, or the installed universal agents for the shared canonical
/// dir. `method` is `symlink` if any occurrence is a symlink, else `copy`.
/// Output is sorted by name for deterministic results.
fn scan_skills(targets: &[(Vec<String>, PathBuf)]) -> Vec<SkillInfo> {
    struct Agg {
        description: String,
        any_symlink: bool,
        agents: Vec<String>,
    }

    let mut merged: std::collections::BTreeMap<String, Agg> = std::collections::BTreeMap::new();
    for (agents, dir) in targets {
        for skill in scan_agent_dir(dir) {
            let entry = merged.entry(skill.name).or_insert_with(|| Agg {
                description: skill.description.clone(),
                any_symlink: false,
                agents: Vec::new(),
            });
            if entry.description.is_empty() && !skill.description.is_empty() {
                entry.description = skill.description;
            }
            entry.any_symlink |= skill.is_symlink;
            for agent in agents {
                if !entry.agents.iter().any(|a| a == agent) {
                    entry.agents.push(agent.clone());
                }
            }
        }
    }

    merged
        .into_iter()
        .map(|(name, mut agg)| {
            agg.agents.sort_by_key(|a| agent_rank(a));
            let method = if agg.any_symlink { "symlink" } else { "copy" };
            build_skill(name, agg.description, method.to_string(), agg.agents)
        })
        .collect()
}

/// Assemble a `SkillInfo` from detected fields.
fn build_skill(name: String, description: String, method: String, agents: Vec<String>) -> SkillInfo {
    SkillInfo {
        id: name.clone(),
        agents,
        method,
        description,
        name,
    }
}

/// Build the scan targets for a scope: each agent's own `<home>/skills` dir plus
/// the shared canonical `<base>/.agents/skills` (attributed to the installed
/// universal agents). `claude_home`/`codex_home` honour env overrides in the
/// global scope; `windsurf_home` resolves to `<base>/.windsurf` in project scope
/// and `~/.codeium/windsurf` in global scope (mirrors the Vercel CLI). The
/// canonical `.agents/skills` dir stays LAST so `delete_skill` can unlink
/// per-agent symlinks before removing it.
fn build_targets(
    roots: &InstallRoots,
    installed_universal: Vec<String>,
) -> Vec<(Vec<String>, PathBuf)> {
    vec![
        (vec!["claude".to_string()], roots.claude_home.join("skills")),
        (vec!["codex".to_string()], roots.codex_home.join("skills")),
        (vec!["gemini".to_string()], roots.base.join(".gemini/skills")),
        (vec!["cursor".to_string()], roots.base.join(".cursor/skills")),
        (vec!["github-copilot".to_string()], roots.base.join(".copilot/skills")),
        (vec!["windsurf".to_string()], roots.windsurf_home.join("skills")),
        (installed_universal, roots.base.join(".agents/skills")),
    ]
}

/// Where an install writes, resolved per scope — the write-side mirror of
/// `resolve_targets`. Project scope roots everything at the project path;
/// global scope roots at the user's home and honours `CLAUDE_CONFIG_DIR` /
/// `CODEX_HOME` for Claude / Codex respectively. Windsurf always uses
/// `<base>/.windsurf` in project and `~/.codeium/windsurf` in global (per Vercel CLI).
struct InstallRoots {
    /// Roots the canonical `.agents/skills` (+ gemini/cursor/copilot) dirs.
    base: PathBuf,
    /// Roots Claude's `skills` dir (`CLAUDE_CONFIG_DIR` override in global scope).
    claude_home: PathBuf,
    /// Roots Codex's scan dir (`CODEX_HOME` override in global scope); install
    /// writes to the shared canonical `.agents/skills` like other universal agents.
    codex_home: PathBuf,
    /// Roots Windsurf's `skills` dir. Project: `<base>/.windsurf`; global:
    /// `~/.codeium/windsurf` (Vercel CLI's globalSkillsDir).
    windsurf_home: PathBuf,
}

/// Pure core of `resolve_install_roots` (no `AppHandle`), for testability.
/// `scope_path` absent/empty/whitespace → global scope.
fn install_roots_for(
    scope_path: Option<&str>,
    home: &Path,
    claude_env: Option<&str>,
    codex_env: Option<&str>,
) -> InstallRoots {
    match scope_path.map(str::trim).filter(|s| !s.is_empty()) {
        Some(root) => {
            let base = PathBuf::from(root);
            InstallRoots {
                claude_home: base.join(".claude"),
                codex_home: base.join(".codex"),
                windsurf_home: base.join(".windsurf"),
                base,
            }
        }
        None => InstallRoots {
            base: home.to_path_buf(),
            claude_home: override_or(home, claude_env, ".claude"),
            codex_home: override_or(home, codex_env, ".codex"),
            windsurf_home: home.join(".codeium/windsurf"),
        },
    }
}

/// Resolve the scan/delete targets for a scope, shared by `list_skills` and
/// `delete_skill`. `scope_path` absent/empty → global scope (rooted at home,
/// honouring `CLAUDE_CONFIG_DIR`/`CODEX_HOME`); otherwise a project scope rooted
/// at that path. Agent detection is machine-global either way and only gates
/// attribution of the shared `.agents/skills` dir to installed universal agents.
///
/// `build_targets` places the canonical `.agents/skills` dir LAST; `delete_skill`
/// relies on that ordering so per-agent symlinks into the canonical dir are
/// unlinked before the canonical dir itself is removed.
fn resolve_targets(
    app: &tauri::AppHandle,
    scope_path: Option<String>,
) -> Vec<(Vec<String>, PathBuf)> {
    let home = app
        .path()
        .home_dir()
        .unwrap_or_else(|_| PathBuf::from(std::env::var("HOME").unwrap_or_default()));
    let claude_env = std::env::var("CLAUDE_CONFIG_DIR").ok();
    let codex_env = std::env::var("CODEX_HOME").ok();

    let installed = detect_installed(
        &home,
        claude_env.as_deref(),
        codex_env.as_deref(),
        Path::new("/etc/codex"),
    );
    let installed_universal: Vec<String> = UNIVERSAL_AGENTS
        .iter()
        .filter(|a| installed.get(**a).copied().unwrap_or(false))
        .map(|a| a.to_string())
        .collect();

    let roots = install_roots_for(
        scope_path.as_deref(),
        &home,
        claude_env.as_deref(),
        codex_env.as_deref(),
    );
    build_targets(&roots, installed_universal)
}

/// Remove every entry across `targets` whose SKILL.md front-matter `name` equals
/// `skill_name`. Identity matches `list_skills` (front-matter name, not dir name)
/// so the UI deletes exactly the skill it displayed. Mirrors the skills CLI
/// `remove` for the whole-skill case: a symlinked entry is unlinked (`remove_file`)
/// and a real directory is removed recursively (`remove_dir_all`). Missing paths
/// are ignored (idempotent). Removal failures are collected into one error string.
///
/// Relies on `build_targets` ordering (canonical `.agents/skills` LAST): per-agent
/// symlinks pointing into the canonical dir are unlinked before that dir is removed,
/// so no dangling symlink is left behind.
fn delete_skill_in_targets(
    targets: &[(Vec<String>, PathBuf)],
    skill_name: &str,
) -> Result<(), String> {
    let mut errors: Vec<String> = Vec::new();
    for (_agents, dir) in targets {
        let Ok(entries) = std::fs::read_dir(dir) else {
            continue; // missing dir → nothing to remove here
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let is_symlink = std::fs::symlink_metadata(&path)
                .map(|m| m.file_type().is_symlink())
                .unwrap_or(false);
            // metadata() follows symlinks — confirms the (link) target is a dir.
            let is_dir = std::fs::metadata(&path).map(|m| m.is_dir()).unwrap_or(false);
            if !is_dir {
                continue; // files and broken symlinks are never skills
            }
            let Ok(content) = std::fs::read_to_string(path.join("SKILL.md")) else {
                continue;
            };
            let Some((name, _)) = parse_frontmatter(&content) else {
                continue;
            };
            if name != skill_name {
                continue;
            }
            let result = if is_symlink {
                std::fs::remove_file(&path) // unlink the symlink, keep its target
            } else {
                std::fs::remove_dir_all(&path)
            };
            if let Err(err) = result {
                if err.kind() != std::io::ErrorKind::NotFound {
                    errors.push(format!("{}: {}", path.display(), err));
                }
            }
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

/// Delete a skill from a scope: remove every on-disk entry (across all agent
/// dirs and the canonical `.agents/skills`) whose SKILL.md name matches
/// `skill_name`. `scope_path` absent/empty → global scope. Returns an error
/// string on removal failure so the frontend can surface it.
#[tauri::command]
fn delete_skill(
    app: tauri::AppHandle,
    scope_path: Option<String>,
    skill_name: String,
) -> Result<(), String> {
    let targets = resolve_targets(&app, scope_path);
    delete_skill_in_targets(&targets, &skill_name)
}

/// List installed skills for a scope. `scope_path` absent/empty → global scope
/// (rooted at the user's home); otherwise a project scope rooted at that path.
///
/// Agent detection is machine-global (home-based) in either scope and is used
/// only to attribute shared `.agents/skills` entries to the universal agents
/// (codex/gemini/cursor) that are actually installed.
#[tauri::command]
fn list_skills(app: tauri::AppHandle, scope_path: Option<String>) -> Vec<SkillInfo> {
    let targets = resolve_targets(&app, scope_path);
    scan_skills(&targets)
}

/// Find the full SKILL.md content for a skill across `targets`. Identity
/// matches `list_skills`/`delete_skill` (front-matter `name`, not dir name)
/// so the UI reads exactly the skill it displayed. First match wins —
/// installed copies/symlinks share the same origin content.
fn read_readme_from_targets(
    targets: &[(Vec<String>, PathBuf)],
    skill_name: &str,
) -> Option<String> {
    for (_agents, dir) in targets {
        let Ok(entries) = std::fs::read_dir(dir) else {
            continue; // missing dir → nothing to read here
        };
        for entry in entries.flatten() {
            let path = entry.path();
            // metadata() follows symlinks — files and broken symlinks are never skills.
            let is_dir = std::fs::metadata(&path).map(|m| m.is_dir()).unwrap_or(false);
            if !is_dir {
                continue;
            }
            let Ok(content) = std::fs::read_to_string(path.join("SKILL.md")) else {
                continue;
            };
            if matches!(parse_frontmatter(&content), Some((name, _)) if name == skill_name) {
                return Some(content);
            }
        }
    }
    None
}

/// Read the full SKILL.md of an installed skill in a scope. `scope_path`
/// absent/empty → global scope (matching `list_skills`/`delete_skill`).
/// Err when nothing matches so the drawer can show an error state.
#[tauri::command]
fn read_skill_readme(
    app: tauri::AppHandle,
    scope_path: Option<String>,
    skill_name: String,
) -> Result<String, String> {
    let targets = resolve_targets(&app, scope_path);
    read_readme_from_targets(&targets, &skill_name)
        .ok_or_else(|| format!("skill '{skill_name}' not found in scope"))
}

#[cfg(test)]
mod read_readme_tests {
    use super::read_readme_from_targets;
    use std::fs;
    use std::path::{Path, PathBuf};
    use tempfile::tempdir;

    /// Creates a skill at `<root>/<dir_name>/SKILL.md` with frontmatter name `fm_name`.
    fn write_skill(root: &Path, dir_name: &str, fm_name: &str, body: &str) {
        let dir = root.join(dir_name);
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join("SKILL.md"),
            format!("---\nname: {fm_name}\ndescription: d\n---\n\n{body}"),
        )
        .unwrap();
    }

    fn targets_of(paths: &[PathBuf]) -> Vec<(Vec<String>, PathBuf)> {
        paths
            .iter()
            .map(|p| (vec!["claude".to_string()], p.clone()))
            .collect()
    }

    #[test]
    fn returns_full_content_from_first_target() {
        let root = tempdir().unwrap();
        let skills = root.path().join("skills");
        write_skill(&skills, "my-skill", "my-skill", "## body");
        let content = read_readme_from_targets(&targets_of(&[skills]), "my-skill")
            .expect("skill should be found");
        // Returns the full content including frontmatter — stripping is the frontend's job.
        assert!(content.contains("name: my-skill"));
        assert!(content.contains("## body"));
    }

    #[test]
    fn falls_through_missing_dir_to_later_target() {
        let root = tempdir().unwrap();
        let missing = root.path().join("no-such-dir");
        let canonical = root.path().join("agents-skills");
        write_skill(&canonical, "my-skill", "my-skill", "canonical body");
        let content =
            read_readme_from_targets(&targets_of(&[missing, canonical]), "my-skill")
                .expect("skill should be found in later target");
        assert!(content.contains("canonical body"));
    }

    #[test]
    fn none_when_no_skill_matches() {
        let root = tempdir().unwrap();
        let skills = root.path().join("skills");
        write_skill(&skills, "other-skill", "other-skill", "x");
        assert!(read_readme_from_targets(&targets_of(&[skills]), "my-skill").is_none());
    }

    #[test]
    fn matches_frontmatter_name_not_dir_name() {
        let root = tempdir().unwrap();
        let skills = root.path().join("skills");
        write_skill(&skills, "some-dir-name", "real-name", "body");
        // Same identity as list_skills/delete_skill: only the frontmatter name is matched.
        assert!(read_readme_from_targets(&targets_of(&[skills.clone()]), "real-name").is_some());
        assert!(read_readme_from_targets(&targets_of(&[skills]), "some-dir-name").is_none());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            detect_installed_agents,
            list_skills,
            read_skill_readme,
            delete_skill,
            discover_skills,
            install_skills
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::detect_installed;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn none_installed_when_no_markers() {
        let home = tempdir().unwrap();
        let missing = home.path().join("no-such-codex-system");
        let m = detect_installed(home.path(), None, None, &missing);
        assert_eq!(m["claude"], false);
        assert_eq!(m["codex"], false);
        assert_eq!(m["gemini"], false);
        assert_eq!(m["cursor"], false);
    }

    #[test]
    fn detects_home_markers() {
        let home = tempdir().unwrap();
        fs::create_dir(home.path().join(".claude")).unwrap();
        fs::create_dir(home.path().join(".gemini")).unwrap();
        let missing = home.path().join("no-such-codex-system");
        let m = detect_installed(home.path(), None, None, &missing);
        assert_eq!(m["claude"], true);
        assert_eq!(m["gemini"], true);
        assert_eq!(m["codex"], false);
        assert_eq!(m["cursor"], false);
    }

    #[test]
    fn claude_env_override_wins() {
        let home = tempdir().unwrap(); // no ~/.claude here
        let custom = tempdir().unwrap(); // CLAUDE_CONFIG_DIR points here
        let missing = home.path().join("no-such-codex-system");
        let claude_env = custom.path().to_str().unwrap();
        let m = detect_installed(home.path(), Some(claude_env), None, &missing);
        assert_eq!(m["claude"], true);
    }

    #[test]
    fn empty_env_falls_back_to_home() {
        let home = tempdir().unwrap();
        fs::create_dir(home.path().join(".claude")).unwrap();
        let missing = home.path().join("no-such-codex-system");
        // whitespace-only env must be ignored, home marker used
        let m = detect_installed(home.path(), Some("   "), None, &missing);
        assert_eq!(m["claude"], true);
    }

    #[test]
    fn codex_system_path_counts() {
        let home = tempdir().unwrap(); // no ~/.codex
        let etc = tempdir().unwrap(); // stand-in for /etc/codex
        let m = detect_installed(home.path(), None, None, etc.path());
        assert_eq!(m["codex"], true);
    }
}

const EXCLUDE_FILES: [&str; 1] = ["metadata.json"];
const EXCLUDE_DIRS: [&str; 3] = [".git", "__pycache__", "__pypackages__"];

fn copy_dir_filtered(src: &Path, dest: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dest)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let name = entry.file_name();
        let name_s = name.to_string_lossy();
        let from = entry.path();
        let to = dest.join(&name);
        let ft = entry.file_type()?;
        if ft.is_dir() {
            if EXCLUDE_DIRS.iter().any(|d| *d == name_s) {
                continue;
            }
            copy_dir_filtered(&from, &to)?;
        } else if ft.is_file() {
            if EXCLUDE_FILES.iter().any(|f| *f == name_s) {
                continue;
            }
            std::fs::copy(&from, &to)?; // follows symlinks, preserves mode on unix
        }
        // symlinks that aren't files/dirs after follow are ignored
    }
    Ok(())
}

/// Path of a directory relative to `from_dir` (both absolute).
fn make_relative(from_dir: &Path, to: &Path) -> PathBuf {
    let from: Vec<_> = from_dir.components().collect();
    let to_c: Vec<_> = to.components().collect();
    let mut i = 0;
    while i < from.len() && i < to_c.len() && from[i] == to_c[i] {
        i += 1;
    }
    let mut result = PathBuf::new();
    for _ in i..from.len() {
        result.push("..");
    }
    for c in &to_c[i..] {
        result.push(c.as_os_str());
    }
    result
}

/// The base skills dir for an agent within a scope. Universal agents
/// (codex/gemini/cursor/github-copilot) share the canonical `.agents/skills`;
/// `claude` uses `claude_home`; `windsurf` uses `windsurf_home` (which resolves
/// per-scope to match Vercel CLI); other agents fall back to `.<id>/skills`.
fn agent_base_dir(roots: &InstallRoots, agent: &str) -> PathBuf {
    if UNIVERSAL_AGENTS.contains(&agent) {
        roots.base.join(".agents/skills")
    } else if agent == "claude" {
        roots.claude_home.join("skills")
    } else if agent == "windsurf" {
        roots.windsurf_home.join("skills")
    } else {
        roots.base.join(format!(".{agent}/skills"))
    }
}

/// Install one skill folder into a scope for the given agents. Universal agents
/// land in the canonical `.agents/skills`; `claude` and `windsurf` get their
/// own per-scope dirs (`claude_home` / `windsurf_home`).
fn place_skill(
    roots: &InstallRoots,
    src_skill_dir: &Path,
    name: &str,
    agents: &[String],
    method: &str,
) -> Result<(), String> {
    let dir_name = sanitize_name(name);
    let canonical = roots.base.join(".agents/skills").join(&dir_name);

    if method == "copy" {
        for agent in agents {
            let dest = agent_base_dir(roots, agent).join(&dir_name);
            let _ = std::fs::remove_dir_all(&dest);
            copy_dir_filtered(src_skill_dir, &dest).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    // symlink mode: real copy to canonical, then symlink each agent dir.
    let _ = std::fs::remove_dir_all(&canonical);
    copy_dir_filtered(src_skill_dir, &canonical).map_err(|e| e.to_string())?;
    for agent in agents {
        let agent_dir = agent_base_dir(roots, agent).join(&dir_name);
        if agent_dir == canonical {
            continue; // universal agents already point at canonical
        }
        std::fs::create_dir_all(agent_dir.parent().unwrap()).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_dir_all(&agent_dir);
        let _ = std::fs::remove_file(&agent_dir);
        let rel = make_relative(agent_dir.parent().unwrap(), &canonical);
        symlink_dir(&rel, &agent_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(unix)]
fn symlink_dir(target: &Path, link: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(target, link)
}

#[cfg(not(unix))]
fn symlink_dir(target: &Path, link: &Path) -> std::io::Result<()> {
    // Fallback: copy the canonical dir contents (no symlink support).
    copy_dir_filtered(&link.parent().unwrap().join(target), link)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
}

#[cfg(test)]
fn resolve_targets_for_test(base: &Path, universal: &[String]) -> Vec<(Vec<String>, PathBuf)> {
    let roots = InstallRoots {
        base: base.to_path_buf(),
        claude_home: base.join(".claude"),
        codex_home: base.join(".codex"),
        windsurf_home: base.join(".windsurf"),
    };
    build_targets(&roots, universal.to_vec())
}

/// Place selected skills from a validated clone dir into a scope. Returns
/// SkillInfo for cache refresh. No lock file is written.
fn install_selected(
    roots: &InstallRoots,
    clone_dir: &Path,
    selections: &[String],
    agents: &[String],
    method: &str,
) -> Result<Vec<SkillInfo>, String> {
    let mut out = Vec::new();
    for skill_path in selections {
        // Guard against path traversal and absolute paths in the provided skillPath.
        if skill_path.split('/').any(|s| s == "..") || Path::new(skill_path).is_absolute() {
            return Err("Invalid skill path.".into());
        }
        let md_path = clone_dir.join(skill_path);
        let skill_dir = md_path.parent().ok_or("Invalid skill path.")?;
        let content = std::fs::read_to_string(&md_path).map_err(|e| e.to_string())?;
        let (name, description) =
            parse_frontmatter(&content).ok_or("Failed to parse SKILL.md")?;

        place_skill(roots, skill_dir, &name, agents, method)?;

        out.push(build_skill(name, description, method.to_string(), agents.to_vec()));
    }
    Ok(out)
}

/// Resolve and validate the discover temp-clone dir: it must canonicalize to a
/// real path INSIDE the OS temp dir. Canonicalizing BOTH sides resolves `..`
/// and symlinks (incl. macOS `/var` -> `/private/var`), closing the lexical
/// `starts_with` bypass.
fn resolve_temp_clone(temp_dir: &str) -> Result<PathBuf, String> {
    let temp = PathBuf::from(temp_dir)
        .canonicalize()
        .map_err(|_| "Temp clone not found. Please discover again.".to_string())?;
    let base = std::env::temp_dir()
        .canonicalize()
        .map_err(|_| "Cannot resolve temp directory.".to_string())?;
    let ok = temp.starts_with(&base)
        && temp != base
        && temp
            .file_name()
            .and_then(|n| n.to_str())
            .map(|n| n.starts_with("skill-desktop-"))
            .unwrap_or(false);
    if !ok {
        return Err("Temp clone not found. Please discover again.".into());
    }
    Ok(temp)
}

/// Resolve the install roots for a scope using the running app's home dir and
/// `CLAUDE_CONFIG_DIR` / `CODEX_HOME`. Absent/empty `scope_path` → global scope.
fn resolve_install_roots(app: &tauri::AppHandle, scope_path: Option<String>) -> InstallRoots {
    let home = app
        .path()
        .home_dir()
        .unwrap_or_else(|_| PathBuf::from(std::env::var("HOME").unwrap_or_default()));
    let claude_env = std::env::var("CLAUDE_CONFIG_DIR").ok();
    let codex_env = std::env::var("CODEX_HOME").ok();
    install_roots_for(
        scope_path.as_deref(),
        &home,
        claude_env.as_deref(),
        codex_env.as_deref(),
    )
}

#[tauri::command]
fn install_skills(
    app: tauri::AppHandle,
    scope_path: Option<String>,
    temp_dir: String,
    selections: Vec<String>,
    agents: Vec<String>,
    method: String,
) -> Result<Vec<SkillInfo>, String> {
    let roots = resolve_install_roots(&app, scope_path);
    // temp_dir must be inside the OS temp dir (defence against arbitrary copy).
    let temp = resolve_temp_clone(&temp_dir)?;
    let result = install_selected(&roots, &temp, &selections, &agents, &method);
    // Always clean up the clone.
    let _ = std::fs::remove_dir_all(&temp);
    result
}

#[cfg(test)]
mod skill_tests {
    use super::{delete_skill_in_targets, parse_frontmatter, scan_skills};
    use std::fs;
    use std::path::{Path, PathBuf};
    use tempfile::tempdir;

    fn write_skill(dir: &Path, name: &str, description: &str) {
        fs::create_dir_all(dir).unwrap();
        fs::write(
            dir.join("SKILL.md"),
            format!("---\nname: {name}\ndescription: {description}\n---\n\nbody\n"),
        )
        .unwrap();
    }

    #[test]
    fn parse_frontmatter_reads_fields() {
        let (name, desc) =
            parse_frontmatter("---\nname: pr-summary\ndescription: Summarize PRs\n---\nbody")
                .unwrap();
        assert_eq!(name, "pr-summary");
        assert_eq!(desc, "Summarize PRs");
    }

    #[test]
    fn parse_frontmatter_requires_fence() {
        assert!(parse_frontmatter("name: x\ndescription: y").is_none());
    }

    #[test]
    fn parse_frontmatter_requires_name() {
        assert!(parse_frontmatter("---\ndescription: y\n---").is_none());
    }

    #[test]
    fn parse_frontmatter_strips_quotes_and_crlf() {
        let (name, desc) =
            parse_frontmatter("---\r\nname: \"quoted\"\r\ndescription: 'single'\r\n---\r\n")
                .unwrap();
        assert_eq!(name, "quoted");
        assert_eq!(desc, "single");
    }

    #[test]
    fn parse_frontmatter_folds_block_scalar() {
        // `>-` folds continuation lines into one whitespace-collapsed string.
        let md = "---\nname: i18n-apply\ndescription: >-\n  first part\n  second part\n---\n";
        let (name, desc) = parse_frontmatter(md).unwrap();
        assert_eq!(name, "i18n-apply");
        assert_eq!(desc, "first part second part");
    }

    #[test]
    fn parse_frontmatter_keeps_literal_block_newlines() {
        // `|` keeps newlines between dedented lines.
        let md = "---\nname: x\ndescription: |\n  line one\n  line two\n---\n";
        let (_, desc) = parse_frontmatter(md).unwrap();
        assert_eq!(desc, "line one\nline two");
    }

    #[test]
    fn parse_frontmatter_block_scalar_stops_at_next_key() {
        // A following top-level key ends the block scalar.
        let md = "---\ndescription: >-\n  hello\n  world\nname: after\n---\n";
        let (name, desc) = parse_frontmatter(md).unwrap();
        assert_eq!(name, "after");
        assert_eq!(desc, "hello world");
    }

    fn one(agent: &str, dir: PathBuf) -> (Vec<String>, PathBuf) {
        (vec![agent.to_string()], dir)
    }

    #[test]
    fn scan_skills_empty_when_dir_missing() {
        let home = tempdir().unwrap();
        let targets = vec![one("claude", home.path().join("nope/skills"))];
        assert!(scan_skills(&targets).is_empty());
    }

    #[test]
    fn scan_skills_detects_and_sorts_by_name() {
        let root = tempdir().unwrap();
        let claude = root.path().join(".claude/skills");
        write_skill(&claude.join("zebra"), "zebra", "Z skill");
        write_skill(&claude.join("alpha"), "alpha", "A skill");
        let skills = scan_skills(&[one("claude", claude)]);
        assert_eq!(skills.len(), 2);
        assert_eq!(skills[0].name, "alpha");
        assert_eq!(skills[1].name, "zebra");
        assert_eq!(skills[0].agents, vec!["claude".to_string()]);
        assert_eq!(skills[0].method, "copy");
        assert_eq!(skills[0].description, "A skill");
    }

    #[test]
    fn scan_skills_detects_per_agent_dirs() {
        // A skill installed only in gemini's own dir must still be found and
        // attributed to gemini (would be missed if only .agents/skills scanned).
        let root = tempdir().unwrap();
        let gemini = root.path().join(".gemini/skills");
        write_skill(&gemini.join("translate"), "translate", "Translate helper");
        let skills = scan_skills(&[one("gemini", gemini)]);
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].agents, vec!["gemini".to_string()]);
    }

    #[test]
    fn scan_skills_attributes_canonical_to_installed_universals() {
        // A skill in the shared .agents/skills is attributed to the universal
        // agents passed for that target (the installed ones), in rank order.
        let root = tempdir().unwrap();
        let canonical = root.path().join(".agents/skills");
        write_skill(&canonical.join("commit"), "commit", "Commit helper");
        let targets = vec![(
            vec!["cursor".to_string(), "codex".to_string()],
            canonical,
        )];
        let skills = scan_skills(&targets);
        assert_eq!(skills.len(), 1);
        // sorted by agent_rank: codex before cursor
        assert_eq!(
            skills[0].agents,
            vec!["codex".to_string(), "cursor".to_string()]
        );
    }

    #[test]
    fn scan_skills_merges_claude_and_canonical() {
        let root = tempdir().unwrap();
        let claude = root.path().join(".claude/skills");
        let canonical = root.path().join(".agents/skills");
        write_skill(&claude.join("commit"), "commit", "Commit helper");
        write_skill(&canonical.join("commit"), "commit", "Commit helper");
        let targets = vec![
            one("claude", claude),
            (vec!["cursor".to_string()], canonical),
        ];
        let skills = scan_skills(&targets);
        assert_eq!(skills.len(), 1);
        assert_eq!(
            skills[0].agents,
            vec!["claude".to_string(), "cursor".to_string()]
        );
    }

    #[test]
    fn scan_skills_ignores_dirs_without_skill_md() {
        let root = tempdir().unwrap();
        let claude = root.path().join(".claude/skills");
        fs::create_dir_all(claude.join("not-a-skill")).unwrap();
        assert!(scan_skills(&[one("claude", claude)]).is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn scan_skills_marks_symlinked_skill() {
        // claude symlinks into the canonical dir → method is symlink even though
        // the canonical copy is a real directory.
        let root = tempdir().unwrap();
        let canonical = root.path().join(".agents/skills/shared");
        write_skill(&canonical, "shared", "Shared skill");
        let claude = root.path().join(".claude/skills");
        fs::create_dir_all(&claude).unwrap();
        std::os::unix::fs::symlink(&canonical, claude.join("shared")).unwrap();
        let targets = vec![
            one("claude", claude),
            (vec!["cursor".to_string()], root.path().join(".agents/skills")),
        ];
        let skills = scan_skills(&targets);
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].method, "symlink");
        assert_eq!(
            skills[0].agents,
            vec!["claude".to_string(), "cursor".to_string()]
        );
    }

    #[test]
    fn delete_removes_matching_skill_and_preserves_others() {
        let root = tempdir().unwrap();
        let claude = root.path().join(".claude/skills");
        write_skill(&claude.join("pr-summary"), "pr-summary", "Summarize PRs");
        write_skill(&claude.join("commit"), "commit", "Commit helper");
        let targets = vec![one("claude", claude.clone())];
        delete_skill_in_targets(&targets, "pr-summary").unwrap();
        assert!(!claude.join("pr-summary").exists());
        assert!(claude.join("commit").exists());
    }

    #[test]
    fn delete_removes_skill_from_every_target() {
        let root = tempdir().unwrap();
        let claude = root.path().join(".claude/skills");
        let gemini = root.path().join(".gemini/skills");
        write_skill(&claude.join("shared"), "shared", "s");
        write_skill(&gemini.join("shared"), "shared", "s");
        let targets = vec![one("claude", claude.clone()), one("gemini", gemini.clone())];
        delete_skill_in_targets(&targets, "shared").unwrap();
        assert!(!claude.join("shared").exists());
        assert!(!gemini.join("shared").exists());
    }

    #[test]
    fn delete_matches_by_frontmatter_name_not_dir_name() {
        // Dir is "old-dir" but the skill's front-matter name is "renamed";
        // deleting by front-matter name must still remove the dir.
        let root = tempdir().unwrap();
        let claude = root.path().join(".claude/skills");
        write_skill(&claude.join("old-dir"), "renamed", "desc");
        let targets = vec![one("claude", claude.clone())];
        delete_skill_in_targets(&targets, "renamed").unwrap();
        assert!(!claude.join("old-dir").exists());
    }

    #[test]
    fn delete_ignores_nonmatching_name() {
        let root = tempdir().unwrap();
        let claude = root.path().join(".claude/skills");
        write_skill(&claude.join("commit"), "commit", "c");
        let targets = vec![one("claude", claude.clone())];
        delete_skill_in_targets(&targets, "nope").unwrap();
        assert!(claude.join("commit").exists());
    }

    #[test]
    fn delete_is_idempotent_when_absent() {
        let root = tempdir().unwrap();
        let targets = vec![one("claude", root.path().join("nope/skills"))];
        // Directory does not exist at all — delete must still succeed.
        delete_skill_in_targets(&targets, "anything").unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn delete_unlinks_symlink_and_removes_canonical() {
        // per-agent dir holds a symlink into the canonical dir. Processing the
        // per-agent target first unlinks the symlink; the canonical target then
        // removes the real dir — no dangling link left.
        let root = tempdir().unwrap();
        let canonical = root.path().join(".agents/skills");
        write_skill(&canonical.join("shared"), "shared", "Shared");
        let claude = root.path().join(".claude/skills");
        fs::create_dir_all(&claude).unwrap();
        std::os::unix::fs::symlink(canonical.join("shared"), claude.join("shared")).unwrap();
        let targets = vec![
            one("claude", claude.clone()),
            (vec!["cursor".to_string()], canonical.clone()),
        ];
        delete_skill_in_targets(&targets, "shared").unwrap();
        // symlink entry gone (lstat errors), and canonical real dir gone
        assert!(fs::symlink_metadata(claude.join("shared")).is_err());
        assert!(!canonical.join("shared").exists());
    }

    #[test]
    fn sanitize_name_basic_and_traversal() {
        use super::sanitize_name;
        assert_eq!(sanitize_name("PR Summary"), "pr-summary");
        assert_eq!(sanitize_name("../etc/passwd"), "etc-passwd");
        assert_eq!(sanitize_name("weird!!name__ok.v2"), "weird-name__ok.v2");
        assert_eq!(sanitize_name("--leading.and.trailing--"), "leading.and.trailing");
        assert_eq!(sanitize_name("...."), "unnamed-skill");
        assert_eq!(sanitize_name(""), "unnamed-skill");
        // 255-char cap: a long all-valid name is truncated to exactly 255 chars.
        assert_eq!(sanitize_name(&"a".repeat(300)).len(), 255);
        // Cap applies AFTER trim: trimming runs first, so the cap can re-expose a
        // trailing '-' at position 254 (matches the reference CLI order
        // replace -> trim -> substring(0,255)).
        let n = format!("{}-{}", "a".repeat(254), "b"); // 256 chars: 254 'a', '-', 'b'
        let r = sanitize_name(&n);
        assert_eq!(r.len(), 255);
        assert!(r.ends_with('-'));
    }

    #[test]
    fn parse_source_https_repo() {
        use super::parse_source;
        let p = parse_source("https://github.com/vercel-labs/agent-skills").unwrap();
        assert_eq!(p.clone_url, "https://github.com/vercel-labs/agent-skills.git");
        assert_eq!(p.r#ref, None);
        assert_eq!(p.subpath, None);
    }

    #[test]
    fn parse_source_accepts_any_host() {
        use super::parse_source;
        // Public github, internal GHES, self-hosted Gitea, GitLab — all fine.
        let p = parse_source("https://github.com/foo/bar").unwrap();
        assert_eq!(p.clone_url, "https://github.com/foo/bar.git");
        let p = parse_source("https://github.example.com/acme/internal-tool").unwrap();
        assert_eq!(p.clone_url, "https://github.example.com/acme/internal-tool.git");
        let p = parse_source("https://gitea.example.com/team/agent-skills.git").unwrap();
        assert_eq!(p.clone_url, "https://gitea.example.com/team/agent-skills.git");
        let p = parse_source("https://gitlab.com/group/sub/repo").unwrap();
        assert_eq!(p.clone_url, "https://gitlab.com/group/sub.git");
    }

    #[test]
    fn parse_source_tree_with_subpath() {
        use super::parse_source;
        let p = parse_source("https://github.com/owner/repo/tree/main/skills/pdf").unwrap();
        assert_eq!(p.clone_url, "https://github.com/owner/repo.git");
        assert_eq!(p.r#ref.as_deref(), Some("main"));
        assert_eq!(p.subpath.as_deref(), Some("skills/pdf"));
    }

    #[test]
    fn parse_source_ssh_preserved() {
        use super::parse_source;
        let p = parse_source("git@github.com:owner/repo.git").unwrap();
        assert_eq!(p.clone_url, "git@github.com:owner/repo.git");
        // Any host is accepted for SSH too.
        let p = parse_source("git@gitlab.example.com:team/repo.git").unwrap();
        assert_eq!(p.clone_url, "git@gitlab.example.com:team/repo.git");
    }

    #[test]
    fn parse_source_ssh_scheme_and_file() {
        use super::parse_source;
        let p = parse_source("ssh://git@gitea.dev:2222/team/repo.git").unwrap();
        assert_eq!(p.clone_url, "ssh://git@gitea.dev:2222/team/repo.git");
        let p = parse_source("file:///tmp/local-repo").unwrap();
        assert_eq!(p.clone_url, "file:///tmp/local-repo");
    }

    #[test]
    fn parse_source_shorthand_defaults_to_github() {
        use super::parse_source;
        let p = parse_source("vercel-labs/agent-skills").unwrap();
        assert_eq!(p.clone_url, "https://github.com/vercel-labs/agent-skills.git");
        let p = parse_source("vercel-labs/agent-skills/skills/pdf").unwrap();
        assert_eq!(p.clone_url, "https://github.com/vercel-labs/agent-skills.git");
        assert_eq!(p.subpath.as_deref(), Some("skills/pdf"));
    }

    #[test]
    fn parse_source_ref_fragment() {
        use super::parse_source;
        let p = parse_source("https://github.com/o/r.git#feature/x").unwrap();
        assert_eq!(p.clone_url, "https://github.com/o/r.git");
        assert_eq!(p.r#ref.as_deref(), Some("feature/x"));
        let p = parse_source("git@github.com:o/r.git#v1.2").unwrap();
        assert_eq!(p.r#ref.as_deref(), Some("v1.2"));
        let p = parse_source("owner/repo#main").unwrap();
        assert_eq!(p.r#ref.as_deref(), Some("main"));
    }

    #[test]
    fn parse_source_rejects_invalid() {
        use super::parse_source;
        assert!(parse_source("").is_err());
        assert!(parse_source("nonsense").is_err());
        assert!(parse_source("https://host/only-one-seg").is_err());
        // Path-traversal in any segment is still rejected.
        assert!(parse_source("https://github.com/../etc").is_err());
        assert!(parse_source("https://github.com/o/r/tree/main/../etc").is_err());
        assert!(parse_source("https://github.com/o/r/tree/../secret").is_err());
        assert!(parse_source("git@github.com:../x.git").is_err());
    }

    #[test]
    fn discover_finds_skill_md_in_cloned_repo() {
        use super::discover_from_url;
        // Build a bare-ish local git repo with one skill.
        let repo = tempdir().unwrap();
        let run = |args: &[&str]| {
            std::process::Command::new("git")
                .args(args)
                .current_dir(repo.path())
                .output()
                .unwrap();
        };
        run(&["init", "-q"]);
        run(&["config", "user.email", "t@t"]);
        run(&["config", "user.name", "t"]);
        let skill = repo.path().join("skills/pdf");
        fs::create_dir_all(&skill).unwrap();
        fs::write(
            skill.join("SKILL.md"),
            "---\nname: pdf\ndescription: PDF tools\n---\nbody\n",
        )
        .unwrap();
        run(&["add", "-A"]);
        run(&["commit", "-qm", "init"]);

        // clone_url = a file:// URL pointing at the local repo
        let url = format!("file://{}", repo.path().display());
        let result = discover_from_url(&url, None, None).unwrap();
        assert_eq!(result.skills.len(), 1);
        assert_eq!(result.skills[0].name, "pdf");
        assert_eq!(result.skills[0].skill_path, "skills/pdf/SKILL.md");
        // temp dir exists and is cleaned by the caller (install), not here
        assert!(Path::new(&result.temp_dir).exists());
        std::fs::remove_dir_all(&result.temp_dir).ok();
    }

    #[cfg(unix)]
    #[test]
    fn place_symlink_roundtrips_with_scan() {
        use super::{place_skill, scan_skills, resolve_targets_for_test, InstallRoots};
        let base = tempdir().unwrap();
        // a source skill dir
        let src = tempdir().unwrap();
        let sdir = src.path().join("pdf");
        fs::create_dir_all(&sdir).unwrap();
        fs::write(sdir.join("SKILL.md"), "---\nname: pdf\ndescription: PDF\n---\nx\n").unwrap();

        let roots = InstallRoots {
            base: base.path().to_path_buf(),
            claude_home: base.path().join(".claude"),
            codex_home: base.path().join(".codex"),
            windsurf_home: base.path().join(".windsurf"),
        };
        place_skill(&roots, &sdir, "pdf", &["claude".into()], "symlink").unwrap();

        // canonical real dir + claude symlink exist
        assert!(base.path().join(".agents/skills/pdf/SKILL.md").exists());
        let link = base.path().join(".claude/skills/pdf");
        assert!(fs::symlink_metadata(&link).unwrap().file_type().is_symlink());

        // scan sees it as symlink for claude
        let targets = resolve_targets_for_test(base.path(), &["claude".into()]);
        let skills = scan_skills(&targets);
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].name, "pdf");
        assert_eq!(skills[0].method, "symlink");
    }

    #[test]
    fn place_copy_writes_into_agent_dir() {
        use super::{place_skill, InstallRoots};
        let base = tempdir().unwrap();
        let src = tempdir().unwrap();
        let sdir = src.path().join("pdf");
        fs::create_dir_all(&sdir).unwrap();
        fs::write(sdir.join("SKILL.md"), "---\nname: pdf\ndescription: PDF\n---\nx\n").unwrap();
        fs::create_dir_all(sdir.join(".git")).unwrap();
        fs::write(sdir.join(".git/x"), "should not copy").unwrap();

        let roots = InstallRoots {
            base: base.path().to_path_buf(),
            claude_home: base.path().join(".claude"),
            codex_home: base.path().join(".codex"),
            windsurf_home: base.path().join(".windsurf"),
        };
        place_skill(&roots, &sdir, "pdf", &["claude".into()], "copy").unwrap();
        assert!(base.path().join(".claude/skills/pdf/SKILL.md").exists());
        assert!(!base.path().join(".claude/skills/pdf/.git").exists()); // excluded
    }

    #[test]
    fn resolve_temp_clone_accepts_inside_rejects_escape() {
        use super::resolve_temp_clone;
        let base = std::env::temp_dir();
        let good = base.join(format!("skill-desktop-test-{}", std::process::id()));
        fs::create_dir_all(&good).unwrap();
        assert!(resolve_temp_clone(good.to_str().unwrap()).is_ok());
        // `..` escape resolves outside the temp dir → rejected
        let escape = good.join("../../../../../../etc");
        assert!(resolve_temp_clone(&escape.to_string_lossy()).is_err());
        // nonexistent → rejected (canonicalize fails)
        assert!(resolve_temp_clone(base.join("nonexistent-skill-xyz").to_str().unwrap()).is_err());
        // the temp root itself → rejected (would later be remove_dir_all'd)
        assert!(resolve_temp_clone(base.canonicalize().unwrap().to_str().unwrap()).is_err());
        // existing dir under base but without the `skill-desktop-` prefix → rejected
        let unprefixed = base.join(format!("not-a-skill-clone-{}", std::process::id()));
        fs::create_dir_all(&unprefixed).unwrap();
        assert!(resolve_temp_clone(unprefixed.to_str().unwrap()).is_err());
        fs::remove_dir_all(&unprefixed).ok();
        fs::remove_dir_all(&good).ok();
    }

    #[test]
    fn install_rejects_absolute_and_traversal_skillpath() {
        use super::{install_selected, InstallRoots};
        let base = tempdir().unwrap();
        let clone = tempdir().unwrap();
        let roots = InstallRoots {
            base: base.path().to_path_buf(),
            claude_home: base.path().join(".claude"),
            codex_home: base.path().join(".codex"),
            windsurf_home: base.path().join(".windsurf"),
        };
        assert!(install_selected(&roots, clone.path(), &["/etc/passwd".into()], &["claude".into()], "copy").is_err());
        assert!(install_selected(&roots, clone.path(), &["../x/SKILL.md".into()], &["claude".into()], "copy").is_err());
    }

    #[test]
    fn install_places_files_without_lock() {
        use super::{install_selected, InstallRoots};
        let home = tempdir().unwrap(); // stands in for the user home
        let claude = tempdir().unwrap(); // stands in for CLAUDE_CONFIG_DIR (distinct from base/.claude)
        let clone = tempdir().unwrap();
        let sdir = clone.path().join("skills/pdf");
        fs::create_dir_all(&sdir).unwrap();
        fs::write(sdir.join("SKILL.md"), "---\nname: pdf\ndescription: PDF\n---\nx\n").unwrap();

        let roots = InstallRoots {
            base: home.path().to_path_buf(),
            claude_home: claude.path().to_path_buf(), // proof that the override is applied
            codex_home: home.path().join(".codex"),
            windsurf_home: home.path().join(".codeium/windsurf"),
        };
        let installed = install_selected(
            &roots,
            clone.path(),
            &["skills/pdf/SKILL.md".into()],
            &["claude".into(), "codex".into()], // claude (dedicated dir) + universal (codex)
            "symlink",
        )
        .unwrap();
        assert_eq!(installed.len(), 1);

        // canonical real copy (serves universal codex)
        assert!(home.path().join(".agents/skills/pdf/SKILL.md").exists());
        // claude symlink is resolved canonically under the overridden claude_home
        assert!(claude.path().join("skills/pdf/SKILL.md").exists());
        // Install must not write a lockfile in any scope (regression guard)
        assert!(!home.path().join("skills-lock.json").exists());
        assert!(!claude.path().join("skills-lock.json").exists());
        assert!(!clone.path().join("skills-lock.json").exists());
    }

    #[test]
    fn install_roots_project_and_global() {
        use super::install_roots_for;
        let home = Path::new("/home/u");

        // Project scope: everything under the project path
        let p = install_roots_for(Some("/work/proj"), home, None, None);
        assert_eq!(p.base, Path::new("/work/proj"));
        assert_eq!(p.claude_home, Path::new("/work/proj/.claude"));
        assert_eq!(p.codex_home, Path::new("/work/proj/.codex"));
        assert_eq!(p.windsurf_home, Path::new("/work/proj/.windsurf"));

        // Global scope (no override): under home, Windsurf under .codeium/windsurf
        let g = install_roots_for(None, home, None, None);
        assert_eq!(g.base, home);
        assert_eq!(g.claude_home, Path::new("/home/u/.claude"));
        assert_eq!(g.codex_home, Path::new("/home/u/.codex"));
        assert_eq!(g.windsurf_home, Path::new("/home/u/.codeium/windsurf"));

        // Global scope: CLAUDE_CONFIG_DIR applied; blank scope_path == global
        let g2 = install_roots_for(Some("  "), home, Some("/custom/claude"), None);
        assert_eq!(g2.base, home);
        assert_eq!(g2.claude_home, Path::new("/custom/claude"));

        // Global scope: CODEX_HOME applied
        let g3 = install_roots_for(None, home, None, Some("/custom/codex"));
        assert_eq!(g3.codex_home, Path::new("/custom/codex"));
    }
}
