<script>
  // @ts-nocheck
  import { createEventDispatcher } from "svelte";
  import { t } from "../../stores/i18n";
  import { FilterIcon, FilterX } from "@lucide/svelte";
  import CustomOptions from "./Options.svelte";
  import { genLetterId } from "../../utils/helper";

  export let searchQuery = null;
  export let SearchOptionCategories = null;
  export let SearchOptionCategoryValue = null;
  export let loadingState;

  export let sortOptions = null;
  export let sortValue = null;

  export let filterOptions = null

  let showFilterOptions = false;

  let dispatch = createEventDispatcher();

  function searchCategoryFilterChange(event) {
    dispatch("searchCategoryFilterChange", event.detail);
  }
  function sortOptionFilterChange(event) {
    dispatch("sortOptionFilterChange", event.detail);
  }
  function search(event) {
    dispatch("search", { value: event.target.value });
  }
  function showFilters(){
    showFilterOptions = !showFilterOptions
  }
  function filterOptionChange(filterId, e){
    dispatch('filterOptionChange', {
      filterId,
      value: e.detail.value
    });
  }
</script>

<div class="search-box">
  <div class="search-bar">
    <input
      type="text"
      class="search-input"
      placeholder={$t(
        "mainContent.instances.browsers.resourcePackBrowser.searchPlaceholder",
      )}
      value={searchQuery}
      on:input={search}
    />
    <button class="btn btn-default" on:click={() => showFilters()}>
      {#if showFilterOptions}
        <FilterX size={20} />
      {:else}
        <FilterIcon size={20} />      
      {/if}
    </button>
  </div>
  {#if showFilterOptions}
    <div class="filters">
        {#if filterOptions}
          {#each filterOptions as fo}
            {console.log(fo)}
            <CustomOptions
              id={genLetterId(8)}
              options={fo.options}
              value={fo.value}
              disabled={loadingState}
              preferredPosition='down-left'
              on:optionchange={(e) => filterOptionChange(fo.id, e)}
            />
          {/each}
        {/if}
        <!-- <CustomOptions
            id={genLetterId(8)}
            options={SearchOptionCategories}
            value={SearchOptionCategoryValue}
            disabled={loadingState}
            preferredPosition="down-left"
            on:optionchange={searchCategoryFilterChange}
        />
        <CustomOptions
            id={genLetterId(8)}
            options={sortOptions}
            value={sortValue}
            disabled={loadingState}
            preferredPosition="down-right"
            on:optionchange={sortOptionFilterChange}
        /> -->
    </div>
  {/if}
</div>

<style>

.search-box {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex-shrink: 0; 

    .search-bar {
        position: relative;
        display: flex;
        flex-grow: 1;
        flex-direction: row;
        position: relative;
        align-items: center;
        padding: 0 !important;
        min-height: 35px;
        column-gap: 10px;

        input{
            flex-grow: 1;
            height: 100%;
            border: none;
            outline: none;
            background-color: transparent;
            color: var(--text-color);
            background-color: var(--overlay-color-1);
            padding: 0 10px;
        }
    }
     
    .filters {
         display: flex;
         gap: 5px;
         flex-direction: row;
    }
}

</style>