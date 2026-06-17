<script>
// @ts-nocheck

    import { createEventDispatcher } from 'svelte';
    import { Folder } from '@lucide/svelte';
    import { openFolderInExplorer, openFolderPicker } from '../../utils/helper';
    import SimpleTip from './Tip.svelte';
    import { t } from '../../stores/i18n';

    export let value = '';
    export  let label = '';
    export let actionType = 'open';
    export let placeholder = $t('folderPicker.noFolderSelected');
    export let disabled = false;
    export let readonly = false;
    export let inputReadOnly = false;

    const dispatch = createEventDispatcher();

    async function folderAction(){
        if(actionType === 'open'){
            await openFolderInExplorer(value);
        }else{
            const result = await openFolderPicker();
            if (result) {
                value = result;
                dispatch('change', { value: result });
            }
        }
    }

    function onInput(e) {
        dispatch('change', { value: e.target.value });
    }
</script>

<div class="folder-picker">
    <input
        type="text"
        bind:value
        placeholder={placeholder}
        readonly={inputReadOnly}
        on:input={onInput}
    />
    <SimpleTip text="{actionType === 'open' ? $t('folderPicker.browse') : $t('folderPicker.pick')}" direction="bottom">
        <button class="btn btn-default" type="button" on:click={folderAction} disabled={disabled || readonly}> 
            <Folder size={18} style="margin-right: 4px; vertical-align: middle;" /> 
            {label}
        </button>
    </SimpleTip>
</div>

<style>
    .folder-picker {
        display: flex;
        flex-direction: row;

        input {
            flex-grow: 1;
            padding: 10px 10px;
        }

        button {
            /* padding: 10px 20px;
            border: none;
            background: var(--overlay-color-1);
            color: var(--text-color);
            cursor: pointer;
            transition: 0.3s;
            height: 40px;
            font-size: 1.1rem; */

            &:hover {
                background-color: var(--overlay-color-2);
            }
            &:active{
                transform: none !important;
                background-color: var(--overlay-color-1);
            }
        }
    }
</style>