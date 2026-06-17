<script>
  // @ts-nocheck

  import { onMount } from "svelte";
  import { Lightbulb, Search, Info, Download, Palette } from "@lucide/svelte";
  import modrinthService from "../services/modrinthService";
  import CustomOptions from "../components/ui/Options.svelte";
  import Loading from "../components/ui/Loading.svelte";
  import Card from "../components/ui/Card.svelte";
  import ItemViewerModal from "../components/modal/ItemViewerModal.svelte";
  import Pagination from "../components/ui/Pagination.svelte";
  import { t } from '../stores/i18n';
  import SearchBox from "../components/ui/SearchBox.svelte";

  let searchQuery = "";
  let items = [];
  let loading = false;
  let offset = 0;
  let hasMore = true;
  let currentPage = 1;
  let totalHits = 0;
  let totalPages = 1;
  let isPageTransition = false;
  let initialLoad = true;

  let version = "all";
  let category = "all";
  let sort = "newest";
  let itemCount = 20;
  let categories = [{ value: "all", label: $t('mainContent.shaders.filters.categories.all') }];

  let showItemViewerModal = false;
  let itemToView = null;
  let itemTypeToView = 'shader';

  const sortOptions = [
    { value: "newest", label: $t('mainContent.shaders.filters.sort.newest') },
    { value: "relevance", label: $t('mainContent.shaders.filters.sort.relevance') },
    { value: "downloads", label: $t('mainContent.shaders.filters.sort.downloads') },
    { value: "updated", label: $t('mainContent.shaders.filters.sort.updated') },
  ];
  const itemCountOptions = [
    { value: "10", label: $t('mainContent.shaders.filters.itemCount.10') },
    { value: "20", label: $t('mainContent.shaders.filters.itemCount.20') },
    { value: "50", label: $t('mainContent.shaders.filters.itemCount.50') },
    { value: "100", label: $t('mainContent.shaders.filters.itemCount.100') },
  ];

  function buildFacets() {
    const facets = [["project_type:shader"]];
    if (version !== "all") facets.push([`versions:${version}`]);
    if (category !== "all") facets.push([`categories:${category}`]);
    return JSON.stringify(facets);
  }

  async function load(reset = true) {
    if (loading) return;
    loading = true;
    isPageTransition = !reset;
    if (reset) {
      offset = 0;
      items = [];
      currentPage = 1;
    }
    const result = await modrinthService.searchProjects({
      query: searchQuery,
      facets: buildFacets(),
      index: sort,
      offset,
      limit: itemCount,
    });
    items = result.hits || [];
    hasMore = (result.hits || []).length === itemCount;
    totalHits = Number(result.total || result.total_hits || items?.length || 0);
    totalPages = Math.max(1, Math.ceil(totalHits / itemCount));
    loading = false;
    isPageTransition = false;
    initialLoad = false;
  }

  function handleSearch(e) {
    searchQuery = e.detail.value;
    clearTimeout(this._t);
    this._t = setTimeout(() => load(true), 400);
  }

  function handleCategoryOptionChange(value){
    category = value;
    load(true);
  }
  function handleSortOptionChange(value){
    sort = value;
    load(true);
  }
  function handleCountOptionChanges(value){
    itemCount = Number(value);
    load(true);
  }

  const filterHandlers = {
    category: handleCategoryOptionChange,
    sort: handleSortOptionChange,
    count: handleCountOptionChanges
  }

  function handleFilterOptionChange(e){
    const { filterId, value } = e.detail;
    filterHandlers[filterId]?.(value)
  }

  function loadMore() {
    if (!hasMore || loading) return;
    offset += itemCount;
    load(false);
  }

  function scrollToTop() {
    const pageEl = document.querySelector('.shaders-page');
    if (pageEl) {
      pageEl.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goToPage(p) {
    const page = Math.min(Math.max(1, p), totalPages);
    const newOffset = (page - 1) * itemCount;
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

  function getVersion(item) {
    const gv = item?.game_versions || item?.latest_version?.game_versions;
    return (gv && gv[0]) || "";
  }
  
  function handleViewShader(shader) {
    itemToView = shader;
    itemTypeToView = 'shader';
    showItemViewerModal = true;
  }
  
  function handleInstallShader(shader) {
    itemToView = shader;
    itemTypeToView = 'shader';
    showItemViewerModal = true;
  }
  
  function closeItemViewerModal() {
    showItemViewerModal = false;
    itemToView = null;
    itemTypeToView = 'shader';
  }

  async function loadCategories() {
    try {
      // Load some initial shader data to see what categories are available
      const initialResult = await modrinthService.searchProjects({
        query: "",
        facets: '[["project_type:shader"]]',
        limit: 100,
        offset: 0
      });

      // Extract unique categories from the actual shader data
      const uniqueCategories = new Set();
      initialResult.hits.forEach(shader => {
        if (shader.categories && Array.isArray(shader.categories)) {
          shader.categories.forEach(cat => uniqueCategories.add(cat));
        }
      });

      // Convert to options format and sort
      const categoryOptions = Array.from(uniqueCategories)
        .sort()
        .map(cat => ({ value: cat, label: cat }));

      categories = [
        { value: "all", label: $t('mainContent.shaders.filters.categories.all') },
        ...categoryOptions
      ];
    } catch (error) {
      console.error($t('mainContent.shaders.errors.failedToLoadCategories'), error);
      // Use common shader categories as fallback
      categories = [
        { value: "all", label: $t('mainContent.shaders.filters.categories.all') },
        { value: "Vanilla", label: "Vanilla" },
        { value: "OptiFine", label: "OptiFine" },
        { value: "Iris", label: "Iris" },
        { value: "Realistic", label: "Realistic" },
        { value: "Fantasy", label: "Fantasy" },
        { value: "PvP", label: "PvP" },
        { value: "Performance", label: "Performance" }
      ];
    }
  }

  onMount(async () => {
    await loadCategories();
    load(true);
  });
</script>

<div class="shaders-page">
  <div class="page-header-section">
    <div class="page-section-header">
      <Palette size={24} />
      <h1 class="section-title">{$t('mainContent.shaders.title')}</h1>
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
        id: 'sort',
        options: sortOptions,
        value: sort
      },
      {
        id: 'count',
        options: itemCountOptions,
        value: String(itemCount)
      }
    ]}
    loadingState={loading}
    on:search={handleSearch}
    on:filterOptionChange={handleFilterOptionChange}
  />
  <div class="section-group">
    <div class="shots-grid">
      {#if initialLoad || (loading && items.length === 0)}
        <Loading size="medium" amount={12} fullPage={true} layout="cards" />
      {:else if loading && items.length > 0 && isPageTransition}
        <Loading size="medium" amount={12} fullPage={true} layout="cards" />
      {:else if loading && items.length > 0}
        <Loading size="medium" amount={12} fullPage={true} layout="cards" />
      {:else if items.length === 0}
        <div class="empty-state">
          <Lightbulb size={48} />
          <p>{$t('mainContent.shaders.empty.noShadersFound')}</p>
          <p class="empty-subtitle">{$t('mainContent.shaders.empty.tryAdjustingFilters')}</p>
        </div>
      {:else}
        {#each items as sh}
          <Card
            variant="shader"
            title={sh.title}
            icon={sh.icon_url || "./images/static/minecraft_grass.jpg"}
            subtitle={`By ${sh.author}`}
            description={sh.description}
            downloads={sh.downloads}
            gameVersions={sh.game_versions || (sh.latest_version?.game_versions ? [sh.latest_version.game_versions[0]] : [])}
            loaders={sh.loaders || []}
            lastUpdated={sh.date_modified || sh.date_created}
            size="medium"
            clickable={true}
            showArtwork={true}
            artworkUrl={sh.gallery && sh.gallery.length > 0 ? sh.gallery[0] : null}
            onClick={() => handleViewShader(sh)}
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
  .shaders-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overflow-y: auto;
    padding: 10px;
    row-gap: 1rem;
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
      background-position: center 24%;
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

  .section-title {
    gap: 5px;
    display: flex;
    font-weight: 500;
    padding-block: 0.4rem;
  }
  
  .shots-grid {
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
    margin-top: 0.5rem;
    opacity: 0.7;
  }
</style>
