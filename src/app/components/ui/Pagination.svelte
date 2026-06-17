
<script>
    import { ChevronLeft, ChevronRight } from '@lucide/svelte';
    export let currentPage = 1;
    export let totalPages = 1;
    export let loading = false;
    export let prevPage = () => {};
    export let nextPage = () => {};
    export let alignment = "center";

    $: alignmentClass =
        alignment === "left"
            ? "pagination-left"
            : alignment === "right"
            ? "pagination-right"
            : "pagination-center";
</script>

<div class="pagination {alignmentClass}">
    <button
        class="btn btn-default"
        on:click={prevPage}
        disabled={currentPage <= 1 || loading}
        aria-label="Previous page"
    >
        <ChevronLeft size={18} />
    </button>
    
    <span class="page-info">
        <strong>{currentPage}</strong> / {totalPages}
    </span>
    
    <button
        class="btn btn-default"
        on:click={nextPage}
        disabled={currentPage >= totalPages || loading}
        aria-label="Next page"
    >
        <ChevronRight size={18} />
    </button>
</div>

<style>
    .pagination {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem 0;
        margin-top: 1rem;
        border-top: 1px solid var(--border-color);
    }

    .pagination-center {
        justify-content: center;
    }

    .pagination-left {
        justify-content: flex-start;
    }

    .pagination-right {
        justify-content: flex-end;
    }

    .btn {
        padding: .3rem 1.1rem !important;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .page-info {
        color: var(--text-color-muted);
        font-size: var(--font-size-sm);
        font-weight: 400;
        white-space: nowrap;
    }

    .page-info strong {
        color: var(--text-color);
        font-weight: 600;
    }

    /* Responsive design */
    @media (max-width: 480px) {
        .pagination {
            gap: 0.5rem;
            padding: 0.75rem;
        }

        .page-info {
            font-size: var(--font-size-sm);
        }
    }
</style>
