<script lang="js">
// @ts-nocheck

    import { createEventDispatcher } from 'svelte';
    import { accountsStore } from '../../stores/account';
    import { showToast, uiState } from '../../stores/ui';
    import SimpleTip from '../ui/Tip.svelte';
    import { addAccount, getAccounts, getSelectedAccount, setSelectedAccount } from '../../shared/user';
    import { generateHexUUID } from '../../utils/helper';
    import { t, currentLocale } from '../../stores/i18n';
    import { XIcon } from '@lucide/svelte';
    import { fade } from 'svelte/transition';

const dispatch = createEventDispatcher();

let showOfflineForm = false;
let name = '';
let error = '';
let submitting = false;
let addingOnlineAccount = false; // New loading state for online accounts
let { activeModal } = uiState;
// Add username validation function
function validateUsername(username) {
    // Check if username is empty
    if (!username.trim()) {
        return false;
    }
    
    // Check length (3-16 characters)
    if (username.length < 3 || username.length > 16) {
        return false;
    }
    
    // Check for valid characters (only alphanumeric and underscore)
    const validPattern = /^[a-zA-Z0-9_]+$/;
    return validPattern.test(username);
}

// Add real-time validation
function handleUsernameInput(e) {
    name = e.target.value;
    
    // Set error messages for display
    if (!name.trim()) {
        error = $t('accountAdder.offlineAccountForm.usernameRequired');
    } else if (name.length < 3) {
        error = $t('accountAdder.offlineAccountForm.usernameTooShort');
    } else if (name.length > 16) {
        error = $t('accountAdder.offlineAccountForm.usernameTooLong');
    } else if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        error = $t('accountAdder.offlineAccountForm.usernameInvalidCharacters');
    } else {
        error = ''; // Clear error if valid
    }
}

// Reactive variable for button state
$: isUsernameValid = validateUsername(name);

function selectType(type) {
    if (type === 'offline') {
        showOfflineForm = true;
    } else {
        addingOnlineAccount = true; // Start loading state
        activeModal.set("invoker");
        window.electron.invoke('add-account', 'hello')
        .then(async auth => {
            const result = JSON.parse(auth);
            const account = result.mc;

            if (!result.success) {
                activeModal.set('none')
                addingOnlineAccount = false; // End loading state
                showToast($t('accountAdder.failedToAddAccount'), 'error');
            } else {
                let _mAccount = {
                    type: 'online',
                    uuid: account.uuid,
                    access_token: account.access_token,
                    refresh_token: result.extra.parent.msToken.refresh_token,
                    client_id: account.client_id,
                    meta: account.meta,
                    name: account.name,
                    user_properties: account.user_properties,
                    profile: result.extra.profile
                };

                if ($accountsStore.length <= 0) {
                    setSelectedAccount(_mAccount.uuid);
                }

                // This is where the delay happens - downloading skin data
                try {
                    await addAccount(_mAccount);

                    // Always set the newly added account as selected
                    setSelectedAccount(_mAccount.uuid);
                    showToast($t('accountAdder.accountAdded'), 'info');
                } catch (error) {
                    console.error('Error adding account:', error);
                    showToast($t('accountAdder.failedToAddAccount'), 'error');
                } finally {
                    activeModal.set('none')
                    addingOnlineAccount = false; // End loading state
                }
            }
        })
        .catch(error => {
            console.error('Authentication error:', error);
            activeModal.set('none')
            addingOnlineAccount = false; // End loading state
            showToast($t('accountAdder.failedToAddAccount'), 'error');
        });
    }
}

function close() {
    activeModal.set('none')
}

