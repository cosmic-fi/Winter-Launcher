<script>
  //@ts-nocheck
    import { createEventDispatcher, onDestroy } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import { X, Download, Plus, Loader2, Info, Image, ImageMinus, ImageDown, ImageOff } from '@lucide/svelte';
    import { instanceStore } from '../../stores/instances.js';
    import modrinthService from '../../services/modrinthService.js';
    import CustomOptions from '../ui/Options.svelte';
    import StepInstanceCreator from './InstanceCreatorModal.svelte';
    import { showToast,   uiState } from '../../stores/ui.js';
   
    import { logger } from '../../utils/logger.js';
    import { resolveLoaderVersion } from '../../services/api.js';
    import { t } from '../../stores/i18n.js';
  import { image } from '../../utils/image.js';
  import GalleryViewer from './GalleryViewerModal.svelte';

    export let open = false;
    export let item = null;
    export let itemType = 'mod'; // 'mod', 'resourcepack', 'shader'
    export let gameVersion = 'all'; // Minecraft version context for auto-selection

    const dispatch = createEventDispatcher();

    let selectedInstance = '';
    let showInstanceCreator = false;
    let installing = false;
    let instancesList = [];
    let modInstallProgress = { current: 0, total: 0, currentMod: '' };
    let currentInstanceId = null;
    let itemVersions = [];
    let versionsLoadedForProject = null;
    let versionsLoading = false;
    
    let currentTab = 'overview';

    let galleryItem = null;
    let galleryItemIndex = null;
    let showGalleryView = false

    $: itemGameVersions = Array.isArray(item?.game_versions)
      ? item.game_versions.filter(Boolean)
      : Array.isArray(item?.versions)
        ? item.versions.filter(Boolean)
        : [];
    
    $: itemLoaders = Array.isArray(item?.loaders)
      ? item.loaders.filter(Boolean)
      : Array.isArray(item?.latest_version?.loaders)
        ? item.latest_version.loaders.filter(Boolean)
        : [];
    
    $: allVersionGameVersions = itemVersions.length > 0
      ? Array.from(
          new Set(
            itemVersions.flatMap(v => Array.isArray(v.game_versions) ? v.game_versions : [])
          )
        ).filter(Boolean)
      : itemGameVersions;
    
    $: allVersionLoaders = itemVersions.length > 0
      ? Array.from(
          new Set(
            itemVersions.flatMap(v => Array.isArray(v.loaders) ? v.loaders : [])
          )
        ).filter(Boolean)
      : itemLoaders;
    
    $: latestDisplayVersion =
      itemVersions.length > 0
        ? itemVersions[0]?.version_number
        : item?.latest_version?.version_number;
    
    $: bannerImageUrl = Array.isArray(item?.gallery) && item.gallery.length > 0
      ? item.gallery[0]
      : item?.icon_url || "./images/static/minecraft_grass.jpg";

    $: selectedInstanceData = instancesList.find(i => i.id === selectedInstance) || null;

    function isItemInstalledOnInstance(instance) {
      if (!instance || !item) return false;
      const projectId = item.id || item.project_id;
      if (!projectId) return false;

      if (itemType === 'mod') {
        const mods = instance.mods || [];
        return mods.some(mod => mod.modrinth_id === projectId || mod.modrinthId === projectId);
      }

      if (itemType === 'resourcepack') {
        const packs = instance.resourcePacks || [];
        return packs.some(rp => rp.modrinth_id === projectId || rp.modrinthId === projectId);
      }

      if (itemType === 'shader') {
        const shaders = instance.shaders || [];
        return shaders.some(sh => sh.modrinth_id === projectId || sh.modrinthId === projectId);
      }

      return false;
    }

    $: isAlreadyInstalled = isItemInstalledOnInstance(selectedInstanceData);

    // Subscribe to instances store
    instanceStore.subscribe(value => {
      instancesList = value.instances || [];
    });

    $: if (open && item) {
      selectedInstance = '';
      showInstanceCreator = false;
      installing = false;
      modInstallProgress = { current: 0, total: 0, currentMod: '' };
      currentInstanceId = null;
      loadItemVersions();
    }
  
    $: compatibleInstances = instancesList.filter(instance => {
      if (!item) return false;
      
      const instanceVersion = instance.gameVersion;
      const instanceLoader = instance.loader;
      
      const versionOk =
        !instanceVersion ||
        itemGameVersions.length === 0 ||
        itemGameVersions.includes(instanceVersion);
      
      if (itemType === 'mod') {
        if (!instanceVersion || !instanceLoader) return false;
        
        if (itemVersions.length > 0) {
          const compatibleVersion = modrinthService.getLatestCompatibleVersion(
            itemVersions,
            instanceVersion,
            instanceLoader
          );
          return !!compatibleVersion;
        }
        
        const loaderOk =
          itemLoaders.length === 0 ||
          itemLoaders.includes(instanceLoader);
        
        return versionOk && loaderOk;
      }
      
      return versionOk;
    });

    // Instance options for dropdown
    $: instanceOptions = compatibleInstances.map(instance => ({
      value: instance.id,
      label: instance.name
    }));


    function handleGalleryView(itemIndex, item){
      showGalleryView = true;
      galleryItemIndex = itemIndex;
      galleryItem = item;
    }

    function closeGalleryView(){
      showGalleryView = false;
      galleryItemIndex = null;
      galleryItem = null;
    }

    async function loadItemVersions() {
      if (!item || versionsLoading) return;
      const projectId = item.id || item.project_id;
      if (!projectId) return;
      if (versionsLoadedForProject === projectId && itemVersions.length > 0) return;
      
      versionsLoading = true;
      try {
        const versions = await modrinthService.getProjectVersions(projectId, {});
        itemVersions = Array.isArray(versions) ? versions : [];
        versionsLoadedForProject = projectId;
      } catch (error) {
        logger.error('Failed to load versions for item in ItemViewerModal:', error);
        itemVersions = [];
        versionsLoadedForProject = projectId;
      } finally {
        versionsLoading = false;
      }
    }

    function handleInstanceChange(e) {
      selectedInstance = e.detail.value;
    }

    async function handleInstanceSubmit(event) {
      const data = event.detail;
      if (!data?.name?.trim()) {
        showToast($t('mainContent.modals.itemViewerModal.toasts.instanceNameRequired'), 'error');
        return;
      }

      try {
        const newInstance = await instanceStore.createInstance(data);
        showInstanceCreator = false;
        selectedInstance = newInstance.id;

        if (item && selectedInstance) {
          await installItemToInstance(newInstance);
        }
      } catch (error) {
        showToast(error.message || $t('mainContent.modals.itemViewerModal.toasts.failedToCreateInstance'), 'error');
      }
    }

    async function installItem() {
      if (!selectedInstance) {
        showToast($t('mainContent.modals.itemViewerModal.toasts.pleaseSelectInstance'), 'error');
        return;
      }

      if (isAlreadyInstalled) {
        showToast($t('mainContent.modals.itemViewerModal.toasts.alreadyInstalledInfo', { itemType: itemType }), 'info');
        return;
      }

      const instance = instancesList.find(i => i.id === selectedInstance);
      if (instance) {
        await installItemToInstance(instance);
      }
    }

    async function handleVersionPickerConfirm(event) {
      const { version } = event.detail;
      selectedVersion = version;
      showVersionPicker = false;
    }

    async function installItemToInstance(instance) {
      installing = true;
      try {
        let success = false;

        switch (itemType) {
          case 'mod':
            success = await installMod(instance);
            break;
          case 'resourcepack':
            success = await installResourcePack(instance);
            break;
          case 'shader':
            success = await installShader(instance);
            break;
        }

        if (success) {
          logger.info(`${itemType} installed successfully to "${instance.name}"`);
          showToast($t('mainContent.modals.itemViewerModal.toasts.installedSuccessfully', { itemType: itemType, instanceName: instance.name }), 'success');
          close();
        } else {
          logger.error(`Failed to install ${itemType} to "${instance.name}"`);
          showToast($t('mainContent.modals.itemViewerModal.toasts.failedToInstall', { itemType: itemType }), 'error');
        }
      } catch (error) {
        logger.error(`Failed to install ${itemType} to "${instance.name}":`, error);
        console.error(`Failed to install ${itemType}:`, error);
        // showToast($t('mainContent.modals.itemViewerModal.toasts.failedToInstall', { itemType: itemType }), 'error');
      } finally {
        installing = false;
      }
    }

    async function installMod(instance) {
      // Get the latest compatible version for the mod
      const versions = await modrinthService.getProjectVersions(item.id || item.project_id, {
        gameVersion: instance.gameVersion,
        loader: instance.loader
      });
      
      const compatibleVersion = modrinthService.getLatestCompatibleVersion(
        versions, 
        instance.gameVersion, 
        instance.loader
      );
      
      if (!compatibleVersion) {
        logger.error(`No compatible version found for mod "${item.title || item.name}"`);
        showToast($t('mainContent.modals.itemViewerModal.toasts.noCompatibleVersionFound', { itemType: 'mod' }), 'error');
        return false;
      }
      
      const file = compatibleVersion.files.find(f => f.primary) || compatibleVersion.files[0];
      
      // Add mod to instance using the instances store
      const modData = {
        modrinth_id: item.id || item.project_id,
        project_id: item.id || item.project_id, // Keep for legacy compatibility if needed
        title: item.title || item.name,
        fileName: file.filename,
        downloadUrl: file.url,
        version_number: compatibleVersion.version_number,
        game_versions: compatibleVersion.game_versions,
        loaders: compatibleVersion.loaders
      };
      
      await instanceStore.installMod(instance.id, modData);
      return true;
    }

    async function installResourcePack(instance) {
      // Get the latest compatible version
      const versions = await modrinthService.getProjectVersions(item.id || item.project_id, {
        gameVersion: instance.gameVersion
      });
      
      // Resource packs don't need loader check
      const compatibleVersion = versions.find(v => v.game_versions.includes(instance.gameVersion)) || versions[0];
      
      if (!compatibleVersion) {
        logger.error(`No compatible version found for resource pack "${item.title || item.name}"`);
        showToast($t('mainContent.modals.itemViewerModal.toasts.noCompatibleVersionFound', { itemType: 'resource pack' }), 'error');
        return false;
      }
      
      const file = compatibleVersion.files.find(f => f.primary) || compatibleVersion.files[0];
      
      // Add resource pack to instance using the instances store
      const resourcePackData = {
        modrinthId: item.id || item.project_id,
        name: item.title || item.name,
        fileName: file.filename,
        downloadUrl: file.url,
        version: compatibleVersion.version_number
      };
      
      await instanceStore.addResourcePack(instance.id, resourcePackData);
      return true;
    }

    async function installShader(instance) {
      // Get the latest compatible version
      const versions = await modrinthService.getProjectVersions(item.id || item.project_id, {
        gameVersion: instance.gameVersion
      });
      
      const compatibleVersion = versions.find(v => v.game_versions.includes(instance.gameVersion)) || versions[0];
      
      if (!compatibleVersion) {
        logger.error(`No compatible version found for shader: ${item.title || item.name}`);
        showToast($t('mainContent.modals.itemViewerModal.toasts.noCompatibleVersionFound', { itemType: 'shader' }), 'error');
        return false;
      }
      
      const file = compatibleVersion.files.find(f => f.primary) || compatibleVersion.files[0];
      
      // Add shader to instance using the instances store
      const shaderData = {
        modrinthId: item.id || item.project_id,
        name: item.title || item.name,
        fileName: file.filename,
        downloadUrl: file.url,
        version: compatibleVersion.version_number
      };
      
      await instanceStore.addShader(instance.id, shaderData);
      return true;
    }

    function close() {
      // Reset progress tracking
      modInstallProgress = { current: 0, total: 0, currentMod: '' };
      dispatch('close');
    }

    function getItemTypeLabel() {
      switch (itemType) {
        case 'mod': return $t("mainContent.modals.itemViewerModal.modLabel") || 'Mod';
        case 'resourcepack': return $t("mainContent.modals.itemViewerModal.resourcePackLabel") || 'Resource Pack';
        case 'shader': return $t("mainContent.modals.itemViewerModal.shaderLabel") || 'Shader';

        default: return $t("mainContent.modals.itemViewerModal.itemLabel") || 'Item';
      }
    }

    function switchTab(tab){
      currentTab = tab
    }
