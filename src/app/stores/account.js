import { writable, derived } from "svelte/store";

// === Account Store ===
// Initialize empty first, then load accounts after
export const accountsStore = writable([]);

// Helper to refresh the store after add/remove
export async function refreshAccounts() {
    // Import getAccounts here to avoid circular dependency
    const { getAccounts } = await import("../shared/user.js");
    accountsStore.set(getAccounts());
}

// Initialize accounts after module loads
async function initializeAccounts() {
    const { getAccounts } = await import("../shared/user.js");
    accountsStore.set(getAccounts());
}

// Call initialization
initializeAccounts();

// === Selected Account Store ===
export const selectedAccount = writable(
    localStorage.getItem('selectedAccount') || null
);

// Keep localStorage in sync
selectedAccount.subscribe(val => {
    if (val) {
        localStorage.setItem('selectedAccount', val);
    } else {
        localStorage.removeItem('selectedAccount');
    }
});

// === Derived Account States ===
export const selectedAccountData = derived(
    [selectedAccount, accountsStore],
    ([$selectedAccount, $accountsStore]) => {
        if (!$selectedAccount) return null;
        return $accountsStore.find(a => a.uuid === $selectedAccount || a.name === $selectedAccount) || null;
    }
);

export const selectedAccountUsername = derived(
    selectedAccountData,
    ($selectedAccountData) => $selectedAccountData?.name || ''
);

export const userBurst = derived(
    selectedAccountData,
    ($selectedAccountData) => {
        if (!$selectedAccountData?.skinData) {
            return '';
        }
        return $selectedAccountData.skinData.urls?.walking?.bust || '';
    }
);

export const hasAnyAccount = derived(
    accountsStore,
    ($accountsStore) => $accountsStore.length > 0
);

// === User Account State (for backward compatibility) ===
export const userAccountState = {
    hasAccount: derived(accountsStore, ($accountsStore) => $accountsStore.length > 0),
    selectedAccountUuid: derived(selectedAccountData, ($selectedAccountData) => $selectedAccountData?.uuid || null)
};