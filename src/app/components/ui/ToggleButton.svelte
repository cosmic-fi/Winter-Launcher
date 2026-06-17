<script>
// @ts-nocheck

    export let checked = false;
    export let disabled = false;
    export let label = '';
    export let description = '';

    // Forward the change event
    function toggle() {
        if (!disabled) {
            checked = !checked;
            // Emit a change event with the new value
            dispatch('change', { checked });
        }
    }

    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="toggle-btn {checked ? 'active-toggle' : ''} {disabled ? 'disabled' : ''}" on:click={toggle} tabindex="0" aria-checked={checked} role="switch">
    <div class="toggle-slider"></div>
</div>
{#if label}
    <span class="toggle-label">{label}</span>
{/if}
{#if description}
    <span class="toggle-description">{description}</span>
{/if}

<style>
    .toggle-btn {
        width: 45px;
        height: 20px;
        background: var(--overlay-color);
        border: 1px var(--border-color) solid;
        position: relative;
        cursor: pointer;
        transition: background 0.3s ease;
        display: inline-flex;
        align-items: center;

        .toggle-slider {
            width: 14px;
            height: 14px;
            background: var(--overlay-color-2) ;
            box-shadow: 0px 0px 3px var(--shadow-color);
            position: absolute;
            top: 50%;
            left: 4px;
            transform: translateY(-50%);
            transition: left 0.3s ease;
        }
    }

    .active-toggle {
        background-color: var(--accent-color);

        .toggle-slider {
            left: 28px;
            background: #ffffff;
            box-shadow: inset 0px 0px 0 2px var(--shadow-color);
        }
    }
</style>