async function submitOffline(e) {
    e.preventDefault();
    
    // Double-check validation before submission
    if (!validateUsername(name)) {
        return;
    }
    
    let uuid = generateHexUUID();
    submitting = true;

    const _oAccount = {
        type: 'offline',
        access_token: 0,
        client_id: 0,
        meta: {},
        name: name.trim(),
        user_properties: {},
        uuid: uuid,
        profile: {}
    }
    
    try {
        // Remove the setTimeout and make it properly async
        await addAccount(_oAccount);
        
        // Always set the newly added account as selected
        setSelectedAccount(uuid);
        
        // Reset form state
        name = '';
        showOfflineForm = false;
        showToast($t('accountAdder.accountAdded'), 'info');
        activeModal.set('none')
    } catch (error) {
        console.error('Error adding offline account:', error);
        showToast($t('accountAdder.failedToAddAccount'), 'error');
    } finally {
        submitting = false;
    }
}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="account-adder-container" transition:fade={{ duration: 100 }} on:click|self={close}>
    <div class="wrapper account-type-option-container">
        <div class="container-header">
            <span class="c-title">{showOfflineForm ? $t('accountAdder.addOfflineAccount') : $t('accountAdder.selectAccountType')}</span>
            <button class="close-btn btn btn-default" aria-label={$t('accountAdder.close')} on:click={close} disabled={submitting || addingOnlineAccount}>
                <XIcon size={16} />
            </button>
        </div>
        {#if !showOfflineForm}
            <div class="ac-type-container">
                <button class="ac-type-item" on:click={() => selectType('online')} disabled={addingOnlineAccount}>
                    <span class="ac-type-title">
                        {#if addingOnlineAccount}
                            <i class="fa fa-spinner fa-spin"></i>
                        {:else}
                            <i class="fa-brands fa-microsoft"></i>
                        {/if}
                        &nbsp;{addingOnlineAccount ? $t('accountAdder.addingAccount') : $t('accountAdder.addMinecraftAccount')}
                    </span>
                    <span class="ac-type-description">
                        {addingOnlineAccount ? $t('accountAdder.addingAccountDescription') : $t('accountAdder.addMinecraftAccountDescription')}
                    </span>
                </button>
                <button class="ac-type-item offline" on:click={() => selectType('offline')} disabled={addingOnlineAccount}>
                    <span class="ac-type-title"><i class="fa fa-link-slash"></i>&nbsp;{$t('accountAdder.addOfflineAccount')}</span>
                    <span class="ac-type-description">
                        {$t('accountAdder.addOfflineAccountDescription')}
                    </span>
                </button>
            </div>
        {:else}
            <div class="offline-account-form">
                <form class="input-form" on:submit={submitOffline}>
                    <div class="description-input-cont">
                        <span class="form-description">
                            {$t('accountAdder.offlineAccountForm.enterUsername')}
                        </span>
                        <input
                            type="text"
                            name="offline-name-input"
                            id="offline-account-name"
                            placeholder={$t('accountAdder.offlineAccountForm.usernamePlaceholder')}
                            bind:value={name}
                            on:input={handleUsernameInput}
                            maxlength="16"
                            class:error={error}
                            disabled={submitting}
                        >
                        {#if error}
                            <div class="form-error text-danger">{error}</div>
                        {/if}
                    </div>
                    <div class="button-group">
                        <button class="btn btn-default" type="button" on:click={() => { showOfflineForm = false; name = ''; }} disabled={submitting}>
                            {$t('accountAdder.offlineAccountForm.cancel')}
                        </button>
                        <button type="submit" class="btn-primary btn" disabled={submitting || !isUsernameValid}>
                            {#if submitting}
                                <i class="fa fa-spinner fa-spin"></i>&nbsp;{$t('accountAdder.offlineAccountForm.saving')}
                            {:else}
                                {$t('accountAdder.offlineAccountForm.save')}
                            {/if}
                        </button>
                    </div>
                </form>
            </div>
        {/if}
    </div>
</div>

<style>
    .account-adder-container {
        width: 100%;
        height: 100%;
        position: absolute !important;
        z-index: 99;
        left: 0px;
        top: 0px;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.5);

        .wrapper {
            display: flex;
            width: 550px;
            background-color: var(--surface-color);
            overflow: hidden;
            border: 2px var(--border-color) solid;
            border-bottom-width: 5px;
            box-shadow: var(--shadow-color) 0px 0px 15px;
            flex-direction: column;

            .container-header {
                background-color: var(--overlay-color);
                padding: 10px;
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
                gap: .5rem;

                .c-title {
                    color: var(--text-color);
                    font-size: var(--font-size-base);
                    flex: 1;
                    border-right: 2px solid var(--border-color);
                }
            }

            .ac-type-container {
                background-color: var(--surface-color);
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                padding: 10px;
                row-gap: 10px;

                .ac-type-item {
                    display: flex;
                    flex-direction: column;
                    padding: 10px;
                    background-color: var(--overlay-color);
                    background-size: 100%;
                    background-position: center left;
                    background-repeat: no-repeat;
                    overflow: hidden;
                    min-height: 90px !important;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1), color .2s, box-shadow .2s !important;
                    cursor: pointer;
                    row-gap: 5px;
                    justify-content: start !important;
                    align-items: start !important;

                    .ac-type-title {
                        color: var(--text-color);
                        font-size: var(--font-size-body);
                        display: flex;
                        flex-direction: row;
                        align-items: center;
                        color: var(--text-color);
                        column-gap: .5vw;
                    }

                    .ac-type-description {
                        color: var(--text-color-muted);
                        font-size: var(--font-size-sm);
                        text-align: left;
                    }

                    i{
                        color: var(--text-color-muted);
                    }
                    &:hover {
                        background-size: 110%;
                        color: var(--text-color);
                        box-shadow: inset 0 0 0 2px var(--overlay-color-1);
                    }
                }

                .offline {
                    background-position: top center;
                    background-size: 100%;
                    background-repeat: no-repeat;
                    justify-content: start !important;
                    align-items: start !important;
                }
            }

            .offline-account-form {
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                padding: 10px;
                row-gap: 10px;

                .input-form {
                    display: flex;
                    margin: 0;
                    flex-direction: column;
                    row-gap: 2vw;

                    .description-input-cont {
                        display: flex;
                        flex-direction: column;
                        row-gap: 10px;

                        .form-description {
                            color: var(--text-color-muted);
                            font-size: var(--font-size-body);
                            padding-block: 10px;
                        }

                        input {
                            padding: 10px;
                        }
                    }

                    .button-group {
                        border-top: 1px var(--border-color) solid;
                        display: flex;
                        flex-direction: row;
                        justify-content: end;
                        padding-top: 1vw;
                        column-gap: 1vw;

                        button {
                            padding-inline: 2rem;
                        }
                    }
                }
            }
        }
    }
    .text-danger{
        color: var(--error-color-light);
        font-size: var(--font-size-body);
    }
    
    .ac-type-item:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    .fa-spin {
        animation: fa-spin 2s infinite linear;
    }
    
    @keyframes fa-spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>
