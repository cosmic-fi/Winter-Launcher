<script>
  // @ts-nocheck

  import SimpleTip from "../ui/Tip.svelte";
  import SkinViewer from "./SkinViewerModal.svelte";
  import {
    getAccounts,
    removeAccount,
    setSelectedAccount,
    getSelectedAccount,
    getSkinUrl,
    updateAccount,
  } from "../../shared/user.js";
  import { limitText } from "../../utils/helper";
  import { showDialog, showToast, uiState } from "../../stores/ui";
  import { accountsStore, userAccountState } from "../../stores/account";
  import { t } from "../../stores/i18n";
  import {
    CircleCheck,
    Trash2,
    RotateCw,
    XIcon,
    Check,
    UserSearch,
    PlusIcon,
  } from "@lucide/svelte";
  import { fade, fly } from "svelte/transition";
  import { image } from "../../utils/image";

  // let accounts = $accountsStore;
  let { selectedAccountUuid } = userAccountState;
  let { activeModal } = uiState;

  const selectedAccount = getSelectedAccount();
  if (selectedAccount) {
    // Source of truth is the selectedAccount writable behind setSelectedAccount
    setSelectedAccount(selectedAccount.uuid);
  }

  // Remove handler
  function handleDelete(account) {
    showDialog({
      title: $t("accountManager.deleteAccountTitle"),
      message: $t("accountManager.deleteAccountMessage"),
      buttons: [
        {
          label: $t("accountManager.cancel"),
          type: "normal",
          action: () => {},
        },
        {
          label: $t("accountManager.delete"),
          type: "danger",
          action: () => {
            removeAccount(account.uuid);
          },
        },
      ],
    });
  }

  // Select handler
  function handleSelect(account) {
    setSelectedAccount(account.uuid);
  }

  // Refresh account handler
  async function handleRefreshAccount(account) {
    const accountId = account.uuid || account.name;

    // Prevent multiple refresh attempts on the same account
    if (refreshingAccounts.has(accountId)) {
      return;
    }

    refreshingAccounts.add(accountId);
    refreshingAccounts = refreshingAccounts; // Trigger reactivity

    try {
      if (account.type === "online") {
        // Refresh online account token
        const result = await window.electron.invoke("refresh-account", account);
        if (result.success) {
          const updatedAccount = {
            ...account,
            access_token: result.mc.access_token,
            refresh_token: result.extra.msToken.refresh_token,
            client_id: result.mc.client_id,
            user_properties: result.mc.user_properties,
            profile: result.extra.profile,
          };
          updateAccount(accountId, updatedAccount);
          showToast($t("accountManager.accountRefreshedSuccessfully"), "info");
        } else {
          showToast($t("accountManager.accountRefreshFailed"), "error");
          console.error("Failed to refresh online account:", result.error);
        }
      }
      return;
    } catch (error) {
      console.error("Error refreshing account:", error);
    } finally {
      refreshingAccounts.delete(accountId);
      refreshingAccounts = refreshingAccounts; // Trigger reactivity
    }
  }

  $: accounts = $accountsStore;

  function close() {
    activeModal.set('none');
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="account-manager-overlay-x"
  transition:fade={{ duration: 100 }}
  on:click|self={close}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="account-manager-panel"
    on:click|stopPropagation
    transition:fly={{ y: 40, duration: 160, opacity: 0.9 }}
  >
    <div class="m-container user-account-manager-container">
      <div class="container-header">
        <div class="container-info-action">
          <span class="title">{$t("accountManager.title")}</span>
          <span class="conntainer-description">
            {$t("accountManager.description")}
          </span>
        </div>
        <button
          class="close-btn btn btn-default"
          aria-label="Close"
          on:click={close}
        >
          <XIcon size={16} />
        </button>
      </div>
      <div class="container-content">
        <div class="o-wrapper">
          <div class="account-list-container">
            <div class="i-wrapper">
              {#if accounts.length === 0}
                <div class="empty-accounts-state">
                  <UserSearch size={48} />
                  <span>{$t("mainContent.noAccounts")}</span>
                  <button
                    class="btn btn-primary"
                    on:click={() => activeModal.set("accountadder")}
                  >
                    <PlusIcon size={16} />
                    {$t("mainContent.addAccount")}
                  </button>
                </div>
              {:else}
                {#each accounts as account, index}
                  <div
                    class="account-card {$selectedAccountUuid === account.uuid
                      ? 'active-card'
                      : ''}"
                  >
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="account-avatar-name-cont"
                      on:click={() => handleSelect(account)}
                    >
                      <img class="account-avatar" src={getSkinUrl(account, 'pixel').face} alt="bananan" use:image>
                      <div class="account-name-spec">
                        <span class="account-name">
                          {#if account.name.length >= 20}
                            <SimpleTip text={account.name} direction="top">
                              <span use:limitText={{ size: 20 }}
                                >{account.name}</span
                              >
                            </SimpleTip>
                          {:else}
                            <span>{account.name}</span>
                          {/if}
                          <span class="account-type"
                            >{account.type === "online"
                              ? $t("accountManager.minecraft")
                              : $t("accountManager.cracked")}</span
                          >
                        </span>
                      </div>
                      <span class="check-mark">
                        <Check size={18} />
                      </span>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        </div>
        <div class="account-skin-view-container">
          <SkinViewer />
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .account-manager-overlay-x {
    width: 100%;
    height: 100%;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .account-manager-panel {
    background-color: var(--surface-color);
    width: 850px;
    height: 550px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--border-color);
    border-bottom-width: 5px;
  }

  .user-account-manager-container {
    overflow: hidden !important;
    flex-grow: 1;
    display: flex;
    flex-direction: column;

    .container-header {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      column-gap: 0.5rem;
      padding: 15px;
    }

    .container-info-action {
      display: flex;
      flex-direction: column;
      justify-content: center;
      row-gap: 5px;

      .title {
        font-size: var(--font-size-body);
        font-weight: 600;
        color: var(--text-color);
      }
      span {
        font-size: var(--font-size-sm);
        color: var(--text-color-muted);
      }
    }

    .container-content {
      display: flex;
      flex-direction: row;
      flex: 1;
      min-height: 0;
      border-top: 2px solid var(--border-color);

      .o-wrapper {
        background-color: var(--overlay-color);
        display: flex;
        flex-direction: column;
        flex: 0 0 320px;
        min-height: 0;
        border-right: 1px solid var(--border-color);

        .account-list-container {
          flex: 1;
          min-height: 0;
          overflow-y: auto;

          .i-wrapper {
            display: flex;
            flex-direction: column;
            row-gap: 8px;
            padding: 10px 8px 10px 10px;

            .empty-accounts-state {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 3rem 1rem;
              text-align: center;
              color: var(--text-color-muted);
              gap: 1rem;

              :global(svg) {
                opacity: 0.5;
              }

              span {
                font-size: var(--font-size-body);
              }

              .btn {
                margin-top: 0.5rem;
              }
            }

            .account-card {
              display: flex;
              flex-direction: row;
              position: relative;
              overflow: hidden;
              align-items: stretch;

              .account-avatar-name-cont {
                display: flex;
                flex-direction: row;
                align-items: center;
                column-gap: 10px;
                padding: 8px 10px;
                z-index: 1;
                cursor: pointer;
                transition: all 0.2s ease !important;
                position: relative;
                border: 2px solid var(--border-color);
                flex: 1;

                .account-avatar {
                  width: 40px;
                  height: 40px;
                  object-fit: contain;
                }

                .account-name-spec {
                  display: flex;
                  flex-direction: column;
                  row-gap: 10px;

                  .account-name {
                    color: var(--text-color);
                    font-size: var(--font-size-body);
                    display: flex;
                    flex-direction: column;
                    align-items: start;
                    justify-content: start;
                    row-gap: 3px;

                    .account-type {
                      font-size: var(--font-size-sm);
                      background-color: var(--overlay-color-2);
                      padding: 1px 5px;
                      color: var(--text-color-muted);
                    }
                  }
                }

                .check-mark {
                  position: absolute;
                  display: none;
                  right: 8px;
                  font-size: 1.1rem;
                  color: var(--text-color);
                }

                &:hover {
                  background-color: var(--overlay-color-1);
                }

                &:active {
                  background-color: var(--overlay-color-2);
                }
              }
            }

            .active-card {
              .account-avatar-name-cont {
                box-shadow:
                  inset 0 0 0 2px
                    color-mix(in srgb, var(--text-color), transparent 80%),
                  inset 0 0 0 100px var(--accent-color-overlay);
                background-color: var(--accent-color-dark);

                .account-name {
                  color: #fff6f0 !important;
                }

                .check-mark {
                  display: flex;
                }

                &:hover {
                  background-color: var(--accent-color-light);
                }
              }
              .account-type {
                background-color: var(--accent-color) !important;
                color: #ffffff !important;
              }
            }
          }
        }
      }

      .account-skin-view-container {
        background-color: var(--base-color);
        flex-grow: 1;
        display: flex;
        overflow: hidden !important;
        flex-direction: column;
        position: relative;
        align-items: center;
        justify-content: center;
        width: 450px;
      }
    }
  }

  :global(.animate-spin) {
    animation: spin 1s infinite linear;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
