<script>
// @ts-nocheck

  import { ChevronLeft, ChevronRight, X } from "@lucide/svelte";
  import { createEventDispatcher } from "svelte";
  import { fade } from "svelte/transition";

    export let galleryItemIndex = null;
    export let galleryItem = null;
    export let open = false;

    let dispatch = createEventDispatcher();

    function next(){
        galleryItemIndex = (galleryItemIndex + 1) % galleryItem.length;
    }
    function prev(){
        galleryItemIndex = (galleryItemIndex - 1 + galleryItem.length) % galleryItem.length
    }

    function close(){
        dispatch('close');
    }
</script>

{#if open && galleryItem}
    {console.log(open, galleryItem, galleryItemIndex, '----a-a-')}
    

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div 
        class="gallery-modal-container"
        on:click|self={close}
        transition:fade
    >
        <div class="gallery-view-container">
            <div class="image-container">
                <img src={galleryItem[galleryItemIndex]} alt={galleryItemIndex}>
            </div>
            
            <div class="gallery-control-btn-container">
                <button class="close-btn" on:click={close}>
                    <X size={20} />
                </button>
                <button class="prev-btn" disabled={galleryItem.length <= 1} on:click={() => prev()}>
                    <ChevronLeft size={20}/>
                </button>
                <button class="next-btn" disabled={galleryItem.length <= 1} on:click={() => next()}>
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .gallery-modal-container{
        position: fixed;
        background: rgba(0, 0, 0, 0.5);
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;

        .gallery-view-container{
            background-color: var(--overlay-color-2);
            width: 950px;
            height: 550px;
            display: flex;
            border: 2px solid var(--border-color);
            border-bottom-width: 5px;
            position: relative;
            justify-content: center;

            .image-container{
                flex: 1;
                overflow: hidden;
                display: flex;
                justify-content: center;

                img{
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
            }
            .gallery-control-btn-container{
                background-color: var(--overlay-color-1);
                position: absolute;
                bottom: -20px;
                padding: 5px 10px;
                border: 2px solid var(--overlay-color-2);
                button{
                    padding: 5px 15px;
                    background-color: var(--overlay-color);
                }
            }
        }
    }
</style>