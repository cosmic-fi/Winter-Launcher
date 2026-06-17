<script>
    import { fade, slide } from 'svelte/transition';
  import { t } from '../../stores/i18n';

  export let title = $t('dialog.defaultTitle');
  export let message = $t('dialog.defaultMessage');
  export let buttons = [
    { label: $t('dialog.ok'), action: () => {}, type: "normal" }
  ];
  export let open = false;
  export let onClose = () => {};

  function getButtonClass(type) {
    switch (type) {
      case "danger": return "btn-danger";
      case "confirm": return "btn-primary";
      default: return "btn-default";
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-container" transition:fade={{ duration: 100 }} on:click|self={onClose}>
    <div class="d-wrapper">
      <div class="dialog-header">{title}</div>
      <div class="d-title-description-container">
        <p class="d-description">
          {@html message}
        </p>
      </div>
      <div class="d-btn-container">
        {#each buttons as btn}
          <button
            class="dialog-btn btn {getButtonClass(btn.type)}"
            on:click={() => { btn.action(); onClose(); }}>
            {btn.label}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}
<style>
  .dialog-container{
    position: absolute;
    z-index: 99999;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all .3s ease; 
    background: rgba(0, 0, 0, 0.5);

    .d-wrapper{
        background-color: var(--surface-color);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border: 2px solid var(--border-color);
        position: relative;
        overflow: hidden;
        width: 500px;
        border-bottom-width: 5px;
      
        .dialog-header{ 
          padding: 15px 10px;
          font-size: var(--font-size-base);
          border-bottom: 2px solid var(--border-color);
          color: var(--text-color);
        }
        .d-title-description-container{
            display: flex;
            flex-direction: column;
            padding: 15px 10px;
            padding-bottom: 1rem;
            min-height: 100px;
            font-size: var(--font-size-body);
            color: var(--text-color-muted);
            text-align: left;

            p{
              text-align: left;
            }
        }
        .d-btn-container{
            display: flex;
            flex-direction: row;
            padding: 10px;
            justify-content: end;
            align-items: center;
            column-gap: 10px;

            .btn{
              padding: 10px 25px;
            }
        }
    }
}
</style>
