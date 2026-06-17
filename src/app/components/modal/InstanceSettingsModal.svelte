<script>
// @ts-nocheck
  import { createEventDispatcher } from 'svelte';
  import { X, Save } from '@lucide/svelte';
  import { openDropdownId } from '../../stores/dropdown.js';
  import { showToast } from '../../stores/ui.js';
  import { logger } from '../../utils/logger.js';
  import CustomOptions from '../ui/Options.svelte';
  import RamInput from '../ui/RamInput.svelte';
  import FolderPicker from '../ui/FolderPicker.svelte';
  import { fetchFabricLoaderVersions, fetchForgeLoaderVersions, fetchQuiltLoaderVersions, fetchNeoForgeLoaderVersions } from '../../services/api.js';
  import { t } from '../../stores/i18n.js';

  export let open = false;
  export let instance = null;

  const dispatch = createEventDispatcher();

  let form = {
    name: '',
    description: '',
    memoryMin: 2048,
    memoryMax: 4096,
    javaPath: '',
    jvmArgs: '',
    gameArgs: '',
    loaderVersion: ''
  };

  let availableLoaderVersions = [];
  let loadingLoaderVersions = false;
  let userHasSelectedLoaderVersion = false;
  let modalInitialized = false;

  // Initialize form when modal opens
  $: if (open && instance && !modalInitialized) {
    console.log('Modal opening, initializing form for instance:', instance.name);
    console.log('Instance loaderVersion from props:', instance.loaderVersion);
    console.log('Instance loader_version from props:', instance.loader_version);
    console.log('Full instance object passed to modal:', instance);
    initForm();
    console.log('Form initialized with loaderVersion:', form.loaderVersion);
    modalInitialized = true;
    // Fetch loader versions but don't override user's selection
    fetchAvailableLoaderVersions();
  }
  

  // Close dropdowns when modal closes
  $: if (!open) {
    openDropdownId.set(null);
    // Reset user selection flag when modal closes
    userHasSelectedLoaderVersion = false;
    // Reset initialization flag so modal can be reinitialized next time
    modalInitialized = false;
  }

  function parseMemory(memStr) {
    if (!memStr) return 2048;
    if (typeof memStr === 'number') return memStr;
    const str = memStr.toString();
    if (str.endsWith('G')) return parseFloat(str) * 1024;
    if (str.endsWith('M')) return parseFloat(str);
    return parseFloat(str);
  }

  function initForm() {
    if (!instance) return;

    console.log('initForm called with instance loaderVersion:', instance.loaderVersion, 'loader_version:', instance.loader_version);
    console.log('Full instance data:', {
      name: instance.name,
      loader: instance.loader,
      gameVersion: instance.gameVersion,
      game_version: instance.game_version,
      loaderVersion: instance.loaderVersion,
      loader_version: instance.loader_version,
      memory: instance.memory
    });
    form = {
      name: instance.name || '',
      description: instance.description || '',
      memoryMin: parseMemory(instance.memory?.min || '2048M'),
      memoryMax: parseMemory(instance.memory?.max || '4096M'),
      javaPath: instance.javaPath || '',
      jvmArgs: instance.jvmArgs ? instance.jvmArgs.join(' ') : '',
      gameArgs: instance.gameArgs ? instance.gameArgs.join(' ') : '',
      loaderVersion: instance.loaderVersion || instance.loader_version || 'latest'
    };
    console.log('Form initialized with loaderVersion:', form.loaderVersion);
  }

  async function fetchAvailableLoaderVersions() {
    if (!instance || instance.loader === 'vanilla') return;
    
    loadingLoaderVersions = true;
    try {
      let versions = [];
      const gameVersion = instance.gameVersion || instance.game_version;
      
      // Store the current selection before fetching to preserve it
      const currentSelection = form.loaderVersion;
      console.log('Before fetching versions - current form.loaderVersion:', currentSelection);
      
      switch (instance.loader) {
        case 'fabric':
          versions = await fetchFabricLoaderVersions(gameVersion);
          break;
        case 'forge':
          versions = await fetchForgeLoaderVersions(gameVersion);
          break;
        case 'quilt':
          versions = await fetchQuiltLoaderVersions(gameVersion);
          break;
        case 'neoforge':
          versions = await fetchNeoForgeLoaderVersions(gameVersion);
          break;
        default:
          versions = [];
      }
      
      // Use versions directly
      availableLoaderVersions = versions;
      console.log('Set availableLoaderVersions from API:', availableLoaderVersions.map(v => ({value: v.value, label: v.label})));
      
      // Add 'latest' option at the beginning
      if (availableLoaderVersions.length > 0) {
        console.log('Before adding latest - available versions:', availableLoaderVersions.map(v => ({value: v.value, label: v.label})));
        availableLoaderVersions.unshift({
          value: 'latest',
          label: 'Latest (Use newest available version)'
        });
        
        // Mark the second version (first actual version) as Recommended
        availableLoaderVersions[1].label += ' (Recommended)';
        console.log('Added recommended label to version:', availableLoaderVersions[1].value, 'label:', availableLoaderVersions[1].label);
        console.log('After processing - available versions:', availableLoaderVersions.map(v => ({value: v.value, label: v.label})));
        
        // Only set default selection if user hasn't made a selection and current selection is invalid
      // This preserves user's explicit choice while still providing sensible defaults
      console.log('Checking current form.loaderVersion before validation:', form.loaderVersion);
      const isCurrentSelectionValid = availableLoaderVersions.find(v => v.value === currentSelection);
      console.log('Current selection:', currentSelection, 'Is valid:', isCurrentSelectionValid, 'User selected:', userHasSelectedLoaderVersion);
      console.log('Available versions:', availableLoaderVersions.map(v => v.value));
      if (!isCurrentSelectionValid && !userHasSelectedLoaderVersion) {
          console.log('Setting loaderVersion to latest because current selection is invalid and user has not selected');
          form.loaderVersion = 'latest';
      } else if (userHasSelectedLoaderVersion) {
          console.log('Preserving user selection:', currentSelection);
      } else {
          console.log('Preserving current selection:', currentSelection);
      }
      console.log('Final form.loaderVersion after validation:', form.loaderVersion);
      }
    } catch (error) {
      logger.error(`Error fetching ${instance.loader} loader versions:`, error);
      availableLoaderVersions = [];
    } finally {
      loadingLoaderVersions = false;
    }
  }

  function handleMinMemoryChange(e) {
    form.memoryMin = e.detail.value;
    if (form.memoryMax < form.memoryMin) {
      form.memoryMax = form.memoryMin;
    }
  }

  function handleMaxMemoryChange(e) {
    form.memoryMax = e.detail.value;
    if (form.memoryMax < form.memoryMin) {
      form.memoryMin = form.memoryMax;
    }
  }

  async function save() {
    try {
      const updates = {
        name: form.name,
        description: form.description,
        memory: {
          min: `${form.memoryMin}M`,
          max: `${form.memoryMax}M`
        },
        javaPath: form.javaPath,
        jvmArgs: form.jvmArgs.split(' ').filter(a => a.trim()),
        gameArgs: form.gameArgs.split(' ').filter(a => a.trim())
      };
      
      // Always save loaderVersion if it has a value (including 'latest')
      if (form.loaderVersion) {
        updates.loaderVersion = form.loaderVersion;
      }
      
      console.log('Saving instance settings:', updates);
      dispatch('save', updates);
      close();
    } catch (err) {
      logger.error('Failed to save settings:', err);
      showToast('Failed to save settings', 'error');
    }
  }

  function close() {
    openDropdownId.set(null);
    dispatch('close');
  }
