<script>
  // @ts-nocheck
  /**
   * @author Cosmic-fi
   * @description Main entry point for the WinterLauncher Front-End application.
   */

   import ToastList from './components/modal/ToastList.svelte';
  import Home from './pages/Home.svelte';
  import Splash from './pages/Splash.svelte';
  import { closeDialog, dialogStore, showToast, uiState } from './stores/ui';
  import Dialog from './components/modal/Dialog.svelte';
  import { startConnectionDaemon, stopConnectionDaemon } from './utils/connectionDaemon';
  import { t } from './stores/i18n';
  import { onMount } from 'svelte';

  const { isBootReady } = uiState;
  
  uiState.isBootReady.set(false);

  onMount(() => {
    // Set up global error handlers for unhandled IPC errors
    if (window.electron) {
      // Handle launch error events
      const removeLaunchErrorListener = window.electron.onLaunchError((error) => {
        console.error('Launch error received:', error);
        showToast(`Launch error: ${error.message || error}`, 'error');
      });

      // Handle generic error events
      const removeErrorListener = window.electron.onError((error) => {
        console.error('Error event received:', error);
        showToast(`Error: ${error.message || error}`, 'error');
      });

      // Handle launch cancelled events
      const removeLaunchCancelledListener = window.electron.onLaunchCancelled((message) => {
        console.log('Launch cancelled:', message);
      });

      // Handle console closed events
      const removeConsoleClosedListener = window.electron.onConsoleClosed(() => {
        console.log('Console window closed');
      });

      // Cleanup listeners on unmount
      return () => {
        removeLaunchErrorListener?.();
        removeErrorListener?.();
        removeLaunchCancelledListener?.();
        removeConsoleClosedListener?.();
      };
    }
  });
</script> 

{#if $isBootReady}
  <Home />
{:else}
  <Splash />
{/if}

<ToastList />
<Dialog />