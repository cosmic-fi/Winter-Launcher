<script>
  // @ts-nocheck
  import { onMount } from 'svelte';
  import { Plus, TriangleAlert, Inbox, ArrowLeft, Play, StopCircle, Info, Puzzle, Image as ImageIcon, Lightbulb, Trash2, Loader2, FolderOpen, Settings, BoxIcon, Box, Square, ToolCase, Palette, PencilRuler } from '@lucide/svelte';
  import { get } from 'svelte/store';
  import { instanceStore, instances, instancesLoading, instancesError, activeInstance } from '../stores/instances';
  import { closeDialog, showToast, uiState, showDialog } from '../stores/ui';
  import { breadcrumbStore } from '../stores/breadcrumb';
  import CustomOptions from '../components/ui/Options.svelte';
  import FolderPicker from '../components/ui/FolderPicker.svelte';
  import InstanceSettingsRestrictedModal from '../components/modal/InstanceSettingsModal.svelte';
  import InstanceModBrowser from '../components/ui/InstanceModBrowser.svelte';
  import InstanceResourcePackBrowser from '../components/ui/InstanceResourcePackBrowser.svelte';
  import InstanceShaderBrowser from '../components/ui/InstanceShaderBrowser.svelte';
  import ToggleButton from '../components/ui/ToggleButton.svelte';
  import Pagination from '../components/ui/Pagination.svelte';
  import { isLaunching, launchButtonText, launchStatus, canLaunch, launchActions, runningInstancesList, getInstanceLaunchStatus, instanceLaunchStates } from '../stores/launch';
  import { getSelectedAccount } from '../shared/user';
  import { settings } from '../stores/settings';
  import { gameLauncher } from '../services/gameLauncher';
  import modrinthService from '../services/modrinthService';
  import SimpleTip from '../components/ui/Tip.svelte';
  import { fade } from 'svelte/transition';
  import { t } from '../stores/i18n';
  import Dialog from '../components/modal/Dialog.svelte';
  import Preloader from '../components/ui/Preloader.svelte';
  
  const { activeModal } = uiState;

  let selectedInstance = null;
  let activeTab = 'overview';
  let showDeleteModal = false;
  let instanceToDelete = null;
  let viewMode = 'details';
  let headerAction = 'none';
  let lastLoadedInstanceId = null;
  let currentInstanceLaunchStatus = null;

  // Pagination state
  let itemsPerPage = 10;
  let modsPage = 1;
  let resourcePacksPage = 1;
  let shadersPage = 1;

  $: paginatedMods = selectedInstance?.mods?.slice((modsPage - 1) * itemsPerPage, modsPage * itemsPerPage) || [];
  $: totalModsPages = Math.ceil((selectedInstance?.mods?.length || 0) / itemsPerPage) || 1;
  
  $: paginatedResourcePacks = selectedInstance?.resourcePacks?.slice((resourcePacksPage - 1) * itemsPerPage, resourcePacksPage * itemsPerPage) || [];
  $: totalResourcePacksPages = Math.ceil((selectedInstance?.resourcePacks?.length || 0) / itemsPerPage) || 1;
  
  $: paginatedShaders = selectedInstance?.shaders?.slice((shadersPage - 1) * itemsPerPage, shadersPage * itemsPerPage) || [];
  $: totalShadersPages = Math.ceil((selectedInstance?.shaders?.length || 0) / itemsPerPage) || 1;

  $: if (selectedInstance?.id && selectedInstance.id !== lastLoadedInstanceId) {
      modsPage = 1;
      resourcePacksPage = 1;
      shadersPage = 1;
      lastLoadedInstanceId = selectedInstance.id;
  }

  function scrollToTop() {
    // Scroll to the top of the instance details section for better UX
    const detailsElement = document.querySelector('.instance-details');
    if (detailsElement) {
      detailsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Fallback: scroll to top of page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function changePage(type, delta) {
      let pageChanged = false;
      
      if (type === 'mods') {
          const newPage = modsPage + delta;
          if (newPage >= 1 && newPage <= totalModsPages) {
              modsPage = newPage;
              pageChanged = true;
          }
      } else if (type === 'resourcepacks') {
          const newPage = resourcePacksPage + delta;
          if (newPage >= 1 && newPage <= totalResourcePacksPages) {
              resourcePacksPage = newPage;
              pageChanged = true;
          }
      } else if (type === 'shaders') {
          const newPage = shadersPage + delta;
          if (newPage >= 1 && newPage <= totalShadersPages) {
              shadersPage = newPage;
              pageChanged = true;
          }
      }
      
      // Scroll to top if page actually changed
      if (pageChanged) {
          scrollToTop();
      }
  }

  $: headerActionOptions = selectedInstance ? [
    { value: 'open-folder', label: $t('mainContent.instances.header.openFolder'), icon: FolderOpen },
    { value: 'settings', label: $t('mainContent.instances.header.settings'), icon: Settings },
    { type: 'separator' },
    { value: 'delete', label: $t('mainContent.instances.header.delete'), type: 'danger', icon: Trash2 },
  ] : [];
  
  const tabs = [
    { id: 'overview', label: $t('mainContent.instances.tabs.overview'), icon: Info },
    { id: 'mods', label: $t('mainContent.instances.tabs.mods'), icon: ToolCase },
    { id: 'resourcepacks', label: $t('mainContent.instances.tabs.resourcepacks'), icon: Palette },
    { id: 'shaders', label: $t('mainContent.instances.tabs.shaders'), icon: PencilRuler }
  ];
  
  onMount(async () => {
    breadcrumbStore.reset();
    await settings.init();
    await loadInstances();
  });
  
  async function loadInstances() {
    try {
      await instanceStore.loadInstances();
    } catch (error) {
      console.error('Failed to load instances:', error);
    }
  }

  async function saveSettings(updates) {
    console.log('saveSettings received updates:', updates);
    try {
        // Transform the data from modal format to database format
        const dbUpdates = {};
        
        // Map the fields correctly
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.description !== undefined) dbUpdates.description = updates.description;
        if (updates.memory?.min !== undefined) {
            // Convert memory string like "512M" to integer
            const minMemory = parseInt(updates.memory.min.replace('M', ''));
            if (!isNaN(minMemory)) dbUpdates.memory_min = minMemory;
        }
        if (updates.memory?.max !== undefined) {
            // Convert memory string like "2048M" to integer
            const maxMemory = parseInt(updates.memory.max.replace('M', ''));
            if (!isNaN(maxMemory)) dbUpdates.memory_max = maxMemory;
        }
        if (updates.javaPath !== undefined) dbUpdates.java_path = updates.javaPath;
        if (updates.jvmArgs !== undefined) dbUpdates.jvm_args = updates.jvmArgs.join(',');
        if (updates.gameArgs !== undefined) dbUpdates.game_args = updates.gameArgs.join(',');
        if (updates.loaderVersion !== undefined) dbUpdates.loader_version = updates.loaderVersion;
        
        // Only update if there are valid fields
        if (Object.keys(dbUpdates).length > 0) {
            console.log('Saving to database:', dbUpdates);
            await instanceStore.updateInstance(selectedInstance.id, dbUpdates);
            
            // Force update selectedInstance with the transformed data
                selectedInstance = { 
                    ...selectedInstance, 
                    ...dbUpdates,
                    memory: updates.memory || selectedInstance.memory,
                    loaderVersion: updates.loaderVersion || selectedInstance.loaderVersion,
                    description: updates.description ?? selectedInstance.description,
                    gameArgs: updates.gameArgs || selectedInstance.gameArgs
                };
            console.log('Updated selectedInstance:', {
                id: selectedInstance.id,
                name: selectedInstance.name,
                loaderVersion: selectedInstance.loaderVersion,
                loader_version: selectedInstance.loader_version
            });
        } else {
            showToast($t('mainContent.instances.toasts.noValidSettingsToSave'), 'warning');
        }
        
        closeSettingsModal();
    } catch (err) {
        console.error('Failed to save settings:', err);
        showToast($t('mainContent.instances.toasts.failedToSaveSettings'), 'error');
    }
  }

  function setInstanceTab(tabId) {
    activeTab = tabId;
    breadcrumbStore.updateContext({ instanceTab: tabId });
  }
  
  function selectInstance(instance) {
    selectedInstance = instance;
    activeTab = 'overview';
    
    // Update breadcrumb context with instance name
    breadcrumbStore.reset();
    if (instance) {
      breadcrumbStore.updateContext({ 
        instanceName: instance.name,
        instanceTab: activeTab 
      });
    }
    
    // Reset launch state when switching instances to prevent stale UI
    // The launch state should reflect the current instance's actual status
    if (instance) {
      // Check if this instance is currently running
      const isInstanceRunning = get(runningInstancesList).some(item => item.id === instance.id);
      
      // If the instance is not running, reset the global launch state
      // This prevents showing "preparing" or other launch states from previous instances
      if (!isInstanceRunning) {
        launchActions.reset();
      }
    }
  }
  
  // Reactive: Update current instance launch status when selected instance changes
  $: if (selectedInstance) {
    currentInstanceLaunchStatus = getInstanceLaunchStatus(selectedInstance.id);
  } else {
    currentInstanceLaunchStatus = null;
  }
  
  function openCreateModal() {
    activeModal.set('instancecreator');
  }
  
  function handleDeleteInstance(instance) {
    instanceToDelete = instance;
    showDeleteModal = true;
  }
  
  function deselectInstance() {
    selectedInstance = null;
    activeTab = 'overview';
    breadcrumbStore.reset();
  }
  
  function closeDeleteModal() {
    showDeleteModal = false;
  }
  
  function closeSettingsModal() {
    activeModal.set('none');
  }
  
  async function deleteInstance() {
    if (!instanceToDelete) return;

    try {
      await instanceStore.deleteInstance(instanceToDelete.id);
      if (selectedInstance?.id === instanceToDelete.id) {
        selectedInstance = null;
      }
      closeDeleteModal();
      showToast($t('mainContent.instances.toasts.instanceDeletedSuccessfully'), "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }
  
  async function launchInstance() {
    if (!selectedInstance) return;
    
    try {
      await gameLauncher.launchInstance(selectedInstance);
    } catch (error) {
      // Error handling is already done in the service
      console.error('Launch failed:', error);
    }
  }
  
  async function cancelLaunch() {
    if (selectedInstance) {
        await gameLauncher.cancelLaunch(selectedInstance.id);
    }
  }
  
  async function handleHeaderActionChange(e) {
    const value = e.detail.value;
    
    if (value === 'none') return;
    switch (value) {
      case 'open-folder':
        try {
          if (selectedInstance?.path) {
            const res = await window.electron.invoke?.('open-folder-in-explorer', selectedInstance.path);
            if (res?.success === false) throw new Error(res.error || 'Failed to open folder');
          } else {
            showToast($t('mainContent.instances.toasts.instanceFolderNotSet'), 'warn');
          }
        } catch (err) {
          showToast(err.message || $t('mainContent.instances.toasts.failedToOpenFolder'), 'error');
        }
        break;
      case 'settings':
        activeModal.set('instancesettings');
        break;
      case 'delete':
        if (selectedInstance) {
          handleDeleteInstance(selectedInstance);
        }
        break;
    }
    headerAction = 'none';
  }
  
  function formatDate(dateString) {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  }
  
  function formatMemory(bytes) {
    if (!bytes) return '0 MB';
    return `${Math.round(bytes / 1024)} MB`;
  }
  
  function getInstanceStatus(instance) {
    if ($activeInstance?.id === instance.id) return 'active';
    if (instance.last_played) return 'played';
    return 'new';
  }
  
  function getStatusColor(status) {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'played': return '#2196F3';
      default: return '#9E9E9E';
    }
  }

  // Reactive statement to select first instance if none selected
  $: if (!$instancesLoading && $instances.length > 0 && !selectedInstance) {
    selectedInstance = $instances[0];
  }
  // Ensure details area waits for sidebar data to finish loading
  $: if ($instancesLoading) {
    selectedInstance = null;
  }

  $: if (selectedInstance && selectedInstance.id && selectedInstance.id !== lastLoadedInstanceId) {
    const id = selectedInstance.id;
    (async () => {
      await instanceStore.loadInstanceResourcePacks(id);
      await instanceStore.loadInstanceMods(id);
      await instanceStore.loadInstanceShaders(id);
      lastLoadedInstanceId = id;
    })();
  }

  function openModsBrowse() {
    viewMode = 'browse-mods';
  }
  function openResourcePacksBrowse() {
    viewMode = 'browse-resourcepacks';
  }
  function openShadersBrowse() {
    viewMode = 'browse-shaders';
  }
  $: if (selectedInstance) {
    const updated = $instances.find(i => i.id === selectedInstance.id);
    if (updated) selectedInstance = updated;
  }
</script>

<div class="instances-page">
  <!-- Left Panel: Compact Instance List -->
  <div class="instances-sidebar">
    <div class="sidebar-header">
      <h3>{$t('mainContent.instances.sidebar.title')}</h3>
      <div class="header-actions">
        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button class="btn btn-primary btn-sm" on:click={openCreateModal}>
          <Plus size={16} />
        </button>
      </div>
    </div>

    {#if $instancesLoading}
      <Preloader />
    {:else if $instancesError}
      <div class="error-message">
        <TriangleAlert size={16} />
        <span>{$instancesError}</span>
      </div>
    {:else if $instances.length === 0}
      <div class="empty-state">
        <Inbox size={40} />
        <p>{$t('mainContent.instances.sidebar.noInstancesFound')}</p>
      </div>
    {:else}
      <div class="instance-list">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        {#each $instances as instance}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div 
            class="instance-item {selectedInstance?.id === instance.id ? 'selected' : ''}"
            on:click={() => selectInstance(instance)}
          >
            <div class="instance-icon">
              <img src={instance.icon || './images/static/vanilla.png'} alt={instance.name} />
            </div>
            <div class="instance-info">
              <div class="instance-name">{instance.name}</div>
              <div class="instance-meta">
                <span class="version">{instance.gameVersion}</span>
                <span class="loader" style="text-transform: capitalize;">{instance.loader}</span>
              </div>
            </div>
            {#if $instanceLaunchStates[instance.id]?.isLaunching || 
                  $runningInstancesList.some(i => i.id === instance.id)}
              <span class="active-instance-indicator"></span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
  
  <!-- Right Panel: Instance Details with Tabs -->
  <div class="instance-details" style="background-image: linear-gradient(to bottom, 
      color-mix(in srgb, var(--surface-color), transparent 10%), 
      color-mix(in srgb, var(--surface-color), transparent 3%),
      color-mix(in srgb, var(--surface-color), transparent 0%)
    ), url('{selectedInstance?.icon ? (selectedInstance.icon.startsWith('http') || selectedInstance.icon.startsWith('data:') ? selectedInstance.icon : `file://${selectedInstance.icon.replace(/\\/g, '/')}`) : './images/static/plain.jpeg'}');">
    {#if $instancesLoading}
      <Preloader />
    {:else if selectedInstance}
      <div class="details-header">
        <div class="header-info">
          {#if viewMode !== 'details'}
          <!-- s!velte-ignore a11y_consider_explicit_label -->
          <button class="btn-back btn btn-default" on:click={() => { viewMode = 'details'; }}>
            <ArrowLeft size={16} />
          </button>
          {/if}
          <div class="header-name-info-container">
            <h2>{selectedInstance.name}</h2>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary launch-btn" on:click={launchInstance} class:busy={!$currentInstanceLaunchStatus.canLaunch} disabled={!$currentInstanceLaunchStatus.canLaunch} aria-label="Launch">
            {#if $currentInstanceLaunchStatus.isLaunching}
              <Loader2 size={16} class="animate-spin" />
              <span class="download-progress" style="width: {$currentInstanceLaunchStatus.progress}%"></span>
            {:else}
              <Play size={16} />
            {/if}
            {$currentInstanceLaunchStatus.buttonText}
          </button>
          {#if $currentInstanceLaunchStatus.isLaunching}
            <span class="download-logs" transition:fade>
              {$currentInstanceLaunchStatus.progressText}
            </span>
          {/if}
          {#if $currentInstanceLaunchStatus.isLaunching || $currentInstanceLaunchStatus.isRunning}
            <SimpleTip direction="bottom" text="Cancel">
              <button class="btn btn-danger" on:click={cancelLaunch} aria-label="Cancel Launch">
                <Square size={16} />
              </button>
            </SimpleTip>
          {/if}
          <span class="line"></span>
          {#if headerActionOptions.length > 0}
            <CustomOptions
              id="instance-header-actions"
              options={headerActionOptions}
              value={headerAction}
              iconOnly={true}
              preferredPosition="down-right"
              on:optionchange={handleHeaderActionChange}
            />
          {/if}
        </div>
      </div>
      
      {#if viewMode === 'details'}
        <div class="tabs-container">
          <div class="tabs">
            {#each tabs as tab}
              <button 
                class="tab {activeTab === tab.id ? 'active' : ''}"
                on:click={() => setInstanceTab(tab.id)}
              >
                <svelte:component this={tab.icon} size={18} />
                <span>{tab.label}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
      
      <!-- Tab Content -->
      <div class="tab-content">
        {#if viewMode !== 'details'}
          {#if viewMode === 'browse-mods'}
            <InstanceModBrowser instance={selectedInstance} />
          {:else if viewMode === 'browse-resourcepacks'}
            <InstanceResourcePackBrowser instance={selectedInstance} />
          {:else if viewMode === 'browse-shaders'}
            <InstanceShaderBrowser instance={selectedInstance} />
          {/if}
        {:else if activeTab === 'overview'}
          <div class="overview-section tab-section">
            <div class="info-grid">
              <div class="info-card">
                <div class="info-item">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label>{$t('mainContent.instances.overview.gameVersion')}</label>
                  <span>{selectedInstance.gameVersion}</span>
                </div>
                <div class="info-item">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label>{$t('mainContent.instances.overview.loader')}</label>
                  <span style="text-transform: capitalize;">{selectedInstance.loader}</span>
                </div>
                {#if selectedInstance.loaderVersion}
                  <div class="info-item">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>{$t('mainContent.instances.overview.loaderVersion')}</label>
                    <span>{selectedInstance.loaderVersion}</span>
                  </div>
                {/if}
                <div class="info-item">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label>{$t('mainContent.instances.overview.created')}</label>
                  <span>{formatDate(selectedInstance.createdAt)}</span>
                </div>
              </div>

              <div class="info-card">
                <div class="info-item">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label>{$t('mainContent.instances.overview.lastPlayed')}</label>
                  <span>{formatDate(selectedInstance.lastPlayed)}</span>
                </div>
                {#if selectedInstance.memory}
                  <div class="info-item">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label>{$t('mainContent.instances.overview.memory')}</label>
                    <span>{typeof selectedInstance.memory === 'object' ? `${selectedInstance.memory.min} - ${selectedInstance.memory.max}` : selectedInstance.memory}</span>
                  </div>
                {/if}
                <div class="info-item">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label>{$t('mainContent.instances.overview.javaPath')}</label>
                  <span>{selectedInstance.javaPath || $t('mainContent.instances.overview.autoDetected')}</span>
                </div>
              </div>

              <div class="info-card">
                <div class="info-item">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label>{$t('mainContent.instances.overview.installedMods')}</label>
                  <span>{selectedInstance.mods?.length || 0}</span>
                </div>
                <div class="info-item">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label>{$t('mainContent.instances.overview.resourcePacks')}</label>
                  <span>{selectedInstance.resourcePacks?.length || 0}</span>
                </div>
                <div class="info-item">
                  <!-- svelte-ignore a11y_label_has_associated_control -->
                  <label>{$t('mainContent.instances.overview.shaders')}</label>
                  <span>{selectedInstance.shaders?.length || 0}</span>
                </div>
              </div>
            </div>

            {#if selectedInstance.description}
              <div class="description-card">
                <h4>{$t('mainContent.instances.overview.descriptionTitle')}</h4>
                <p>{selectedInstance.description}</p>
              </div>
            {/if}
          </div>
        {:else if activeTab === 'mods'}
          <div class="mods-section tab-section">
            <div class="section-header">
              <h3>{$t('mainContent.instances.mods.title')} ({selectedInstance.mods?.length || 0})</h3>
              <button class="btn btn-primary btn-sm" on:click={openModsBrowse}>
                <Plus size={14} />
                {$t('mainContent.instances.mods.addMod')}
              </button>
            </div>

            {#if selectedInstance.mods && selectedInstance.mods.length > 0}
              <div class="list">
                {#each paginatedMods as mod}
                  <div class="row">
                    <div class="icon">
                      <ToolCase size={24} />
                    </div>
                    <div class="info">
                      <div class="title">{mod.name}</div>
                      <div class="meta">
                        <span>{mod.file_name}</span>
                      </div>
                    </div>
                    <div class="actions">
                      <ToggleButton
                        checked={mod.enabled}
                        on:change={(e) => instanceStore.toggleMod(mod.id, e.detail.checked)}
                      />
                      <span class="line"></span>
                      <!-- svelte-ignore a11y_consider_explicit_label -->
                      <button class="btn btn-danger-text" on:click={() => instanceStore.removeMod(mod.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
              {#if totalModsPages > 1}
                <Pagination
                  currentPage={modsPage}
                  totalPages={totalModsPages}
                  prevPage={() => changePage('mods', -1)}
                  nextPage={() => changePage('mods', 1)}
                  alignment="left"
                />
              {/if}
            {:else}
              <div class="empty-content">
                <ToolCase size={40} />
                <p>{$t('mainContent.instances.mods.noModsInstalled')}</p>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'resourcepacks'}
          <div class="resourcepacks-section tab-section">
            <div class="section-header">
              <h3>{$t('mainContent.instances.resourcepacks.title')} ({selectedInstance.resourcePacks?.length || 0})</h3>
              <button class="btn btn-primary btn-sm" on:click={openResourcePacksBrowse}>
                <Plus size={14} />
                {$t('mainContent.instances.resourcepacks.addResourcePack')}
              </button>
            </div>

            {#if selectedInstance.resourcePacks && selectedInstance.resourcePacks.length > 0}
              <div class="list">
                {#each paginatedResourcePacks as resourcePack}
                  <div class="row">
                    <div class="icon">
                      <Palette size={24} />
                    </div>
                    <div class="info">
                      <div class="title">{resourcePack.name}</div>
                      <div class="meta">
                        <span>{resourcePack.version}</span>
                      </div>
                    </div>
                    <div class="actions">
                      <ToggleButton 
                        checked={resourcePack.enabled}
                        on:change={(e) => instanceStore.toggleResourcePack(resourcePack.id, e.detail.checked)}
                      />
                      <span class="line"></span>
                      <!-- svelte-ignore a11y_consider_explicit_label -->
                      <button class="btn btn-danger-text" on:click={() => instanceStore.removeResourcePack(resourcePack.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
              {#if totalResourcePacksPages > 1}
                <Pagination 
                  currentPage={resourcePacksPage}
                  totalPages={totalResourcePacksPages}
                  prevPage={() => changePage('resourcepacks', -1)}
                  nextPage={() => changePage('resourcepacks', 1)}
                  alignment="left"
                />
              {/if}
            {:else}
              <div class="empty-content">
                <Palette size={40} />
                <p>{$t('mainContent.instances.resourcepacks.noResourcePacksInstalled')}</p>
              </div>
            {/if}
          </div>
        
        {:else if activeTab === 'shaders'}
          <div class="shaders-section tab-section">
            <div class="section-header">
              <h3>{$t('mainContent.instances.shaders.title')} ({selectedInstance.shaders?.length || 0})</h3>
              <button class="btn btn-primary btn-sm" on:click={openShadersBrowse}>
                <Plus size={14} />
                {$t('mainContent.instances.shaders.addShader')}
              </button>
            </div>

            {#if selectedInstance.shaders && selectedInstance.shaders.length > 0}
              <div class="list">
                {#each paginatedShaders as shader}
                  <div class="row">
                    <div class="icon">
                      <PencilRuler size={24} />
                    </div>
                    <div class="info">
                      <div class="title">{shader.name}</div>
                      <div class="meta">
                        <span>{shader.version}</span>
                      </div>
                    </div>
                    <div class="actions">
                      <ToggleButton
                        checked={shader.enabled}
                        on:change={(e) => instanceStore.toggleShader(shader.id, e.detail.checked)}
                      />
                      <span class="line"></span>
                      <!-- svelte-ignore a11y_consider_explicit_label -->
                      <button class="btn btn-danger-text" on:click={() => instanceStore.removeShader(shader.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
              {#if totalShadersPages > 1}
                <Pagination
                  currentPage={shadersPage}
                  totalPages={totalShadersPages}
                  prevPage={() => changePage('shaders', -1)}
                  nextPage={() => changePage('shaders', 1)}
                  alignment="left"
                />
              {/if}
            {:else}
              <div class="empty-content">
                <PencilRuler size={40} />
                <p>{$t('mainContent.instances.shaders.noShadersInstalled')}</p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {:else}
      <div class="empty-details">
        <h3>{$t('mainContent.instances.emptyDetails.title')}</h3>
        <p>{$t('mainContent.instances.emptyDetails.description')}</p>
      </div>
    {/if}
  </div>
</div>

<!-- Delete Instance Modal -->
{#if showDeleteModal}
  {
    showDialog({
        title: $t('mainContent.instances.deleteModal.title'),
        message: $t('mainContent.instances.deleteModal.message', { name: instanceToDelete?.name }),
        buttons: [
        { label: $t('accountManager.cancel'), type: "normal", action: () => {} },
        { label: $t('accountManager.delete'), type: "danger", action: () => {
            deleteInstance();
          } }
        ]
    })
  }
{/if}

<!-- Settings Modal -->
<InstanceSettingsRestrictedModal
  open={$activeModal === 'instancesettings'}
  instance={selectedInstance}
  on:close={closeSettingsModal}
  on:save={(e) => saveSettings(e.detail)}
/>

<style>
  .instances-page {
    display: flex;
    height: 100%;
    background: var(--surface-color);
  }
  
  /* Compact Sidebar */
  .instances-sidebar {
    width: 280px;
    background: var(--surface-color);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    height: 100%;
    overflow: hidden;
  }
  
  .sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--surface-color);
  }
  
  .header-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    position: relative;

    .download-logs{
      position: absolute;
      text-overflow: ellipsis;
      top: calc(100%);
      font-size: .65rem;
      padding-top: 0px;
      color: var(--text-color-muted);
      width: 100%;
      max-width: 100%;
      overflow: hidden;
    }
  }
  .launch-btn{
    position: relative !important;
    overflow: hidden;
    color: var(--text-color);

    .download-progress{
      position: absolute;
      bottom: 0%;
      left: 0%;
      height: 4px;
      background: rgb(255, 255, 255);
    }
  }
  
  .line{
    width: 1px;
    height: 24px;
    background: var(--border-color);
  }
  
  .sidebar-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-color);
  }
  
  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    color: var(--error-color);
    background: var(--error-color-25);
    border: 1px solid var(--error-color-50);
    margin: 1rem;
    font-size: var(--font-size-fluid-sm);
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-color-muted);
  }
  
  .empty-state p {
    margin: 1rem 0 1rem 0;
    font-size: var(--font-size-body);
  }
  
  .instance-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    height: calc(100% - 60px);
  }
  
  .instance-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 0.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
    background: color-mix(in srgb, var(--overlay-color), transparent 50%);
    position: relative;
    border: 1px solid var(--border-color);
  }
  
  .instance-item:hover {
    background: var(--overlay-color);
    box-shadow:inset 0 0 0 2px color-mix(in srgb, var(--overlay-color-2), transparent 0%);
  }
  
  .instance-item.selected {
    background: color-mix(in srgb, var(--accent-color), transparent 80%);
    box-shadow:inset 0 0 0 2px color-mix(in srgb, var(--accent-color), transparent 20%);
  }
  
  .instance-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .active-instance-indicator{
    position: absolute;
    top: 10px;
    right: 10px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--success-color);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--success-color), transparent 50%);
    animation: pulse 1.5s infinite cubic-bezier(0.4, 0, 0.6, 1);
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--success-color), transparent 50%);
    }
    70% {
      box-shadow: 0 0 0 8px color-mix(in srgb, var(--success-color), transparent 100%);
    }
    100% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--success-color), transparent 100%);
    }
  }
  
  .instance-icon img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .instance-info {
    flex: 1;
    min-width: 0;
  }
  
  .instance-name {
    font-weight: 500;
    color: var(--text-color);
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .instance-meta {
    display: flex;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-color-muted);
    margin-top: 0.25rem;
  }
  
  .version, .loader {
    background: var(--overlay-color);
    padding: 0.3rem 0.5rem;
    font-size: 0.7rem;
    border: 1px solid var(--border-color);

  }
  
  /* Main Details Area */
  .instance-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: linear-gradient(to bottom , 
      color-mix(in srgb, var(--surface-color), transparent 10%), 
      color-mix(in srgb, var(--surface-color), transparent 0%),
      color-mix(in srgb, var(--surface-color), transparent 0%)
      ), 
      url(./images/static/plain.jpeg);
    background-size: cover;
    background-position: top center;
    height: 100%;
    overflow: hidden;
  }
  
  .details-header {
    padding: 15px 10px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-color);

  }
  
  .header-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .header-name-info-container{
    display: flex;
    flex-direction: column;
    align-items: start;
    gap: 5px
  }
  
  .header-actions {
    display: flex;
    gap: 0.75rem;
  }
  
  /* Tabs */
  .tabs-container {
    background: var(--overlay-color);
    border-bottom: 1px solid var(--border-color);
  }
  
  .tabs {
    display: flex;
    overflow-x: auto;
    padding: 0 10px;
  }
  
  .tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    color: var(--text-color-muted);
    cursor: pointer;
    font-size: var(--font-size-body);
    white-space: nowrap;
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
  }
  
  .tab:hover {
    color: var(--text-color);
    background: var(--overlay-color);
  }
  
  .tab.active {
    color: var(--text-color);
    border-bottom-color: var(--text-color);
  }
  
  /* Tab Content */
  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;

    .tab-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }
    
  }
  
  .overview-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }
  
  .info-card, .description-card{
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-bottom-width: 5px;
    padding: 10px;
  }
  
  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-color);
  }
  
  .info-item:last-child {
    border-bottom: none;
  }
  
  .info-item label {
    color: var(--text-color-muted);
    font-size: var(--font-size-body);
  }
  
  .info-item span {
    color: var(--text-color);
    font-size: var(--font-size-body);
  }
  
  
  .description-card h4 {
    margin: 0 0 1rem 0;
    color: var(--text-color);
    font-size: var(--font-size-body);
  }
  
  .description-card p {
    color: var(--text-color-muted);
    line-height: 1.6;
    margin: 0;
  }
  
  /* Section Styles */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 10px;
  }
  
  .section-header h3 {
    margin: 0;
    color: var(--text-color);
    font-size: var(--font-size-body);
  }
  

  /* Resource Pack Styles */
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-grow: 1;
  }
  .row {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--surface-color);
    border: 1px solid var(--border-color);
  }
  .row .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--overlay-color);
    color: var(--text-color);
  }
  .row .info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .row .title {
    color: var(--text-color);
    font-size: var(--font-size-body);
  }
  .row .meta {
    color: var(--text-color-muted);
    font-size: var(--font-size-sm);
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .row .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    /* padding: 3rem; */
    flex-grow: 1;
    text-align: center;
    color: var(--text-color-muted);
  }
  
  .empty-content p {
    margin: 1rem 0 1rem 0;
    font-size: var(--font-size-body);
  }
  
  /* Log Styles */
  .empty-details {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--text-color-muted);
  }
  
  .empty-details h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-color);
  }
  
  /* Settings Form Styles */
  @media (max-width: 768px) {
    .instances-page {
      flex-direction: column;
    }
    
    .instances-sidebar {
      width: 100%;
      height: 200px;
      border-right: none;
      border-bottom: 1px solid var(--border-color);
    }
    
    .instance-details {
      height: calc(100vh - 200px);
    }
    
    .details-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }
    
    .header-actions {
      width: 100%;
      justify-content: flex-end;
    }
    
    .tabs {
      padding: 0 1rem;
    }
    
    .tab {
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
    }
    
    
    .info-grid {
      grid-template-columns: 1fr;
    }
  }
  
  @media (max-width: 480px) {
    .tabs {
      overflow-x: scroll;
      scrollbar-width: none;
    }
    
    .tabs::-webkit-scrollbar {
      display: none;
    }
    
    .tab {
      padding: 0.5rem 0.5rem;
      font-size: 0.75rem;
    }
  }

  .busy{
    background-color: var(--accent-color-dark);
  }
</style>
