<script>
  //@ts-nocheck
  import { onMount } from "svelte";
  import { modsStore } from "../stores/mods";
  import { instanceStore, instancesRecentlyAdded } from "../stores/instances";
  import { uiState } from "../stores/ui";
  import {
    getInstanceLaunchStatus,
    launchActions,
    runningInstancesList,
    instanceLaunchStates,
  } from "../stores/launch";
  import gameLauncher from "../services/gameLauncher";
  import { getSelectedAccount } from "../shared/user";
  import { showToast } from "../stores/ui";
  import Card from "../components/ui/Card.svelte";
  import Loading from "../components/ui/Loading.svelte";
  import ItemViewerModal from "../components/modal/ItemViewerModal.svelte";
  import {
    Plus,
    ChevronRight,
    Play,
    X,
    Loader2,
    Flame,
    Box,
    ArrowRight,
    ArrowLeft,
    Calendar,
    Speaker,
    Megaphone,
    MegaphoneIcon,
    MegaphoneOff,
    CalendarX,
  } from "@lucide/svelte";
  import { t } from "../stores/i18n";
  import { image } from "../utils/image";
  import GalleryViewer from "../components/modal/GalleryViewerModal.svelte";
  import SectionHeader from "../components/ui/SectionHeader.svelte";

  let { activeModal } = uiState;

  let popularMods = [];
  let recentInstances = [];
  let loading = true;
  let showItemViewerModal = false;
  let itemToView = null;
  let itemTypeToView = "mod";
  let currentUpdateTab = "updates";

  let updates = [];
  let events = [];

  let instanceViewStyle = 'grid';
  let modViewStyle = 'grid';

  function changeInstanceViewStyle(viewStyle){
    instanceViewStyle = viewStyle;
  }
  function changeModViewStyle(viewStyle){
    modViewStyle = viewStyle;
  }

  // Game versions and loaders are now fetched dynamically in StepInstanceCreator
  onMount(async () => {
    // Load popular mods
    await modsStore.loadPopularMods(20);

    // Load instances for continue playing section
    await instanceStore.loadInstances();

    loading = false;
  });

  modsStore.subscribe((store) => {
    popularMods = store.popular;
  });

  instancesRecentlyAdded.subscribe((instances) => {
    // Filter out running instances and get only the 4 most recently added
    recentInstances = instances
      .filter((instance) => {
        // Check if instance is running by looking in the runningInstancesList
        const isRunning = $runningInstancesList.some(
          (item) => item.id === instance.id,
        );
        return !isRunning;
      })
      .slice(0, 4);
  });

  function formatLastPlayed(dateString) {
    if (!dateString) return $t("mainContent.home.sections.period.neverPlayed");

    const now = new Date();
    const playedDate = new Date(dateString);
    const diffMs = now - playedDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays > 0)
      return `${diffDays} ${$t("mainContent.home.sections.period.daysAgo")}`;
    if (diffHours > 0)
      return `${diffHours} ${$t("mainContent.home.sections.period.hoursAgo")}`;
    if (diffMins > 0)
      return `${diffMins} ${$t("mainContent.home.sections.period.minutesAgo")}`;
    return $t("mainContent.home.sections.period.justNow");
  }

  function switchUpdateTabs(tab) {
    currentUpdateTab = tab;
  }

  function navigateToMods() {
    uiState.activeTab.set("mods");
  }

  function navigateToInstances() {
    uiState.activeTab.set("instances");
  }

  function handlePlayInstance(instance) {
    // Check if instance is already launching or running by checking the runningInstancesList
    const isRunning = $runningInstancesList.some(
      (item) => item.id === instance.id,
    );

    // Check instance launch state from the instanceLaunchStates store
    const instanceState = $instanceLaunchStates[instance.id];
    const isLaunching = instanceState?.isLaunching || false;

    if (isLaunching || isRunning) {
      console.log("Instance is already launching or running:", instance.name);
      return;
    }

    // Check if account is selected
    const account = getSelectedAccount();
    if (!account) {
      showToast($t("mainContent.home.alerts.noAccountSelected"), "error");
      return;
    }

    // Trigger the launch process
    console.log("Launching instance:", instance.name);

    // Set per-instance launch status
    launchActions.setInstanceLaunching(instance.id, true);
    launchActions.setInstanceStatus(instance.id, "preparing");

    // Update last played timestamp
    instanceStore.updateLastPlayed(instance.id);

    // Dispatch custom event to trigger launch in parent component
    const event = new CustomEvent("launchInstance", {
      detail: instance,
      bubbles: true,
    });
    document.dispatchEvent(event);
  }

  function handleCancelInstance(instance) {
    gameLauncher.cancelLaunch(instance.id);
  }

  function handleCreateInstance() {
    activeModal.set("instancecreator");
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

  function getDisplayedVersion(item) {
    const versions = getVersions(item);
    return versions[0] || "";
  }

  function getLoaders(item) {
    const ll = item?.latest_version?.loaders;
    const ls = item?.loaders;
    const arr =
      Array.isArray(ll) && ll.length > 0 ? ll : Array.isArray(ls) ? ls : [];
    return arr.filter(Boolean);
  }

  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  }
