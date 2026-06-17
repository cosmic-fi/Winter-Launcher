import { writable } from 'svelte/store';

function persistStore(key, initial) {
    let stored = localStorage.getItem(key);
    if (stored === null || stored === undefined) {
        localStorage.setItem(key, initial);
        stored = initial;
    }
    const store = writable(stored);
    store.subscribe(value => {
        localStorage.setItem(key, value);
    });
    return store;
}

export const selectedMajor = persistStore('selectedMajor', '');
export const selectedVariant = persistStore('selectedVariant', '');
export const selectedType = persistStore('selectedType', '');