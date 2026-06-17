<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { openDropdownId } from '../../stores/dropdown.js';
  import { ChevronDown, ChevronUp, MoreHorizontal } from '@lucide/svelte';
  import { t } from '../../stores/i18n.js';

  export let options = [];
  export let value = null;
  export let id = '';
  export let disabled = false;
  export let preferredPosition = 'down'; // Default to 'down' - below the button
  export let iconOnly = false;

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let dropdown, menu, toggle;

  // $: selectedOption = options.find(o => o.value === value) || options[0];
  $: selectedOption = options.find(o => o.value === value) || value;

  $: isOpen = $openDropdownId === id;

  function openDropdown(e) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    // Toggle this dropdown
    if ($openDropdownId === id) {
      openDropdownId.set(null);
    } else {
      openDropdownId.set(id);
    }
  }

  function selectOption(option) {
    openDropdownId.set(null);
    dispatch('optionchange', {
      value: option.value,
      data_value: option.label,
      other: option.other
    });
  }

  function handleClickOutside(event) {
    // Only close this specific dropdown if it's open and the click is outside
    if (isOpen && dropdown && !dropdown.contains(event.target)) {
      openDropdownId.set(null);
    }
  }

  function getDropdownPosition() {
    // If a specific position is requested, use it
    if (preferredPosition) {
      return preferredPosition;
    }
    
    // Otherwise, determine based on available space (this is a basic implementation)
    // For now, we'll use the preferred position or default to 'down'
    return preferredPosition || 'down';
  }

  onMount(() => {
    // Use capture phase to ensure we catch clicks before other elements
    document.addEventListener('click', handleClickOutside, true);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside, true);
    // Clean up: if this dropdown is open when destroyed, close it
    if ($openDropdownId === id) {
      openDropdownId.set(null);
    }
  });
</script>

