<script>
// @ts-nocheck

  import { createEventDispatcher, onMount } from 'svelte';
  import { openDropdownId } from '../../stores/dropdown.js';
  import CustomOptions from '../ui/Options.svelte';
  import RamInput from '../ui/RamInput.svelte';
  import FolderPicker from '../ui/FolderPicker.svelte';
  import { fetchFabricLoaderVersions, fetchForgeLoaderVersions, fetchQuiltLoaderVersions, fetchNeoForgeLoaderVersions, fetchLoaderGameVersions } from '../../services/api.js';
  import { getCompatibleVersions } from '../../shared/versionManager.js';
  import { getTotalSystemRamGB } from '../../utils/helper.js';
  import { X, Image, Plus } from '@lucide/svelte';
  import { fade, fly } from 'svelte/transition';
  import { t } from '../../stores/i18n.js';
  
  export let open = false;
  
  const dispatch = createEventDispatcher();
  
  let currentStep = 1;
  let totalSteps = 3;
  
  let form = {
    name: '',
    description: '',
    icon: '',
    game_version: '',
    loader: 'vanilla', // Default to vanilla
    loader_version: '',
    memory_min: 1024,
    memory_max: 4096,
    java_path: '',
    java_args: ''
  };

  let iconPreviewUrl = '';

  // Internal list of loaders to ensure we have everything including Vanilla
  const allLoaders = [
    { value: 'vanilla', label: $t('mainContent.instancecreator.loaders.vanilla') },
    { value: 'forge', label: $t('mainContent.instancecreator.loaders.forge') },
    { value: 'neoforge', label: $t('mainContent.instancecreator.loaders.neoforge') },
    { value: 'fabric', label: $t('mainContent.instancecreator.loaders.fabric') },
    { value: 'quilt', label: $t('mainContent.instancecreator.loaders.quilt') }
  ];

  // Available loader versions based on game version and loader type
  let loaderVersions = [];
  
  // Available game versions (dynamic)
  let availableGameVersions = [];
  
  let totalSystemRam = 10; // Default fallback (16GB)

  // Formatted options for CustomOptions components
  $: gameVersionOptions = availableGameVersions.map(version => ({
    value: version.id,
    label: version.id
  }));
  
  // Filtered game versions based on selected loader
  $: filteredGameVersionOptions = gameVersionOptions;

  $: loaderOptions = allLoaders;

  // Load versions on mount
  onMount(async () => {
    updateGameVersions();
    const ramGB = await getTotalSystemRamGB();
    if (ramGB) {
        totalSystemRam = ramGB * 1024; // Convert GB to MB
    }
  });

  // Close all dropdowns when modal closes
  $: if (!open) {
    openDropdownId.set(null);
  }

  // Update game versions when loader changes
  $: if (form.loader) {
    updateGameVersions();
  }

  // Update loader versions when game version or loader changes
  $: if (form.game_version && form.loader && form.loader !== 'vanilla') {
    (async () => {
      await updateLoaderVersions();
    })();
  }

  async function updateGameVersions() {
    // Get all individual versions from versionManager
    const allVersions = getCompatibleVersions('vanilla');
    
    let compatibleVersions = [];
    
    try {
        // Fetch supported game versions for the selected loader dynamically
        const supportedVersions = await fetchLoaderGameVersions(form.loader);
        
        if (supportedVersions === 'all') {
            compatibleVersions = allVersions;
        } else if (Array.isArray(supportedVersions)) {
            // Filter allVersions to only include those in supportedVersions
            const supportedSet = new Set(supportedVersions);
            compatibleVersions = allVersions.filter(v => supportedSet.has(v.id));
        } else {
            console.warn('Unknown supported versions format:', supportedVersions);
            compatibleVersions = allVersions;
        }
    } catch (error) {
        console.error('Error fetching supported game versions:', error);
        compatibleVersions = allVersions;
    }
    
    // Sort versions by release date (newest first) - assuming allVersions is already sorted or we sort manually
    availableGameVersions = compatibleVersions.map(v => ({
        id: v.id,
        type: v.type
    }));
    
    // If current game version is not valid for new loader, reset it
    if (form.game_version && !availableGameVersions.find(v => v.id === form.game_version)) {
        form.game_version = availableGameVersions.length > 0 ? availableGameVersions[0].id : '';
    }
    
    // If no game version selected, select first available
    if (!form.game_version && availableGameVersions.length > 0) {
        form.game_version = availableGameVersions[0].id;
    }
  }

  async function updateLoaderVersions() {
    if (!form.game_version || !form.loader || form.loader === 'vanilla') {
      loaderVersions = [];
      form.loader_version = '';
      return;
    }

    try {
      let versions = [];
      
      // Fetch loader versions based on loader type
      switch (form.loader) {
        case 'fabric':
          versions = await fetchFabricLoaderVersions(form.game_version);
          break;
        case 'forge':
          versions = await fetchForgeLoaderVersions(form.game_version);
          break;
        case 'quilt':
          versions = await fetchQuiltLoaderVersions(form.game_version);
          break;
        case 'neoforge':
          versions = await fetchNeoForgeLoaderVersions(form.game_version);
          break;
        default:
          versions = [];
      }
      
      // Use versions directly - do not add "latest" option to ensure specific version is selected
      loaderVersions = versions;

      // Mark the first version as Recommended
      if (loaderVersions.length > 0) {
        loaderVersions[0].label += $t('mainContent.instancecreator.versionSuffix.recommended');
      }

      // Set default loader version if not set or invalid
      if (!form.loader_version || !loaderVersions.find(v => v.value === form.loader_version)) {
        // Default to first available version (usually newest/recommended)
        form.loader_version = loaderVersions.length > 0 ? loaderVersions[0].value : '';
      }
    } catch (error) {
      console.error(`Error fetching ${form.loader} loader versions for ${form.game_version}:`, error);
      loaderVersions = [];
      form.loader_version = '';
    }
  }

  function close() {
    // Close any open dropdowns
    openDropdownId.set(null);
    dispatch('close');
    resetForm();
  }

  function resetForm() {
    currentStep = 1;
    form = {
      name: '',
      description: '',
      icon: '',
      game_version: '',
      loader: 'vanilla',
      loader_version: '',
      memory_min: 2048,
      memory_max: 4096,
      java_path: '',
      java_args: ''
    };
    iconPreviewUrl = '';
  }

  function nextStep() {
    if (currentStep < totalSteps) {
      // Close any open dropdowns before changing steps
      openDropdownId.set(null);
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      // Close any open dropdowns before changing steps
      openDropdownId.set(null);
      currentStep--;
    }
  }

  function submit() {
    if (!form.name?.trim()) {
      dispatch('error', { message: $t('mainContent.instancecreator.errors.instanceNameRequired') });
      return;
    }

    const instanceData = {
      name: form.name.trim(),
      gameVersion: form.game_version,
      loader: form.loader,
      loaderVersion: form.loader_version,
      description: form.description,
      memoryMin: form.memory_min,
      memoryMax: form.memory_max,
      customJavaPath: form.java_path,
      jvmArgs: form.java_args,
      icon: form.icon
    };

    dispatch('submit', instanceData);
  }

  function handleGameVersionChange(e) {
    form.game_version = e.detail.value;
    // Reset loader version when game version changes
    form.loader_version = '';
  }

  function handleLoaderChange(e) {
    form.loader = e.detail.value;
    // Reset game version and loader version when loader changes
    form.game_version = '';
    form.loader_version = '';
  }

  function handleLoaderVersionChange(e) {
    form.loader_version = e.detail.value;
  }

  function handleMinMemoryChange(e) {
    form.memory_min = e.detail.value;
    // Ensure max memory is not less than min memory
    if (form.memory_max < form.memory_min) {
      form.memory_max = form.memory_min;
    }
  }

  function handleMaxMemoryChange(e) {
    form.memory_max = e.detail.value;
    // Ensure max memory is not less than min memory
    if (form.memory_max < form.memory_min) {
      form.memory_min = form.memory_max;
    }
  }

  function handleIconSelect(e) {
    form.icon = e.detail;
  }

  function handleIconChange(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        form.icon = event.target.result;
        iconPreviewUrl = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  $: canProceedToNextStep = (() => {
    switch (currentStep) {
      case 1:
        const valid = form.name.trim().length > 0;
        return valid;
      case 2:
        // For vanilla: only need game_version and loader
        // For other loaders: need game_version, loader, and loader_version
        // Also need valid memory settings
        const valid2 = form.game_version && form.loader && 
          (form.loader === 'vanilla' || form.loader_version) &&
          form.memory_min > 0 && form.memory_max > 0;
        return valid2;
      case 3:
        // Overview step - always valid since all validation is done in step 2
        return true;
      default:
        return true;
    }
  })();
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" on:click|self={close} transition:fade={{ duration: 120 }}>
    <div
      class="modal-content"
      transition:fly={{ x: 40, duration: 160, opacity: 0.9 }}
    >
      <div class="modal-header">
        <h3>{$t('mainContent.instancecreator.title')}</h3>
        <button class="close-btn btn btn-default" on:click={close}>
          <X size={20} />
        </button>
      </div>
      <div class="model-content-container">
        <!-- Progress Steps -->
        <div class="progress-steps">
          <div class="step-indicator">
            {#each Array(totalSteps) as _, i}
              <div class="step {currentStep >= i + 1 ? 'active' : ''}">
                <div class="step-number">{i + 1}</div>
                <div class="step-label">
                  {i === 0 ? $t('mainContent.instancecreator.steps.basicInfo') : i === 1 ? $t('mainContent.instancecreator.steps.gameConfiguration') : $t('mainContent.instancecreator.steps.overview')}
                </div>
              </div>
              {#if i < totalSteps - 1}
                <div class="step-connector {currentStep > i + 1 ? 'completed' : ''}"></div>
              {/if}
            {/each}
          </div>
        </div>

        <div class="modal-body">
          <!-- Step 1: Basic Info -->
          {#if currentStep === 1}
            <div class="step-content">
              <p class="step-description">{$t('mainContent.instancecreator.step1.description')}</p>
              <div class="form-group">
                <label for="#">{$t('mainContent.instancecreator.step1.iconLabel')}</label>
                <div class="icon-selector">
                  {#if form.icon || iconPreviewUrl}
                    <div class="icon-preview">
                      <img src={iconPreviewUrl || `file://${form.icon}`} alt="Instance Icon" />
                      <button class="remove-icon" on:click={() => { form.icon = ''; iconPreviewUrl = ''; }}>
                        <X size={16} />
                      </button>
                    </div>
                  {:else}
                    <label for="icon-selector" class="icon-placeholder">
                      <Image size={24} strokeWidth={2} />
                      <span>{$t('mainContent.instancecreator.step1.noIconSelected')}</span>
                    </label>
                  {/if}
                  <input
                    type="file"
                    name="icon"
                    id="icon-selector"
                    hidden
                    accept="image/*"
                    on:change={handleIconChange}
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="instance-name">{$t('mainContent.instancecreator.step1.instanceNameLabel')}</label>
                <input
                  id="instance-name"
                  type="text"
                  bind:value={form.name}
                  placeholder={$t('mainContent.instancecreator.step1.instanceNamePlaceholder')}
                  required
                />
              </div>

              <div class="form-group">
                <label for="description">{$t('mainContent.instancecreator.step1.descriptionLabel')}</label>
                <textarea
                  id="description"
                  bind:value={form.description}
                  placeholder={$t('mainContent.instancecreator.step1.descriptionPlaceholder')}
                  rows="2"
                ></textarea>
              </div>
            </div>
          {/if}

          <!-- Step 2: Game Configuration -->
          {#if currentStep === 2}
            <div class="step-content">
              <p class="step-description">{$t('mainContent.instancecreator.step2.description')}</p>
              <div class="group-header">{$t('mainContent.instancecreator.step2.gameConfigurationGroup')}</div>
              <div class="game-version-selection-container">
                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label>{$t('mainContent.instancecreator.step2.loaderTypeLabel')}</label>
                  <CustomOptions
                    id="loader-type-dropdown"
                    options={loaderOptions}
                    value={form.loader}
                    on:optionchange={handleLoaderChange}
                    preferredPosition="down-left"
                  />
                </div>
                <div class="form-group">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label>{$t('mainContent.instancecreator.step2.gameVersionLabel')}</label>
                  <CustomOptions
                    id="game-version-dropdown"
                    options={filteredGameVersionOptions}
                    value={form.game_version}
                    on:optionchange={handleGameVersionChange}
                    preferredPosition="down-left"
                    disabled={!form.loader}
                  />
                </div>
                {#if form.loader !== 'vanilla'}
                  <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>{$t('mainContent.instancecreator.step2.loaderVersionLabel')}</label>
                    <CustomOptions
                      id="loader-version-dropdown"
                      options={loaderVersions}
                      value={form.loader_version}
                      on:optionchange={handleLoaderVersionChange}
                      preferredPosition="down-left"
                      disabled={!form.game_version || !form.loader}
                    />
                  </div>
                {/if}
              </div>

              <div class="group-header">{$t('mainContent.instancecreator.step2.memoryAllocationGroup')}</div>
              <div class="form-row ram-input-row">
                <div class="form-group ram-input-group">
                  <RamInput
                    value={form.memory_min}
                    minRam={1024}
                    maxRam={totalSystemRam}
                    label={$t('mainContent.instancecreator.step2.minimumRamLabel')}
                    step={512}
                    on:change={handleMinMemoryChange}
                  />
                  <RamInput
                    value={form.memory_max}
                    minRam={1024}
                    maxRam={totalSystemRam}
                    label={$t('mainContent.instancecreator.step2.maximumRamLabel')}
                    step={512}
                    on:change={handleMaxMemoryChange}
                  />
                </div>
              </div>

              <div class="group-header">{$t('mainContent.instancecreator.step2.javaConfigurationGroup')}</div>
              <div class="form-group">
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label>{$t('mainContent.instancecreator.step2.javaPathLabel')}</label>
                <FolderPicker
                  bind:value={form.java_path}
                  label=""
                  actionType="pick"
                  placeholder={$t('mainContent.instancecreator.step2.javaPathPlaceholder')}
                  inputReadOnly={true}
                />
              </div>

              <div class="form-group">
                <label for="java-args">{$t('mainContent.instancecreator.step2.javaArgsLabel')}</label>
                <input
                  id="java-args"
                  type="text"
                  bind:value={form.java_args}
                  placeholder={$t('mainContent.instancecreator.step2.javaArgsPlaceholder')}
                />
              </div>
            </div>
          {/if}

          <!-- Step 3: Overview -->
          {#if currentStep === 3}
            <div class="step-content">
              <p class="step-description">{$t('mainContent.instancecreator.step3.description')}</p>

              <div class="overview-section">
                <div class="overview-group">
                  <h5>{$t('mainContent.instancecreator.step3.basicInformationGroup')}</h5>
                  <div class="overview-item">
                    <span class="label">{$t('mainContent.instancecreator.step3.nameLabel')}</span>
                    <span class="value">{form.name || $t('mainContent.instancecreator.step3.notSet')}</span>
                  </div>
                  {#if form.description}
                    <div class="overview-item">
                      <span class="label">{$t('mainContent.instancecreator.step3.descriptionLabel')}</span>
                      <span class="value">{form.description}</span>
                    </div>
                  {/if}
                  <div class="overview-item">
                    <span class="label">{$t('mainContent.instancecreator.step3.iconLabel')}</span>
                    <span class="value">{form.icon || iconPreviewUrl ? $t('mainContent.instancecreator.step3.customIconSet') : $t('mainContent.instancecreator.step3.defaultIcon')}</span>
                  </div>
                </div>

                <div class="overview-group">
                  <h5>{$t('mainContent.instancecreator.step3.gameConfigurationGroup')}</h5>
                  <div class="overview-item">
                    <span class="label">{$t('mainContent.instancecreator.step3.gameVersionLabel')}</span>
                    <span class="value">{form.game_version || $t('mainContent.instancecreator.step3.notSet')}</span>
                  </div>
                  <div class="overview-item">
                    <span class="label">{$t('mainContent.instancecreator.step3.modLoaderLabel')}</span>
                    <span class="value">{form.loader ? form.loader.charAt(0).toUpperCase() + form.loader.slice(1) : $t('mainContent.instancecreator.step3.notSet')}</span>
                  </div>
                  {#if form.loader !== 'vanilla' && form.loader_version}
                    <div class="overview-item">
                      <span class="label">{$t('mainContent.instancecreator.step3.loaderVersionLabel')}</span>
                      <span class="value">{form.loader_version}</span>
                    </div>
                  {/if}
                  <div class="overview-item">
                    <span class="label">{$t('mainContent.instancecreator.step3.memoryLabel')}</span>
                    <span class="value">{form.memory_min}M - {form.memory_max}M</span>
                  </div>
                </div>

                {#if form.java_path || form.java_args}
                  <div class="overview-group">
                    <h5>{$t('mainContent.instancecreator.step3.javaConfigurationGroup')}</h5>
                    {#if form.java_path}
                      <div class="overview-item">
                        <span class="label">{$t('mainContent.instancecreator.step3.customJavaPathLabel')}</span>
                        <span class="value">{form.java_path}</span>
                      </div>
                    {/if}
                    {#if form.java_args}
                      <div class="overview-item">
                        <span class="label">{$t('mainContent.instancecreator.step3.javaArgsLabel')}</span>
                        <span class="value">{form.java_args}</span>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <div class="modal-footer">
          <button class="btn btn-default" on:click={currentStep === 1 ? close : prevStep}>
            {currentStep === 1 ? $t('mainContent.instancecreator.buttons.cancel') : $t('mainContent.instancecreator.buttons.previous')}
          </button>

          {#if currentStep < totalSteps}
            <button
              class="btn btn-primary"
              on:click={nextStep}
              disabled={!canProceedToNextStep}
            >
              {$t('mainContent.instancecreator.buttons.next')}
            </button>
          {:else}
            <button class="btn btn-primary" on:click={submit}>
              {$t('mainContent.instancecreator.buttons.createInstance')}
            </button>
          {/if}
        </div>
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
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: var(--surface-color);
    width: 800px;
    height: 560px;
    overflow-y: auto;
    border: 2px solid var(--border-color);
    border-bottom-width: 5px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .modal-header {
    padding: 15px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: color-mix(in srgb, var(--overlay-color-1), transparent 60%);
    -webkit-app-region: no-drag;
  }
  .model-content-container{
    overflow: hidden;
    overflow-y: auto !important;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
  }
  
  .modal-header h3 {
    margin: 0;
    color: var(--text-color);
    font-size: var(--font-size-base);
  }
  
  .progress-steps {
    padding-block: 20px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .step-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }
  
  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  
  .step-number {
    width: 25px;
    height: 25px;
    background: var(--overlay-color-1);
    color: var(--text-color-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-sm);
    transition: all 0.2s;
    box-shadow: 0 0 0 2px var(--overlay-color-2);
  }
  
  .step.active .step-number {
    background: var(--accent-color);
    box-shadow: 0 0 0 2px var(--accent-color-light);
    color: #ffffff;
  }
  
  .step-label {
    font-size: var(--font-size-sm);
    color: var(--text-color-muted);
    text-align: center;
  }
  
  .step.active .step-label {
    color: var(--text-color);
  }
  
  .step-connector {
    width: 40px;
    height: 2px;
    background: var(--overlay-color);
    transition: background 0.2s;
  }
  
  .step-connector.completed {
    background: var(--accent-color);
  }
  
  .modal-body {
    padding-block: 10px;
    overflow-y: auto;
    flex-grow: 1;
    padding-inline: 10px;
  }

  .step-description {
    color: var(--text-color-muted);
    font-size: var(--font-size-body);
    margin-bottom: 1.5rem;
    border: 1px dashed var(--border-color);
    padding: 0.75rem;
    background: color-mix(in srgb, var(--base-color), transparent 80%);
    line-height: 1.5;
  }
  
  .group-header {
    font-size: var(--font-size-body);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-color-muted);
    margin-top: 1.5rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .game-version-selection-container{
    display: flex;
    column-gap: 20px;
  }
  .form-group {
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    justify-content: start;
  }

  .ram-input-group{
    flex-direction: row;
    column-gap: 20px;
    align-items: start !important;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-color);
    font-size: var(--font-size-body);
  }
  
  .form-group input,
  .form-group textarea {
    padding: 10px 10px;
    background: var(--base-color);
    color: var(--text-color);
    font-size: var(--font-size-body);
    font-family: inherit !important;
    flex-grow: 1;
  }

  textarea{
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    padding: 10px 12px;
    color: var(--text-color);
    font-size: var(--font-size-body);
    min-height: 80px;
    resize: none;
    font-family: inherit;
  }

  .icon-selector {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .icon-preview {
    position: relative;
    width: 85px;
    height: 85px;
    border: 2px solid var(--border-color);
    border-left-width: 4px;
  }
  
  .icon-preview img {
    width: 100%;
    height: 100%;
    overflow: hidden;
    object-fit: cover;
  }
  
  .remove-icon {
    position: absolute;
    top: -8px;
    right: -8px;
    background: var(--error-color);
    color: white;
    border: none;
    padding-inline: 1px;
    display: flex !important;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 1px solid var(--error-color-light);
  }
  
  .icon-placeholder {
    width: 64px;
    height: 64px;
    border: 2px dashed var(--border-color);
    display: flex !important;
    flex-direction: column !important;
    align-items: center;
    justify-content: center;
    color: var(--text-color-muted) !important;
    padding: 10px;
    gap: 10px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover{
      border-color: var(--accent-color);
    }
    &:active{
      border-color: var(--border-color);
    }
  }

  .icon-placeholder span{
    text-align: center;
    font-size: var(--font-size-body) !important;
    color: var(--text-color-muted) !important;
  }
  
  .modal-footer {
    padding: 15px;
    border-top: 1px solid var(--border-color);
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }
  
  .btn{
    padding: 10px 25px;
  }

  /* Overview Styles */
  .overview-section {
    background: var(--surface-color);
    padding: 10px;
    border: 1px solid var(--border-color);
    border-left-width: 5px;
  }
  
  .overview-group {
    margin-bottom: 1.5rem;
  }
  
  .overview-group:last-child {
    margin-bottom: 0;
  }
  
  .overview-group h5 {
    margin: 0 0 1rem 0;
    color: var(--text-color);
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .overview-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color-subtle);
  }
  
  .overview-item:last-child {
    border-bottom: none;
  }
  
  .overview-item .label {
    color: var(--text-color-muted);
    font-size: var(--font-size-body);
  }
  
  .overview-item .value {
    color: var(--text-color);
    font-size: var(--font-size-body);
    text-align: right;
    max-width: 60%;
    word-break: break-word;
  }
</style>
