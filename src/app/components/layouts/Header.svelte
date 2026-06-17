<script>
// @ts-nocheck
  import { onMount, onDestroy } from "svelte";
  import { t } from "../../stores/i18n";
  import { formatNumber } from "../../utils/helper";
  import SimpleTip from "../ui/Tip.svelte";
  import { uiState } from "../../stores/ui";
  import { accountsStore, selectedAccountData, hasAnyAccount } from "../../stores/account";
  import { getDefaultSkin, getSkinUrl } from "../../shared/user";
  import { breadcrumbStore } from "../../stores/breadcrumb";
  import { writable } from 'svelte/store';
  import { runningInstances, runningInstancesList } from "../../stores/launch";
  import About from "../modal/AboutModal.svelte";
  import { 
    ArrowLeft, ArrowRight, Home, ChevronRight, Terminal, ChevronDown, Square, Minus, X,
    Compass, Layers, Box, Lightbulb, User, UserPlus, PlusCircle, Globe, Settings,
    LucideSquaresExclude,
    LucideMaximize2,
    Minimize2,
    Info,
    HeartPlus,
    ChevronUp,
  } from '@lucide/svelte';
  import { image } from "../../utils/image";

  const { activeTab, activeModal } = uiState;

  let ignoreHistoryPush = false;
  let unsubscribeHistoryPush;
  let popHandler;
  let showRunningDropdown = false;
  let showAboutModal = false;
  let uptimeTimer;
  let currentTime = Date.now();
  let dropdownElement;
  let dropdownToggleElement;
  let isMaximized = false;

  const defaultFace = getDefaultSkin().urls.pixel.face;

  // Format uptime for running instances
  function formatUptime(startTime) {
    // Use currentTime to make this reactive - it updates every second
    const now = currentTime;
    const diff = now - startTime;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }
  
  onMount(() => {
    popHandler = (e) => {
      const nextTab = e.state?.tab || 'home';
      ignoreHistoryPush = true;
      uiState.activeTab.set(nextTab);
      ignoreHistoryPush = false;
    };
    window.addEventListener('popstate', popHandler);
    unsubscribeHistoryPush = activeTab.subscribe(tab => {
      if (!ignoreHistoryPush) {
        history.pushState({ tab }, '', '#' + tab);
      }
    });
    
    // Handle click outside to close dropdown
    const handleClickOutside = (event) => {
      if (showRunningDropdown && dropdownElement && 
          !dropdownElement.contains(event.target) && 
          !dropdownToggleElement.contains(event.target)) {
        showRunningDropdown = false;
      }
    };
    document.addEventListener('click', handleClickOutside);

    // Listen for window maximize/unmaximize events to update header icon
    if (window.electron?.onWindowMaximized && window.electron?.onWindowUnmaximized) {
      window.electron.onWindowMaximized(() => {
        isMaximized = true;
      });
      window.electron.onWindowUnmaximized(() => {
        isMaximized = false;
      });
    }
    
    // Store cleanup function for onDestroy
    const clickOutsideCleanup = () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
  
  onDestroy(() => {
    if (popHandler) window.removeEventListener('popstate', popHandler);
    if (unsubscribeHistoryPush) unsubscribeHistoryPush();
    if (uptimeTimer) clearInterval(uptimeTimer);
    if (typeof clickOutsideCleanup === 'function') clickOutsideCleanup();
  });
  
  // Reactive: Start/stop uptime timer based on running instances
  $: {
    if ($runningInstancesList.length > 0) {
      // Start timer if not already running
      if (!uptimeTimer) {
        uptimeTimer = setInterval(() => {
          currentTime = Date.now();
        }, 1000);
      }
    } else {
      // Stop timer when no instances are running
      if (uptimeTimer) {
        clearInterval(uptimeTimer);
        uptimeTimer = null;
      }
    }
  }
</script>

<div class="top-container header">
  <div class="left-header">
        <div class="nav-controls">
          <button class="nav-arrow" onclick={() => window.history.back()} aria-label="Go back">
            <ArrowLeft size={16} />
          </button>
          <button class="nav-arrow" onclick={() => window.history.forward()} aria-label="Go forward">
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
  <div class="right-header">
    <div class="container-group">
      <div class="wrapper-group">
        <SimpleTip text={$t("header.buttons.console")} direction="bottom">
          <button
            class="window-action-btn console-btn"
            aria-label="Open Console"
            onclick={async () => {
              try {
                await window.electron.openConsoleWindow();
              } catch (e) {}
            }}
          >
            <Terminal size={16} />
          </button>
        </SimpleTip>
        <div class="running-instances-dropdown" aria-live="polite" bind:this={dropdownElement}>
          <button 
            class="running-instances-toggle"
            onclick={() => showRunningDropdown = !showRunningDropdown}
            aria-expanded={showRunningDropdown}
            aria-label="Running instances"
            bind:this={dropdownToggleElement}
          >
            {#if $runningInstances > 0}
              <span class="running-badge active">
                <span class="dot"></span>
                {$runningInstances} Instance{$runningInstances > 1 ? 's' : ''} running
                <ChevronDown size={14} class="dropdown-arrow {showRunningDropdown ? 'open' : ''}" />
              </span>
            {:else}
              <span class="running-badge idle">
                <span class="dot"></span>
                {$t("header.instanceRunTime.noInstancesRunning")}
              </span>
            {/if}
          </button>
          
          {#if showRunningDropdown && $runningInstances > 0 }
            <div class="running-instances-menu">
              <div class="dropdown-header">
                <span>{$t('header.instanceRunTime.runningInstances')}</span>
              </div>
              <div class="running-instances-list">
                {#each $runningInstancesList as instance}
                  <div class="running-instance-item">
                    <div class="instance-info">
                      <span class="instance-name">{instance.name}</span>
                      <span class="instance-time">{formatUptime(instance.startTime)}</span>
                    </div>

                    <button 
                        class="stop-instance-btn"
                        onclick={async () => {
                          try {
                            await window.electron.cancelLaunch(instance.id);
                          } catch (error) {
                            console.log(`Failed to stop instance ${instance.name}:`, error);
                          }
                          showRunningDropdown = false;
                        }}
                        aria-label="Stop {instance.name}"
                    >
                        <Square size={14} fill="currentColor" />
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
      <span class="line"></span>
      <div class="wrapper-group">
        <SimpleTip text={$t("header.buttons.about")} direction="bottom">
          <button
            class="window-action-btn console-btn"
            aria-label="About"
            onclick={() => {activeModal.set('about')}}
          >
            <Info size={16} />
          </button>
        </SimpleTip>
        <SimpleTip text={$t("header.buttons.donate")} direction="bottom">
          <a
            href={"https://www.buymeacoffee.com/cosmic_fi"}
            class="window-action-btn txt-pink"
            aria-label="Donate"
          >
            <HeartPlus size={16} />
          </a>
        </SimpleTip>
      </div>
      <div class="wrapper-group">
          <button
            class="window-action-btn account-btn avatarcard-toggle-btn"
            aria-label="Active account"
            onclick={() => {
              activeModal.set('avatarCard')
            }}
          >
            <img
              class="account-face-icon"
              src={$selectedAccountData ? getSkinUrl($selectedAccountData, 'pixel').face : defaultFace}
              alt={$selectedAccountData ? $selectedAccountData.name : 'Steve'}
              use:image
            />
            <span class="account-button-label">
              {$selectedAccountData ? $selectedAccountData.name : 'Select account'}
            </span>
            {#if $activeModal === 'avatarCard'}
              <ChevronUp size={15}/>
            {:else}
              <ChevronDown size={15}/>
            {/if}
          </button>
      </div>
      <div class="wrapper-group">
        <SimpleTip  text={$t("header.buttons.settings")} direction="bottom">
          <button
              class="window-action-btn settings-btn"
              aria-label="Settings"
              onclick={() => activeModal.set('settings')}
            >
              <Settings size={16} />
          </button>
        </SimpleTip>
      </div>
      <span class="line"></span>
      <div class="wrapper-group">
        <SimpleTip text={$t("header.buttons.minimize")} direction="bottom">
          <button
            class="window-action-btn minimize-app-btn"
            aria-label={$t("header.buttons.minimize")}
            onclick={async () => {
              await window.electron.minimizeApp();
            }}
          >
            <Minus size={16} />
          </button>
        </SimpleTip>
      </div>
      <div class="wrapper-group">
        <SimpleTip text={$t(isMaximized ? "header.buttons.restore" : "header.buttons.maximize")} direction="bottom">
          <button
            class="window-action-btn maximize-app-btn"
            aria-label={$t(isMaximized ? "header.buttons.restore" : "header.buttons.maximize")}
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
      </div>
      <div class="wrapper-group">
        <SimpleTip text={$t("header.buttons.close")} direction="bottom">
          <button
            class="window-action-btn exit-app-btn"
            aria-label={$t("header.buttons.close")}
            onclick={async () => {
              await window.electron.closeApp();
            }}
          >
            <X size={16} />
          </button>
        </SimpleTip>
      </div>
    </div>
  </div>
</div>

<style>
    .top-container {
        display: flex;
        justify-content: space-between;
        -webkit-app-region: drag;
        grid-area: header;
        padding: 10px 10px;
        .left-header {
            display: flex;
            align-items: center;
            -webkit-app-region: no-drag;
            gap: 15px;

            
            .nav-controls {
                display: flex;
                align-items: center;
                gap: 10px;
                
                .nav-arrow {
                    background: none;
                    border: none;
                    color: var(--text-color-muted);
                    font-size: var(--font-size-fluid-sm);
                    cursor: pointer;
                    padding: 4px 8px;
                    background-color: var(--overlay-color);
                    box-shadow: 0 0 0 2px var(--border-color);
                    transition: all 0.2s ease;
                    font-weight: bold;
                    
                    &:hover {
                        background-color: var(--overlay-color-1);
                        color: var(--text-color);
                    }
                    
                    &:active {
                        transform: scale(0.95);
                    }
                    
                    &:disabled {
                        opacity: 0.3;
                        cursor: not-allowed;
                    }
                }
            }
        }

        .right-header{
          display: flex;
          flex-direction: row;
          align-items: center;
          column-gap: 20px;

          .container-group {
              display: flex;
              flex-direction: row;
              align-items: center;
              column-gap: 10px;
              -webkit-app-region: no-drag;
              font-size: var(--font-size-body);
  
              .wrapper-group {
                  background-color: var(--surface-color-1);
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  box-shadow: 0 0 0 2px var(--border-color);
                  
                  .running-badge {
                      display: inline-flex;
                      align-items: center;
                      gap: 6px;
                      color: var(--text-color);
                      background: var(--overlay-color);
                      padding: 4px 8px;
                      margin-inline: 6px;

                      .dot{
                        width: 8px;
                        height: 8px;
                        border-radius: 100px;
                        background-color: var(--success-color);
                      }
                  }
                  .running-badge.idle {
                    color: var(--text-color-muted);

                    .dot{
                      background-color: var(--overlay-color-2) !important;
                      }
                  }
  
                  .window-action-btn {
                      padding: 10px;
                      font-size: var(--font-size-sm);
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      gap: 10px;
                      color: var(--text-color);
                      transition: all 0.2s ease-in-out;
                      overflow: hidden;

                      &:hover {
                          color: var(--text-color-muted);
                          background-color: var(--overlay-color-2);
                      }
  
                      &:active {
                          color: var(--text-color);
                      }
                  }
                  .avatarcard-toggle-btn{
                    flex-direction: row;
                    align-items: center;
                    justify-content: start;
                    position: relative;
                    width: 170px;
                    height: 34px;
                    background: linear-gradient(45deg, var(--accent-color), var(--accent-color-dark), var(--accent-color));
                    box-shadow: 0 0 0 2px var(--accent-color-dark);
                    padding: 5px 30px 5px 6px !important;
                    color: #fff6f0;

                    img{
                      width: 25px;
                      right: 0;
                    }

                    &:hover, &:focus{
                      background: linear-gradient(45deg, var(--accent-color-dark), var(--accent-color-dark), var(--accent-color));
                      box-shadow: 0 0 0 2px var(--accent-color);
                      color: #fff6f07c;
                    }
                  }

                  .account-button-label {
                    align-items: center;
                    gap: 0.25rem;
                    white-space: nowrap;
                    max-width: 110px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  }
                  .console-btn{
                    border-right: 1px solid var(--border-color) ;
                  }
  
                  .exit-app-btn {
                      &:hover {
                          color: var(--text-color) !important;
                          background-color: color-mix(in srgb, var(--error-color), transparent 40%);
                      }
                  }
                  
                  /* Running Instances Dropdown Styles */
                  .running-instances-dropdown {
                      position: relative;
                      display: inline-block;
                  }
                  
                  .running-instances-toggle {
                      background: none;
                      border: none;
                      padding: 0;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                  }
                  
                  .running-instances-toggle:hover .running-badge {
                      background-color: var(--overlay-color-1);
                  }
                  
                  .running-badge {
                      display: inline-flex;
                      align-items: center;
                      gap: 6px;
                      color: var(--text-color);
                      background: var(--overlay-color);
                      padding: 4px 8px;
                      font-size: var(--font-size-sm);
                      transition: all 0.2s ease;
                  }
                  
                  .running-badge.active {
                      color: var(--text-color);
                  }
                  
                  .running-badge.idle {
                      color: var(--text-color-muted);
                  }
                  
                  
                  .running-instances-menu {
                      position: absolute;
                      top: calc(100% + 5px);
                      right: 0;
                      margin-top: 8px;
                      background: var(--surface-color);
                      border: 2px solid var(--border-color);
                      border-bottom: 5px solid var(--border-color);
                      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                      min-width: 280px;
                      max-width: 350px;
                      z-index: 1000;
                  }
                  
                  .dropdown-header {
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      padding: 8px 10px;
                      border-bottom: 1px solid var(--border-color);
                      font-size: var(--font-size-body);
                      color: var(--text-color-muted);
                  }
                  
                  .running-instances-list {
                      max-height: 300px;
                      overflow-y: auto;
                  }
                  
                  .running-instance-item {
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      padding: 12px 10px;
                      border-bottom: 1px solid var(--border-color-50);
                      transition: background-color 0.2s ease;
                      gap: 16px;
                  }
                  
                  .running-instance-item:hover {
                      background-color: var(--overlay-color-25);
                  }
                  
                  .running-instance-item:last-child {
                      border-bottom: none;
                  }
                  
                  .instance-info {
                      display: flex;
                      flex-direction: column;
                      align-items: start;
                      justify-content: start;
                      min-width: 0;
                      width: 100%;
                      row-gap: 4px;
                  }
                  
                  .instance-name {
                      font-weight: 500;
                      color: var(--text-color);
                      font-size: var(--font-size-body);
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                  }
                  
                  .instance-time {
                      color: var(--text-color-muted);
                      font-size: var(--font-size-sm);
                  }
                  
                  .stop-instance-btn {
                      background: var(--error-color-25);
                      border: 2px solid var(--error-color-50);
                      color: var(--error-color);
                      padding: 6px 10px;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      gap: 4px;
                      transition: all 0.2s ease;
                      white-space: nowrap;
                  }
                  
                  .stop-instance-btn:hover {
                      background: var(--error-color-50);
                      color: var(--text-color);
                  }
                  
                  .stop-instance-btn:active {
                      transform: scale(0.95);
                  }

                  button {
                      &:hover {
                          color: var(--text-color-muted);
                      }
  
                      &:active {
                          color: var(--text-color);
                      }
                  }
              }
          }
        }
    }
</style>