<div class="options" {id} bind:this={dropdown}>
  <div class="dropdown {isOpen ? 'open' : ''}">
    <button
      class="btn btn-default option-btn dropdown-toggle"
      bind:this={toggle}
      on:click={openDropdown}
      disabled={disabled}
      type="button"
    >
      {#if iconOnly}
        <MoreHorizontal size={16} />
      {:else}
        {@html (selectedOption && selectedOption.label) || $t('components.customSelect.selectPlaceholder')}
        {#if isOpen}
          <ChevronUp size={14} class="dropdown-arrow" />
        {:else}
          <ChevronDown size={14} class="dropdown-arrow" />
        {/if}
      {/if}
    </button>
      <div 
        class="dropdown-menu" bind:this={menu}
        class:open-left={getDropdownPosition() === 'left'}
        class:open-right={getDropdownPosition() === 'right'}
        class:open-up={getDropdownPosition() === 'up'}
        class:open-up-left={getDropdownPosition() === 'up-left'}
        class:open-up-right={getDropdownPosition() === 'up-right'}
        class:open-down={getDropdownPosition() === 'down'}
        class:open-down-left={getDropdownPosition() === 'down-left'}
        class:open-down-right={getDropdownPosition() === 'down-right'}
        class:open-left-fall-right={getDropdownPosition() === 'left-fall-right'}
        class:open-right-fall-left={getDropdownPosition() === 'right-fall-left'}
      >
        <div class="menu-wrapper">
          {#each options as opt}
            {console.log(opt)}
            {#if opt.type === 'separator'}
              <div class="dropdown-separator"></div>
            {:else}
              <button
                class="dropdown-item {opt.type ? `type-${opt.type}` : ''} {opt.value === (selectedOption && selectedOption.value) ? 'active' : ''}"
                on:click={() => selectOption(opt)}
                value={opt.value}
                data-value={opt.label}
                disabled={opt.disabled}
                class:disabled-option-btn={opt.disabled}
                type="button"
              >
                {#if opt.icon}
                  {#if typeof opt.icon === 'string'}
                    <i class="{opt.icon}"></i>
                  {:else}
                    <svelte:component this={opt.icon} size={16} />
                  {/if}
                {/if}
                {@html opt.label}
              </button>
            {/if}
          {/each}
        </div>
      </div>
  </div>
</div>

<style>
  .options {
    position: relative;
    display: flex;
    gap: 10px;
    align-items: center;
    border: 2px solid transparent;
  }

  .options .option-btn,
  .options .dropdown-item {
    color: var(--text-color);
    border: 1px var(--border-color) solid;
    padding: 10px 16px;
    font-size: var(--font-size-body);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    column-gap: 10px;
    align-items: center;
    justify-content: space-between;
    gap: 1vw;
    white-space: nowrap;
  }
  .options .option-btn:hover,
  .options .dropdown-item:hover {
    background: var(--overlay-color-2);
    color: var(--text-color);
  }

  .dropdown-item.type-danger:hover{
    background-color: color-mix(in srgb, var(--error-color), transparent 90%);
  }
  .disabled-option-btn{
    opacity: .5;
  }
  .options .dropdown {
    position: relative;
    display: inline-block;
  }

  .options .dropdown-toggle:after {
      display: none;
  }

  .open{
    .option-btn{
      border: 1px solid color-mix(in srgb, var(--text-color), transparent 50%) !important;
    }
  }
  .options .dropdown-menu {
    display: none;
    position: absolute;
    background: var(--overlay-color);
    border: 2px var(--border-color) solid;
    border-bottom-width: 5px;
    box-shadow: 0 2px 10px var(--shadow-color);
    max-height: 200px;
    min-width: 120px;
    overflow: hidden;
    overflow-y: auto;
    padding: 4px;
    z-index: 10;
    font-weight: 100;
    flex-direction: column;
    /* Default positioning: below the button, aligned to the left */
    top: calc(100% + 5px);
    left: 0;
    right: auto;
    bottom: auto;
    margin-top: 0;
  }

  .options .dropdown.open .dropdown-menu {
    display: flex;
  }

  .options .dropdown-item {
    background: none;
    border: none;
    color: var(--text-color-muted);
    padding: 8px 16px;
    text-align: left;
    width: 100%;
    font-weight: 400;
    font-size: var(--font-size-body);
    cursor: pointer;
    transition: background 0.2s;
    min-width: auto;
    gap: 10px;
    align-items: start;
    justify-content: start;
  }

  /* Option type variants */
  .options .dropdown-item.type-danger {
    color: var(--error-color);
  }
  .options .dropdown-item.type-warning {
    color: var(--warning-color);
  }
  .options .dropdown-item.type-success {
    color: var(--success-color);
  }
  .options .dropdown-item.type-primary {
    color: var(--accent-color);
  }

  .dropdown-separator {
    height: 1px;
    background-color: var(--border-color);
    margin: 4px 0;
    width: 100%;
    opacity: 0.5;
  }

  /* Positioning classes for adaptive dropdown */
  .options .dropdown-menu.open-up {
    bottom: calc(100% + 5px);
    left: 0;
    right: auto;
    top: auto;
  }
  .options .dropdown-menu.open-up-left {
    bottom: calc(100% + 5px);
    left: 0;
    right: auto;
    top: auto;
  }
  .options .dropdown-menu.open-up-right {
    bottom: calc(100% + 5px);
    left: auto;
    right: 0;
    top: auto;
  }


  .options .dropdown-menu.open-down {
    top: calc(100% + 5px);
    left: 0;
    right: auto;
    bottom: auto;
  }
  .options .dropdown-menu.open-down-left {
    left: 0;
    right: auto;
    top: calc(100% + 5px);
    bottom: auto;
  }
  .options .dropdown-menu.open-down-right {
    right: 0 !important;
    left: auto !important;
    top: calc(100% + 5px);
    bottom: auto;
  }

  .options .dropdown-menu.open-left {
    right: calc(100% + 5px);
    top: 0;
    bottom: auto;
    left: auto;
  }

  .options .dropdown-menu.open-right {
    top: 0;
    left: calc(100% + 5px);
    bottom: auto;
    right: auto;
  }

  /* Special positioning for "open left, fall right" - aligns to the left (default fall) */
  .options .dropdown-menu.open-left-fall-right {
    left: 0;
    right: auto;
    top: calc(100% + 5px);
    bottom: auto;
  }

  /* Special positioning for "open right, fall left" - aligns to the right */
  .options .dropdown-menu.open-right-fall-left {
    right: 0;
    left: auto;
    top: calc(100% + 5px);
    bottom: auto;
  }
</style>
