// @ts-nocheck
/**
 * @author Cosmic-fi
 * @description Main entry point for the WinterLauncher Front-End application.
*/

import { mount } from 'svelte'
import './style/app.css'
import './style/animation/animation.css'
import App from './App.svelte'
import { fetchAppVersion } from './utils/version'

fetchAppVersion();



const app = mount(App, {
  target: document.getElementById('app')
})
export default app

if (window.electron?.openExternal) {
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a');
    if (
      anchor &&
      anchor.href &&
      !anchor.href.startsWith('javascript:') &&
      !anchor.href.startsWith('#') &&
      anchor.target !== '_self'
    ) {
      e.preventDefault();
      window.electron.openExternal(anchor.href);
    }
  });
}