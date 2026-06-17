<script>
// @ts-nocheck

  import { onMount, createEventDispatcher } from 'svelte';
  import { getTotalSystemRamGB } from '../../utils/helper';

  export let value = 4096; // Default 4GB in MB
  export let minRam = 1024; // 1GB in MB
  export let maxRam = 16384; // 16GB in MB
  export let step = 512; // 512MB steps
  export let label = "RAM";
  export let disabled = false;

  const dispatch = createEventDispatcher();
  
  let totalRam = null;
  let systemRamMB = null;
  let valueGB = 4;
  let minRamGB = 1;
  let maxRamGB = 16;

  onMount(async () => {
    totalRam = await getTotalSystemRamGB();
    if (totalRam) {
      systemRamMB = totalRam * 1024;
    }
    updateGBFromMB();
  });

  $: effectiveMaxRam = systemRamMB ? Math.min(maxRam, systemRamMB) : maxRam;

  // Convert MB to GB for display
  $: valueGB = (value / 1024).toFixed(1).replace(/\.0$/, '');
  $: minRamGB = (minRam / 1024).toFixed(1).replace(/\.0$/, '');
  $: maxRamGB = (effectiveMaxRam / 1024).toFixed(1).replace(/\.0$/, '');

  function handleInputChange(e) {
    let newValueGB = parseFloat(e.target.value) || 0;
    const effectiveMaxGB = effectiveMaxRam / 1024;
    
    // Check if user tries to input higher than total ram
    if (newValueGB > effectiveMaxGB) {
        newValueGB = effectiveMaxGB;
        e.target.value = effectiveMaxGB.toString();
    }
    
    // Clamp to min/max
    const clampedGB = Math.max(parseFloat(minRamGB), Math.min(effectiveMaxGB, newValueGB));
    
    // Convert back to MB
    value = Math.round(clampedGB * 1024);
    
    dispatch('change', { value });
  }

  function updateGBFromMB() {
    valueGB = (value / 1024).toFixed(1).replace(/\.0$/, '');
  }

  // Update GB when MB changes externally
  $: if (value !== undefined) {
    updateGBFromMB();
  }

  function increment() {
    const nextVal = value + step;
    if (nextVal <= effectiveMaxRam) {
        value = nextVal;
        dispatch('change', { value });
    }
  }

  function decrement() {
    const nextVal = value - step;
    if (nextVal >= minRam) {
        value = nextVal;
        dispatch('change', { value });
    }
  }
</script>

<div class="ram-input-container">
  <label class="ram-label">{label}</label>
  <div class="ram-input-group">
    <!-- svelte-ignore a11y_consider_explicit_label -->
    <button 
      class="ram-btn ram-btn-decrement" 
      on:click={decrement}
      disabled={disabled || value <= minRam}
      type="button"
    >
      <i class="fas fa-minus"></i>
    </button>
    
    <input
      type="number"
      class="ram-input"
      value={valueGB}
      min={minRamGB}
      max={maxRamGB}
      step={step / 1024}
      on:input={handleInputChange}
      {disabled}
    />
    <span class="ram-unit">GB</span>
    <!-- svelte-ignore a11y_consider_explicit_label -->
    <button 
      class="ram-btn ram-btn-increment" 
      on:click={increment}
      disabled={disabled || value >= effectiveMaxRam}
      type="button"
    >
      <i class="fas fa-plus"></i>
    </button>
  </div>
</div>

<style>
  .ram-input-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ram-label {
    font-size: var(--font-size-sm);
    color: var(--text-color);
  }

  .ram-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: color-mix(in srgb, var(--base-color), transparent 50%) !important;
    border: 1px solid var(--border-color);
    padding: 10px;
  }

  .ram-input {
    text-align: center;
    border: none !important;
    background: transparent !important;
    color: var(--text-color);
    font-size: var(--font-size-body);
    outline: none !important;
  }

  .ram-input::-webkit-inner-spin-button,
  .ram-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .ram-input[type=number] {
    -moz-appearance: textfield;
    font-size: var(--font-size-sm);
  }

  .ram-btn {
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .ram-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ram-unit {
    font-size: var(--font-size-sm);
    color: var(--text-color-muted);
    margin-left: 0.25rem;
  }
</style>