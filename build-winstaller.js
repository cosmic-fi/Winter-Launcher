import { createWindowsInstaller } from 'electron-winstaller';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildInstaller() {
    try {
        console.log('Step 1: Packaging application...');
        // Run the build script with --dir to unpack the app
        execSync('node build.js --dir', { stdio: 'inherit' });

        console.log('Step 2: Creating Windows installer...');
        const rootPath = path.resolve(__dirname);
        const outPath = path.join(rootPath, 'build/installers');

        // Copy LICENSE to win-unpacked
        try {
            const licenseSrc = path.join(rootPath, 'LICENSE');
            const licenseDest = path.join(rootPath, 'build/win-unpacked/LICENSE');
            // Check if LICENSE exists
            const fs = require('fs');
            if (fs.existsSync(licenseSrc)) {
                 fs.copyFileSync(licenseSrc, licenseDest);
                 console.log('Copied LICENSE to unpacked directory.');
            } else {
                 console.warn('LICENSE file not found in root, skipping copy.');
            }
        } catch (err) {
            console.warn('Failed to copy LICENSE file:', err);
        }

        await createWindowsInstaller({
            appDirectory: path.join(rootPath, 'build/win-unpacked'),
            outputDirectory: outPath,
            authors: pkg.author.name || 'Cosmic-fi',
            exe: 'OriLauncher.exe',
            description: pkg.description,
            version: pkg.version,
            noMsi: true,
            setupIcon: path.join(rootPath, 'public/icon.ico'),
            setupExe: `OriLauncher-Setup-${pkg.version}.exe`
        });

        console.log(`Installer created successfully at ${outPath}`);
    } catch (e) {
        console.error(`Error creating installer: ${e.message}`);
        process.exit(1);
    }
}

buildInstaller();
