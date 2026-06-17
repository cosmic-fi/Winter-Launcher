<script>
    // @ts-nocheck
    import { uiState } from "../../stores/ui";
    import { get } from "svelte/store";
    import {t, currentLocale } from '../../stores/i18n'
    import { hasAnyAccount } from "../../stores/account";
    import { Home, Gamepad, Compass, Box, Lightbulb, Image, Settings, Folder, FolderOpen, ToolCase, PanelLeftOpen, Palette, PencilRuler, Book, Logs, Clock, Info, ExternalLink, Timer, Clock1, Clock10 } from "@lucide/svelte";

    $: buttons = [
        {
            label: $t('sidebar.buttons.home'),
            isDisabled: false,
            isActive: true,
            icon: Home,
            tabIndex: 'home'
        },
        {
            label: $t('sidebar.buttons.instances'),
            isDisabled: false,
            isActive: false,
            icon: FolderOpen,
            tabIndex: 'instances'
        },
        {
            label: $t('sidebar.buttons.discover'),
            isDisabled: false,
            isActive: false,
            icon: Compass,
            tabIndex: 'discover'
        },
        {
            isSeperator: true,
        },
        {
            label: $t('sidebar.buttons.mods'),
            isDisabled: !$hasAnyAccount,
            isActive: false,
            isDisabled: false,
            icon: ToolCase,
            tabIndex: 'mods'
        },
        {
            label: $t('sidebar.buttons.shaders'),
            isDisabled: !$hasAnyAccount,
            isActive: false,
            isDisabled: false,
            icon: Palette,
            tabIndex: 'shaders'
        },
        {
            label: $t('sidebar.buttons.resourcePacks'),
            isDisabled: !$hasAnyAccount,
            isActive: false,
            isDisabled: false,
            icon: PencilRuler,
            tabIndex: 'resourcepacks'
        },
  ];

    let activeIndex = 0;
    let inActiveTabs = ['console', 'accountmanager'];

    // Get all sidebar tabIndexes for comparison
    $: sidebarTabIndexes = buttons.map(btn => btn.tabIndex);

    // Subscribe to uiState.activeTab and update activeIndex accordingly
    $: {
        const unsubscribe = uiState.activeTab.subscribe(tab => {
            const idx = buttons.findIndex(btn => btn.tabIndex === tab);
            if (idx !== -1) {
                activeIndex = idx;
            } else {
                activeIndex = -1; // No sidebar button is active
            }
        });
    }

    function handleClick(btn, index){
        uiState.activeTab.set(btn.tabIndex);
        activeIndex = index;
    }
</script>

<div class="side-bar menu">
    <div class="brand-container">
        <div class="brand">
          <img src="./logo/WLLogo.svg" alt="">
          <h3 class="brand-title">Winter Launcher</h3>
        </div>
        <span class="version-tag">v0.1-Beta</span>
    </div>
    <div class="nav-btn-container">
        <div class="btn-group">
            {#each buttons as btn, index}
                {#if !btn.isSeperator}
                    <div class="nav-btn {index === activeIndex ? 'active' : ''}">
                        <div class="active-indicator"></div>
                        <button 
                            onclick={() => handleClick(btn, index)} 
                            class="btn-item" 
                            aria-label="{btn.label}" 
                            disabled={btn.isDisabled}>
                            <svelte:component this={btn.icon} size={20} strokeWidth={2} />
                            <span class="btn-text">{btn.label}</span>
                        </button>
                    </div>
                {:else}
                    <span class="line-short"></span>
                {/if}
            {/each}
        </div>
        <div class="btn-group bottom-group">
            <span class="line"></span>
            <div class="nav-btn bottom external">
                <a href="https://github.com/winter-launcher" class="btn-item" aria-label="changelogs">
                    <Clock size={20} strokeWidth={2} />
                    <span class="btn-text">{$t('sidebar.buttons.changelogs')}</span>
                    <ExternalLink className="external-icon" size={17}/>
                </a>
            </div>
            <div class="nav-btn bottom external">
                <a href="https://github.com/winter-launcher" class="btn-item" aria-label="docs">
                    <Book size={20} strokeWidth={2} />
                    <span class="btn-text">{$t('sidebar.buttons.docs')}</span>
                    <ExternalLink className="external-icon" size={17}/>
                </a>
            </div>
        </div>
    </div>
</div>

<style>
    .side-bar {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        grid-area: menu;
        border-right: 2px solid var(--border-color);

        .brand-container{
            padding: 15px 15px 5px 15px;
            position: relative;

            .version-tag{
                position: absolute;
                color: var(--text-color-muted);
                font-size: var(--font-size-sm);
                top: 13px;
                opacity: .8;
                right: 15px
            }
            .brand{
              display: flex;
              justify-content: start;
              align-items: center;
              gap: 5px;

              img{
                width: 40px;
              }

              .brand-title{
                font-size: 13px;
                font-weight: 700;
                color: var(--text-color);
              }
            }
        }
        .line{
            height: 1px;
            border-radius: 1px;
            width: 70%;
            margin: auto;
            background-color: var(--border-color);
            opacity: .5;
        }
        .line-short{
            height: 1px;
            border-radius: 10px;
            width: 90%;
            margin: .7em auto;
            background-color: var(--border-color);
        }
        .nav-btn-container {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding-top: 1rem;
            flex-grow: 1;
            padding-bottom: .4rem;

            .btn-group {
                display: flex;
                flex-direction: column;

                .nav-btn {
                    display: flex;
                    position: relative;
                    flex-direction: column;
                    border-left: 3px solid transparent;

                    span{
                        white-space: nowrap;
                        color: var(--text-color);
                    }
                    .btn-item {
                        flex-grow: 1;
                        color: var(--text-color-muted);
                        display: flex;
                        flex-direction: row;
                        font-size: var(--font-size-body);
                        align-items: center;
                        justify-content: start;
                        gap: 8px;
                        text-shadow: none;
                        padding-block: 8px;
                        cursor: pointer;
                        transition: all 0.2s ease-in-out;
                    }
                    a{
                        padding-left: 5px;
                        padding-top: 8px !important;
                        align-items: center !important;
                        display: flex;
                    }
                    &:hover {
                        background-color: var(--overlay-color-1);
                        color: var(--accent-color);
                        text-shadow: none;
                    }

                    [disabled]:hover{
                        color: var(--text-color-25) !important;
                        background-color: var(--base-color) !important;
                    }
                }
                .bottom{
                    padding-top: 0;
                    margin-top: 0 !important;
                }

                .external{
                    position: relative;
                }
                .active {
                    background-color: var(--overlay-color-1);
                    border-left: 3px solid var(--text-color);
                    .active-indicator {
                        display: flex;
                    }

                    .btn-item {
                        color: var(--text-color);
                    }
                }
            }
        }
    }
</style>