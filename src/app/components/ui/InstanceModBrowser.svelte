<script>
  // @ts-nocheck

  import { onMount } from "svelte";
  import CustomOptions from "./Options.svelte";
  import Loading from "./Loading.svelte";
  import BrowserSkeleton from "./BrowserSkeleton.svelte";
  import modrinthService from "../../services/modrinthService";
  import { instanceStore } from "../../stores/instances";
  import SimpleTip from "./Tip.svelte";
  import Pagination from "./Pagination.svelte";
  import { logger } from "../../utils/logger";
  import {
    Search,
    ChevronRight,
    Link,
    Link2Off,
    Plus,
    ChevronDown,
  } from "@lucide/svelte";
  import { t } from "../../stores/i18n";
  import ItemViewerModal from "../modal/ItemViewerModal.svelte";
  import SearchBox from "./SearchBox.svelte";
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
  let loader = "all";
  let environment = "all";
  let sort = "relevance";
  let gameVersion = "all";
  let itemCount = 10;
  let adding = {};

  let showItemViewerModal = false;
  let itemToView = null;
  let itemTypeToView = "mod";

  $: installedModIds = new Set(
    (instance?.mods || []).map((m) => String(m.modrinth_id)),
  );
  $: installedModMap = new Map(
    (instance?.mods || []).map((m) => [String(m.modrinth_id), m.id]),
  );

  // Function to validate Minecraft game versions
  function validateGameVersion(version) {
    if (!version || version === "all") return "all";

    const m = version.match(/^1\.(\d{1,2})(?:\.(\d{1,2}))?$/);
    if (!m) return "all";
    const series = `1.${m[1]}`;
    return series;
  }
  const loaderOptions = [
    {
      value: "all",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.loaders.all",
      ),
    },
    {
      value: "forge",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.loaders.forge",
      ),
    },
    {
      value: "fabric",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.loaders.fabric",
      ),
    },
    {
      value: "quilt",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.loaders.quilt",
      ),
    },
    {
      value: "neoforge",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.loaders.neoforge",
      ),
    },
  ];
  const environmentOptions = [
    {
      value: "all",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.environment.all",
      ),
    },
    {
      value: "client",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.environment.client",
      ),
    },
    {
      value: "server",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.environment.server",
      ),
    },
  ];
  const sortOptions = [
    {
      value: "relevance",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.sort.relevance",
      ),
    },
    {
      value: "downloads",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.sort.downloads",
      ),
    },
    {
      value: "follows",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.sort.follows",
      ),
    },
    {
      value: "updated",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.sort.updated",
      ),
    },
  ];
  const itemCountOptions = [
    {
      value: "10",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.itemCount.10",
      ),
    },
    {
      value: "20",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.itemCount.20",
      ),
    },
    {
      value: "30",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.itemCount.30",
      ),
    },
    {
      value: "50",
      label: $t(
        "mainContent.instances.browsers.modBrowser.filters.itemCount.50",
      ),
    },
  ];

  $: if (instance) {
    gameVersion = instance.gameVersion;
    loader = instance.loader;
  }
  async function load(reset = true) {
    if (loading) return;
    loading = true;
    isPageTransition = !reset;
    if (reset) {
      offset = 0;
      currentPage = 1;
    }

    const validVersionStrings = (await modrinthService.getGameVersions())
      .map((v) => v.version)
      .filter(Boolean);
    const validatedGameVersion = validVersionStrings.includes(
      instance?.gameVersion,
    )
      ? instance.gameVersion
      : null;

    const validatedLoader = ["forge", "fabric", "quilt", "neoforge"].includes(
      instance?.loader,
    )
      ? instance.loader
      : null;

    const result = await modrinthService.searchMods({
      query: searchQuery.trim().length ? searchQuery : "*",
      gameVersion: validatedGameVersion,
      loader: validatedLoader,
      environment: environment !== "all" ? environment : null,
      sort:
        sort === "popularity"
          ? "downloads"
          : sort === "last_updated"
            ? "updated"
            : sort,
      offset,
      limit: itemCount,
    });

    const modsWithDeps = await Promise.all(
      result.hits.map(async (mod) => {
        if (!mod.latest_version) return { ...mod, dependencies: [] };

        try {
          const versionDetails = await modrinthService.getVersion(
            mod.latest_version,
          );
          return { ...mod, dependencies: versionDetails.dependencies || [] };
        } catch (err) {
          console.error(`Failed to fetch version for ${mod.project_id}`, err);
          return { ...mod, dependencies: [] };
        }
      }),
    );

    items = modsWithDeps || [];
    totalHits = result.total_hits || 0;
    totalPages = Math.max(1, Math.ceil(totalHits / itemCount));
    hasMore = items.length < totalHits;

    loading = false;
    isPageTransition = false;
    initialLoad = false;
  }

  function handleViewMod(mod) {
    itemToView = mod;
    itemTypeToView = "mod";
    showItemViewerModal = true;
  }
  function closeItemViewerModal() {
    showItemViewerModal = false;
    itemToView = null;
    itemTypeToView = "mod";
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

  function handleSearch(e) {
    searchQuery = e.detail.value;
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      scrollToTop();
      load(true);
    }, 400);
  }

  function handleCategoryOptionChange(value){
    loader = value;
    scrollToTop();
    load(true);
  }
  function handleSortOptionChange(value){
    sort = value;
    scrollToTop();
    load(true);
  }

  const filterHandlers = {
    loader: handleCategoryOptionChange,
    sort: handleSortOptionChange
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
  async function addMod(mod) {
    if (!instance) return;
    if (adding[mod.project_id]) return;
    adding[mod.project_id] = true;
    try {
      await instanceStore.installMod(instance.id, mod);
    } catch (error) {
      logger.error("Failed to install mod", error);
    } finally {
      adding[mod.project_id] = false;
    }
  }
  async function getModDependencies(project_id) {
    return await modrinthService.getProject(project_id);
  }

  // Fetch details for dependencies when they're expanded (only for visible items)
  async function fetchDependencyDetails(dependencies) {
    if (!dependencies || dependencies.length === 0) return;

    // Only fetch for dependencies that don't have details yet
    const dependenciesToFetch = dependencies.filter(
      (dep) =>
        dep.project_id &&
        !projectDetailsMap[dep.project_id] &&
        !loadingDependencyDetails.has(dep.project_id),
    );

    if (dependenciesToFetch.length === 0) return;

    // Mark as loading
    dependenciesToFetch.forEach((dep) => {
      loadingDependencyDetails = new Set([
        ...loadingDependencyDetails,
        dep.project_id,
      ]);
    });

    // Limit concurrent fetches to avoid overwhelming the API
    const batchSize = 3;
    for (let i = 0; i < dependenciesToFetch.length; i += batchSize) {
      const batch = dependenciesToFetch.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (dep) => {
          try {
            const details = await getModDependencies(dep.project_id);
            projectDetailsMap = {
              ...projectDetailsMap,
              [dep.project_id]: details,
            };
          } catch (error) {
            console.error(
              `Failed to fetch dependency details for ${dep.project_id}:`,
              error,
            );
          } finally {
            // Remove from loading set
            loadingDependencyDetails = new Set(
              [...loadingDependencyDetails].filter(
                (id) => id !== dep.project_id,
              ),
            );
          }
        }),
      );
    }
  }

  // Store project details for each mod
  let projectDetailsMap = {};
  let loadingDependencyDetails = new Set(); // Track which dependencies are being loaded

  // Get currently visible items based on pagination
  $: visibleItems = items.slice(
    (currentPage - 1) * itemCount,
    currentPage * itemCount,
  );

  onMount(() => {
    load(true);
  });
