<script>
    // @ts-nocheck
    import { onMount, onDestroy } from "svelte";
    import axios from "axios";

    import { uiState, showToast } from "../../stores/ui";
    import {
        selectedAccountUsername,
        userBurst,
        userAccountState,
        hasAnyAccount,
    } from "../../stores/account";
    import AccountManager from "../modal/AccountManagerModal.svelte";
    import { formatNumber } from "../../utils/helper";
    import { t } from "../../stores/i18n.js";
    import {
        isLaunching,
        launchActions,
        launchStatus,
    } from "../../stores/launch";
    import { logger } from "../../utils/logger";
    import { gameLauncher } from "../../services/gameLauncher";

    import { discordRPCManager } from "../../utils/discordRPCManager.js";
    import AvatarCard from "../modal/AvatarCardModal.svelte";
    import HomePage from "../../routes/HomePage.svelte";
    import Discover from "../../routes/Discover.svelte";
    import Mods from "../../routes/Mods.svelte";
    import Shaders from "../../routes/Shaders.svelte";
    import ResourcePacks from "../../routes/ResourcePacks.svelte";
    import Instances from "../../routes/Instances.svelte";
    import StepInstanceCreator from "../modal/InstanceCreatorModal.svelte";
    import OnboardingModal from "../modal/OnboardingModal.svelte";
    import { instanceStore } from "../../stores/instances";
    import About from "../modal/AboutModal.svelte";
    
    const { activeTab, activeModal } = uiState;
    const { hasAccount } = userAccountState;

    let showOnboarding = false;
    let avatarCardRef;

    function showOnboardingModal() {
        showOnboarding = true;
    }

    function handleOnboardingClose() {
        showOnboarding = false;
        localStorage.setItem('winter_launcher_onboarding_seen', 'true');
    }

    let consoleModalOpen = false;

    // Store cleanup functions for event listeners
    let cleanupFunctions = [];

    // Check if user has seen onboarding
    let hasSeenOnboarding = localStorage.getItem('winter_launcher_onboarding_seen');
    if (!hasSeenOnboarding) {
        // Show it after a short delay
        setTimeout(() => {
            showOnboardingModal();
        }, 500);
    }
    // In the onMount function, initialize Discord RPC
    onMount(async () => {
        setupLaunchListeners();

        // Initialize Discord RPC
        await discordRPCManager.initialize();

        // Monitor console window state
        if (window.electron && window.electron.getConsoleWindowState) {
            const checkConsoleState = async () => {
                try {
                    const state = await window.electron.getConsoleWindowState();
                    consoleModalOpen = state.isOpen;
                } catch (error) {
                    logger.error('Failed to get console window state:', error);
                }
            };
            
            // Check initially and then periodically
            checkConsoleState();
            const consoleCheckInterval = setInterval(checkConsoleState, 1000);
            
            // Listen for console window closed event
            let removeConsoleClosedListener;
            if (window.electron && window.electron.on) {
                removeConsoleClosedListener = window.electron.on('console-closed', () => {
                    consoleModalOpen = false;
                });
            }
            
            // Clean up on unmount
            return () => {
                clearInterval(consoleCheckInterval);
                if (removeConsoleClosedListener) {
                    removeConsoleClosedListener();
                }
            };
        }
    });

    function closeGlobalCreateInstance() {
        activeModal.set("none");
    }

    function closeAvatarCardModal(e) {
        const toggleButton = e.target.closest('.avatarcard-toggle-btn');

        if (toggleButton) return;

        if (avatarCardRef && !avatarCardRef.contains(event.target)) {
            activeModal.set('none');
        }
    }

    async function handleGlobalCreateInstanceSubmit(event) {
        const data = event.detail;
        if (!data?.name?.trim()) {
            showToast("Instance name is required", "error");
            return;
        }
        try {
            await instanceStore.createInstance(data);
            activeModal.set("none");
        } catch (error) {
            showToast(error.message, "error");
        }
    }

    onDestroy(() => {
        // Use centralized cleanup from gameLauncher
        gameLauncher.cleanupLaunchListeners();

        // Clean up any additional individual listeners
        cleanupFunctions.forEach((cleanup) => {
            if (typeof cleanup === "function") {
                cleanup();
            }
        });
        cleanupFunctions = [];

        // Also remove all launch listeners from preload as backup
        window.electron.removeAllLaunchListeners?.();
    });

    function setupLaunchListeners() {
        logger.info('[MAIN CONTENT] Setting up launch listeners via gameLauncher service');
        
        // Use the centralized listener setup from gameLauncher
        const newCleanupFunctions = gameLauncher.setupLaunchListeners();
        
        // Store cleanup functions for later cleanup
        newCleanupFunctions.forEach(cleanup => {
            if (typeof cleanup === "function") {
                cleanupFunctions.push(cleanup);
            }
        });
        
        logger.info(`${$t("logs.debugger.eventSetupComplete")} ${cleanupFunctions.length}`);
    }
</script>

<div class="main-content content">
    <!-- Single container layout for instances and mods browser -->
    {#if $activeTab === 'instances'}
        <div class="single-container">
            {#if $activeTab === 'instances'}
                <Instances />
            {/if}
        </div>
    {:else}
        <!-- Two container layout for other pages -->
        <div class="two-grid-container">
            <div class="page-grids">
                {#if $activeTab === 'home'}
                    <HomePage />
                {:else if $activeTab === 'discover'}
                    <Discover />
                {:else if $activeTab === 'shaders'}
                    <Shaders />
                {:else if $activeTab === 'resourcepacks'}
                    <ResourcePacks />
                {:else if $activeTab === 'mods'}
                    <Mods />
                {/if}
            </div>
        </div>
    {/if}
    
    {#if $activeModal === 'accountmanager'}
        <AccountManager />
    {/if}

    {#if $activeModal === 'avatarCard'}
        <AvatarCard />
    {/if}

    {#if $activeModal === 'instancecreator'}
        <StepInstanceCreator
            open={true}
            on:close={closeGlobalCreateInstance}
            on:submit={handleGlobalCreateInstanceSubmit}
            on:error={(e) => showToast(e.detail.message, "error")}
        />
    {/if}

    <OnboardingModal
        open={showOnboarding}
        on:close={() => handleOnboardingClose()}
    />
</div>

<style>
    .main-content {
        position: relative !important;
        grid-area: content;
        height: 100%;
        background-color: color-mix(in srgb, var(--base-color), transparent 60%);
        border-top: 2px solid var(--border-color);
        overflow: hidden;

        .single-container {
            height: 100%;
            width: 100%;
            display: flex;
            flex-direction: column;
        }
        
        .two-grid-container{
            display: grid;
            grid-template-areas:
            "page-grids";
            grid-template-columns: 1fr;
            grid-template-rows: 1fr; 
            height: 100%; 

            .page-grids{
                grid-area: page-grids;
                display: flex;
                justify-content: stretch;
                align-items: stretch; 
                height: 100%; 
                position: relative;
                overflow: hidden;
            }
        }
    }
</style>
