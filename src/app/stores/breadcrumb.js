import { writable } from 'svelte/store';

// Dynamic breadcrumb context store
function createBreadcrumbStore() {
  const { subscribe, set, update } = writable({
    instanceName: null,
    modName: null,
    shaderName: null,
    resourcePackName: null,
    instanceTab: null
  });

  return {
    subscribe,
    set,
    update,
    updateContext: (context) => update(current => ({ ...current, ...context })),
    reset: () => set({
      instanceName: null,
      modName: null,
      shaderName: null,
      resourcePackName: null,
      instanceTab: null
    }),
    resetContext: (contextKey) => update(current => ({ ...current, [contextKey]: null }))
  };
}

export const breadcrumbStore = createBreadcrumbStore();