</script>

<div class="browser">
  <SearchBox
    searchQuery={searchQuery}
    filterOptions={
      [
        {
          id: 'loader',
          options: loaderOptions,
          value: loader,
        },
        {
          id: 'sort',
          options: sortOptions,
          value: sort
        }
      ]
    }
    on:search={handleSearch}
    on:filterOptionChange={handleFilterOptionChange}
  />
  {#if loading}
    <div class="list">
      <BrowserSkeleton count={itemCount} />
    </div>
  {:else if items.length === 0}
    <div class="list">
      <div class="no-results">
        <Search size={48} />
        <p>
          {$t("mainContent.instances.browsers.modBrowser.empty.noResultsFound")}
        </p>
        <span class="hint"
          >{$t(
            "mainContent.instances.browsers.modBrowser.empty.tryAdjustingFilters",
          )}</span
        >
      </div>
    </div>
  {:else}
    <div class="list">
      {#each items as mod}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="row" on:click={() => handleViewMod(mod)}>
          <div class="icon">
            <img
              src={mod.icon_url || "./images/static/minecraft_grass.jpg"}
              alt={mod.title}
            />
          </div>
          <div class="info-container">
            <div class="info">
              <div class="title">{mod.title}</div>
              <div class="meta">
                <span
                  >{$t("mainContent.instances.browsers.modBrowser.labels.by")}
                  {mod.author}</span
                >
                {#if mod.game_versions?.length > 0}
                  <span class="sep">•</span>
                  <span>{mod.game_versions[0]}</span>
                {/if}
                {#if mod.loaders?.length > 0}
                  <span class="sep">•</span>
                  <span>{mod.loaders.slice(0, 2).join(", ")}</span>
                {/if}
                {#if mod.downloads}
                  <span class="sep">•</span>
                  <span
                    >{mod.downloads.toLocaleString()}
                    {$t(
                      "mainContent.instances.browsers.modBrowser.labels.downloads",
                    )}</span
                  >
                {/if}
              </div>
              {#if mod.description}
                <div class="description">{mod.description}</div>
              {/if}

              <!-- Dependencies Section -->
              {#if mod.dependencies && mod.dependencies.length > 0}
                <!-- Project details are fetched reactively and logged to console -->
                <div class="dependencies-section">
                  <button
                    class="dependencies-toggle"
                    on:click|stopPropagation={() => {
                      mod.showDependencies = !mod.showDependencies;
                      if (mod.showDependencies && mod.dependencies) {
                        fetchDependencyDetails(mod.dependencies);
                      }
                    }}
                    class:expanded={mod.showDependencies}
                  >
                    {#if mod.showDependencies}
                      <ChevronDown
                        size={14}
                        class="toggle-icon {mod.showDependencies
                          ? 'expanded'
                          : ''}"
                      />
                    {:else}
                      <ChevronRight
                        size={14}
                        class="toggle-icon {mod.showDependencies
                          ? 'expanded'
                          : ''}"
                      />
                    {/if}
                    <span
                      >{mod.dependencies.length === 1
                        ? $t(
                            "mainContent.instances.browsers.modBrowser.dependencies.toggleSingular",
                            { count: mod.dependencies.length },
                          )
                        : $t(
                            "mainContent.instances.browsers.modBrowser.dependencies.toggle",
                            { count: mod.dependencies.length },
                          )}</span
                    >
                    {#if mod.dependencies.filter((d) => d.type === "required").length > 0}
                      <span class="required-count"
                        >{$t(
                          "mainContent.instances.browsers.modBrowser.dependencies.requiredCount",
                          {
                            count: mod.dependencies.filter(
                              (d) => d.type === "required",
                            ).length,
                          },
                        )}</span
                      >
                    {/if}
                  </button>

                  {#if mod.showDependencies}
                    <div class="dependencies-list">
                      {#each mod.dependencies as dep}
                        <div
                          class="dependency-item"
                          class:required={dep.type === "required"}
                          class:optional={dep.type === "optional"}
                        >
                          <SimpleTip
                            text={dep.dependency_type === "required"
                              ? $t(
                                  "mainContent.instances.browsers.modBrowser.dependencies.required",
                                )
                              : $t(
                                  "mainContent.instances.browsers.modBrowser.dependencies.optional",
                                )}
                            direction="bottom"
                          >
                            {#if dep.dependency_type === "required"}
                              <Link size={14} class="text-accent" />
                            {:else}
                              <Link2Off size={14} />
                            {/if}
                          </SimpleTip>
                          <span class="dep-name">
                            {#if projectDetailsMap[dep.project_id]}
                              {projectDetailsMap[dep.project_id].title}
                              {console.log(
                                projectDetailsMap[dep.project_id],
                                "projectDetailsMap[dep.project_id]",
                              )}
                            {:else if loadingDependencyDetails.has(dep.project_id)}
                              <span class="loading-text"
                                >{$t(
                                  "mainContent.instances.browsers.modBrowser.dependencies.loading",
                                )}</span
                              >
                            {:else}
                              {dep.slug ||
                                $t(
                                  "mainContent.instances.browsers.modBrowser.dependencies.unknownMod",
                                )}
                            {/if}
                          </span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>

            <div class="actions">
              {#if installedModIds.has(String(mod.project_id))}
                <!-- svelte-ignore a11y_consider_explicit_label -->
                <button
                  class="btn btn-danger btn-sm"
                  on:click|stopPropagation={() =>
                    instanceStore.removeMod(
                      installedModMap.get(String(mod.project_id)),
                    )}
                >
                  {$t(
                    "mainContent.instances.browsers.modBrowser.actions.remove",
                  )}
                </button>
              {:else}
                <button
                  class="btn btn-accent btn-sm"
                  disabled={adding[mod.project_id]}
                  on:click|stopPropagation={() => addMod(mod)}
                >
                  {#if adding[mod.project_id]}
                    {$t(
                      "mainContent.instances.browsers.modBrowser.actions.adding",
                    )}
                  {:else}
                    <Plus size={14} />
                    {$t(
                      "mainContent.instances.browsers.modBrowser.actions.add",
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

  /* Dependencies Section Styles */
  .dependencies-section {
    margin-top: 0.5rem;
  }

  .dependencies-toggle {
    background: none;
    border: none;
    color: var(--text-color-muted);
    font-size: var(--font-size-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0;
    transition: color 0.2s ease;
  }

  .dependencies-toggle:hover {
    color: var(--text-color);
  }

  .required-count {
    opacity: 0.7;
    font-size: var(--font-size-sm);
  }

  .dependencies-list {
    margin-top: 0.5rem;
    padding-left: 1rem;
    border-left: 2px solid var(--border-color);
  }

  .dependency-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
    font-size: 0.8rem;
    color: var(--text-color-muted);
  }

  .dep-name {
    flex-grow: 1;
    font-weight: 500;
    font-size: var(--font-size-sm);
  }

  .loading-text {
    color: var(--text-color-muted);
    font-style: italic;
    opacity: 0.7;
    font-size: var(--font-size-sm);
  }
</style>
