import { writable } from 'svelte/store';
import { refreshAccounts, selectedAccount, userAccountState } from '../stores/account.js';
import { skinService } from '../services/skinService.js';

const ACCOUNTS_KEY = 'user_accounts';

// === Storage Functions ===
function loadAccounts() {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
}

function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

// === Account Management ===
export function getAccounts() {
    return loadAccounts();
}

export async function addAccount(account) {
    const accounts = loadAccounts();
    
    // Prevent duplicates
    const isDuplicate = accounts.some(a => 
        (account.type === 'offline' && a.type === 'offline' && a.name === account.name) ||
        (account.type === 'online' && a.type === 'online' && a.uuid === account.uuid)
    );
    
    if (isDuplicate) {
        return false;
    }

    // Fetch skin data
    try {
        account.skinData = await skinService.getSkinData(account.name);
    } catch (error) {
        account.skinData = skinService.getSteveSkinData();
    }

    accounts.push(account);
    saveAccounts(accounts);
    refreshAccounts();
    return true;
}

export async function refreshAccountSkins(account) {
    try {
        account.skinData = await skinService.getSkinData(account.name);
        return true;
    } catch (error) {
        console.error(`Failed to refresh skin for ${account.name}:`, error);
        return false;
    }
}

export async function refreshAllAccountSkins() {
    const accounts = loadAccounts();
    let hasChanges = false;

    for (const account of accounts) {
        const success = await refreshAccountSkins(account);
        if (success) {
            hasChanges = true;
        }
    }

    if (hasChanges) {
        saveAccounts(accounts);
        refreshAccounts();
    }
    
    // Cleanup expired cache
    skinService.cleanupCache();
}

export function updateAccount(identifier, updates) {
    const accounts = loadAccounts();
    const idx = accounts.findIndex(a =>
        (a.type === 'offline' && a.name === identifier) ||
        (a.type === 'online' && a.uuid === identifier)
    );
    
    if (idx === -1) return false;

    accounts[idx] = { ...accounts[idx], ...updates };
    saveAccounts(accounts);
    refreshAccounts();
    return true;
}

export function removeAccount(identifier) {
    let accounts = loadAccounts();
    const selectedId = localStorage.getItem('selectedAccount');

    // Check if removing selected account
    const isSelected = accounts.some(a => 
        (a.uuid === identifier || a.name === identifier) &&
        (a.uuid === selectedId || a.name === selectedId)
    );

    // Remove account
    accounts = accounts.filter(a => 
        a.uuid !== identifier && a.name !== identifier
    );

    saveAccounts(accounts);
    refreshAccounts();

    // Clear selection if needed
    if (isSelected) {
        selectedAccount.set(null);
    }
}

// === Selection Management ===
export function setSelectedAccount(identifier) {
    selectedAccount.set(identifier);
}

export function getSelectedAccount() {
    const id = localStorage.getItem('selectedAccount');
    if (!id) return null;

    const accounts = getAccounts();
    return accounts.find(a => a.uuid === id || a.name === id) || null;
}

// === Skin Data Access ===
export function getSkinUrl(account, renderType = 'default') {
    if (!account || !account.skinData) {
        return skinService.getSkinUrl(null, renderType);
    }
    
    return skinService.getSkinUrl(account.skinData, renderType);
}

export function getRawSkinUrl(account) {
    if (!account || !account.skinData) {
        return skinService.getSkinUrl(null, 'raw');
    }
    
    return account.skinData.urls.raw;
}

export function getFaceUrl(account) {
    if (!account || !account.skinData) {
        return skinService.getSkinUrl(null, 'face');
    }
    
    return account.skinData.urls.pixel.face;
}

export function getDefaultSkin(){
    return skinService.getSteveSkinData();
}

// Legacy function for backward compatibility
export function refreshHasAccount() {
    // No longer needed as hasAccount is now a derived store
    console.warn('refreshHasAccount is deprecated - hasAccount is now reactive');
}