</script>

{#if open && instance}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" on:click|self={close}>
    <div class="modal-content modal-large" on:click|stopPropagation>
      <div class="modal-header">
        <h3>{$t('mainContent.instanceSettings.title', { name: instance.name })}</h3>
        <button class="close-btn btn btn-default" on:click={close}>
          <X size={16} />
        </button>
      </div>

      <div class="modal-body">
        <div class="settings-grid">
          <div class="group-container">
            <div class="setting-group">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label>{$t('mainContent.instanceSettings.basicInfo.instanceName')}</label>
              <input type="text" bind:value={form.name} class="form-input" />
            </div>

            <div class="setting-group full-width">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label>{$t('mainContent.instanceSettings.basicInfo.description')}</label>
              <textarea
                bind:value={form.description}
                class="form-input"
                rows="3"
                placeholder={$t('mainContent.instanceSettings.basicInfo.descriptionPlaceholder')}
              ></textarea>
            </div>

            <div class="setting-group">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label>{$t('mainContent.instanceSettings.gameInfo.gameVersion')}</label>
              <input type="text" value={instance.gameVersion || instance.game_version} readonly class="form-input disabled" />
            </div>

            <div class="setting-group">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label>{$t('mainContent.instanceSettings.gameInfo.loaderType')}</label>
              <input type="text" value={instance.loader} readonly class="form-input disabled" style="text-transform: capitalize;" />
            </div>

            {#if instance.loader !== 'vanilla' && (instance.loaderVersion || instance.loader_version || form.loaderVersion || availableLoaderVersions.length > 0)}
              <div class="setting-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label>{$t('mainContent.instanceSettings.gameInfo.loaderVersion')}</label>
                {#if loadingLoaderVersions}
                  <input type="text" value={$t('mainContent.instanceSettings.gameInfo.loadingVersions')} disabled class="form-input" />
                {:else if availableLoaderVersions.length > 0}
                  <CustomOptions
                    id="loader-version-dropdown"
                    options={availableLoaderVersions}
                    value={form.loaderVersion}
                    preferredPosition="up-left"
                    on:optionchange={(e) => {
                      console.log('User selected loader version:', e.detail.value);
                      userHasSelectedLoaderVersion = true;
                      form.loaderVersion = e.detail.value;
                    }}
                  />
                {:else}
                  <input type="text" bind:value={form.loaderVersion} class="form-input" placeholder="Enter version..." />
                {/if}
              </div>
            {/if}
          </div>
          <div class="setting-group ram-alloc">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label>{$t('mainContent.instanceSettings.memoryAllocation.label')}</label>
            <div class="memory-inputs">
              <RamInput label={$t('mainContent.instanceSettings.memoryAllocation.minimumRam')} bind:value={form.memoryMin} on:change={handleMinMemoryChange} />
              <RamInput label={$t('mainContent.instanceSettings.memoryAllocation.maximumRam')} bind:value={form.memoryMax} on:change={handleMaxMemoryChange} />
            </div>
          </div>
          <div class="setting-group full-width">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label>{$t('mainContent.instanceSettings.javaConfiguration.javaPath')}</label>
            <FolderPicker
              bind:value={form.javaPath}
              label=""
              actionType="pick"
              placeholder={$t('mainContent.instanceSettings.javaConfiguration.javaPathPlaceholder')}
              inputReadOnly={true}
            />
          </div>

          <div class="setting-group full-width">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label>{$t('mainContent.instanceSettings.javaConfiguration.jvmArgs')}</label>
            <input bind:value={form.jvmArgs} class="form-input" placeholder={$t('mainContent.instanceSettings.javaConfiguration.jvmArgsPlaceholder')} />
          </div>

          <div class="setting-group full-width">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label>{$t('mainContent.instanceSettings.javaConfiguration.gameArgs')}</label>
            <input bind:value={form.gameArgs} class="form-input" placeholder={$t('mainContent.instanceSettings.javaConfiguration.gameArgsPlaceholder')} />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-default" on:click={close}>{$t('mainContent.instanceSettings.buttons.cancel')}</button>
        <button class="btn btn-primary" on:click={save}>
          <Save size={16} style="margin-right: 8px;" />
          {$t('mainContent.instanceSettings.buttons.saveChanges')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: var(--surface-color);
    width: 800px;
    height: 550px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--border-color);
  }
  
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background-color: var(--overlay-color);
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h3 {
    margin: 0;
    color: var(--text-color);
    font-size: var(--font-size-base);
  }
  
  .modal-body {
    padding: 10px;
    overflow: hidden;
    overflow-y: auto;
    flex-grow: 1;
  }

  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 15px;
    border-top: 1px solid var(--border-color);
  }
  
  .settings-grid {
    display: flex;
    flex-direction: column;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }
  
  @media (max-width: 768px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }
  }
  
  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0; /* Prevent overflow */
  }
  
  .setting-group.full-width {
    grid-column: 1 / -1;
  }
  
  .setting-group label {
    font-weight: 500;
    color: var(--text-color-muted);
    font-size: var(--font-size-body);
  }
  
  .group-container{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 15px;
    padding: 15px 0;
    border-bottom: 1px solid var(--border-color);
  }

  .setting-group :global(.custom-options) {
    width: 100%;
  }
  
  .memory-inputs {
    display: flex;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }
  
  @media (max-width: 768px) {
    .memory-inputs {
      grid-template-columns: 1fr;
    }
  }
  
  .form-input {
    padding: 10px 12px;
    color: var(--text-color)
  }
  
  .form-input.disabled {
    background: var(--overlay-color);
    color: var(--text-muted);
    cursor: not-allowed;
  }
</style>
