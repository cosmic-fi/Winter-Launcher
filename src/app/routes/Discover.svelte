<script>
  // @ts-nocheck

  //ts-nocheck
  import { onMount, onDestroy } from "svelte";
  import modrinthService from "../services/modrinthService";
  import { formatNumber } from "../utils/helper";
  import CustomOptions from "../components/ui/Options.svelte";
  import Card from "../components/ui/Card.svelte";
  import Loading from "../components/ui/Loading.svelte";
  import { uiState } from "../stores/ui";
  import ItemViewerModal from "../components/modal/ItemViewerModal.svelte";
  import { Compass, Search, TrendingUp, ChevronRight, Info, Download, Image, Lightbulb, Clock, Palette, PencilRuler } from '@lucide/svelte';
  import { t } from '../stores/i18n';
  import SearchBox from "../components/ui/SearchBox.svelte";

  let searchQuery = "";
  let showFilter = "all";
  let loaderFilter = "all";
  let loaders = [
    { id: "all", name: $t('mainContent.discover.filters.loaders.all') },
    { id: "forge", name: $t('mainContent.discover.filters.loaders.forge') },
    { id: "fabric", name: $t('mainContent.discover.filters.loaders.fabric') },
    { id: "quilt", name: $t('mainContent.discover.filters.loaders.quilt') },
    { id: "neoforge", name: $t('mainContent.discover.filters.loaders.neoforge') },
  ];
  const showOptions = [
    { value: "all", label: $t('mainContent.discover.filters.show.all') },
    { value: "mods", label: $t('mainContent.discover.filters.show.mods') },
    { value: "resourcepacks", label: $t('mainContent.discover.filters.show.resourcepacks') },
    { value: "shaders", label: $t('mainContent.discover.filters.show.shaders') },
  ];
  const loaderOptions = [
    { value: "all", label: $t('mainContent.discover.filters.loaders.all') },
    { value: "forge", label: $t('mainContent.discover.filters.loaders.forge') },
    { value: "fabric", label: $t('mainContent.discover.filters.loaders.fabric') },
    { value: "quilt", label: $t('mainContent.discover.filters.loaders.quilt') },
    { value: "neoforge", label: $t('mainContent.discover.filters.loaders.neoforge') },
  ];
  const itemCountOptions = [
    { value: "10", label: $t('mainContent.discover.filters.itemCount.10') },
    { value: "20", label: $t('mainContent.discover.filters.itemCount.20') },
    { value: "50", label: $t('mainContent.discover.filters.itemCount.50') },
    { value: "100", label: $t('mainContent.discover.filters.itemCount.100') },
  ];

  let trendingMods = [];
  let resourcePacks = [];
  let shaders = [];
  let recentlyUpdated = [];
  let loading = false;
  let itemCount = 20;
  
  let showItemViewerModal = false;
  let itemToView = null;
  let itemTypeToView = 'mod';
  let modsOffset = 0;
  let modsHasMore = true;
  let rpOffset = 0;
  let rpHasMore = true;
  let shadersOffset = 0;
  let shadersHasMore = true;

  let bannerItems = [];
  let bannerIndex = 0;
  let bannerTimer;

  let carouselEl;

  onMount(async () => {
    await loadAllData();
    bannerTimer = setInterval(() => {
      bannerIndex = (bannerIndex + 1) % Math.max(bannerItems.length, 1);
    }, 4000);
  });
  onDestroy(() => {
    if (bannerTimer) clearInterval(bannerTimer);
  });

  async function loadAllData() {
    loading = true;
    modsOffset = 0;
    rpOffset = 0;
    shadersOffset = 0;
    await Promise.all([
      loadTrendingMods(true),
      loadResourcePacks(),
      loadShaders(),
      loadRecentlyUpdated(),
    ]);
    const pool = [
      ...(trendingMods || []).slice(0, 5).map((x) => ({ type: "mod", ...x })),
      ...(resourcePacks || [])
        .slice(0, 5)
        .map((x) => ({ type: "resourcepack", ...x })),
      ...(shaders || []).slice(0, 5).map((x) => ({ type: "shader", ...x })),
    ];
    bannerItems = pool.sort(() => Math.random() - 0.5).slice(0, 8);
    loading = false;
  }

  function getSelectedLoader() {
    return loaderFilter === "all" ? null : loaderFilter;
  }



  async function loadTrendingMods(reset = false) {
    const params = {
      query: searchQuery,
      loader: getSelectedLoader(),
      sort: "downloads",
      offset: reset ? 0 : modsOffset,
      limit: itemCount,
    };
    const result = await modrinthService.searchMods(params);
    if (reset) {
      trendingMods = result.hits || [];
    } else {
      trendingMods = [...trendingMods, ...(result.hits || [])];
    }
    modsHasMore = (result.hits || []).length === itemCount;
  }

  async function loadMoreMods() {
    if (!modsHasMore || loading) return;
    modsOffset += itemCount;
    await loadTrendingMods(false);
  }


  function buildFacets(type) {
    const facets = [];
    facets.push([`project_type:${type}`]);
    return JSON.stringify(facets);
  }

  function getDisplayedLoader(loadersArr = []) {
    const selected = getSelectedLoader();
    if (selected && loadersArr?.includes(selected)) return selected;
    return loadersArr?.[0];
  }

  function getVersions(item) {
    const lv = item?.latest_version?.game_versions;
    const gv = item?.game_versions;
    const arr =
      Array.isArray(lv) && lv.length > 0 ? lv : Array.isArray(gv) ? gv : [];
    // Sort versions in descending order (latest first)
    return arr.filter(Boolean).sort((a, b) => {
      // Extract version numbers and compare
      const aParts = a.split(".").map(Number);
      const bParts = b.split(".").map(Number);

      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        if (aPart !== bPart) return bPart - aPart;
      }
      return 0;
    });
  }

  function getLoaders(item) {
    const ll = item?.latest_version?.loaders;
    const ls = item?.loaders;
    const arr =
      Array.isArray(ll) && ll.length > 0 ? ll : Array.isArray(ls) ? ls : [];
    return arr.filter(Boolean);
  }

  function getDisplayedVersion(item) {
    const versions = getVersions(item);
    return versions[0] || "";
  }
  
  function handleViewItem(item, type) {
    itemToView = item;
    itemTypeToView = type;
    showItemViewerModal = true;
  }
  
  function handleInstallItem(item, type) {
    itemToView = item;
    itemTypeToView = type;
    showItemViewerModal = true;
  }
  
  function closeItemViewerModal() {
    showItemViewerModal = false;
    itemToView = null;
    itemTypeToView = 'mod';
  }

  async function loadResourcePacks() {
    const result = await modrinthService.searchProjects({
      query: searchQuery,
      facets: buildFacets("resourcepack"),
      index: "downloads",
      offset: rpOffset,
      limit: itemCount,
    });
    resourcePacks =
      rpOffset === 0
        ? result.hits || []
        : [...resourcePacks, ...(result.hits || [])];
    rpHasMore = (result.hits || []).length === itemCount;
  }

  async function loadShaders() {
    const result = await modrinthService.searchProjects({
      query: searchQuery,
      facets: buildFacets("shader"),
      index: "downloads",
      offset: shadersOffset,
      limit: itemCount,
    });
    shaders =
      shadersOffset === 0
        ? result.hits || []
        : [...shaders, ...(result.hits || [])];
    shadersHasMore = (result.hits || []).length === itemCount;
  }

  async function loadRecentlyUpdated() {
    const result = await modrinthService.searchMods({
      query: searchQuery,
      loader: getSelectedLoader(),
      sort: "updated",
      limit: itemCount,
    });
    recentlyUpdated = result.hits || [];
  }

  function handleSearchInput(e) {
    searchQuery = e.detail.value;
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(loadAllData, 400);
  }

  function handleShowOptionChanges(value){
    showFilter = value;
    handleFilterChange();
  }
  function handleLoaderOptionChanges(value){
    loaderFilter = value;
    handleFilterChange();
  }
  function handleCountOptionChanges(value){
    itemCount = Number(value);
    handleFilterChange();
  }

  const handleFilters = {
    show: handleShowOptionChanges,
    loader: handleLoaderOptionChanges,
    count: handleCountOptionChanges
  }

  function handleFilterOptionChange(e){
    const { filterId, value } = e.detail;
    handleFilters[filterId]?.(value);
  }

  async function handleFilterChange() {
    await loadAllData();
  }

  function scrollCarousel(dir) {
    if (!carouselEl) return;
    const amount = 400;
    carouselEl.scrollTo({
      left: carouselEl.scrollLeft + (dir === "next" ? amount : -amount),
      behavior: "smooth",
    });
  }
  
  function navigateToMods() {
    uiState.activeTab.set('mods');
  }
  
  function navigateToResourcePacks() {
    uiState.activeTab.set('resourcepacks');
  }
  
  function navigateToShaders() {
    uiState.activeTab.set('shaders');
  }
