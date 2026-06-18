<script>
  //@ts-nocheck
  import { createEventDispatcher } from 'svelte';
  import {
    Cpu, Coffee, Wrench, Gamepad2, HelpCircle, AlertTriangle,
    AlertCircle, Lightbulb, X
  } from '@lucide/svelte';
  import { crashRecoveryService } from '../../services/crashRecovery.js';
  import { showToast } from '../../stores/ui.js';
  import { logger } from '../../utils/logger.js';
  import { t } from '../../stores/i18n.js';
  import { fade, fly } from 'svelte/transition';
  
  export let instance = null;
  export let crashData = null;
  export let crashAnalysis = null;

  const dispatch = createEventDispatcher();
  
  let isRecovering = false;
  let recoveryResult = null;
  let showAdvanced = false;
  
  async function attemptRecovery() {
    if (!crashAnalysis || !instance) return;
    
    isRecovering = true;
    recoveryResult = null;
    
    try {
      const result = await crashRecoveryService.attemptRecovery(instance.id, crashAnalysis);
      recoveryResult = result;
      
      if (result.success) {
        showToast($t('mainContent.crashRecovery.toasts.recoverySuccess'), 'success');
      } else {
        showToast($t('mainContent.crashRecovery.toasts.recoveryFailed', { message: result.message }), 'error');
      }
    } catch (error) {
      logger.error('Recovery attempt failed:', error);
      showToast($t('mainContent.crashRecovery.toasts.recoveryFailed', { message: error.message }), 'error');
      recoveryResult = { success: false, message: error.message };
    } finally {
      isRecovering = false;
    }
  }
  
  function applySuggestedSettings() {
    if (recoveryResult && recoveryResult.suggestedSettings) {
      dispatch('applySettings', recoveryResult.suggestedSettings);
      showToast($t('mainContent.crashRecovery.toasts.settingsApplied'), 'success');
    }
  }

  function dismiss() {
    dispatch('close');
  }

  function clearCrashHistory() {
    if (instance) {
      crashRecoveryService.clearCrashHistory(instance.id);
      showToast($t('mainContent.crashRecovery.toasts.crashHistoryCleared'), 'normal');
    }
  }
  
  function getCrashTypeIcon(type) {
    const icons = {
      'memory_issues': Cpu,
      'java_version': Coffee,
      'mod_conflicts': Wrench,
      'graphics_issues': Gamepad2,
      'unknown_crashes': HelpCircle
    };
    return icons[type] || HelpCircle;
  }
  
  function getCrashTypeColor(type) {
    const colors = {
      'memory_issues': 'orange',
      'java_version': 'blue',
      'mod_conflicts': 'red',
      'graphics_issues': 'purple',
      'unknown_crashes': 'gray'
    };
    return colors[type] || 'gray';
  }
</script>

