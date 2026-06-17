<script>
  // @ts-nocheck
  export let size = "medium";
  export let variant = "skeleton";
  export let fullPage = false;
  export let inline = false;
  export let layout = "list";
  export let amount = 3;

  $: containerClasses = [
    'loading-container',
    fullPage ? 'loading-container--full-page' : '',
    inline ? 'loading-container--inline' : ''
  ].join(' ');

  $: spinnerClasses = [
    'loading-spinner',
    `loading-spinner--${size}`,
    `loading-spinner--${variant}`
  ].join(' ');
</script>

<div class={containerClasses}>
  {#if variant === "skeleton"}
    {#if layout === "cards"}
      <div class="skeleton-grid">
        {#each Array(amount) as _}
          <div class="skeleton-card">
            <div class="skeleton-card-header">
              <div class="skeleton-avatar large"></div>
              <div class="skeleton-card-info">
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
              </div>
            </div>
            <div class="skeleton-card-body">
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="skeleton-list">
        {#each Array(amount) as _}
          <div class="skeleton-row">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-content">
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class={spinnerClasses}></div>
  {/if}
</div>

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-color-muted);
    text-align: center;
    gap: 10px;
  }

  .loading-container--full-page {
    min-height: 200px;
  }

  .loading-container--inline {
    padding: 10px;
    min-height: auto;
  }

  .loading-message {
    font-size: 0.9rem;
    opacity: 0.8;
  }

  /* Spinner Variants */
  .loading-spinner {
    position: relative;
    box-sizing: border-box;
  }

  .loading-spinner--small {
    width: 24px;
    height: 24px;
  }

  .loading-spinner--medium {
    width: 40px;
    height: 40px;
  }

  .loading-spinner--large {
    width: 56px;
    height: 56px;
  }

  .skeleton-list {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .skeleton-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background-color: var(--surface-color);
  }

  .skeleton-avatar {
    width: 40px;
    height: 40px;
    background-color: var(--overlay-color-1);
    background-image: linear-gradient(
      90deg,
      color-mix(in srgb, var(--overlay-color-1), transparent 10%),
      color-mix(in srgb, var(--overlay-color-1), var(--overlay-color-2) 90%),
      color-mix(in srgb, var(--overlay-color-1), transparent 10%)
    );
    background-size: 200% 100%;
    background-repeat: no-repeat;
    animation: pulse 1.6s ease-in-out infinite, shimmer 1.6s linear infinite;
    flex-shrink: 0;
  }

  .skeleton-avatar.large {
    width: 52px;
    height: 52px;
  }

  .skeleton-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .skeleton-line {
    height: 0.9rem;
    width: 70%;
    background-color: var(--overlay-color-1);
    background-image: linear-gradient(
      90deg,
      color-mix(in srgb, var(--overlay-color-1), transparent 10%),
      color-mix(in srgb, var(--overlay-color-1), var(--overlay-color-2) 90%),
      color-mix(in srgb, var(--overlay-color-1), transparent 10%)
    );
    background-size: 200% 100%;
    background-repeat: no-repeat;
    animation: pulse 1.6s ease-in-out infinite, shimmer 1.6s linear infinite;
  }

  .skeleton-line.short {
    width: 40%;
  }

  .skeleton-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 10px;
  }

  .skeleton-card {
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    padding: 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transform-origin: center;
    animation: pulse 1.8s ease-in-out infinite;
  }

  .skeleton-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .skeleton-card-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .skeleton-card-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Classic Spinner */
  .loading-spinner--spinner {
    border: 3px solid var(--border-color);
    border-top: 3px solid var(--accent-color);
    animation: spin 1s linear infinite;
  }

  /* Dots Animation */
  .loading-spinner--dots {
    display: inline-block;
    position: relative;
  }

  .loading-spinner--dots::before,
  .loading-spinner--dots::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    background-color: var(--accent-color);
    opacity: 0.6;
    animation: pulse 1.5s ease-in-out infinite;
  }
  .loading-spinner--dots::before {
    animation-delay: -0.3s;
  }

  .loading-spinner--dots::after {
    animation-delay: -0.6s;
  }

  /* Pulse Animation */
  .loading-spinner--pulse {
    background-color: var(--accent-color);
    opacity: 0.8;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .loading-spinner--spinner {
      border-color: color-mix(in srgb, var(--border-color), transparent 30%);
    }
  }
</style>
