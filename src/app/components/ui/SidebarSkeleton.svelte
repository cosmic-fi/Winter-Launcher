<script>
    export let count = 5;
</script>

{#each Array(count) as _}
    <div class="skeleton-item">
        <div class="skeleton-icon"></div>
        <div class="skeleton-info">
            <div class="skeleton-text title"></div>
            <div class="skeleton-text meta"></div>
        </div>
    </div>
{/each}

<style>
    .skeleton-item {
        display: flex;
        align-items: center;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        border-radius: 8px;
        background-color: transparent;
        border: 1px solid transparent;
    }

    .skeleton-icon {
        width: 40px;
        height: 40px;
        margin-right: 0.75rem;
        border-radius: 6px;
        background-color: var(--overlay-color-1);
        animation: pulse 1.5s infinite ease-in-out;
        flex-shrink: 0;
    }

    .skeleton-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .skeleton-text {
        background-color: var(--overlay-color-1);
        animation: pulse 1.5s infinite ease-in-out;
        border-radius: 4px;
    }

    .skeleton-text.title {
        height: 1rem;
        width: 70%;
    }

    .skeleton-text.meta {
        height: 0.8rem;
        width: 40%;
    }

    @keyframes pulse {
        0% { opacity: 0.6; }
        50% { opacity: 0.3; }
        100% { opacity: 0.6; }
    }
</style>