</script>

<div class="homepage">
  <div class="welcome-banner-container">
    <div class="banner-overlay"></div>
    <div class="banner-texts">
      <span>{$t("mainContent.home.welcomeBanner.greeting")}</span>
      <h1>{$t("mainContent.home.welcomeBanner.title")}</h1>
    </div>
    <div class="action-buttons">
      <button class="btn-primary btn" on:click={handleCreateInstance}>
        <Plus size={18} />
        {$t("mainContent.home.buttons.createInstance")}
      </button>
    </div>
    <div class="update-container">
      {#if currentUpdateTab === "updates"}
        <div class="update-content">
          {#if updates.length <= 0}
            <div class="no-update-container">
              <MegaphoneOff size={30} />
              <span class="noupdates">No updates available</span>
            </div>
          {:else}
            {#each updates as update}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="content-card"
                on:click={() => {
                  window.electron.openExternal(update?.url);
                }}
              >
                <img
                  src={update?.thumbnailURL}
                  alt="Update"
                  class="src"
                  use:image
                />
                <div class="content-info">
                  <h2 class="content-title">{update?.title}</h2>
                  <p class="content-description">{update?.description}</p>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      {:else}
        <div class="update-content">
          {#if events.length <= 0}
            <div class="no-update-container">
              <CalendarX size={30} />
              <span class="noupdates">No Events available</span>
            </div>
          {:else}
            {#each events as event}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="content-card"
                on:click={() => {
                  window.electron.openExternal(event?.url);
                }}
              >
                <img
                  src={event?.thumbnailURL}
                  alt="Update"
                  class="src"
                  use:image
                />
                <div class="content-info">
                  <h2 class="content-title">{event?.title}</h2>
                  <p class="content-description">{event?.description}</p>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
      <div class="controls">
        <div class="section-switch">
          <button
            class="switch-btn"
            on:click={() => switchUpdateTabs("updates")}
            class:active={currentUpdateTab === "updates"}
          >
            <MegaphoneIcon size={15} />
            Updates
          </button>
          <button
            class="switch-btn"
            on:click={() => switchUpdateTabs("events")}
            class:active={currentUpdateTab === "events"}
          >
            <Calendar size={15} />
            Events
          </button>
        </div>
      </div>
    </div>
  </div>
  <div class="section-group">
    <SectionHeader 
        layoutStyle={instanceViewStyle}
        on:navigate={navigateToInstances}
        on:setGridLayout={() => changeInstanceViewStyle('grid')}
        on:setListLayout={() => changeInstanceViewStyle('list')}
    />
    <div class="section-content instances-grid">
      {#if loading}
        <Loading
          size="medium"
          fullPage={true}
          layout="cards"
          amount={recentInstances.length}
        />
      {:else}
        {#each recentInstances as instance}
          {@const instanceState = $instanceLaunchStates[instance.id] || {
            isLaunching: false,
            status: "ready",
          }}
          {@const isRunning = $runningInstancesList.some(
            (item) => item.id === instance.id,
          )}
          {@const buttonText = instanceState.isLaunching
            ? instanceState.status === "preparing"
              ? $t("mainContent.home.launchStatus.preparing")
              : instanceState.status === "downloading"
                ? $t("mainContent.home.launchStatus.downloading")
                : instanceState.status === "extracting"
                  ? $t("mainContent.home.launchStatus.extracting")
                  : instanceState.status === "verifying"
                    ? $t("mainContent.home.launchStatus.verifying")
                    : instanceState.status === "running"
                      ? "Running"
                      : $t("mainContent.home.launchStatus.launching")
            : isRunning
              ? "Running"
              : $t("mainContent.home.buttons.play")}
          <Card
            variant="instance"
            title={instance.name}
            subtitle={`${instance.gameVersion} • ${instance.loader}`}
            icon={instance.icon || "./images/static/vanilla.png"}
            lastPlayed={instance.lastPlayed}
            clickable={true}
            onClick={() => handlePlayInstance(instance)}
            actions={instanceState.isLaunching &&
            instanceState.status !== "running"
              ? [
                  {
                    icon: Loader2,
                    iconClass: "animate-spin",
                    label: buttonText,
                    variant: "primary",
                    onClick: () => {},
                    disabled: true,
                  },
                  {
                    icon: X,
                    label: $t("mainContent.home.buttons.cancel"),
                    variant: "danger",
                    onClick: () => handleCancelInstance(instance),
                    disabled: false,
                  },
                ]
              : isRunning
                ? [
                    {
                      icon: Play,
                      label: buttonText,
                      variant: "primary",
                      onClick: () => {},
                      disabled: true,
                    },
                    {
                      icon: X,
                      label: $t("mainContent.home.buttons.cancel"),
                      variant: "danger",
                      onClick: () => handleCancelInstance(instance),
                      disabled: false,
                    },
                  ]
                : [
                    {
                      icon: Play,
                      label: buttonText,
                      variant: "primary",
                      onClick: () => handlePlayInstance(instance),
                      disabled: false,
                    },
                  ]}
          />
        {/each}
      {/if}
    </div>
  </div>

  <div class="section-group">
    <SectionHeader 
        layoutStyle={modViewStyle}
        on:navigate={navigateToMods}
        on:setGridLayout={() => changeModViewStyle('grid')}
        on:setListLayout={() => changeModViewStyle('list')}
    />
    <div class="mods-grid">
      {#if loading}
        <Loading
          size="medium"
          amount={popularMods.length}
          fullPage={true}
          layout="cards"
        />
      {:else if popularMods.length === 0}
        <div class="empty-state">
          <Cube size={48} />
          <h3>{$t("mainContent.home.sections.noPopularMods")}</h3>
          <p>{$t("mainContent.home.sections.noPopularModsDescription")}</p>
        </div>
      {:else}
        {#each popularMods as mod}
          <Card
            variant="mod"
            title={mod.title}
            subtitle={$t("mainContent.home.sections.author", {
              author: mod.author,
            })}
            description={mod.description}
            icon={mod.icon_url}
            downloads={mod.downloads || mod.downloads_count || 0}
            gameVersions={mod.latest_version?.game_versions ||
              mod.game_versions ||
              []}
            loaders={mod.latest_version?.loaders || mod.loaders || []}
            lastUpdated={mod.date_modified}
            clickable={true}
            onClick={() => handleViewMod(mod)}
          />
        {/each}
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
</div>

<style>
  .homepage {
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overflow-y: auto;
    padding: 10px;
    padding-bottom: 2rem;
    row-gap: 10px;
    position: relative;

    .welcome-banner-container {
      padding: 15px;
      padding-top: 2rem;
      display: flex;
      flex-direction: column;
      row-gap: 1.5rem;
      background: url("./images/static/winterland.png");
      background-position: center;
      background-repeat: no-repeat;
      background-size: cover;
      position: relative;
      min-height: 150px;
      justify-content: end;
      border-bottom: 10px solid var(--border-color);
      position: relative;

      .banner-overlay {
        position: absolute;
        width: 100%;
        height: 100%;
        z-index: 0;
        background: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0.274),
          color-mix(in srgb, rgba(0, 0, 0, 0.5), transparent 30%)
        );
        top: 0;
        left: 0;
      }
      .banner-texts {
        color: #fff;
        display: flex;
        flex-direction: column;
        row-gap: 5px;
        z-index: 1;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);

        h1 {
          font-size: var(--font-size-h2);
        }
      }
      .action-buttons {
        z-index: 1;
        display: flex;
        flex-direction: row;
        column-gap: 10px;

        button {
          color: var(--text-color);
          font-family: inherit;

          &:hover {
            opacity: 0.9;
          }
        }
      }

      .update-container {
        position: absolute;
        background-color: color-mix(
          in srgb,
          var(--overlay-color-1),
          transparent 50%
        );
        backdrop-filter: blur(2px);
        border: 2px solid var(--border-color);
        right: 10px;
        bottom: 10px;
        border-left-width: 5px;
        z-index: 1;
        min-width: 400px;
        max-width: 400px;
        height: calc(100% - 20px);
        display: flex;
        flex-direction: column;

        .update-content {
          flex: 1;
          color: var(--text-color-muted);
          font-size: 13px;
          overflow: hidden;
          overflow-y: auto;
          padding: 5px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          row-gap: 5px;

          .no-update-container {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            row-gap: 10px;
            color: var(--text-color-muted);
          }
          .content-card {
            display: flex;
            flex-direction: row;
            column-gap: 8px;
            background-color: var(--overlay-color-2);
            padding: 5px 5px;
            align-items: center;
            cursor: pointer;
            border: 1px solid var(--border-color);
            transition: all 0.4s ease;

            img {
              height: 40px;
              object-fit: cover;
              aspect-ratio: 10/6;
            }

            .content-info {
              display: flex;
              flex-direction: column;
              row-gap: 5px;

              h2 {
                font-size: var(--font-size-body);
              }
              p {
                padding: 0;
                margin: 0;
                font-size: var(--font-size-sm);
                max-height: 30px;
                color: var(--text-color-muted);
                display: -webkit-box;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 2;
                overflow: hidden;
                text-overflow: ellipsis;
              }
            }

            &:hover {
              background-color: var(--overlay-color-1);
              border-color: var(--accent-color);
            }
          }
        }
        .controls {
          background-color: var(--overlay-color-1);
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          padding: 4px;
          padding-block: 0;
          height: 36px;
          align-items: center;

          .section-switch {
            display: flex;
            flex-direction: row;
            height: 100%;
          }
          button {
            color: var(--text-color-muted);
            border-bottom: 3px solid transparent;
            display: flex;
            flex-direction: row;
            align-items: center;
            column-gap: 5px;
            font-size: var(--font-size-sm);
            padding-inline: 10px;
          }
          .active {
            position: relative !important;
            color: var(--text-color) !important;
            justify-content: center;
            display: flex;
            flex-direction: row;
            align-items: center;
            border-bottom-color: var(--accent-color);
          }
        }
      }
    }
    .section-group {
      display: flex;
      flex-direction: column;

      .section-content {
        padding: 1rem 0;
      }
      /* Grid layouts for different sections */
      .instances-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 10px;
      }

      .mods-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 10px;
        padding: 1rem 0;

        @media (max-width: 1024px) {
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 10px;
        }

        @media (max-width: 768px) {
          grid-template-columns: 1fr;
          gap: 10px;
        }

        @media (max-width: 480px) {
          grid-template-columns: 1fr;
          gap: 10px;
        }
      }

      /* Loading and Empty States */
      .empty-state {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3rem;
        text-align: center;
        color: var(--text-color-muted);
        background-color: var(--overlay-color-1);
        border: 1px solid var(--border-color);
      }

      .empty-state h3 {
        font-size: var(--font-size-h3);
        margin-bottom: 0.5rem;
        color: var(--text-color);
      }

      .empty-state p {
        font-size: var(--font-size-body);
        opacity: 0.8;
      }
    }
  }
</style>