</script>

{#if open && item}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" on:click|self={close} transition:fade={{ duration: 100 }}>
    <div
      class="modal-content modal-large"
      on:click|stopPropagation
      transition:fly={{ y: 20, duration: 300, opacity: 0.9 }}
    >
      <div class="modal-header">
        <h2>{getItemTypeLabel()}</h2>
        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button class="close-btn btn btn-default" on:click={close}>
          <X size={16} />
        </button>
      </div>
      <div
        class="modal-body"
        style={`background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), var(--surface-color) 25%), url('${bannerImageUrl}')`}
      >
        {#if item}
          {console.log(item)}
          <div class="item-info">
            <div class="item-icon">
              <img class="item-icon-image" src={item.icon_url} alt={item.title || item.name} />
            </div>
            <div class="item-details">
              <h3>{item.title || item.name}</h3>
              <div class="item-detail-meta">
                {#if item.author}
                  <p class="item-authors">
                    {$t('mainContent.modals.itemViewerModal.author', {author: item.author})}
                  </p>
                {/if}
                <span class="line"></span>
                {#if item.downloads}
                  <p class="item-downloads">
                    <Download size={14} /> {item.downloads.toLocaleString()} {$t("mainContent.modals.itemViewerModal.downloads") || 'Downloads'}
                  </p>
                {/if}
              </div>
              <div class="tab-button-container">
                <button 
                  class="tab-btn"
                  on:click={() => switchTab('overview')}
                  class:active-tab={currentTab === 'overview'}  
                >
                  <Info size={15} />
                  Overview
                </button>
                <button 
                  class="tab-btn"
                  on:click={() => switchTab('gallery')}
                  class:active-tab={currentTab === 'gallery'}
                >
                  <Image size={15} />
                  Gallery
                </button>
              </div>
              {#if currentTab === 'overview'}
                <div class="item-meta-grid">
                  <div class="meta-item">
                    <span class="meta-label">{$t('mainContent.modals.itemViewerModal.latestVersion')}</span>
                    <span class="meta-value">{latestDisplayVersion || $t('mainContent.modals.itemViewerModal.unknown')}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">{$t('mainContent.modals.itemViewerModal.gameVersions')}</span>
                    <span class="meta-value">
                      {#if allVersionGameVersions.length > 0}
                        {allVersionGameVersions.slice(0, 5).join(', ')}{#if allVersionGameVersions.length > 5}…{/if}
                      {:else}
                        {$t('mainContent.modals.itemViewerModal.unknown')}
                      {/if}
                    </span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">{$t('mainContent.modals.itemViewerModal.loaders')}</span>
                    <span class="meta-value">
                      {#if allVersionLoaders.length > 0}
                        {allVersionLoaders.join(', ')}
                      {:else}
                        {$t('mainContent.modals.itemViewerModal.unknown')}
                      {/if}
                    </span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">{$t('mainContent.modals.itemViewerModal.updated')}</span>
                    <span class="meta-value">
                      {item.date_modified
                        ? new Date(item.date_modified).toLocaleDateString()
                        : item.date_created
                          ? new Date(item.date_created).toLocaleDateString()
                          : $t('mainContent.modals.itemViewerModal.unknown')}
                    </span>
                  </div>
                </div>
                <p class="item-description">{item.description || item.summary || $t('mainContent.modals.itemViewerModal.noDescriptionAvailable')}</p>

                <div class="install-section">
                  <h4>{$t('mainContent.modals.itemViewerModal.selectInstance')}</h4>

                  {#if compatibleInstances.length > 0}
                    <p class="install-info">
                    {$t('mainContent.modals.itemViewerModal.compatibleInstancesCount', { count: compatibleInstances.length, itemType: itemType })}
                    </p>
                  {/if}
                  {#if isAlreadyInstalled}
                    <p class="install-warning">
                      {$t('mainContent.modals.itemViewerModal.alreadyInstalledWarning', { itemType: itemType })}
                    </p>
                  {/if}
                  
                  {#if instancesList.length === 0}
                    <div class="no-instances">
                      <p>{$t('mainContent.modals.itemViewerModal.noInstancesFound')}</p>
                      <button class="btn-primary btn" on:click={() => showInstanceCreator = true}>
                        <Plus size={16} /> {$t('mainContent.modals.itemViewerModal.createInstance')}
                      </button>
                    </div>
                  {:else if compatibleInstances.length === 0}
                    <div class="no-compatible-instances">
                      <p>{$t('mainContent.modals.itemViewerModal.noCompatibleInstances', { itemType: itemType })}</p>
                      <p>{$t('mainContent.modals.itemViewerModal.gameVersionLabel')}: {item.versions?.join(', ') || $t('mainContent.modals.itemViewerModal.unknown')}</p>
                      <button class="btn-primary btn" on:click={() => showInstanceCreator = true}>
                        <Plus size={16} /> {$t('mainContent.modals.itemViewerModal.createCompatibleInstance')}
                      </button>
                    </div>
                  {:else}
                    <div class="instance-selection">
                      <CustomOptions
                        id="instance-select"
                        options={instanceOptions}
                        value={selectedInstance}
                        preferredPosition="up"
                        on:optionchange={handleInstanceChange}
                        placeholder={$t('mainContent.modals.itemViewerModal.selectInstancePlaceholder')}
                      />
                      <button
                        class="btn btn-primary"
                        on:click={installItem}
                        disabled={!selectedInstance || installing || isAlreadyInstalled}
                      >
                        {#if installing}
                          <Loader2 size={16} class="animate-spin" /> {$t('mainContent.modals.itemViewerModal.installing')}
                        {:else}
                          {#if isAlreadyInstalled}
                            {$t('mainContent.modals.itemViewerModal.alreadyInstalled')}
                          {:else}
                            <Download size={16} /> {$t('mainContent.modals.itemViewerModal.installToSelectedInstance')}
                          {/if}
                        {/if}
                      </button>
                    </div>
                  {/if}
                </div>
              {:else}
                <div class="gallery-container">
                  {#if item.gallery && item.gallery.length <= 0}
                    <div class="empty-gallery-container">
                      <ImageOff strokeWidth={2} size={50} />
                      <span class="no-gallery-label">Nothing here!</span>
                    </div>
                  {:else}
                    <div class="gallery-item-container">
                      {#each item.gallery as i, index}
                        {console.log(index, 'indexxx')}
                        <div 
                          class="gallery-card"
                          on:click={() => handleGalleryView(index, item.gallery)}
                        >
                          <img 
                            src={i}
                            use:image
                            alt="Banana" />
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      {#if showInstanceCreator}
        <StepInstanceCreator 
          open={showInstanceCreator}
          on:close={() => showInstanceCreator = false}
          on:submit={handleInstanceSubmit}
          on:error={(e) => showToast(e.detail.message, 'error')}
        />
      {/if}
    </div>
  </div>

  {#if showGalleryView}
    <GalleryViewer 
      open={showGalleryView}
      galleryItemIndex={galleryItemIndex}
      galleryItem={galleryItem
      }
      on:close={closeGalleryView}
    />
  {/if}
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
    min-width: 800px;
    height: 560px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--border-color);
    border-bottom-width: 5px;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.3);
  }
  
  .modal-large {
    width: 480px;
    max-width: 520px;
  }
  
  @media (max-width: 768px) {
    .modal-content,
    .modal-large {
      width: 100%;
      max-width: 100%;
      box-shadow: none;
    }
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h2 {
    margin: 0;
    color: var(--text-color);
    font-size: var(--font-size-base);
  }
  .btn{
    -webkit-app-region: no-drag;
  }
  
  .modal-body {
    padding: 15px;
    flex: 1;
    overflow-y: auto;
    background-color: var(--surface-color);
    background-repeat: no-repeat;
    background-size: cover;
    background-position: top center;
    background-size: contain;
  }

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-block: 10px;
  }

  .item-icon-image{
    width: 100%;
    object-fit: cover;
  }
  .item-icon {
    width: 80px;
    height: 80px;
    background: var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-primary);
    flex-shrink: 0;
    overflow: hidden;
    position: relative;
  }

  .item-details {
    flex: 1;

    .tab-button-container{
      background-color: var(--overlay-color);
      display: flex;
      flex-direction: row;
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: -15px;
      transition: all .3s ease;
      z-index: 5;

      .tab-btn{
        padding: 10px 15px;
        display: flex;
        flex-direction: row;
        align-items: center;
        column-gap: 5px;
        border-bottom: 2px solid transparent;
        color: var(--text-color-muted);
        transition: all .2s ease;
      }
      .active-tab{
        border-bottom-color: var(--text-color);
        color: var(--text-color);
      }
    }
    .item-detail-meta{
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      border-top: 1px solid var(--border-color);
    }
  }

  .item-details h3 {
    margin: 0 0 10px 0;
    color: var(--text-color);
    font-size: var(--font-size-body);
  }

  .item-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin: 10px 0 12px 0;
  }

  .gallery-container{
    .gallery-item-container{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: 220px !important;
      gap: 5px;
      padding: 10px 5px 5px 5px;

    }
    .gallery-card{
      overflow: hidden;
      background-color: var(--overlay-color);
      border: 2px solid var(--border-color);
      cursor: pointer;
      transition: all .2s ease;

      img{
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      &:hover{
        background-color: var(--overlay-color-1);
        border-color: var(--overlay-color-2);
      }
      &:active{
        transform: scale(.98);
      }
    }
    .empty-gallery-container{
      width: 100% !important;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding-block: 6rem;
      row-gap: 10px;
      color: var(--text-color-muted);
    }
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .meta-label {
    font-size: var(--font-size-sm);
    color: var(--text-color-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .meta-value {
    font-size: var(--font-size-body);
    color: var(--text-color);
    word-break: break-word;
    text-transform: capitalize;
  }

  .item-description {
    border-top: 1px solid var(--border-color);
    padding-top: 10px;
    color: var(--text-color-muted);
    margin: 0 0 15px 0;
    font-size: var(--font-size-body);
    line-height: 1.5;
  }

  .item-authors,
  .item-downloads{
    margin: 8px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-color-muted);
    font-size: var(--font-size-sm);
  }

  .install-section {
    margin-top: 20px;
    padding: 10px;
    background: var(--overlay-color);
    border: 1px solid var(--border-color);
    border-left-width: 5px;
    margin-bottom: 20px;
  }

  .install-section h4 {
    margin: 0 0 15px 0;
    color: var(--text-color);
    font-size: var(--font-size-body);
  }

  .install-info {
    color: var(--text-color-muted);
    font-size: var(--font-size-body);
    margin: 0 0 15px 0;
  }

  .no-instances p,
  .no-compatible-instances p {
    color: var(--text-color-muted);
    font-size: var(--font-size-body);
    margin: 0 0 15px 0;
  }

  .instance-selection {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 15px;
  }

  .install-warning {
    font-size: var(--font-size-sm);
    color: var(--warning-color, #fbbf24);
  }

  @keyframes progress-shine {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
</style>
