<script>
    import { toasts } from '../../stores/ui';
    import Toast from './Toast.svelte';
</script>

<div class="toast-container">
    {#each $toasts as toast (toast.id)}
        <Toast {...toast} />
    {/each}
</div>

<style>
    .toast-container {
        position: fixed;
        top: 16px;
        right: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        gap: 8px;
        z-index: 9999;
        pointer-events: none;
    }
</style>
