<script>
  // @ts-nocheck

  import CustomOptions from "../ui/Options.svelte";
  import ToggleButton from "../ui/ToggleButton.svelte";
  import { settings } from "../../stores/settings";
  import { t } from "../../stores/i18n";
  import ThemeCard from "../ui/ThemeCard.svelte";
  import { discordRPCManager } from "../../utils/discordRPCManager.js";
  import BetaTag from "../ui/BetaTag.svelte";
  import { XIcon } from "@lucide/svelte";
  import { uiState } from "../../stores/ui";
  import { createEventDispatcher } from "svelte";
  import { fade, fly } from "svelte/transition";

  const { activeModal } = uiState;

  let currentTheme = "light";
  let currentLang = "en";

  const dispatch = createEventDispatcher();

  $: currentLauncherStyle = $settings?.general?.appearance?.launcherStyle?.value;
  $: themesOptions = [
    {
      value: "light",
      label: $t("settings.general.appearance.theme.themes.light"),
      colors: ["#ffffff", "#4242C9", "#23272a"],
    },
    {
      value: "dark",
      label: $t("settings.general.appearance.theme.themes.dark"),
      colors: ["#181818", "#4242C9", "#FFFFFF"],
    },
  ];

  $: langOptions = [
    { value: "en", label: $t("settings.general.appearance.language.languages.english") },
    // { value: "tr", label: $t("settings.general.appearance.language.languages.turkish") },
    // { value: "fr", label: $t("settings.general.appearance.language.languages.french") },
    // { value: "es", label: $t("settings.general.appearance.language.languages.spanish") },
  ];
  $: {
    if (
      $settings?.launcher?.integration?.discordRichPresence?.value !== undefined
    ) {
      const isEnabled =
        $settings.launcher?.integration?.discordRichPresence?.value;
      discordRPCManager
        .updateSettings(isEnabled)
        .then(() => {
          if (isEnabled) {
            discordRPCManager.refreshActivity();
          }
        })
        .catch((error) => {
          console.error("Failed to update Discord RPC settings:", error);
        });
    }
  }

  function handleThemeChange(e) {
    settings.updatePath("general.appearance.theme", e.detail.value);
    document.body.setAttribute("data-theme", e.detail.value);
  }

  function handleLangChange(e) {
    const newLang = e.detail.value;
    currentLocale.set(newLang);
    settings.updatePath("general.appearance.language", e.detail.value);
  }
  
  function close() {
    activeModal.set('none')
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="settings" 
  onclick={(e) => {
      if (e.target === e.currentTarget) close();
  }}
  onkeydown={(e) => {
      if (e.key === 'Escape') close();
  }}
  transition:fade={{ duration: 100 }}
  >
  <div class="s-wrapper" onclick={(e) => e.stopPropagation()} transition:fly={{ y: 40, duration: 160, opacity: 0.9 }}>
    <div class="settings-content">
      <div class="settings-header">
        <span class="header-title">
          <i class="fa fa-gear"></i>
          {$t("settings.title")}
        </span>
        <button class="close-btn btn btn-default" onclick={() => activeModal.set("none")}>
            <XIcon size="17"/>
        </button>
      </div>
      <div class="top-content-container setting-content-container">
        <!-- General Settings -->
        <div class="settings-section">
          <div class="setting-group general-settings">
            <div class="setting-item-group">
              <span class="group-sub-label"
                >{$t("settings.general.appearance.label")}</span
              >
              <div class="sub-item-group px-0">
                <div class="toggle-label-group">
                  <span class="toggle-label"
                    >{$t("settings.general.appearance.theme.label")}</span
                  >
                  <span class="group-description"
                    >{$t("settings.general.appearance.theme.description")}</span
                  >
                  <div class="theme-cards-container">
                    {#each themesOptions as theme (theme.label)}
                      <ThemeCard
                        value={theme.value}
                        displayName={theme.label}
                        selected={$settings.general?.appearance?.theme
                          ?.value === theme.value}
                        colors={theme.colors}
                        on:selecttheme={handleThemeChange}
                      />
                    {/each}
                  </div>
                </div>
              </div>

              <hr class="setting-seperator" />
              <div class="sub-item-group px-0">
                <div class="toggle-label-group">
                  <span class="toggle-label"
                    >{$t("settings.general.appearance.language.label")}</span
                  >
                  <span class="group-description"
                    >{$t(
                      "settings.general.appearance.language.description",
                    )}</span
                  >
                </div>
                <CustomOptions
                  options={langOptions}
                  id="langauge"
                  preferredPosition="up-right"
                  value={$settings.general?.appearance?.language?.value}
                  on:optionchange={handleLangChange}
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Game Settings -->
        <div class="settings-section">
          <div class="setting-group game-settings">
            <hr class="setting-seperator" />
            <div class="setting-item-group">
              <span class="group-sub-label"
                >{$t("settings.game.runtime.label")}</span
              >
              <div class="sub-item-group">
                <div class="toggle-label-group">
                  <span class="toggle-label"
                    >{$t("settings.game.runtime.runDetached")}</span
                  >
                  <span class="group-description"
                    >{$t("settings.game.runtime.runDetachedDescription")}</span
                  >
                </div>
                <ToggleButton
                  checked={$settings.game?.runtime?.runDetached?.value}
                  on:change={(e) =>
                    settings.updatePath(
                      "game.runtime.runDetached",
                      e.detail.checked,
                    )}
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Launcher Settings -->
        <div class="settings-section">
          <div class="setting-group network-settings">
            <div class="setting-item-group">
              <span class="group-sub-label"
                >{$t("settings.launcher.updates")}</span
              >
              <div class="sub-item-group">
                <div class="toggle-label-group">
                  <span class="toggle-label"
                    >{$t("settings.launcher.checkForUpdates")}</span
                  >
                  <span class="group-description"
                    >{$t("settings.launcher.checkForUpdatesDescription")}</span
                  >
                </div>
                <ToggleButton
                  checked={$settings.launcher?.updates?.checkForUpdates?.value}
                  on:change={(e) =>
                    settings.updatePath(
                      "launcher.updates.checkForUpdates",
                      e.detail.checked,
                    )}
                />
              </div>
            </div>
            <hr class="setting-seperator" />
            <div class="setting-item-group">
              <span class="group-sub-label"
                >{$t("settings.launcher.integration.label")}</span
              >
              <div class="sub-item-group">
                <div class="toggle-label-group">
                  <span class="toggle-label">
                    {$t("settings.launcher.integration.discordRPC")}
                    <BetaTag text="Beta" />
                  </span>
                  <span class="group-description"
                    >{$t(
                      "settings.launcher.integration.discordRPCDescription",
                    )}</span
                  >
                </div>
                <ToggleButton
                  checked={$settings.launcher?.integration?.discordRichPresence
                    ?.value}
                  on:change={(e) =>
                    settings.updatePath(
                      "launcher.integration.discordRichPresence",
                      e.detail.checked,
                    )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .settings {
    position: absolute;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.5);
    width: 100%;
    height: 100%;
    display: flex;
    top: 0;
    left: 0;
    justify-content: center;
    align-items: center;
    transition: all 0.3s ease;
    overflow: hidden;

    .s-wrapper {
      border: 2px var(--border-color) solid;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-bottom-width: 5px;
      width: 850px;
      height: 550px;

      .settings-content {
        background-color: var(--surface-color);
        display: grid;
        grid-template-areas:
        "header"
        "content";
        grid-template-columns: 1fr;
        grid-template-rows: 1fr; 
        height: 100%; 

        .settings-header {
          grid-area: header;
          border-bottom: 1px var(--border-color) solid;
          padding: 15px 15px;
          display: flex;
          align-items: center;
          -webkit-app-region: no-drag;

          .header-title {
            display: flex;
            flex-direction: row;
            align-items: center;
            font-size: var(--font-size-base);
            font-weight: 600;
            column-gap: 8px;
            color: var(--text-color);
            justify-content: start;
            flex-grow: 1;
          }
        }

        .top-content-container {
          grid-area: content;
          overflow-y: auto;
          flex-direction: column;
          gap: 5px;
          display: flex;
          padding-bottom: 10px;
          .settings-section {
            .setting-group {
              display: flex;
              flex-direction: column;
              padding: 10px 15px;

              .setting-item-group {
                display: flex;
                flex-direction: column;
                row-gap: 15px;

                .group-sub-label {
                  opacity: 0.8;
                  font-size: var(--font-size-body);
                  font-weight: 600;
                  color: var(--text-color-muted);
                }

                .toggle-label{
                  font-size: var(--font-size-body);
                  position: relative;
                }

                .group-description {
                  font-size: var(--font-size-sm);
                  color: var(--text-color-muted);
                }

                .sub-item-group {
                  display: flex;
                  flex-direction: row;
                  color: var(--text-color);
                  justify-content: space-between;
                  align-items: center;
                  padding-left: 10px;
                  column-gap: 20px;

                  .toggle-label-group {
                    display: flex;
                    flex-direction: column;
                    align-items: start;
                    width: 80%;
                  }
                }
              }

              .setting-seperator {
                width: 100%;
                background-color: transparent;
                border: none;
                border-top: 1px var(--border-color) solid;
                opacity: 0.5;
              }
            }
          }
        }
      }
    }
  }

  .theme-cards-container {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 10px;
    width: 30rem;
    margin-top: 10px;
  }
  :global(.credit-owner-text) {
    opacity: 1 !important;
    color: var(--accent-color) !important;
  }
</style>
