import { build } from 'electron-builder';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import 'dotenv/config';
import { createRequire } from 'module';

const args = process.argv.slice(2);
const shouldBuild = args.includes('--build=platform');
const require = createRequire(import.meta.url);
const envTag = process.env.RELEASE_TAG || '';
const envRef = process.env.GIT_REF_NAME || '';
const selectedTag = envTag ? envTag : (envRef.startsWith('v') ? envRef : '');
const pkg = require('./package.json');
const resolvedVersion = selectedTag ? selectedTag.replace(/^v/, '') : pkg.version;

const getFiles = async (dir, files = []) => {
    const fileList = await fsPromises.readdir(dir);
    for (const file of fileList) {
        const name = `${dir}/${file}`;
        const stat = await fsPromises.stat(name);
        if (stat.isDirectory()) {
            await getFiles(name, files);
        } else {
            files.push(name);
        }
    }
    return files;
};

const copyFiles = async () => {
    console.log('Copying source files...');
    
    const electronFiles = await getFiles('src/electron');
    for (const file of electronFiles) {
        const content = await fsPromises.readFile(file, 'utf8');
        const outputPath = file.replace('src/', 'appsrc/');
        const outputDir = path.dirname(outputPath);
        
        try {
            await fsPromises.access(outputDir);
        } catch (error) {
            await fsPromises.mkdir(outputDir, { recursive: true });
        }
        
        await fsPromises.writeFile(outputPath, content);
    }
    
    try {
        await fsPromises.access('locale');
        const localeFiles = await getFiles('locale');
        for (const file of localeFiles) {
            const content = await fsPromises.readFile(file, 'utf8');
            const outputPath = `appsrc/locale/${path.basename(file)}`;
            const outputDir = path.dirname(outputPath);
            
            try {
                await fsPromises.access(outputDir);
            } catch (error) {
                await fsPromises.mkdir(outputDir, { recursive: true });
            }
            
            await fsPromises.writeFile(outputPath, content);
        }
    } catch (error) {
        console.log('No locale files found, skipping...');
    }
    
    console.log('Files copied successfully!');
};

const buildApp = async () => {
    try {
        console.log('Building application...');
        await build({
            config: {
                appId: 'dev.cosmicfi.winterlauncher',
                productName: 'Winter Launcher',
                copyright: `Copyright © ${new Date().getFullYear()} Cosmic-fi (Cosmic Boucher)`,
                forceCodeSigning: true,
                afterSign: null,
                publish: null,
                artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
                extraMetadata: {
                    main: 'appsrc/electron/main.js',
                    version: resolvedVersion
                },
                files: [
                    "dist/**/*",           
                    "appsrc/electron/**/*.js",    
                    "appsrc/electron/**/*.json",  
                    "appsrc/electron/**/*.mjs",   
                    "appsrc/locale/**/*.json",    
                    "node_modules/**/*",
                    "!node_modules/**/{test,__tests__,tests,powered-test,example,examples}/**",
                    "!node_modules/**/*.{d.ts,o,hprof,rc,bin,log,sh,md,txt,map}",
                    "package.json",
                    "LICENSE.md",
                    "public/icon.ico",
                    "public/icon.icns",
                    "public/icon.png",
                    "public/installerSidebar.bmp",
                    "public/uninstallerSidebar.bmp",
                    "src/console/view.html",
                    "src/console/console.css",
                    "src/console/console.js"
                ],
                directories: {
                    buildResources: "public",
                    output: 'build'
                },
                compression: 'normal',
                asar: true,
                asarUnpack: [
                    '**/*.node',
                    '**/discord-rpc/**/*',
                    '**/discord-rpc/**/.*'
                ],
                win: {
                    signtoolOptions: {
                        certificateFile: 'certificate.pfx',
                        certificatePassword: process.env.CERTIFICATE_PASSWORD,
                    },
                    target: [
                        {
                            target: 'nsis',
                            arch: ['x64']
                        },
                        {
                            target: 'zip',
                            arch: ['x64']
                        }
                    ],
                    icon: 'public/icons/icon.ico'
                },
                nsis: {
                    oneClick: false,
                    allowToChangeInstallationDirectory: true,
                    createDesktopShortcut: true,
                    createStartMenuShortcut: true,
                    allowElevation: false,
                    selectPerMachineByDefault: true,
                    artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
                    deleteAppDataOnUninstall: true,
                    license: 'LICENSE',
                    installerSidebar: 'public/artwork/installerSidebar.bmp',
                    uninstallerSidebar: 'public/artwork/uninstallerSidebar.bmp'
                },
                mac: {
                    target: [
                        {
                            target: 'dmg',
                            arch: ['universal']
                        },
                        {
                            target: 'zip',
                            arch: ['universal']
                        }
                    ],
                    icon: 'public/icons/icon.icns',
                    identity: null,
                    hardenedRuntime: false,
                    gatekeeperAssess: false
                },
                linux: {
                    target: [
                        {
                            target: 'AppImage',
                            arch: ['x64']
                        }
                    ],
                    icon: 'public/icons/icon.png',
                    category: 'Game',
                    synopsis: 'Winter Launcher - Custom Minecraft Launcher',
                    description: 'A modern custom Minecraft Launcher'
                }
            }
        });
        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
};

const buildFrontend = async () => {
    try {
        console.log('Building frontend with Vite...');
        execSync('npm run build:ui', { stdio: 'inherit' });
        console.log('Frontend build completed successfully!');
        return true;
    } catch (error) {
        console.error('Frontend build failed:', error);
        return false;
    }
};

const main = async () => {
    if (shouldBuild) {
        // First build the frontend with Vite
        const frontendBuilt = await buildFrontend();
        if (!frontendBuilt) {
            console.error('Failed to build frontend, aborting packaging process.');
            process.exit(1);
        }
        
        // Copy console files to dist directory after Vite build
        console.log('Copying console files to dist...');
        try {
            // Copy console files to dist/src/console
            const consoleFiles = await getFiles('src/console');
            for (const file of consoleFiles) {
                const content = await fsPromises.readFile(file, 'utf8');
                const outputPath = file.replace('src/', 'dist/src/');
                const outputDir = path.dirname(outputPath);
                
                try {
                    await fsPromises.access(outputDir);
                } catch (error) {
                    await fsPromises.mkdir(outputDir, { recursive: true });
                }
                
                await fsPromises.writeFile(outputPath, content);
            }
            
            // Also copy theme CSS files
            const themeFiles = await getFiles('src/app/style/themes');
            for (const file of themeFiles) {
                const content = await fsPromises.readFile(file, 'utf8');
                const outputPath = file.replace('src/', 'dist/src/');
                const outputDir = path.dirname(outputPath);
                
                try {
                    await fsPromises.access(outputDir);
                } catch (error) {
                    await fsPromises.mkdir(outputDir, { recursive: true });
                }
                
                await fsPromises.writeFile(outputPath, content);
            }
            
            console.log('Console files copied to dist successfully!');
        } catch (error) {
            console.error('Error copying console files to dist:', error);
        }
        
        // Then copy necessary files
        await copyFiles();
        
        // Finally package the application
        await buildApp();
    } else {
        console.log('Use --build=platform to build the application');
    }
};

main().catch(console.error);
