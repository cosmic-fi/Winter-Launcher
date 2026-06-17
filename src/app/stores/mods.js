//@ts-nocheck

import { writable, derived } from 'svelte/store';
import modrinthService from '../services/modrinthService';

// Create a store for mods
const createModsStore = () => {
    const { subscribe, set, update } = writable({
        popular: [],
        loading: false,
        error: null
    });

    return {
        subscribe,
        
        async loadPopularMods(limit = 4) {
            update(state => ({ ...state, loading: true, error: null }));
            
            try {
                // Try Modrinth first for popular mods
                const result = await modrinthService.searchMods({
                    query: '',
                    sort: 'downloads', // Sort by downloads for popular mods
                    limit: limit
                });
                
                update(state => ({
                    ...state,
                    popular: result.hits,
                    loading: false
                }));
            } catch (error) {
                update(state => ({
                    ...state,
                    error: error.message,
                    loading: false
                }));
            }
        },
        
        clearError() {
            update(state => ({ ...state, error: null }));
        }
    };
};

export const modsStore = createModsStore();