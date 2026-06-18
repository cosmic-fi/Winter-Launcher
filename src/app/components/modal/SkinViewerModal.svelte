<script>
    // @ts-nocheck
    import { onDestroy, onMount } from 'svelte';
    import { showToast, showDialog } from '../../stores/ui.js';
    import { selectedAccount, accountsStore, selectedAccountData } from '../../stores/account.js';
    import * as skin3d from 'skin3d';
    import SimpleTip from '../ui/Tip.svelte';
    import CustomOptions from '../ui/Options.svelte';
    import { t } from '../../stores/i18n.js';
    import { getSkinUrl, removeAccount, updateAccount } from '../../shared/user.js';
    import Loading from '../ui/Loading.svelte';
    import { Pause, Play, RefreshCcw, Save, Trash, MoreHorizontal } from '@lucide/svelte';
  import { image } from '../../utils/image.js';
  import { fade } from 'svelte/transition';

    let canvas;
    let viewer = null;
    let animations;
    let view2D = true;
    let skinImage = null;
    let currentRenderType = 'default';
    let currentCropType = 'full';
    let refreshing = false;
    let showActionsMenu = false;
    
    let actionMenuAction = 'none';

    $: animations = [
        { value: 'idle', label: $t('skinViewer.animations.idle') },
        { value: 'walking', label: $t('skinViewer.animations.walking') },
        { value: 'running', label: $t('skinViewer.animations.running') },
        { value: 'crouch', label: $t('skinViewer.animations.crouch') },
        { value: 'waving', label: $t('skinViewer.animations.waving') },
    ];

    let activeAnimationValue;
    $: activeAnimationValue = animations[0]?.value || 'idle';

    // keys must align with animation values
    const availableAnimations = {
        idle: new skin3d.IdleAnimation(),
        walking: new skin3d.WalkingAnimation(),
        running: new skin3d.RunningAnimation(),
        waving: new skin3d.WaveAnimation(),
        crouch: new skin3d.CrouchAnimation(),
    };

    let isPaused = false;
    
    // derived
    $: activeAnimation = availableAnimations[activeAnimationValue];

    // Use the derived selectedAccountData instead of manual lookup
    $: account = $selectedAccountData;
    // Get current skin URL based on render type and crop
    $: currentSkinUrl = getSkinUrl(account, 'default').full;
    // Use raw skin for 3D viewer
    $: skinUrl = getSkinUrl(account, 'skin').default;

    // Initialize or update viewer when canvas and skinUrl are available
    $: if (canvas && !view2D) {
        if (!viewer) {
            // create viewer once
            viewer = new skin3d.View({
                canvas,
                width: 450,
                height: 500,
                skin: skinUrl,
                cape: account?.type === 'online'
                    ? account?.profile?.capes?.find(c => c.state === 'ACTIVE')?.url
                    : undefined
            });
            viewer.controls.enableRotate = true;
            viewer.controls.enableZoom = false;
            viewer.zoom = 0.6;
            // set panorama background using skin3d built-in support
            try {
                viewer.loadPanorama('/images/static/panorama.png');
            } catch (e) {
                console.error('Failed to load panorama background for SkinViewer:', e);
            }

            // apply initial animation state
            if (activeAnimation) {
                viewer.animation = activeAnimation;
                viewer.animation.speed = 0.6;
            }
            viewer.animation.paused = isPaused;
        } else {
            // update skin without full re-create
            viewer.loadSkin(skinUrl);
            
            if (account?.type === 'online') {
                const activeCape = account?.profile?.capes?.find(c => c.state === 'ACTIVE');
                if (activeCape) {
                    viewer.loadCape(activeCape.url);
                } else {
                    // Remove cape if online account has no active cape
                    viewer.loadCape(null);
                }
            } else {
                // Remove cape for offline accounts or when no account selected
                viewer.loadCape(null);
            }
        }
    }

    // Handle 2D view mode
    $: if (view2D) {
        // Dispose 3D viewer when switching to 2D
        if (viewer) {
            viewer.dispose();
            viewer = null;
        }
        // Load skin image for 2D view
        skinImage = currentSkinUrl;
    } else {
        // Clear skin image when switching to 3D
        skinImage = null;
    }

    // Apply animation changes (swap) while preserving speed & pause
    $: if (viewer && activeAnimation) {
        const wasPaused = viewer.animation?.paused || false;
        viewer.animation = activeAnimation;
        viewer.animation.speed = 0.6;
        if (wasPaused || isPaused) {
            viewer.animation.paused = true;
        } else {
            viewer.animation.paused = false;
        }
    }

    // Pause/resume control separate
    $: if (viewer && viewer.animation) {
        if (isPaused) {
            viewer.animation.paused = true;
        } else {
            viewer.animation.paused = false;
        }
    }

    
    $: actionMenuOptions =  [
        { value: 'save-skin', label: $t('skinViewer.saveSkin'), icon: Save },
        { value: 'refresh-account', label: $t('accountManager.refreshAccount'), icon: RefreshCcw, disabled: account.type === 'offline' },
        { type: 'separator' },
        { value: 'delete-account', label: $t('accountManager.removeAccount'), type: 'danger', icon: Trash },
    ]

    function handleActionMenuChange(e){
        const value = e.detail.value;

        if(value === 'none') return;
        
        switch(value){
            case 'save-skin':
                saveSkin();
                break;
            case 'refresh-account':
                handleRefreshAccount();
                break;
            case 'delete-account':
                handleDeleteAccount();
                break;
        }
        actionMenuAction = 'none';
    }

    onDestroy(() => {
        if (viewer) viewer.dispose();
    });

    function handleAnimationChange(e) {
        activeAnimationValue = e.detail.value;
    }

    function togglePausePlay() {
        isPaused = !isPaused;
    }

    function toggleViewMode() {
        view2D = !view2D;
    }

    async function saveSkin() {
        if (!skinUrl) {
            showToast($t('skinViewer.noSkinAvailable'), 'error');
            return;
        }
        
        try {
            const filename = `${account?.name || 'minecraft'}_skin.png`;
            const result = await window.electron.downloadSkin(skinUrl, filename);
            
            if (result.success) {
                showToast($t('skinViewer.skinSavedSuccessfully'), 'info');
            } else if (!result.canceled) {
                showToast($t('skinViewer.failedToSaveSkin', { error: result.error }), 'error');
            }
        } catch (error) {
            console.error('Error saving skin:', error);
            showToast($t('skinViewer.failedToSaveSkin'), 'error');
        }
    }

    async function handleRefreshAccount() {
        showToast('Refreshing account..', 'normal');
        if (!account || account.type !== 'online' || refreshing) {
            return;
        }

        refreshing = true;

        try {
            const accountId = account.uuid || account.name;
            const result = await window.electron.invoke('refresh-account', account);
            if (result.success) {
                const updatedAccount = {
                    ...account,
                    access_token: result.mc.access_token,
                    refresh_token: result.extra.msToken.refresh_token,
                    client_id: result.mc.client_id,
                    user_properties: result.mc.user_properties,
                    profile: result.extra.profile
                };
                updateAccount(accountId, updatedAccount);
                showToast($t('accountManager.accountRefreshedSuccessfully'), 'info');
            } else {
                showToast($t('accountManager.accountRefreshFailed'), 'error');
                console.error('Failed to refresh online account:', result.error);
            }
        } catch (error) {
            console.error('Error refreshing account:', error);
        } finally {
            refreshing = false;
        }
    }

    function handleDeleteAccount() {
        if (!account) return;

        showDialog({
            title: $t('accountManager.deleteAccountTitle'),
            message: $t('accountManager.deleteAccountMessage'),
            buttons: [
                { label: $t('accountManager.cancel'), type: "normal", action: () => {} },
                { label: $t('accountManager.delete'), type: "danger", action: () => { 
                    removeAccount(account.uuid);
                } }
            ]
        });
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="skin-viewer-container">
    {#if view2D}
        <div class="skin-2d-container fade-in-bck">
            {#if skinImage}
                <img src={skinImage} alt="Minecraft Skin" class="skin-2d-image" use:image />
            {:else}
                <Loading message="Loading skin..." size="small" inline={true} />
            {/if}
        </div>
    {:else}
        <canvas class="fade-in-bck" bind:this={canvas}></canvas>
    {/if}
    <div class="skin-viewer-button">
        {#if !view2D}
            <SimpleTip text="{$t('skinViewer.viewModes.2d')}" direction="left">
                <button class="btn-primary btn" 
                        aria-label="toggle-view" 
                        on:click={toggleViewMode}>
                        2D
                </button>
            </SimpleTip>
        {:else}
            <SimpleTip text="{$t('skinViewer.viewModes.3d')}" direction="left">
                <button class="btn-primary btn" 
                    aria-label="toggle-view" 
                    on:click={toggleViewMode}>
                   3D
                </button>
            </SimpleTip>
        {/if}
      
        {#if !view2D}
            <CustomOptions
                options={animations}
                id="skinviewAnimation"
                preferredPosition="up"
                value={activeAnimationValue}
                on:optionchange={handleAnimationChange}
            />
            <SimpleTip text="{$t('skinViewer.playPause')}" direction="left">
                <button class="animation btn btn-default" aria-label="play-animation" on:click={togglePausePlay}>
                    {#if isPaused}
                        <Play size={16}/>
                    {:else}
                        <Pause size={16}/>
                    {/if}
                </button>
            </SimpleTip>
        {/if}

        {#if account}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div class="actions-menu-container" on:click|stopPropagation>
                <CustomOptions
                    id='action-menu-actions'
                    options={actionMenuOptions}
                    value={actionMenuAction}
                    iconOnly={true}
                    preferredPosition="up-right"
                    on:optionchange={handleActionMenuChange}
                />
            </div>
        {:else}
            <SimpleTip text="{$t('skinViewer.saveSkin')}" direction="left">
                <button class="btn btn-default" 
                    aria-label="save-skin" 
                    on:click={saveSkin}>
                    <Save size={16} />
                </button>
            </SimpleTip>
        {/if}
    </div>
</div>

<style>
.skin-viewer-container {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all .2s ease;
    perspective: 1000px;
    background-color: var(--base-color);
    overflow: hidden;
}
.skin-viewer-button {
    position: absolute;
    display: flex;
    bottom: 10px;
    flex-direction: row;
    justify-content: end;
    align-items: center;
    column-gap: 10px;
    padding: 3px 5px;
    background-color: var(--overlay-color);
    border: 2px solid var(--overlay-color-1);
}

.actions-menu-container {
    position: relative;
    display: flex;
    align-items: center;
}

canvas {
    width: 100%;
    height: 100%;
    display: block;
    border: 2px solid var(--border-color);
}

.skin-2d-container {
    width: 300px;
    height: 350px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 10px;
}

.skin-2d-image {
    height: 84%;
    image-rendering: pixelated;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
    border-radius: 5px;
}
</style>
