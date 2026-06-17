<script>
  export let count = 1;
</script>

{#each Array(count) as _}
  <div class="row skeleton-row">
    <div class="icon skeleton-box"></div>
    <div class="info">
      <div class="title skeleton-text"></div>
      <div class="meta skeleton-text sm"></div>
    </div>
    <div class="actions">
      <div class="skeleton-btn"></div>
    </div>
  </div>
{/each}

<style>
  .row {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    background-color: var(--surface-color);
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .skeleton-box {
    background-color: var(--overlay-color-1);
    animation: pulse 1.5s infinite ease-in-out;
  }

  .skeleton-text {
    background-color: var(--overlay-color-1);
    animation: pulse 1.5s infinite ease-in-out;
    height: 1.2rem;
    width: 60%;
    margin-bottom: 0.5rem;
  }

  .skeleton-text.sm {
    height: 0.9rem;
    width: 40%;
  }

  .skeleton-btn {
    background-color: var(--overlay-color-1);
    animation: pulse 1.5s infinite ease-in-out;
    height: 32px;
    width: 80px;
  }

  .icon {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
  }
  
  .icon.skeleton-box {
    width: 48px;
    height: 48px;
  }

  .info {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  @keyframes pulse {
    0% {
      opacity: 0.6;
    }
    50% {
      opacity: 0.3;
    }
    100% {
      opacity: 0.6;
    }
  }
</style>
