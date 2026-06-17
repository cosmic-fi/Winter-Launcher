<script>
    // @ts-nocheck
    import { uiState } from "../../stores/ui";
    import {
        selectedAccountUsername,
        userBurst,
        accountsStore,
        selectedAccount,
        selectedAccountData
    } from "../../stores/account";
    import { getDefaultSkin, setSelectedAccount, getSkinUrl } from "../../shared/user";
    import { t } from "../../stores/i18n.js";
    import { limitText } from "../../utils/helper";
    import SimpleTip from "../ui/Tip.svelte";

    const { activeModal } = uiState;

    const defaultSkin = getDefaultSkin().urls.dungeons.bust;
    
    let showAccountDropdown = false;
    let dropdownRef;
    let avatarCardRef;
    
    function toggleAccountDropdown(event) {
         event.stopPropagation(); // Prevent this click from triggering the outside click handler
         showAccountDropdown = !showAccountDropdown;
     }
    
    function selectAccount(account) {
        setSelectedAccount(account.uuid);
        showAccountDropdown = false;
    }
    
    function handleAddAccount() {
        activeModal.set("accountadder");
        showAccountDropdown = false;
    }

    function handleManageAccounts() {
        activeModal.set("accountmanager");
        showAccountDropdown = false;
    }
    
    // Close dropdown when clicking outside
    function closeSelectionPopup(event) {
        // Don't close if clicking on the toggle button itself
        const toggleBtn = event.target.closest('.account-button-toggle');
        if (toggleBtn) return;
        
        // Close if clicking outside the dropdown
        if (dropdownRef && !dropdownRef.contains(event.target)) {
            showAccountDropdown = false;
        }
    }

    function closeModal(event){
        const modalToggleBtn = event.target.closest('.avatarcard-toggle-btn');
        if(modalToggleBtn) return;

        if(avatarCardRef && !avatarCardRef.contains(event.target)){
           activeModal.set('none');
        }
    }
    
    // Add event listener for outside clicks
    import { onMount } from "svelte";
    import { PlusIcon, User2, UserCog, UserSearch } from "@lucide/svelte";
  import { image } from "../../utils/image";
    
    onMount(() => {
        const handleClickEvents = (event) => {
            closeSelectionPopup(event);
            closeModal(event);   
        }


        document.addEventListener('click', handleClickEvents);
        return () => document.removeEventListener('click', handleClickEvents);
    });

    $: accounts = $accountsStore;
</script>

