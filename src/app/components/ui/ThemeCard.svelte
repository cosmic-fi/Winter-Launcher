<script>
  // @ts-nocheck
  import { createEventDispatcher } from "svelte";
  import { settings } from "../../stores/settings";

  const dispatch = createEventDispatcher();

  export let displayName;
  export let colors = [];
  export let value = null;

  // Reactive statement to determine if this theme is selected
  $: selected = $settings.general?.appearance?.theme?.value === value;

  function onSelect(){
    dispatch('selecttheme', {
      value: value
    });
  };
</script>

<button
  class="theme-card {selected ? 'selected' : ''}"
  style="background-color: {colors[0]};"
  on:click={onSelect}
  value={value}
>
  <div class="theme-preview">
    <span class="theme-accent-color theme-element" style="background-color: {colors[1]};"></span>
    <span class="theme-text-color theme-element" style="background-color: {colors[2]}"></span>
    <span class="theme-name" style="color: {colors[2]};">{displayName}</span>
  </div>
</button>

<style>
    .theme-card {
        display: flex;
        flex-direction: column;
        border: none;
        cursor: pointer;
        transition: border 0.2s, box-shadow 0.2s;
        min-width: 100px;
        padding: 0;
        overflow: hidden;
        box-shadow: 0 0 0 2px var(--border-color);
        outline: none;
    }
    .theme-card:hover{
      box-shadow: 0 0 0 3px var(--accent-color-light);
    }
    .theme-card.selected{
      box-shadow: 0 0 0 3px var(--accent-color);
    }
    .theme-preview {
        display: flex;
        gap: 4px;
        flex-direction: column;
        flex-grow: 1;
        justify-content: center;
        padding: 5px 5px;
        align-items: start;
    }
    .theme-element{
      width: 50px;
      height: 10px;
      opacity: 0.8;
    }
    .theme-text-color{
      width: 60px;
    }
    .theme-name{
      font-size: var(--font-size-sm);
    }
</style>