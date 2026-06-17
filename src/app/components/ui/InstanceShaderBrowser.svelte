<script>
  // @ts-nocheck

  import { onMount } from "svelte";
  import { Search, Plus } from "@lucide/svelte";
  import CustomOptions from "./Options.svelte";
  import Loading from "./Loading.svelte";
  import BrowserSkeleton from "./BrowserSkeleton.svelte";
  import modrinthService from "../../services/modrinthService";
  import { instanceStore } from "../../stores/instances";
  import { showToast } from "../../stores/ui";
  import Pagination from "./Pagination.svelte";
  import { t } from "../../stores/i18n";
  import SearchBox from "./SearchBox.svelte";
  import ItemViewerModal from "../modal/ItemViewerModal.svelte";
  export let instance = null;
  let searchQuery = "";
  let items = [];
  let loading = false;
  let initialLoad = true;
  let offset = 0;
  let hasMore = true;
  let currentPage = 1;
  let totalHits = 0;
  let totalPages = 1;
  let isPageTransition = false;
  let version = "all";
  let category = "all";
  let sort = "newest";
  let itemCount = 10;
  
  let categories = [
    {
      value: "all",
      label: $t(
        "mainContent.instances.browsers.shaderBrowser.labels.allCategories",
      ),
    },
  ];
  let adding = {};

  let showItemViewerModal = false;
  let itemToView = null;
  let itemTypeToView = "shader";

  // Reactive Set/Map for installed shaders
  $: installedShaderIds = new Set();
  $: installedShaderMap = new Map();

  $: if (instance?.shaders) {
    const shaders = instance.shaders;
    const ids = new Set();
    const map = new Map();
    shaders.forEach((s) => {
      if (s.modrinth_id) {
        ids.add(String(s.modrinth_id));
        map.set(String(s.modrinth_id), s.id);
      }
      if (s.name) {
        ids.add(s.name);
        map.set(s.name, s.id);
      }
    });
    installedShaderIds = ids;
    installedShaderMap = map;
  }

  function getShaderId(shader) {
    return shader.project_id || shader.slug || shader.id;
  }

  const sortOptions = [
    {
      value: "newest",
      label: $t(
        "mainContent.instances.browsers.shaderBrowser.filters.sort.newest",
      ),
    },
    {
      value: "relevance",
      label: $t(
        "mainContent.instances.browsers.shaderBrowser.filters.sort.relevance",
      ),
    },
    {
      value: "downloads",
      label: $t(
        "mainContent.instances.browsers.shaderBrowser.filters.sort.downloads",
      ),
    },
    {
      value: "updated",
      label: $t(
        "mainContent.instances.browsers.shaderBrowser.filters.sort.updated",
      ),
    },
  ];

  $: if (instance) {
    version = instance.gameVersion || "all";
  }
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
      currentPage = 1;
    }
    const result = await modrinthService.searchProjects({
      query: searchQuery.trim().length < 2 ? "" : searchQuery,
      facets: buildFacets(),
      index: sort,
      offset,
      limit: itemCount,
    });
    items = result.hits || [];
    totalHits = Number(result.total || result.total_hits || items?.length || 0);
    totalPages = Math.max(1, Math.ceil(totalHits / itemCount));
    hasMore = currentPage < totalPages;
    loading = false;
    isPageTransition = false;
    initialLoad = false;
  }
  function scrollToTop() {
    // Scroll to the top of the controls section for better UX
    const controlsElement = document.querySelector(".controls");
    if (controlsElement) {
      controlsElement.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // Fallback: scroll to top of browser container
      const browserElement = document.querySelector(".browser");
      if (browserElement) {
        browserElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function handleShaderPackView(shader) {
    itemToView = shader;
    itemTypeToView = "shader";
    showItemViewerModal = true;
  }

  function closeItemViewerModal() {
    showItemViewerModal = false;
    itemToView = null;
    itemTypeToView = "shader";
  }

  function handleSearch(e) {
    searchQuery = e.detail.value;
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      scrollToTop();
      load(true);
    }, 400);
  }

  function handleCategoryChange(value) {
    category = value;
    scrollToTop();
    load(true);
  }
  function handleSortChange(value) {
    sort = value;
    scrollToTop();
    load(true);
  }

  const filterHandlers = {
    category: handleCategoryChange,
    sort: handleSortChange
  }

  function handleFilterOptionChange(e){
    const { filterId, value } = e.detail;
    filterHandlers[filterId]?.(value);
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
  async function addShader(shader) {
    if (!instance) return;
    const pid = shader.project_id || shader.slug || shader.id;
    if (adding[pid]) return;
    adding[pid] = true;
    try {
      const versions = await modrinthService.getProjectVersions(pid, {
        gameVersion: instance.gameVersion,
      });
      const latest = versions[0];
      if (!latest || !latest.files || latest.files.length === 0) {
        throw new Error("No compatible file found");
      }
      const primaryFile =
        latest.files.find((f) => f.primary) || latest.files[0];

      let instancePath;
      if (instance.path) {
        instancePath = instance.path;
      } else {
        const appFolder = await window.electron.getAppFolder();
        instancePath = await window.electron.invoke(
          "path-join",
          appFolder,
          "instances",
          instance.id,
        );
      }

      const targetPath = await window.electron.invoke(
        "path-join",
        instancePath,
        "shaderpacks",
        primaryFile.filename,
      );
      await modrinthService.downloadFile(primaryFile.url, targetPath);

      await instanceStore.addShader(instance.id, {
        name: shader.title,
        version: latest.version_number,
        fileName: primaryFile.filename,
        modrinthId: pid,
      });
    } catch (error) {
      showToast(
        error.message ||
          $t("mainContent.instances.browsers.shaderBrowser.toasts.failedToAdd"),
        "error",
      );
    } finally {
      adding[pid] = false;
    }
  }
  async function removeShader(shader) {
    const pid = getShaderId(shader);
    const id =
      installedShaderMap.get(String(pid)) ||
      installedShaderMap.get(shader.title);
    if (!id) {
      return;
    }
    try {
      await instanceStore.removeShader(id);
    } catch (error) {
      showToast(
        error.message ||
          $t(
            "mainContent.instances.browsers.shaderBrowser.toasts.failedToRemove",
          ),
        "error",
      );
    }
  }
  async function loadCategories() {
    try {
      const initial = await modrinthService.searchProjects({
        query: "",
        facets: '[["project_type:shader"]]',
        limit: 100,
        offset: 0,
      });
      const unique = new Set();
      initial.hits.forEach((sh) => {
        (sh.categories || []).forEach((cat) => unique.add(cat));
      });
      categories = [
        {
          value: "all",
          label: $t(
            "mainContent.instances.browsers.shaderBrowser.labels.allCategories",
          ),
        },
        ...Array.from(unique)
          .sort()
          .map((c) => ({ value: c, label: c })),
      ];
    } catch {
      categories = [
        {
          value: "all",
          label: $t(
            "mainContent.instances.browsers.shaderBrowser.labels.allCategories",
          ),
        },
      ];
    }
  }
  onMount(async () => {
    await loadCategories();
    load(true);
  });
</script>

<div class="browser">
  <SearchBox
    searchQuery={searchQuery}
    loadingState={loading}
    filterOptions={[
      {
        id: 'category',
        options: categories,
        value: category,
      },
      {
        id: 'sort',
        options: sortOptions,
        value: sort,
      }
    ]}
    on:search={handleSearch}
    on:filterOptionChange={handleFilterOptionChange}
  />
  <!-- <div class="controls">
    <div class="search-bar">
      <input
        type="text"
        class="search-input"
        placeholder={$t('mainContent.instances.browsers.shaderBrowser.searchPlaceholder')}
        value={searchQuery}
        on:input={handleSearch}
      />
    </div>
    <div class="filters">
      <CustomOptions
        id="sh-category"
        options={categories}
        value={category}
        disabled={loading}
        preferredPosition="down-left"
        on:optionchange={(e) => {
          category = e.detail.value;
          scrollToTop();
          load(true);
        }}
      />
      <CustomOptions
        id="sh-sort"
        options={sortOptions}
        value={sort}
        disabled={loading}
        preferredPosition="down-right"
        on:optionchange={(e) => {
          sort = e.detail.value;
          scrollToTop();
          load(true);
        }}
      />
    </div>
  </div> -->
  {#if loading || initialLoad}
    <div class="list">
      <BrowserSkeleton count={itemCount} />
    </div>
  {:else if items.length === 0}
    <div class="list">
      <div class="no-results">
        <Search size={48} />
        <p>
          {$t(
            "mainContent.instances.browsers.shaderBrowser.empty.noResultsFound",
          )}
        </p>
        <span class="hint"
          >{$t(
            "mainContent.instances.browsers.shaderBrowser.empty.tryAdjustingFilters",
          )}</span
        >
      </div>
    </div>
  {:else}
    <div class="list">
      {#each items as sh}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="row" on:click={() => handleShaderPackView(sh)}>
          <div class="icon">
            <img
              src={sh.icon_url || "./images/static/minecraft_grass.jpg"}
              alt={sh.title}
            />
          </div>
          <div class="info-container">
            <div class="info">
              <div class="title">{sh.title}</div>
              <div class="meta">
                <span
                  >{$t(
                    "mainContent.instances.browsers.shaderBrowser.labels.by",
                  )}
                  {sh.author}</span
                >
                {#if sh.latest_version?.game_versions?.length > 0}
                  <span class="sep">•</span>
                  <span>{sh.latest_version.game_versions[0]}</span>
                {/if}
                {#if sh.downloads}
                  <span class="sep">•</span>
                  <span
                    >{sh.downloads.toLocaleString()}
                    {$t(
                      "mainContent.instances.browsers.shaderBrowser.labels.downloads",
                    )}</span
                  >
                {/if}
              </div>
              {#if sh.description}
                <div class="description">{sh.description}</div>
              {/if}
            </div>
            <div class="actions">
              {#if installedShaderIds.has(String(getShaderId(sh))) || installedShaderIds.has(sh.title)}
                <!-- svelte-ignore a11y_consider_explicit_label -->
                <button
                  class="btn btn-danger btn-sm"
                  on:click={() => removeShader(sh)}
                >
                  {$t(
                    "mainContent.instances.browsers.shaderBrowser.actions.remove",
                  )}
                </button>
              {:else}
                <button
                  class="btn btn-accent btn-sm"
                  disabled={adding[sh.project_id || sh.slug || sh.id]}
                  on:click={() => addShader(sh)}
                >
                  {#if adding[sh.project_id || sh.slug || sh.id]}
                    {$t(
                      "mainContent.instances.browsers.shaderBrowser.actions.adding",
                    )}
                  {:else}
                    <Plus size={16} />
                    {$t(
                      "mainContent.instances.browsers.shaderBrowser.actions.add",
                    )}
                  {/if}
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
    <Pagination
      {currentPage}
      {totalPages}
      {loading}
      {prevPage}
      {nextPage}
      alignment="left"
    />
  {/if}
  {#if showItemViewerModal}
    <ItemViewerModal
      open={showItemViewerModal}
      item={itemToView}
      itemType={itemTypeToView}
      on:close={closeItemViewerModal}
    />
  {/if}
</div>

<style>
  .browser {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex-grow: 1;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex: 1; /* Take remaining space */
  }
  .row {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    align-items: start;
    gap: 0.75rem;
    padding: 0.5rem 10px;
    background: var(--overlay-color);
    border: 1px solid color-mix(in srgb, var(--border-color), transparent 0%);
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-bottom-width: 5px;
      border-color: var(--overlay-color-2);
    }
    &:active {
      transform: scale(0.99);
    }
  }
  .icon {
    width: 48px;
    height: 48px;
    margin-top: 5px;
    overflow: hidden;
  }
  .icon img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .info-container {
    display: flex;
    flex-direction: row;
    gap: 2rem;
    align-items: start;
    justify-content: space-between;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .btn {
    white-space: nowrap;
  }
  .title {
    color: var(--text-color);
    font-weight: 600;
    font-size: var(--font-size-body);
  }
  .meta {
    color: var(--text-color-muted);
    font-size: var(--font-size-sm);
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;

    span {
      opacity: 0.6;
    }
  }
  .sep {
    opacity: 0.6;
  }
  .description {
    color: var(--text-color-muted);
    font-size: var(--font-size-sm);
    line-height: 1.3;
    margin-top: 0.25rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .actions {
    display: flex;
    width: 48px;
    padding: 0 !important;
    justify-content: end;
    flex-direction: row;
    height: 48px;
    margin-top: 5px;
    align-items: center;

    .btn {
      padding: 5px 10px;
      font-size: var(--font-size-sm);
    }
  }

  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--text-color-muted);
    flex-grow: 1;
  }

  .no-results p {
    font-size: var(--font-size-body);
    margin: 1rem 0 0.5rem 0;
    font-weight: 500;
  }
  .no-results .hint {
    font-size: var(--font-size-sm);
    opacity: 0.8;
  }
</style>
