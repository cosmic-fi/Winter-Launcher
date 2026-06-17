<script>
  // @ts-nocheck
  import {
    ChevronRight,
    Grid,
    Grid2X2,
    Grid2X2Icon,
    List,
  } from "@lucide/svelte";
  import { t } from "../../stores/i18n";
  import { createEventDispatcher } from "svelte";

  export let layoutStyle = null;

  const dispatch = createEventDispatcher();

  function setGridLayout() {
    dispatch("setGridLayout");
  }

  function setListLayout() {
    dispatch("setListLayout");
  }
  function navigate() {
    dispatch("navigate");
  }
</script>

<div class="section-header">
  <span class="section-title"
    >{$t("mainContent.home.sections.recentlyAdded")}</span
  >

  <div class="right-section">
    <div class="view-style-container">
      <button 
        class="grid-view active-style" 
        class:active-style={layoutStyle === 'grid'}
        on:click={setGridLayout}
        >
        <Grid2X2Icon size={20} />
      </button>
      <button 
        class="list-view" 
        class:active-style={layoutStyle === 'list'}
        on:click={setListLayout}
        >
        <List size={20} />
      </button>
    </div>
    <span class="seperator"></span>
    <button class="btn-default" on:click={navigate}>
      {$t("mainContent.home.buttons.seeAll")}
      <ChevronRight size={16} />
    </button>
  </div>
</div>

<style>
  .section-header {
    display: flex;
    flex-direction: row;
    column-gap: 10px;
    align-items: center;
    padding: 0.4rem 0;
    font-size: var(--font-size-body);
    border-bottom: 1px solid var(--border-color);
    color: var(--text-color-muted);
    justify-content: space-between;

    .section-title {
      gap: 5px;
      display: flex;
      padding-block: 0.4rem;
    }

    .right-section {
      display: flex;
      flex-direction: row;
      align-items: center;
      column-gap: 15px;

      .view-style-container {
        display: flex;
        flex-direction: row;

        .active-style {
          background-color: var(--overlay-color-2) !important;
          box-shadow: inset 0 0 0 2px var(--border-color) !important;
          color: var(--text-color) !important;
        }
      }
      button {
        font-size: var(--font-size-sm);
        display: flex;
        gap: 5px;
        padding-block: 5px;
        flex-direction: row;
        font-size: var(--font-size-sm);
        align-items: center;
        background-color: transparent !important;
        color: var(--text-color-muted) !important;
        box-shadow: none !important;
        justify-content: center;

        &:hover {
          color: var(--text-color) !important;
        }
      }
    }
  }
</style>
