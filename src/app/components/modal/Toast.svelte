<script>
  import { t } from "../../stores/i18n";
  import { fade, fly } from "svelte/transition";

  export let message = $t('toast.defaultMessage');
  export let duration = 2500;
  export let type = "normal";
</script>

<div
  class="toast {type}-toast"
  in:fly={{ y: -8, duration: 120, opacity: 0 }}
  out:fade={{ duration: 500 }}
>
  <div class="toast-content">
    <span class="toast-message">{message}</span>
  </div>
</div>

<style>
  .toast {
    background-color: var(--accent-color);
    padding: 10px 16px;
    border: 1px solid var(--accent-color-light);
    border-left-width: 5px;
    box-shadow: 2px 2px 10px color-mix(in srgb, var(--shadow-color), transparent 70%);
    color: var(--text-color);
    font-size: var(--font-size-body);
    min-width: 220px;
    max-width: 360px;
    pointer-events: auto;
  }

  .toast-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .toast-message {
    white-space: pre-line;
    text-transform: capitalize;
  }

  .error-toast {
    background-color: var(--error-color-dark);
    color: #fff !important;
    border-color: var(--error-color-50);
    box-shadow: 2px 2px 10px color-mix(in srgb, var(--error-color), transparent 80%);
  }

  .info-toast {
    background-color: var(--info-color-dark);
    color: #fff !important;
    border-color: var(--info-color);
    box-shadow: 2px 2px 10px color-mix(in srgb, var(--info-color), transparent 80%);
  }

  .normal-toast {
    background-color: var(--overlay-color-3);
    border-color: var(--base-variant-2);
  }
</style>
