<script>
// @ts-nocheck
    import SimpleTip from "../components/ui/Tip.svelte";
    import { bootStatus, runBootSequence } from "../utils/bootUpManager";
    import { onMount } from "svelte";
    import { t } from "../stores/i18n";
    import { LucideMaximize, LucideMaximize2, Maximize, Minimize, Minimize2, Minus, X } from '@lucide/svelte';

    let status = { message: $t('splash.loading'), progress: 0 };
    let appVersion = 'Loading...';
    const unsubscribe = bootStatus.subscribe(val => status = val);


    let isMaximized = false;

    onMount(async () => {
        // Get the actual app version from Electron
        try {
            const versionInfo = await window.electron.invoke('get-app-version');
            appVersion = versionInfo.version;
        } catch (error) {
            console.error('Failed to get app version:', error);
            appVersion = 'Unknown';
        }
        
        // Listen for window maximize/unmaximize events to update header icon
        if (window.electron?.onWindowMaximized && window.electron?.onWindowUnmaximized) {
            window.electron.onWindowMaximized(() => {
                isMaximized = true;
            });
            window.electron.onWindowUnmaximized(() => {
                isMaximized = false;
            });
        }
        
        runBootSequence();
        return unsubscribe;
    });
</script>
<div class="updater splash-screen">
    <div class="win-bar">
        <div class="win-title">
        </div>
        <div class="drag-bar"></div>
        <div class="win-action-bar-cont">
            <SimpleTip text="{$t('mainContent.minimize')}" direction="bottom">
                <button 
                    onclick={async () => {
                        await window.electron.minimizeApp()
                    }}
                    aria-label="minimize-app" class="win-action-btn splash-minimize-btn"
                    >
                    <Minus size={14} />
                </button>
            </SimpleTip>
            <SimpleTip text={$t(isMaximized ? "mainContent.restore" : "mainContent.maximize")} direction="bottom">
                <button
                    aria-label={$t(isMaximized ? "mainContent.restore" : "mainContent.maximize")}
                    class="win-action-btn"
                    onclick={async () => {
                    await window.electron.toggleMaximizeApp();
                    }}
                >
                    {#if isMaximized}
                        <Minimize2 size={16} />
                    {:else}
                        <LucideMaximize2 size={16} />
                    {/if}
                </button>
            </SimpleTip>
            <SimpleTip text="{$t('mainContent.closeApp')}" direction="bottom">
                <button 
                    onclick={async () => {
                        await window.electron.closeApp()
                    }}
                    aria-label="minimize-app" class="win-action-btn splash-close-btn">
                    <X size={14} />
                </button>
            </SimpleTip>
        </div>
    </div>
    <div class="u-wrapper">
        <div class="grass-level">
            <span class="horizontal-seperator"></span>
            <div class="u-progress-bar-cont">
                <div class="progress-bar loading" style="width: {status.progress}%"></div>
            </div>
            <span class="progress-status">{status.message}</span>
            <span class="version-tag">v{appVersion}</span>
        </div>
    </div>
</div>
<style>
    .splash-screen{
        display: flex;
        position: relative;
        z-index: 999;
        flex-grow: 1;
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        background-color: var(--overlay-color);
        background-size: 110%;
        background-position: center;
        background-repeat: no-repeat;

        .win-bar{
            display: flex;
            top: 0;
            left: 0;
            flex-direction: row;
            justify-content: space-between;
            padding: 1.5vw;
            -webkit-app-region: drag;

            .win-title{
                color: var(--text-color);
                font-weight: bolder;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .splash-close-btn {
                &:hover {
                    color: var(--text-color) !important;
                    background-color: color-mix(in srgb, var(--error-color), transparent 40%);
                }
            }

            .win-action-bar-cont{
                display: flex;
                flex-direction: row;
                -webkit-app-region: no-drag;
                column-gap: 1vw;

                .win-action-btn{
                    padding: 10px 15px;
                    /* font-size: var(--font-size-sm); */
                    background-color: var(--surface-color);
                    flex-direction: row;
                    box-shadow: inset 0 0 0 2px var(--border-color);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    color: var(--text-color);
                    transition: all 0.2s ease-in-out;
                    overflow: hidden;

                    &:hover{
                        color: var(--text-color);
                    }
                    &:active > :global(svg){
                        transform: scale(.9);
                    }
                }
                .splash-close-btn{
                    &:hover{
                        color: var(--error-color) !important;
                    }
                }
            }
        }
        .u-wrapper{
            display: flex;
            flex-grow: 1;
            row-gap: 10px;
            flex-direction: column;
            align-items: center;
            justify-content: end;
            -webkit-app-region: drag;

            .grass-level{
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                /* background: linear-gradient(to top, var(--base-color), #0000000e), url('./images/static/grass_level.jpg'); */
                background-repeat: repeat-x;
                background-size: 90px auto;
                position: relative;
                padding-block: 25px;
                gap: 10px;
               
                .u-progress-bar-cont{
                    background-color: var(--overlay-color-1);
                    width: 300px;
                    padding: 6px 5px;
                    position: relative;
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: start;
                    border: 1px var(--overlay-color-2) solid;
    
                    .progress-bar{
                        height: 3px;
                        width: 10%;
                        transition: all .2s ease;
                        background: linear-gradient(to right, var(--accent-color), var(--accent-color-light));
                    }
                }
                .progress-status{
                    color: var(--text-color-muted);
                    font-size: var(--font-size-sm);
                }
                .version-tag{
                    position: absolute;
                    bottom: 10px;
                    right: 10px;
                    font-size: 12px;
                    color: var(--text-color-muted);
                    opacity: 0.7;
                    font-family: monospace;
                    padding: 4px 8px;
                }
            }
        }
    }

    @keyframes scrollGrass {
        0% {
            background-position: 0 0;
        }
        100% {
            background-position: -180px 0;
        }
    }

    @keyframes foxWalk {
        0% {
            transform: translateY(0px);
        }
        100% {
            transform: translateY(-3px);
        }
    }
</style>