// @ts-nocheck
import { writable } from 'svelte/store';
import { fetchNews } from '../services/api';

export const newsFeed = writable([]);
export const newsLoaded = writable(false);

export async function loadNewsOnce() {
  let fetched = [];
  try {
    fetched = await fetchNews();
    fetched.sort((a, b) => new Date(b.date) - new Date(a.date));
    newsFeed.set(fetched);
    newsLoaded.set(true);
  } catch (err) {
    console.error('Failed to load news:', err);
  }
}