</script>

<div class="discover-page">
  <div class="discover-header-section">
    <div class="discover-section-header">
      <Compass size={24} />
      <span class="section-title">{$t('mainContent.discover.title')}</span>
    </div>
  </div>
  <SearchBox 
    searchQuery={searchQuery}
    loadingState={loading}
    filterOptions={[
      {
        id: 'show',
        options: showOptions,
        value: showFilter,
      },
      {
        id: 'loader',
        options: loaderOptions,
        value: loaderFilter
      },
      {
        id: 'count',
        options: itemCountOptions,
        value: String(itemCount)
      }
    ]}
    on:search={handleSearchInput}
    on:filterOptionChange={handleFilterOptionChange}
  />
  {#if showFilter === "all" || showFilter === "mods"}
    <div class="section-group">
      <div class="section-header">
        <span class="section-title"
          ><TrendingUp size={18} class="text-accent" style="margin-right: 8px;" /> {$t('mainContent.discover.sections.trendingMods')}</span
        >
        <button class="btn btn-default" on:click={navigateToMods}
          >{$t('mainContent.discover.buttons.viewMore')}<ChevronRight size={16} style="margin-left: 4px;" /></button
        >
      </div>
      <div class="mods-grid">
        {#if loading}
          <Loading message={$t('mainContent.discover.sections.loadingTrendingMods')} size="medium" fullPage={true} layout="cards" />
        {:else if trendingMods.length === 0}
          <div class="empty-state">{$t('mainContent.discover.sections.noTrendingMods')}</div>
        {:else}
          {#each trendingMods as mod}
            <Card
              variant="mod"
              title={mod.title}
              icon={mod.icon_url || "./images/static/minecraft_grass.jpg"}
              subtitle={`By ${mod.author}`}
              description={mod.description}
              downloads={mod.downloads}
              gameVersions={getVersions(mod)}
              loaders={getLoaders(mod)}
              lastUpdated={mod.date_modified || mod.date_created}
              size="medium"
              clickable={true}
              onClick={() => handleViewItem(mod, 'mod')}
            />
          {/each}
        {/if}
      </div>
    </div>
  {/if}

  {#if showFilter === "all" || showFilter === "resourcepacks"}
    <div class="section-group">
      <div class="section-header">
        <span class="section-title"
          ><Palette size={18} class="text-accent" style="margin-right: 8px;" /> {$t('mainContent.discover.sections.popularResourcePacks')}</span
        >
        <button
          class="btn-default btn"
          on:click={navigateToResourcePacks}>{$t('mainContent.discover.buttons.viewMore')}<ChevronRight size={16} style="margin-left: 4px;" /></button
        >
      </div>
      <div class="resourcepacks-grid">
        {#if loading}
          <Loading message={$t('mainContent.discover.sections.loadingResourcePacks')} size="medium" fullPage={true} layout="cards" />
        {:else if resourcePacks.length === 0}
          <div class="empty-state">{$t('mainContent.discover.sections.noResourcePacks')}</div>
        {:else}
          {#each resourcePacks as rp}
            <Card
              variant="resourcepack"
              title={rp.title}
              icon={rp.icon_url || "./images/static/minecraft_grass.jpg"}
              subtitle={`By ${rp.author}`}
              description={rp.description}
              downloads={rp.downloads}
              gameVersions={getVersions(rp)}
              lastUpdated={rp.date_modified || rp.date_created}
              size="medium"
              clickable={true}
              onClick={() => handleViewItem(rp, 'resourcepack')}
            />
          {/each}
        {/if}
      </div>
    </div>
  {/if}

  {#if showFilter === "all" || showFilter === "shaders"}
    <div class="section-group">
      <div class="section-header">
        <span class="section-title"
          ><PencilRuler size={18} class="text-accent" style="margin-right: 8px;" /> {$t('mainContent.discover.sections.shaders')}</span
        >
        <button
          class="btn-default btn"
          on:click={navigateToShaders}>{$t('mainContent.discover.buttons.viewMore')}<ChevronRight size={16} style="margin-left: 4px;" /></button
        >
      </div>
      <div class="shaders-grid">
        {#if loading}
          <Loading message={$t('mainContent.discover.sections.loadingShaders')} size="medium" fullPage={true} layout="cards" />
        {:else if shaders.length === 0}
          <div class="empty-state">{$t('mainContent.discover.sections.noShaders')}</div>
        {:else}
          {#each shaders as sh}
            {console.log(sh)}
            <Card
              variant="shader"
              title={sh.title}
              icon={sh.icon_url || "./images/static/minecraft_grass.jpg"}
              subtitle={`By ${sh.author}`}
              description={sh.description}
              downloads={sh.downloads}
              gameVersions={getVersions(sh)}
              lastUpdated={sh.date_modified || sh.date_created}
              size="medium"
              clickable={true}
              onClick={() => handleViewItem(sh, 'shader')}
            />
          {/each}
        {/if}
        {#if shaders.length === 0}
          <div class="empty-state">{$t('mainContent.discover.sections.noResultsFound')}</div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="section-group">
    <div class="section-header">
      <span class="section-title"
        ><Clock size={18} class="text-accent" style="margin-right: 8px;" /> {$t('mainContent.discover.sections.recentlyUpdated')}</span
      >
    </div>
    <div class="recent-list">
      {#if loading}
        <Loading message={$t('mainContent.discover.sections.loadingRecentlyUpdated')} size="medium" fullPage={true} />
      {:else if recentlyUpdated.length === 0}
        <div class="empty-state">{$t('mainContent.discover.sections.noRecentlyUpdated')}</div>
      {:else}
        {#each recentlyUpdated as item}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="recent-item" on:click={() => handleViewItem(item, 'mod')}>
              <div class="recent-info">
                <div class="icon">
                    <img
                      src={item.icon_url || "./images/static/minecraft_grass.jpg"}
                      alt={item.title}
                      class="instance-art"
                    />
                </div>
                <div class="recent-name-desc"> 
                    <span class="recent-title">{item.title}</span>
                    <span class="recent-author">By {item.author}</span>
                </div>
            </div>
          <div class="recent-meta">
            <span class="recent-date"
              >{new Date(
                item.date_modified || item.date_created
              ).toLocaleDateString()}</span
            >
            <span class="recent-downloads"
              ><Download size={14} style="margin-right: 4px;" />
              {formatNumber(item.downloads)}</span
            >
          </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>
{#if showItemViewerModal}
  <ItemViewerModal
    open={showItemViewerModal}
    item={itemToView}
    itemType={itemTypeToView}
    on:close={closeItemViewerModal}
  />
{/if}

<style>
  .discover-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overflow-y: auto;
    padding: 10px;
    padding-bottom: 2rem;
    row-gap: 1rem;
  }
  .discover-header-section{
    background-color: var(--surface-color);

    .discover-section-header{
        background-color: var(--overlay-color);
        display: flex;
        flex-direction: row;
        column-gap: 10px;
        height: 100px;
        padding: 0.4rem 0.8rem;
        background: linear-gradient(to left, color-mix(in srgb, var(--overlay-color), transparent 70%), var(--overlay-color)), url('./images/static/winterland.png');
        background-size: cover;
        background-position: center 10%;
        color: var(--text-color);
        font-size: var(--font-size-body);
        display: flex;
        align-items: end;
        
        :global(svg){
          opacity: .5;
          margin-bottom: 5px;
        }

        .section-title {
          gap: 5px;
          font-weight: 600;
          margin-top: 4px !important;
          font-size: 28px;
        }
    }
  }

  .section-group {
    display: flex;
    flex-direction: column;
  }
  .section-header {
    display: flex;
    flex-direction: row;
    column-gap: 10px;
    align-items: center;
    padding: 0.4rem 0;
    font-size: var(--font-size-fluid-sm);
    border-bottom: 1px solid color-mix(in srgb, var(--border-color), transparent 70%);
    color: var(--text-color-muted);
    justify-content: space-between;
    

    button{
      font-size: var(--font-size-sm);
      display: flex;
      flex-direction: row;
      font-size: var(--font-size-sm);
      align-items: center;
      background-color: transparent !important;
      color: var(--text-color-muted) !important;
      box-shadow: none !important;
      justify-content: center;
      padding: 0 !important;
      gap: 0;

      &:hover{
          padding-right: 8px !important;
          color: var(--text-color) !important;
      }
    }
  }
  
  .mods-grid,
  .resourcepacks-grid,
  .shaders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 10px;
    padding-top: 10px;
  }

  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 1rem;
    color: var(--text-color-muted);
    border: 1px dashed var(--border-color);
  }
  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1rem 0;
  }
  .recent-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--overlay-color);
    border: 1px solid var(--border-color);
    padding: 0.6rem 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
 
    &:hover {
      border-bottom-width: 5px;
    }
    &:active {
      border-bottom-width: 1px;
    }
  }
  .recent-info {
    display: flex;
    flex-direction: row;
    gap: 0.6rem;
    min-width: 0;

    .recent-name-desc{
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        justify-content: center;
        align-items: start;
        color: var(--text-color-muted);
        flex: 1;
        min-width: 0;
    }
    .icon{
        width: 3rem;
        height: 3rem;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 8px;
        flex-shrink: 0;

        img{
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }
  }
  .recent-title {
    font-size: 0.95rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-color);
  }
  .recent-author {
    font-size: 0.85rem;
    color: var(--text-color-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .recent-meta {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    color: var(--text-color-muted);
    font-size: .8rem;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: var(--text-color-muted);
    background-color: var(--overlay-color-1);
    border-radius: 12px;
    border: 1px solid var(--border-color);
    min-height: 200px;
  }


</style>
