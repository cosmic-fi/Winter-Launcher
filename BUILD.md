# OriLauncher — Local Build Guide (No Distribution)

This guide explains how to build OriLauncher locally for personal testing and development.
Distribution or publishing of binaries or modified sources is not permitted without explicit written permission from the maintainers.

## Policy
- Personal builds are allowed for local use only.
- Do not distribute, upload, or publish build artifacts.
- Forks should remain private unless you have permission to publish.

## Prerequisites
- Node.js v18+
- Git
- npm (or yarn)
- Windows/macOS/Linux

## Setup
```bash
# Clone the repository
git clone https://github.com/<your-org>/OriLauncher.git
cd OriLauncher

# Install dependencies
npm install
```

## Develop Locally
```bash
# Start Vite and Electron in dev mode
npm run dev
```
- Vite serves the renderer at `http://localhost:5173`.
- Electron launches the desktop app once the dev server is ready.

## Build Renderer (UI)
```bash
npm run build
```
- Compiles the Svelte renderer into `dist/`.

## Preview Built UI
```bash
npm run preview
```
- Serves the built UI for quick verification.

## Optional: Package Locally (Personal Use Only)
If you want to test a packaged desktop app, you may create local installers/executables. Do not distribute these artifacts.
```bash
# Package for current platform
npm run dist

# Platform-specific packaging
npm run dist:win
npm run dist:mac
npm run dist:linux
```

## Troubleshooting
- Electron Builder missing: `npm install --save-dev electron-builder`
- Build fails on first run: delete `node_modules` and reinstall
- Auto-updates only work in packaged builds during local tests; do not publish

## Notes
- There are intentionally no instructions for publishing releases.
- For exceptions or partnership inquiries, contact the maintainers.