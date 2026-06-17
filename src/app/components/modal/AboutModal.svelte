<script>
// @ts-nocheck

    import { showToast, uiState } from "../../stores/ui";
    import { t } from "../../stores/i18n";
    import { appVersion } from "../../utils/version";
    import { checkForUpdate, downloadAndInstallUpdateAutomatic } from "../../utils/updateChecker.js";
    import { AlertCircle, AlertOctagon, Heart, Info, MailWarning, Paperclip, X } from '@lucide/svelte';

    const { activeModal } = uiState;
    
    export let onClose = () => {
        activeModal.set('none')
    };
</script>

<div 
    class="about-modal-overlay" 
    role="dialog"
    aria-modal="true"
    tabindex="0"
    onclick={(e) => {
        if (e.target === e.currentTarget) onClose();
    }}
    onkeydown={(e) => {
        if (e.key === 'Escape') onClose();
    }}
>
    <div class="about-modal-content">
        <div class="about-modal-header">
            <div class="header-title-cont">
                <Info size={20} />
                <h2>{
                    $t('settings.tabs.about')}
                </h2>
            </div>  
            <button class="close-btn btn btn-default" onclick={onClose()} aria-label="Close">
                <X size={16} />
            </button>
        </div>
        
        <div class="about-modal-body">
            <div class="about-section">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="banner">
                    <div class="section-item">
                        <span class="item-value">v{$appVersion}</span>
                    </div>
                </div>
            </div>

            <div class="about-section">
                <span class="section-title">
                    <Paperclip size={20} />
                    {$t('settings.about.credits')}
                </span>
                <span class="section-description">
                    <span>
                        {@html $t('settings.about.developedBy')}.
                    </span>
                    <span>
                        * {$t('settings.about.specialThanks')}
                    </span>
                </span>
            </div>

            <div class="about-section">
                <span class="section-title">
                    <Heart size={20}/>
                    {$t('settings.about.donate')}
                </span>
                <span class="section-description">
                    {$t('settings.about.donateDescription')} 
                    <a href="https://www.buymeacoffee.com/cosmic_fi" target="_blank" rel="noopener noreferrer">
                        {$t('settings.about.donateButton')}
                    </a>
                </span>
            </div>

            <div class="about-section disclaimer-section">
                <span class="section-title">
                    <AlertOctagon size={20}/> 
                    {$t('settings.about.disclaimer')}
                </span>
                <span class="section-description">
                    {$t('settings.about.disclaimerDescription')}
                </span>
            </div>
        </div>
    </div>
</div>

<style>
    .about-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .about-modal-content {
        background: var(--overlay-color);
        width: 90%;
        width: 600px;
        height: 500px;
        display: flex;
        flex-direction: column;
        border: 2px solid var(--border-color);
        border-bottom-width: 5px;
    }

    .about-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid var(--border-color);

        .header-title-cont{
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--text-color);

            h2{
                font-size: var(--font-size-base);
            }
        }
    }

    .about-modal-header h2 {
        margin: 0;
        font-size: var(--font-size-base);
        color: var(--text-color);
    }

    .about-modal-body {
        overflow-y: auto;
        padding: 15px;
        flex: 1;
    }

    .about-section {
        margin-bottom: 20px;

    }
    
    .about-section:last-child {
        margin-bottom: 0;
    }

    .banner {
        width: 100%;
        height: 200px;
        background: url("./images/static/0.png");
        background-size: cover;
        background-position: center;
        border-bottom: 5px solid var(--accent-color);
        position: relative !important;    
    }
    .section-item {
        display: flex;
        position: absolute;
        margin: 5px;
        z-index: 10;
        bottom: 0;
        justify-content: start;
        align-items: center;
        font-size: var(--font-size-sm);
        gap: 10px;
        color: #fff;
    }
    

    .section-title {
        display: flex;
        color: var(--text-color);
        font-weight: 600;
        margin-bottom: 8px;
        font-size: var(--font-size-body);
        flex-direction: row;
        align-items: center;
        gap: 5px
    }

    .section-description {
        display: flex;
        flex-direction: column;
        justify-content: start;
        align-items: start;
        color: var(--text-color-muted);
        font-size: var(--font-size-body);
        line-height: 1.5;
    }

    .disclaimer-section {
        border-top: 1px solid var(--border-color);
        padding-top: 24px;
        margin-top: 24px;
    }
</style>