<div class="avatar-modal">
    <div class="avatar-model-wrapper" bind:this={avatarCardRef}>
        <div class="avatar-card">
            <div class="wrapper">
                <div class="skin-container">
                    <div class="burst-container">
                        <div class="bg-cover"></div>
                        <img class="burst-image" src={$userBurst || defaultSkin} alt="" use:image>
                    </div>
                </div>
                
                <!-- Account Selection Dropdown -->
                {#if showAccountDropdown}
                    <div class="account-dropdown" bind:this={dropdownRef}>
                        <div class="dropdown-header">
                            <span>{$t("mainContent.selectAccount")}</span>
                        </div>
                        <div class="account-list">
                            {#if $accountsStore.length === 0}
                                 <div class="no-accounts-message">
                                     <UserSearch />
                                     <span>{$t("mainContent.noAccounts")}</span>
                                 </div>
                            {:else}
                                {#each $accountsStore as account}
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                                    <div 
                                        class="account-item {$selectedAccount === account.uuid ? 'active' : ''}"
                                        onclick={() => selectAccount(account)}
                                    >
                                        <img 
                                            src={getSkinUrl(account, 'pixel').face} 
                                            alt={account.name}
                                            class="account-face"
                                            use:image
                                        />
                                        <div class="account-info">
                                            <span class="account-name" use:limitText={{size: 16}}>{account.name}</span>
                                            <span class="account-type">{account.type === 'online' ? $t('avatarCard.accountType.minecraft') : $t('avatarCard.accountType.offline')}</span>
                                        </div>
                                        {#if $selectedAccount === account.uuid}
                                            <i class="fa fa-check check-icon"></i>
                                        {/if}
                                    </div>
                                {/each}
                            {/if}
                        </div>
                        <div class="dropdown-footer">
                            <button 
                                class="add-account-dropdown-btn btn btn-primary"
                                onclick={handleAddAccount}
                            >
                                <PlusIcon size={16} />
                                {$t("mainContent.addAccount")}
                            </button>
                            <SimpleTip direction="left" text={$t("avatarCard.manageAccount")}>
                                <button
                                    class="manage-account-dropdown-btn btn btn-default"
                                    onclick={handleManageAccounts}
                                >
                                    <UserCog size={18} />
                                </button>
                            </SimpleTip>
                        </div>
                    </div>
                {/if}
                
                <div class="account-action-btn-container">
                    <!-- Show account selector button when accounts exist -->
                    <button 
                        class="account-button-toggle"
                        onclick={toggleAccountDropdown}
                        aria-label="Select account"
                    >
                        {#if $selectedAccountData}
                            <img src={getSkinUrl($selectedAccountData, 'pixel').face} alt={$selectedAccountData.name} class="account-face-small" use:image>
                            <div class="account-info">
                                <span class="account-name">{$selectedAccountData.name}</span>
                                <span class="account-type">{$selectedAccountData.type === 'online' ? $t('avatarCard.accountType.minecraft') : $t('avatarCard.accountType.offline')}</span>
                            </div>
                        {:else}
                            <div class="account-info">
                                <span class="account-name">{$t("mainContent.selectAccount")}</span>
                                <span class="account-type">{$t("mainContent.noAccountSelected")}</span>
                            </div>
                        {/if}
                        <i class="fa fa-chevron-down dropdown-icon" class:rotated={showAccountDropdown}></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .avatar-modal{
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        z-index: 999;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: start;
        flex-direction: row;
        justify-content: end;
        
        .avatar-model-wrapper{
            padding: 5px 10px 5px 5px;
        }
    }
    .avatar-card {
        display: flex;
        flex: 1;
        grid-area: avatar-card;
        position: relative;
        border: 2px solid var(--border-color);
        border-bottom-width: 5px;

        .wrapper {
            display: flex;
            flex-direction: column;
            background-color: var(--overlay-color);
            box-shadow: 0 1px 0px 0px var(--border-color);
            flex-grow: 1;
            padding: 8px;
            row-gap: 8px !important;
            overflow: hidden;

            .skin-container {
                flex-grow: 1;
                min-height: 200px;
                min-width: 300px;
                border-bottom: 2px var(--border-color) solid;
                position: relative;
                display: flex;
                justify-content: center;

                .burst-container {
                    position: relative;
                    display: flex;
                    align-items: center;
                    flex-direction: column;
                    justify-content: end;
                    transition: all .2s ease;
                    overflow: hidden;
                    row-gap: .8rem;
                    padding-inline: 1rem;
                    background: radial-gradient(circle,
                        color-mix(in srgb, var(--accent-color-light), transparent 40%) 0%, 
                        color-mix(in srgb, var(--accent-color-light), transparent 100%) 70%);

                    .bg-cover{
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        top: 0;
                        left: 0;
                        z-index: 1;
                    }
                    .burst-image{
                        width: 160px;
                        object-fit: contain;
                        transition: all .3s ease;
                    }

                    &:hover > .burst-image{
                        transform: scale(1.05);
                    }
                }
            }

            .account-action-btn-container {
                display: flex;
                flex-direction: row;
                column-gap: 1vw;
                position: relative;

                    .account-button-toggle {
                        flex-grow: 1;
                        padding: 0.8vw 1vw;
                        background-color: color-mix(in srgb, var(--overlay-color-1), transparent 50%);
                        color: var(--text-color);
                        box-shadow: inset 0 0 0 3px var(--border-color);
                        display: flex;
                        flex-direction: row;
                        align-items: center;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        gap: 8px;
                        
                        &:hover {
                            background-color: var(--overlay-color-2);
                        }
                        
                        .account-face-small {
                            width: 32px;
                            height: 32px;
                            image-rendering: pixelated;
                            border: 1px solid var(--border-color);
                        }
                        
                        .account-info {
                            flex: 1;
                            display: flex;
                            flex-direction: column;
                            gap: 2px;
                            text-align: left;
                        }
                        
                        .account-name {
                            font-size: var(--font-size-body);
                            font-weight: 500;
                            color: var(--text-color);
                        }
                        
                        .account-type {
                            font-size: var(--font-size-sm);
                            color: var(--text-color-muted);
                        }
                        
                        .dropdown-icon {
                            font-size: var(--font-size-fluid-sm);
                            color: var(--text-color-muted);
                            transition: transform 0.2s ease;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            width: 16px;
                            height: 16px;
                            margin-left: auto;
                            &.rotated {
                                transform: rotate(180deg);
                            }
                         }
                    }
                }
        }
    }
    
    .account-dropdown {
        position: absolute;
        top: calc(100% - 5px);
        left: 10px;
        right: 10px;
        background-color: var(--surface-color);
        border: 2px solid var(--border-color);
        border-bottom: 5px solid var(--border-color);
        box-shadow: 0 4px 12px var(--shadow-color);
        z-index: 10;
        max-height: 260px;
        display: flex;
        flex-direction: column;
        animation: dropdownSlide 0.2s ease;
        min-width: 200px;
    }
    
    @keyframes dropdownSlide {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    
    .dropdown-header {
        padding: 10px 12px;
        border-bottom: 1px solid var(--border-color);
        font-size: var(--font-size-body);
        font-weight: 600;
        color: var(--text-color-muted);
        text-align: center;
    }
    
    .account-list {
        flex: 1;
        overflow-y: auto;
        max-height: 200px;
        padding: 5px;
    }
    
    .no-accounts-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px 16px;
        text-align: center;
        color: var(--text-color-muted);
        gap: 12px;
        animation: fadeIn 0.3s ease;
    }
    
    .no-accounts-message span {
        font-size: var(--font-size-sm);
    }
    .account-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        border-bottom: 1px solid var(--border-color-50);
        gap: 10px;
        position: relative;
    }
    
    .account-item:hover {
        background-color: var(--overlay-color);
    }
    
    .account-item.active {
        background-color: var(--overlay-color-1);
        box-shadow: inset 0 0 0 2px var(--overlay-color-2);
    }
    
    .account-face {
        width: 24px;
        height: 24px;
        image-rendering: pixelated;
    }
    
    .account-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    
    .account-name {
        font-size: var(--font-size-body);
        font-weight: 500;
        color: var(--text-color);
    }
    
    .account-type {
        font-size: var(--font-size-sm);
        color: var(--text-color-muted);
    }
    
    .check-icon {
        color: var(--text-color);
        font-size: var(--font-size-sm);
    }
    
    .dropdown-footer {
        display: flex;
        flex-direction: row;
        padding: 8px;
        border-top: 1px solid var(--border-color);
        gap: 10px;
    }
    
    .add-account-dropdown-btn {
        width: 100%;
    }
    
    .add-account-dropdown-btn:hover {
        background-color: var(--accent-color-light);
    }
</style>
