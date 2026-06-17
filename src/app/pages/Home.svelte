<script>
// @ts-nocheck

    import { onMount } from "svelte";
    import MainContent from "../components/layouts/MainContent.svelte";
    import AccountAdder from "../components/modal/AccountAdderModal.svelte";
    import Invoker from "../components/modal/Invoker.svelte";
    import Settings from "../components/modal/SettingsModal.svelte";
    import { uiState, showToast, dialogStore, closeDialog } from "../stores/ui";
    import { instanceStore } from "../stores/instances";
    import { getSelectedAccount } from "../shared/user";
    import { launchActions } from "../stores/launch";
    import { settings } from "../stores/settings";
    import { gameLauncher } from "../services/gameLauncher";
    import Sidebar from "../components/layouts/Sidebar.svelte";
    import Header from "../components/layouts/Header.svelte";
    import Dialog from "../components/modal/Dialog.svelte";
    import CrashRecoveryModal from "../components/modal/CrashRecoveryModal.svelte";
  import About from "../components/modal/AboutModal.svelte";
    
    const { activeModal } = uiState;
    
    // Crash recovery modal state
    let showCrashRecovery = false;
    let crashInstance = null;
    let crashData = null;
    let crashAnalysis = null;

    onMount(() => {
        // Handle crash recovery events
        const handleCrashRecovery = (event) => {
            console.log('Crash recovery event received in Home.svelte:', event.detail);
            console.log('Event instance:', event.detail.instance);
            console.log('Event crashData:', event.detail.crashData);
            console.log('Event crashAnalysis:', event.detail.crashAnalysis);
            showCrashRecovery = true;
            crashInstance = event.detail.instance;
            crashData = event.detail.crashData;
            crashAnalysis = event.detail.crashAnalysis;
            console.log('Set modal state - showCrashRecovery:', showCrashRecovery);
        };
        window.addEventListener('show-crash-recovery', handleCrashRecovery);

        // Cleanup listener on unmount
        return () => {
            window.removeEventListener('show-crash-recovery', handleCrashRecovery);
        };
    });
</script>

<div class="main">
    <Header />
    <Sidebar />
    <MainContent />
    
    {#if $activeModal === 'accountadder'}
        <AccountAdder />
    {:else if $activeModal === 'settings'}
        <Settings />
    {:else if $activeModal === 'about'}
        <About />
    {:else if $activeModal === 'invoker'}
        <Invoker />
    {/if}
    <Dialog
        open={$dialogStore.open}
        title={$dialogStore.title}
        message={$dialogStore.message}
        buttons={$dialogStore.buttons}
        onClose={closeDialog}
    />
    <!-- Crash Recovery Modal -->
    {#if showCrashRecovery}
        {console.log(showCrashRecovery)}
        <CrashRecoveryModal
            instance={crashInstance}
            crashData={crashData}
            crashAnalysis={crashAnalysis}
            on:close={() => {
            showCrashRecovery = false;
            crashInstance = null;
            crashData = null;
            crashAnalysis = null;
            }}
            on:applySettings={(event) => {
            // Handle applying suggested settings
            console.log('Applying suggested settings:', event.detail);
            showToast('Settings applied successfully', 'success');
                showCrashRecovery = false;
            }}
            on:viewLogs={() => {
            // Capture the current instance data before starting async operations
            const currentInstance = crashInstance;
            const currentInstanceName = currentInstance?.name;
            const currentInstancePath = currentInstance?.path;
            
            // Open the most relevant log file for the crash
            if (currentInstance && currentInstancePath) {
                console.log('Opening logs for crashed instance:', currentInstanceName, 'at path:', currentInstancePath);
                
                // Try to find the most relevant log file in order of priority:
                // 1. latest.log (most recent session)
                // 2. debug.log (detailed debug info)
                // 3. crash-reports folder (specific crash reports)
                // 4. Fallback to instance folder
                
                const logFiles = [
                    'latest.log',
                    'debug.log'
                ];
                
                // Function to check if file exists and open it
                const tryOpenLogFile = async (filePath) => {
                    try {
                        // Check if file exists using the file system API
                        const exists = await window.electron.pathExists(filePath);
                        if (exists) {
                            console.log('Opening log file:', filePath);
                            await window.electron.openFolderInExplorer(filePath);
                            showToast('Opened log file', 'success');
                            return true;
                        }
                        return false;
                    } catch (error) {
                        console.log('File does not exist or error checking:', filePath, error.message);
                        return false;
                    }
                };
                
                // Try to open the most relevant log file
                (async () => {
                    let opened = false;
                    
                    // Try log files in order
                    for (const logFile of logFiles) {
                        const logFilePath = await window.electron.pathJoin(currentInstancePath, logFile);
                        if (await tryOpenLogFile(logFilePath)) {
                            opened = true;
                            break;
                        }
                    }
                    
                    // If no log files found, try crash-reports folder
                    if (!opened) {
                        const crashReportsPath = await window.electron.pathJoin(currentInstancePath, 'crash-reports');
                        try {
                            const crashReportsExist = await window.electron.pathExists(crashReportsPath);
                            if (crashReportsExist) {
                                // List crash report files and find the most recent one
                                const crashFiles = await window.electron.readdir(crashReportsPath);
                                if (crashFiles && crashFiles.length > 0) {
                                    // Filter for .txt files (crash reports) and sort by name (which includes timestamp)
                                    const crashTxtFiles = crashFiles
                                        .filter(file => file.isFile && file.name.endsWith('.txt'))
                                        .map(file => file.name)
                                        .sort();
                                    
                                    if (crashTxtFiles.length > 0) {
                                        const mostRecentCrash = crashTxtFiles.pop();
                                        const crashFilePath = await window.electron.pathJoin(crashReportsPath, mostRecentCrash);
                                        console.log('Opening crash report:', crashFilePath);
                                        await window.electron.openFolderInExplorer(crashFilePath);
                                        showToast('Opened crash report', 'success');
                                        opened = true;
                                    }
                                }
                            }
                        } catch (error) {
                            console.log('Crash reports folder does not exist:', crashReportsPath);
                        }
                    }
                    
                    // Fallback: open the instance folder if no specific log files found
                    if (!opened) {
                        console.log('No specific log files found, opening instance folder:', currentInstancePath);
                        await window.electron.openFolderInExplorer(currentInstancePath);
                        showToast('Opened instance folder (no specific logs found)', 'info');
                    }
                })().catch(error => {
                    console.error('Failed to open logs:', error);
                    showToast('Failed to open logs', 'error');
                });
            } else {
                console.error('Cannot open logs: instance or instance path is missing');
                showToast('Cannot open logs: instance path not available', 'error');
            }
            
            // Close the modal and clear state after starting the async operation
            showCrashRecovery = false;
            crashInstance = null;
            crashData = null;
            crashAnalysis = null;
            }}
        />
    {/if}
</div>

<style>
    .main {
        overflow: hidden;
        height: 100%;
        display: grid;
        grid-template-areas: 
        "menu header header"
        "menu content content"
        "menu content content";
        grid-template-columns: 190px 1fr 1fr; 
        grid-template-rows: 60px 1fr 1fr; 
        background: radial-gradient(circle at 80% 40%,
                    color-mix(in srgb, var(--accent-color-light), transparent 85%) 10%, 
                    color-mix(in srgb, var(--accent-color-light), transparent 100%) 70%);
        background-color: var(--overlay-color);
    }
</style>