{#if instance && crashData}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-overlay" on:click={dismiss} transition:fade={{ duration: 100 }}>
    <div class="crash-recovery-modal" on:click|stopPropagation transition:fly={{ y: 40, duration: 160, opacity: 0.9 }}>
      <div class="modal-header">
        <h3>
          <AlertTriangle size={20} style="color: var(--warning-color); margin-right: 8px;" />
          {$t('mainContent.crashRecovery.title')}
        </h3>
        <button class="close-btn btn btn-default" on:click={dismiss}>
          <X size={20} />
        </button>
      </div>

      <div class="modal-content">
        <div class="crash-info">
          <div class="crash-summary">
            <h4>{instance.name}</h4>
            <p class="crash-details">
              {$t('mainContent.crashRecovery.exitCode')}: <code>{crashData.code}</code> |
              {$t('mainContent.crashRecovery.runtime')}: <code>{(crashData.runtime / 1000).toFixed(1)}s</code>
            </p>
            {#if crashAnalysis}
              <div class="crash-type-badge" style="background-color: {getCrashTypeColor(crashAnalysis.type)};">
                <span class="crash-icon">
                  <svelte:component this={getCrashTypeIcon(crashAnalysis.type)} size={16} />
                </span>
                <span>{crashAnalysis.strategy.name}</span>
              </div>
            {/if}
          </div>
          
          {#if crashAnalysis && crashAnalysis.crashCount > 1}
            <div class="crash-warning">
              <div style="display: flex; align-items: center;">
                <AlertCircle size={18} style="color: var(--warning-color); margin-right: 8px;" />
                {$t('mainContent.crashRecovery.crashWarning', { count: crashAnalysis.crashCount })}
              </div>
              <button class="link-btn" on:click={clearCrashHistory}>{$t('mainContent.crashRecovery.clearCrashHistory')}</button>
            </div>
          {/if}
        </div>
        
        {#if crashAnalysis}
          <div class="recovery-section">
            <h4>{$t('mainContent.crashRecovery.recoverySuggestions')}</h4>

            <div class="suggestions-list">
              {#each crashAnalysis.suggestions as suggestion}
                <div class="suggestion-item">
                  <span class="suggestion-icon">
                    <Lightbulb size={16} />
                  </span>
                  <span>{suggestion}</span>
                </div>
              {/each}
            </div>

            <div class="recovery-actions">
              <button class="btn btn-default" on:click={() => showAdvanced = !showAdvanced}>
                {showAdvanced ? $t('mainContent.crashRecovery.hideAdvanced') : $t('mainContent.crashRecovery.showAdvanced')}
              </button>
            </div>

            {#if showAdvanced}
              <div class="advanced-options">
                <h5>{$t('mainContent.crashRecovery.advancedCrashInfo')}</h5>
                <div class="crash-details-advanced">
                  <p><strong>{$t('mainContent.crashRecovery.signal')}:</strong> {crashData.signal || $t('mainContent.crashRecovery.none')}</p>
                  <p><strong>{$t('mainContent.crashRecovery.timeSinceLastOutput')}:</strong> {(crashData.timeSinceLastOutput / 1000).toFixed(1)}s</p>
                  <p><strong>{$t('mainContent.crashRecovery.crashType')}:</strong> {crashAnalysis.type}</p>
                  <p><strong>{$t('mainContent.crashRecovery.crashCount')}:</strong> {crashAnalysis.crashCount}</p>
                </div>

                <div class="advanced-actions">
                  <button class="btn btn-default" on:click={() => dispatch('viewLogs')}>
                    {$t('mainContent.crashRecovery.viewGameLogs')}
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <div class="loading-analysis">
            <p>{$t('mainContent.crashRecovery.analyzingCrash')}</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }
  
  .crash-recovery-modal {
    background: var(--surface-color);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    width: 500px;
    height: 500px;
    overflow: hidden;
    color: var(--text-color);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color);
    border-bottom-width: 5px;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h3 {
    margin: 0;
    color: #ff6b6b;
    display: flex;
    flex-direction: row;
    align-items: center;
    font-size: var(--font-size-base);
  }
  
  .modal-content{
    flex-wrap: 1;
    overflow: hidden;
    overflow-y: auto;
    padding-bottom: 10px;
  }
  .crash-info {
    padding: 10px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .crash-summary h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-color);
    font-size: var(--font-size-base);
  }
  
  .crash-details {
    margin: 0.5rem 0;
    color: var(--text-color-muted);
    font-size: var(--font-size-body);
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .crash-details code {
    background: var(--base-color);
    padding: 0.2rem 0.4rem;
    font-family: 'Courier New', monospace;
    font-size: var(--font-size-sm);
  }
  
  .crash-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 5px 10px;
    flex-direction: row;
    align-items: start;
    justify-content: start;
    font-size: var(--font-size-body);
    background-color: var(--error-color-dark) !important;
    color: var(--text-color);
    margin-top: 0.5rem;
    border: 1px solid color-mix(in srgb, #ffffff, transparent 50%);
    border-left-width: 5px;
  }
  
  .crash-warning {
    background: color-mix(in srgb, var(--warning-color), transparent 93%);
    border: 1px solid var(--warning-color);
    padding: 10px;
    margin-top: 1rem;
    display: flex;
    font-size: var(--font-size-body);
    border-left-width: 5px;
    color: var(--text-color);
    justify-content: space-between;
    align-items: center;
  }
  
  .link-btn {
    background: none;
    border: none;
    color: var(--info-color);
    text-decoration: underline;
    cursor: pointer;
    font-size: var(--font-size-sm);
  }
  
  .recovery-section {
    padding: 10px;
  }
  
  .recovery-section h4 {
    margin: 0 0 1rem 0;
    color: var(--text-color);
  }
  
  .suggestions-list {
    margin-bottom: 1rem;
  }
  
  .suggestion-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    font-size: var(--font-size-body);
    color: var(--text-color-muted);
    background: var(--overlay-color);
  }
  
  .suggestion-icon {
    color: #ffc107;
    font-size: var(--font-size-sm);
    margin-top: 0.1rem;
  }
  
  .advanced-options {
    margin-top: 1rem;
    padding: 10px;
    font-size: var(--font-size-body);
    background: color-mix(in srgb, var(--overlay-color-1), transparent 60%);
    border-left: 3px solid var(--border-color);
  }
  
  .advanced-options h5 {
    margin: 0 0 1rem 0;
    color: var(--text-color);
    font-size: var(--font-size-body);
  }
  
  .crash-details-advanced p {
    margin: 0.25rem 0;
    font-size: var(--font-size-sm);
    color: var(--text-color-muted);
  }
  
  .advanced-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  
  .loading-analysis {
    text-align: center;
    padding: 2rem;
    font-size: var(--font-size-body);
    color: var(--text-color-muted);
  }
</style>