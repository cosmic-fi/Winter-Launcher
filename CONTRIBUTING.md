# Contributing to OriLauncher

Thanks for your interest in contributing! This guide explains how to set up your environment, propose changes, and open pull requests effectively.

OriLauncher is a source-available project. We welcome code and documentation contributions, but redistribution or publishing of binaries or modified sources is not permitted. Please read the License & Usage section in `README.md` and the `LICENSE` file.

## Overview
- Tech: Electron (Main/Preload), Svelte (Renderer), Vite, Electron Builder
- Platforms: Windows, macOS, Linux
- Scope: Performance, UX, instance management, localization, stability
- Policy: Contributions allowed; distribution prohibited (see `LICENSE`)

## Prerequisites
- Node.js v18+
- Git
- npm (or yarn)
- A GitHub account

## Local Setup
```bash
# Clone your fork
git clone https://github.com/<your-account>/Ori-Launcher.git
cd Ori-Launcher

# Install dependencies
npm install

# Run in development (starts Vite and Electron)
npm run dev
```
- Vite serves the renderer at `http://localhost:5173`.
- Electron launches after the dev server is ready.

For local builds and packaging (personal use only — do not distribute), see `BUILD.md`.

## Project Structure
- Electron Main: `src/electron/main.js`
- Electron Preload: `src/electron/preload.js`
- Renderer (Svelte): UI and state logic
- Localization: `locale/*.json`
- Config: `vite.config.mjs`, `svelte.config.js`, `jsconfig.json`

## Contribution Areas
- Bug fixes: crashes, incorrect behavior, performance
- Features: instance management, settings, UX improvements
- Localization: add/improve translations across language files
- Docs: README, BUILD.md, usage notes, troubleshooting

## Coding Guidelines
- Use ES Modules (`"type": "module"` in `package.json`).
- Prefer modern JS/TS patterns; avoid CommonJS in new code.
- Keep changes focused and minimal; avoid large unrelated refactors.
- Follow existing code style and structure.
- For Svelte components, keep logic clear and avoid heavy inline HTML in locale strings.

## Localization Workflow
- Update `locale/en.json` first for new UI text.
- Mirror the same keys and structure in other locale files (`es.json`, `fr.json`, `id.json`, `tr.json`).
- Ensure consistency of HTML formatting in strings when necessary.
- Keep translations concise and user-friendly.

## Branching & Commits
- Create feature branches from `main`:
  - `feat/<short-description>`
  - `fix/<short-description>`
  - `docs/<short-description>`
- Write clear commit messages (present tense, concise). Example:
  - `feat(instances): add RAM slider to settings`
  - `fix(locale): complete developedBy string in tr.json`

## Pull Request Checklist
- Runs locally: `npm run dev`
- Builds cleanly: `npm run build`
- Scope is focused and well-tested (manual tests are fine if no automated tests exist)
- Localization files updated if UI changed
- Documentation updated (README/BUILD.md) if behavior changed
- No secrets committed (`.env`, tokens)
- No distribution instructions included or modified

## Opening a PR
1. Push your branch to your fork.
2. Open a PR against `main` with a clear description:
   - What changed and why
   - Screenshots for UI changes
   - Any trade-offs or follow-ups
3. Reference issues (e.g., `Fixes #123`).

## Issues & Bug Reports
- Include OS, Node version, and logs (console/devtools).
- Steps to reproduce and expected vs actual behavior.
- Screenshots or screen recordings help.

## License & Usage
- Personal builds allowed for local testing.
- Redistribution or publishing of binaries or modified source is NOT permitted.
- Official releases are published only by maintainers.
- See `LICENSE` and `README.md` (License & Usage) for details.

## Security & Secrets
- Do not commit `.env` or any secrets.
- Remove tokens before sharing logs.

## Questions
If you’re unsure about scope or approach, open a draft PR or discussion. We’re happy to help guide contributions that align with the project’s roadmap and policy.