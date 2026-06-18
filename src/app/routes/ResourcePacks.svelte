<script>
  // @ts-nocheck

  import { onMount } from "svelte";
  import modrinthService from "../services/modrinthService";
  import CustomOptions from "../components/ui/Options.svelte";
  import Loading from "../components/ui/Loading.svelte";
  import Card from "../components/ui/Card.svelte";
  import ItemViewerModal from "../components/modal/ItemViewerModal.svelte";
  import Pagination from "../components/ui/Pagination.svelte";
  import { Image, Search, Info, Download, PencilRuler } from '@lucide/svelte';
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
  let sort = "updated";
  let itemCount = 20;
  let categories = [{ value: "all", label: $t('mainContent.resourcepacks.filters.categories.all') }];

  let showItemViewerModal = false;
  let itemToView = null;
  let itemTypeToView = 'resourcepack';

  const sortOptions = [
    { value: "downloads", label: $t('mainContent.resourcepacks.filters.sort.trending') },
    { value: "relevance", label: $t('mainContent.resourcepacks.filters.sort.relevance') },
    { value: "follows", label: $t('mainContent.resourcepacks.filters.sort.follows') },
    { value: "updated", label: $t('mainContent.resourcepacks.filters.sort.updated') },
  ];
  const itemCountOptions = [
    { value: "10", label: $t('mainContent.resourcepacks.filters.itemCount.10') },
    { value: "20", label: $t('mainContent.resourcepacks.filters.itemCount.20') },
    { value: "50", label: $t('mainContent.resourcepacks.filters.itemCount.50') },
    { value: "100", label: $t('mainContent.resourcepacks.filters.itemCount.100') },
  ];

  function buildFacets() {
    const facets = [["project_type:resourcepack"]];
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
    const pageEl = document.querySelector('.resourcepacks-page');
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
  
  function handleViewResourcePack(rp) {
    itemToView = rp;
    itemTypeToView = 'resourcepack';
    showItemViewerModal = true;
  }
  
  function handleInstallResourcePack(rp) {
    itemToView = rp;
    itemTypeToView = 'resourcepack';
    showItemViewerModal = true;
  }
  
  function closeItemViewerModal() {
    showItemViewerModal = false;
    itemToView = null;
    itemTypeToView = 'resourcepack';
  }

  async function loadCategories() {
    try {
      // Load some initial resource pack data to see what categories are available
      const initialResult = await modrinthService.searchProjects({
        query: "",
        facets: '[["project_type:resourcepack"]]',
        limit: 100,
        offset: 0
      });

      // Extract unique categories from the actual resource pack data
      const uniqueCategories = new Set();
      initialResult.hits.forEach(resourcepack => {
        if (resourcepack.categories && Array.isArray(resourcepack.categories)) {
          resourcepack.categories.forEach(cat => uniqueCategories.add(cat));
        }
      });

      // Convert to options format and sort
      const categoryOptions = Array.from(uniqueCategories)
        .sort()
        .map(cat => ({ value: cat, label: cat }));

      categories = [
        { value: "all", label: $t('mainContent.resourcepacks.filters.categories.all') },
        ...categoryOptions
      ];
    } catch (error) {
      console.error($t('mainContent.resourcepacks.errors.failedToLoadCategories'), error);
      // Use common resource pack categories as fallback
      categories = [
        { value: "all", label: $t('mainContent.resourcepacks.filters.categories.all') },
        { value: "Realistic", label: "Realistic" },
        { value: "Simplistic", label: "Simplistic" },
        { value: "Themed", label: "Themed" },
        { value: "PvP", label: "PvP" },
        { value: "Faithful", label: "Faithful" },
        { value: "Cartoon", label: "Cartoon" },
        { value: "Medieval", label: "Medieval" },
        { value: "Modern", label: "Modern" },
        { value: "Fantasy", label: "Fantasy" }
      ];
    }
  }

  onMount(async () => {
    await loadCategories();
    load(true);
  });
</script>

<div class="resourcepacks-page">
  <div class="page-header-section">
    <div class="page-section-header">
      <PencilRuler size={24} />
      <h1 class="section-title">{$t('mainContent.resourcepacks.title')}</h1>
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
          <Image size={48} />
          <p>{$t('mainContent.resourcepacks.empty.noResourcePacksFound')}</p>
          <p class="empty-subtitle">{$t('mainContent.resourcepacks.empty.tryAdjustingFilters')}</p>
        </div>
      {:else}
        {#each items as rp}
          <Card
            variant="resourcepack"
            title={rp.title}
            icon={rp.icon_url || "./images/static/minecraft_grass.jpg"}
            subtitle={`By ${rp.author}`}
            description={rp.description}
            downloads={rp.downloads}
            gameVersions={rp.game_versions || (rp.latest_version?.game_versions ? [rp.latest_version.game_versions[0]] : [])}
            loaders={rp.loaders || []}
            lastUpdated={rp.date_modified || rp.date_created}
            size="medium"
            clickable={true}
            showArtwork={true}
            artworkUrl={rp.featured_gallery}
            onClick={() => handleViewResourcePack(rp)}
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
  .resourcepacks-page {
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
      background-position: center 70%;
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
