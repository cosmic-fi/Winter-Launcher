<script>
  // @ts-nocheck

  import { onMount } from "svelte";
  import modrinthService from "../services/modrinthService";
  import CustomOptions from "../components/ui/Options.svelte";
  import SimpleTip from "../components/ui/Tip.svelte";
  import Card from "../components/ui/Card.svelte";
  import Loading from "../components/ui/Loading.svelte";
  import ItemViewerModal from "../components/modal/ItemViewerModal.svelte";
  import Pagination from "../components/ui/Pagination.svelte";
  import { PackageSearch, Search, Loader2, Package, Info, Download, ToolCase } from '@lucide/svelte';
  import { t } from '../stores/i18n';
  import SearchBox from "../components/ui/SearchBox.svelte";

  let searchQuery = "";
  let items = [];
  let loading = false;
  let isPageTransition = false;
  let initialLoad = true;
  let offset = 0;
  let hasMore = true;
  let currentPage = 1;
  let totalHits = 0;
  let totalPages = 1;

  let loader = "all";
  let environment = "all";
  let sort = "relevance";
  let gameVersion = "all";
  let category = "all";
  const ITEMS_PER_PAGE = 20; // Modrinth default limit is 20, let's match it or use 20
  
  let gameVersions = [{ value: "all", label: $t('mainContent.mods.filters.gameVersions.all') }];
  let categories = [{ value: "all", label: $t('mainContent.mods.filters.categories.all') }];

  let showItemViewerModal = false;
  let itemToView = null;
  let itemTypeToView = 'mod';

  const loaderOptions = [
    { value: "all", label: $t('mainContent.mods.filters.loaders.all') },
    { value: "forge", label: $t('mainContent.mods.filters.loaders.forge') },
    { value: "fabric", label: $t('mainContent.mods.filters.loaders.fabric') },
    { value: "quilt", label: $t('mainContent.mods.filters.loaders.quilt') },
    { value: "neoforge", label: $t('mainContent.mods.filters.loaders.neoforge') },
  ];
  const environmentOptions = [
    { value: "all", label: $t('mainContent.mods.filters.environment.all') },
    { value: "client", label: $t('mainContent.mods.filters.environment.client') },
    { value: "server", label: $t('mainContent.mods.filters.environment.server') },
  ];
  const sortOptions = [
    { value: "relevance", label: $t('mainContent.mods.filters.sort.relevance') },
    { value: "downloads", label: $t('mainContent.mods.filters.sort.downloads') },
    { value: "follows", label: $t('mainContent.mods.filters.sort.follows') },
    { value: "newest", label: $t('mainContent.mods.filters.sort.newest') },
    { value: "updated", label: $t('mainContent.mods.filters.sort.updated') },
  ];

  async function load(reset = true) {
    if (loading) return;
    loading = true;
    isPageTransition = !reset; // Set to true when navigating pages
    if (reset) {
      offset = 0;
      items = [];
      currentPage = 1;
    }
    
    try {
      const result = await modrinthService.searchMods({
        query: searchQuery,
        gameVersion: gameVersion !== "all" ? gameVersion : undefined,
        loader: loader !== "all" ? loader : undefined,
        category: category !== "all" ? category : undefined,
        environment: environment !== "all" ? environment : undefined,
        sort: sort,
        offset,
        limit: ITEMS_PER_PAGE,
      });

      // Modrinth handles filtering server-side via facets
      items = result.hits || [];
      totalHits = result.total_hits || 0;
      hasMore = items.length === ITEMS_PER_PAGE;
      totalPages = Math.max(1, Math.ceil(totalHits / ITEMS_PER_PAGE));
    } catch (error) {
      console.error($t('mainContent.mods.errors.failedToLoadMods'), error);
      items = [];
      totalHits = 0;
    } finally {
      loading = false;
      isPageTransition = false;
      initialLoad = false;
    }
  }

  function handleSearch(e) {
    searchQuery = e.detail.value;
    clearTimeout(this._t);
    this._t = setTimeout(() => load(true), 400);
  }

  function handleCategoryOptionChanges(value){
    category = value;
    load(true);
  }
  function handleLoaderOptionChange(value){
    loader = value;
    load(true);
  }
  function handleEnvironmentOptionChange(value){
    environment = value;
    load(true)
  }
  function handleSortOptionChange(value){
    sort = value;
    load(true);
  }

  const filterHandlers = {
    category: handleCategoryOptionChanges,
    loader: handleLoaderOptionChange,
    environment: handleEnvironmentOptionChange,
    sort: handleSortOptionChange
  }

  function handleFilterOptionChange(e){
    const { filterId, value } = e.detail;
    filterHandlers[filterId]?.(value);
  }

  function loadMore() {
    if (!hasMore || loading) return;
    offset += ITEMS_PER_PAGE;
    load(false);
  }

  function scrollToTop() {
    const pageEl = document.querySelector('.mods-page');
    if (pageEl) {
      pageEl.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goToPage(p) {
    const page = Math.min(Math.max(1, p), totalPages);
    const newOffset = (page - 1) * ITEMS_PER_PAGE;
    if (newOffset === offset) return;
    offset = newOffset;
    currentPage = page;
    scrollToTop();
    load(false);
  }

  function nextPage() {
    if (currentPage < totalPages) goToPage(currentPage + 1);
  }
  function prevPage() {
    if (currentPage > 1) goToPage(currentPage - 1);
  }

  function handleViewMod(mod) {
    itemToView = mod;
    itemTypeToView = 'mod';
    showItemViewerModal = true;
  }
  
  function handleInstallMod(mod) {
    itemToView = mod;
    itemTypeToView = 'mod';
    showItemViewerModal = true;
  }
  
  function closeItemViewerModal() {
    showItemViewerModal = false;
    itemToView = null;
    itemTypeToView = 'mod';
  }

  async function loadGameVersions() {
    try {
      const versionsData = await modrinthService.getGameVersions();
      const versions = versionsData.map(v => v.version).filter(Boolean);

      gameVersions = [
        { value: "all", label: $t('mainContent.mods.filters.gameVersions.all') },
        ...versions.map(v => ({ value: v, label: v }))
      ];
    } catch (error) {
      console.error($t('mainContent.mods.errors.failedToLoadGameVersions'), error);
      gameVersions = [{ value: "all", label: $t('mainContent.mods.filters.gameVersions.all') }];
    }
  }

  async function loadCategories() {
    try {
      const categoriesData = await modrinthService.getCategories();

      // Filter categories that are relevant for mods
      // Modrinth categories have a project_type field, but it's often 'mod' or generic
      const categoryOptions = categoriesData
        .filter(cat => cat.project_type === 'mod' || !cat.project_type)
        .map(cat => ({ value: cat.name, label: cat.name.charAt(0).toUpperCase() + cat.name.slice(1) }))
        .sort((a, b) => a.label.localeCompare(b.label));

      categories = [
        { value: "all", label: $t('mainContent.mods.filters.categories.all') },
        ...categoryOptions
      ];
    } catch (error) {
      console.error($t('mainContent.mods.errors.failedToLoadCategories'), error);
      // Use common mod categories as fallback
      categories = [
        { value: "all", label: $t('mainContent.mods.filters.categories.all') },
        { value: "technology", label: "Technology" },
        { value: "magic", label: "Magic" },
        { value: "adventure", label: "Adventure" },
        { value: "utility", label: "Utility" },
        { value: "decoration", label: "Decoration" },
        { value: "storage", label: "Storage" },
        { value: "world-generation", label: "World Generation" },
        { value: "food", label: "Food" },
        { value: "transportation", label: "Transportation" }
      ];
    }
  }

  onMount(async () => {
    await loadGameVersions();
    await loadCategories();
    load(true);
  });
</script>

<div class="mods-page">
  <div class="page-header-section">
    <div class="page-section-header">
      <ToolCase size={24} />
      <span class="section-title">{$t('mainContent.mods.title')}</span>
    </div>
  </div>
  <SearchBox
    searchQuery={searchQuery}
    filterOptions={[
      {
        id: 'category',
        options: categories,
        value: category
      },
      {
        id: 'loader',
        options: loaderOptions,
        value: loader
      },
      {
        id: 'environment',
        options: environmentOptions,
        value: environment
      },
      {
        id: 'sort',
        options: sortOptions,
        value: sort
      }
    ]}
    loadingState={loading}
    on:search={handleSearch}
    on:filterOptionChange={handleFilterOptionChange}
  />
  <div class="section-group">
    <div class="mods-grid">
      {#if initialLoad || (loading && items.length === 0)}
        <Loading size="medium" amount={12} fullPage={true} layout="cards" />
      {:else if loading && items.length > 0 && isPageTransition}
        <Loading size="medium" amount={12} fullPage={true} layout="cards" />
      {:else if loading && items.length > 0}
        <Loading size="medium" amount={12} fullPage={true} layout="cards" />
        {:else if items.length === 0}
        <div class="empty-state">
          <Package size={48} />
          <p>{$t('mainContent.mods.empty.noModsFound')}</p>
          <p class="empty-subtitle">{$t('mainContent.mods.empty.tryAdjustingFilters')}</p>
        </div>
      {:else}
        {#each items as mod}
          <Card
            variant="mod"
            title={mod.title}
            subtitle={`By ${mod.author}`}
            icon={mod.icon_url}
            downloads={mod.downloads || mod.downloads_count || 0}
            gameVersions={mod.latest_version?.game_versions || mod.game_versions || []}
            loaders={mod.latest_version?.loaders || mod.loaders || []}
            lastUpdated={mod.date_modified}
            description={mod.description}
            clickable={true}
            onClick={() => handleViewMod(mod)}
          />
        {/each}
        {/if}
      </div>
      {#if totalPages > 1}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          loading={loading}
          prevPage={prevPage}
          nextPage={nextPage}
          alignment="left"
        />
      {/if}
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
  .mods-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overflow-y: auto;
    padding: 10px;
    row-gap: 1rem;
  }
  .page-header-section {
    display: flex;
    flex-direction: column;
    row-gap: 0.5rem;
  }
  .page-header-section{
    background-color: var(--surface-color);

    .page-section-header{
      background-color: var(--overlay-color);
      display: flex;
      flex-direction: row;
      column-gap: 10px;
      height: 100px;
      align-items: center;
      padding: 0.4rem 0.8rem;
      background: linear-gradient(to left, color-mix(in srgb, var(--overlay-color), transparent 70%), var(--overlay-color)), url('./images/static/winterland.png');
      background-size: cover;
      background-position: center 84%;
      color: var(--text-color);
      font-size: var(--font-size-sm);
      display: flex;
      align-items: end;
      flex-direction: row;

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
  
  

  .mods-grid {
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
    border-radius: 8px;
  }

  /* Empty states */
  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 3rem;
    color: var(--text-color-muted);
  }

  .empty-state :global(svg) {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-subtitle {
    font-size: 0.9rem;
    opacity: 0.7;
    margin-top: 0.5rem;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
