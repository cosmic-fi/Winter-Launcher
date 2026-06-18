<script>
// @ts-nocheck

  import { t } from "../../stores/i18n";


</script>
<div class="invoker fade-in" transition:fade={{ duration: 100 }}>
    <div class="wrapper">
        <span class="blink">{$t('invoker.loading')}</span>
        <p class="description">
            {$t('invoker.description')}
            <br>*<span>{$t('invoker.closeNote')}</span>
        </p>
    </div>
</div>

<style>
    .invoker{
        position: absolute;
        z-index: 99999;
        background: rgba(0, 0, 0, 0.5);
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--text-color)
    }

    .wrapper{
        padding: 10px;
        background-color: var(--overlay-color);
        border: 2px solid var(--border-color);
        border-bottom-width: 5px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 400px;
        height: 100px;

        span{
            font-size: var(--font-size-body);
            font-weight: 600;
        }
        .description{
            font-size: var(--font-size-body);
            text-align: center;
        }
        .description span{
            font-size: var(--font-size-sm);
            font-weight: normal;
            color: var(--text-color-muted);
        }
    }
</style>