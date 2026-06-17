// @ts-nocheck
/**
 * @author Cosmic-fi
 * @description Helper utility for the WinterLauncher Front-End application.
*/

export const rssURL = 'https://winterlauncher.cosmicfi.dev/';
export const starlightBaseURL = 'https://starlightskins.lunareclipse.studio/render/ultimate';
export const apiBase = 'https://api.cosmicfi.dev/winterlauncher';
export const versionMetaURL = 'https://piston-meta.mojang.com/mc/game/version_manifest.json';

export const DISCORD_CLIENT_ID = import.meta.env.DISCORD_CLIENT_ID || '';

export function scrollHorizontal(node) {
  const handler = (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      node.scrollBy({ left: e.deltaY, behavior: 'smooth' });
    }
  };

  node.addEventListener('wheel', handler, { passive: false });

  return {
    destroy() {
      node.removeEventListener('wheel', handler);
    }
  };
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function parseDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function limitText(node, { size }) {
    let original = node.textContent;
    if (original.length > size) {
        node.textContent = original.slice(0, size) + '...';
    }
    return {
        update({ size }) {
            node.textContent = original;
            if (original.length > size) {
                node.textContent = original.slice(0, size) + '...';
            }
        }
    };
}

export function formatNumber(num) {
    const n = Number(num);
    if (!isFinite(n)) return String(num);
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    const fmt = (val, suf) => {
        let s = val.toFixed(1).replace(/\.0$/, '');
        return sign + s + suf;
    };
    if (abs >= 1e12) return fmt(abs / 1e12, 'T');
    if (abs >= 1e9)  return fmt(abs / 1e9,  'B');
    if (abs >= 1e6)  return fmt(abs / 1e6,  'M');
    if (abs >= 1e3)  return fmt(abs / 1e3,  'K');
    return sign + abs.toLocaleString();
}

export function generateHexUUID() {
    // Generates a 32-character hex string
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export function slideX(node, { snapX = -60, threshold = -30 } = {}) {
    let currentX = 0;
    let startX = 0;
    let dragging = false;
    let animating = false;
    let moved = false;

    const avatarEl = node;
    const deleteBtnEl = node.parentElement.querySelector('.account-action-btn-cont');

    function setTransform(x) {
        avatarEl.style.transform = `translateX(${x}px)`;
    }

    function onDragStart(e) {
        if (animating) return;
        dragging = true;
        moved = false;
        deleteBtnEl?.classList.remove('hide');
        avatarEl.style.transition = 'none';
        startX = (e.touches ? e.touches[0].clientX : e.clientX) - currentX;
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
        window.addEventListener('touchmove', onDragMove, { passive: false });
        window.addEventListener('touchend', onDragEnd);
    }

    function onDragMove(e) {
        if (!dragging) return;
        let x = (e.touches ? e.touches[0].clientX : e.clientX) - startX;
        if (x > 0) x = 0;
        if (x < snapX * 1.5) x = snapX * 1.5;
        if (Math.abs(currentX - x) > 3) moved = true;
        currentX = x;
        setTransform(currentX);
        e.preventDefault && e.preventDefault();
    }

    function onDragEnd() {
        dragging = false;
        avatarEl.style.transition = 'transform 0.2s cubic-bezier(.4,1.4,.6,1)';
        if (currentX < threshold) {
            currentX = snapX;
        } else {
            currentX = 0;
            deleteBtnEl?.classList.add('hide');
        }
        animating = true;
        setTransform(currentX);
        setTimeout(() => { animating = false; }, 200);
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
        window.removeEventListener('touchmove', onDragMove);
        window.removeEventListener('touchend', onDragEnd);

        // Set a flag for click handler
        node.wasDragged = moved;
        setTimeout(() => { node.wasDragged = false; }, 0);
    }

    function onDocumentClick(e) {
        if (!node.contains(e.target) && currentX === snapX) {
            avatarEl.style.transition = 'transform 0.2s cubic-bezier(.4,1.4,.6,1)';
            currentX = 0;
            setTransform(currentX);
            deleteBtnEl?.classList.add('hide');
        }
    }

    avatarEl.addEventListener('mousedown', onDragStart);
    avatarEl.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('click', onDocumentClick);

    return {
        destroy() {
            avatarEl.removeEventListener('mousedown', onDragStart);
            avatarEl.removeEventListener('touchstart', onDragStart);
            document.removeEventListener('click', onDocumentClick);
        }
    };
}

export async function getTotalSystemRamGB() {
    // @ts-ignore
    const info = await window.electron.getMemoryInfo();
    // info.total is in kB, so convert to GB
    if (info && typeof info.total === 'number') {
        return Math.round(info.total / 1024 / 1024); // GB
    }
    return null;
}

export async function openFolderPicker() {
    return await window.electron.openFolderDialog();
}

export async function openFolderInExplorer(path) {
  await window.electron.openFolderInExplorer(path);
}

export async function getAppFolder(){
    return await window.electron.getAppFolder(); 
}

export async function getMinecraftFolder(){
    return await window.electron.getMinecraftFolder();
}

export async function getBackupFolder(){
    return await window.electron.getBackupFolder();
}

export function genLetterId(len = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    return Array.from(
        { length: len },
        () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
}

export function genNumberId(len = 8) {
    const chars = '0123456789';

    return Array.from(
        { length: len },
        () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
}

export function genMixedId(len = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    return Array.from(
        { length: len },
        () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
}