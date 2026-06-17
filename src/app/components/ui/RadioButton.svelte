<script>
    import { createEventDispatcher } from 'svelte';
    
    export let name = '';
    export let value = '';
    export let group = '';
    export let disabled = false;
    export let label = '';
    export let icon = '';
    export let description = '';
    
    const dispatch = createEventDispatcher();
    
    // Handle change event
    function handleChange() {
        if (!disabled) {
            group = value;
            dispatch('change', value);
        }
    }
</script>

<label class="radio-button" class:disabled>
    <input 
        type="radio" 
        {name} 
        {value} 
        bind:group 
        {disabled}
        on:change={handleChange}
    >
    <span class="checkmark"></span>
    
    {#if icon}
        <img src={icon} alt={label} class="radio-icon">
    {/if}
    
    <div class="radio-content">
        <span class="radio-label">{label}</span>
        {#if description}
            <span class="radio-description">{description}</span>
        {/if}
    </div>
</label>

<style>
    .radio-button {
        display: flex;
        align-items: center;
        column-gap: .8rem;
        cursor: pointer;
        padding: .6rem;
        border-radius: var(--border-radius-10);
        transition: all 0.2s ease;
        user-select: none;
        
        &:hover:not(.disabled) {
            background-color: var(--base-variant-2);
        }
        
        &.disabled {
            opacity: 0.6;
            cursor: not-allowed;
            
            &:hover {
                background-color: transparent;
            }
        }
        
        input[type="radio"] {
            display: none;
        }
        
        .checkmark {
            width: 20px;
            height: 20px;
            border: 2px solid var(--border-color);
            border-radius: 50%;
            position: relative;
            transition: all 0.2s ease;
            flex-shrink: 0;
            
            &::after {
                content: '';
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background-color: var(--accent-color);
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0);
                transition: transform 0.2s ease;
            }
        }
        
        input[type="radio"]:checked + .checkmark {
            border-color: var(--accent-color);
            
            &::after {
                transform: translate(-50%, -50%) scale(1);
            }
        }
        
        input[type="radio"]:disabled + .checkmark {
            opacity: 0.5;
        }
        
        .radio-icon {
            width: 24px;
            height: 24px;
            object-fit: contain;
            flex-shrink: 0;
        }
        
        .radio-content {
            display: flex;
            flex-direction: column;
            row-gap: .2rem;
            
            .radio-label {
                color: var(--text-color);
                font-weight: 500;
                font-size: var(--font-size-fluid-base);
                line-height: 1.2;
            }
            
            .radio-description {
                color: var(--text-color-secondary);
                font-weight: 400;
                font-size: var(--font-size-fluid-sm);
                line-height: 1.3;
            }
        }
    }
</style>