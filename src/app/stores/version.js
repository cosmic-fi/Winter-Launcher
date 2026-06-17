import { writable, derived } from 'svelte/store';

export const selectedMajor = writable('');
export const selectedVariant = writable('');
export const selectedType = writable('');

// Optionally, a derived store for the full selected version object
export const selectedVersionInfo = derived(
  [selectedMajor, selectedVariant, selectedType],
  ([$selectedMajor, $selectedVariant, $selectedType]) => ({
    major: $selectedMajor,
    variant: $selectedVariant,
    type: $selectedType
  })
);