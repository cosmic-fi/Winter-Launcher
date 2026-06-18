<script>
// @ts-nocheck
  import { Download, Gamepad, Clock, Loader2 } from '@lucide/svelte';
  import { t } from '../../stores/i18n';

  export let variant = 'default'; // 'mod', 'instance', 'shader', 'resourcepack', 'default'
  export let icon = '';
  export let title = '';
  export let subtitle = '';
  export let description = '';
  export let downloads = 0;
  export let gameVersions = [];
  export let loaders = [];
  export let lastUpdated = '';
  export let lastPlayed = '';
  export let actions = []; // Array of action objects: { icon, label, onClick, variant }
  export let clickable = false;
  export let onClick = () => {};
  export let imageUrl = '';
  export let fallbackImage = './images/static/minecraft_grass.jpg';
  export let showArtwork = false; // For cards with background artwork
  export let artworkUrl = '';
  export let size = 'medium'; // 'small', 'medium', 'large'
  export let fallbackArtwork = './images/static/minecraft_grass.jpg';

  // Reactive variable to track artwork image loading errors
  let artworkError = false;
  
  // Reset artwork error when artworkUrl changes
  $: if (artworkUrl) artworkError = false;

  // Utility functions
  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  function getVersions() {
    const lv = gameVersions;
    const arr = Array.isArray(lv) ? lv : [];
    return arr.filter(Boolean).sort((a, b) => {
      const aParts = a.split(".").map(Number);
      const bParts = b.split(".").map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        if (aPart !== bPart) return bPart - aPart;
      }
      return 0;
    });
  }

  function getDisplayedVersion() {
    const versions = getVersions();
    return versions[0] || "";
  }

  function formatDate(dateString) {
    if (!dateString) return $t('mainContent.home.sections.period.neverPlayed');
    
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return $t('mainContent.home.sections.period.justNow');
    if (diffMins < 60) return `${diffMins}${$t('mainContent.home.sections.period.minutesAgo')}`;
    if (diffHours < 24) return `${diffHours}${$t('mainContent.home.sections.period.hoursAgo')}`;
    if (diffDays < 7) return `${diffDays}${$t('mainContent.home.sections.period.daysAgo')}`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}${$t('mainContent.home.sections.period.weeksAgo')}`;
    return date.toLocaleDateString();
  }

  function handleCardClick() {
    if (clickable) {
      onClick();
    }
  }

  function handleActionClick(action, event) {
    event.stopPropagation();
    if (action.disabled) return; // Don't execute if disabled
    if (action.onClick) {
      action.onClick();
    }
  }

  // Get appropriate CSS classes
  $: cardClasses = [
    'card',
    `card--${variant}`,
    `card--${size}`,
    clickable ? 'card--clickable' : '',
    showArtwork ? 'card--with-artwork' : ''
  ].join(' ');

  $: hasTopMeta = downloads > 0 || getVersions().length > 0;
  $: hasBottomMeta = loaders.length > 0 || lastUpdated || lastPlayed || variant === 'instance';
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class={cardClasses} on:click={handleCardClick} style="background: {variant === 'instance' ? 'linear-gradient(145deg, color-mix(in srgb, var(--surface-color), transparent 0%), color-mix(in srgb, var(--surface-color), transparent 2%)), url('+icon+') !important' : ''};">
  {#if showArtwork && artworkUrl && !artworkError}
    <div class="card-artwork">
      <img 
        src={artworkUrl} 
        alt="{title} artwork" 
        on:error={(e) => {
          artworkError = true;
          // Try fallback artwork if main artwork fails
          if (fallbackArtwork && fallbackArtwork !== artworkUrl) {
            e.target.src = fallbackArtwork;
            artworkError = false;
          }
        }}
      />
    </div>
  {/if}
  
  <div class="card-content">
    <div class="card-header">
      {#if icon || imageUrl}
        <div class="card-icon">
          <img 
            src={icon || imageUrl} 
            alt={title} 
            on:error={(e) => {
              // Fallback to default image if icon fails to load
              if (icon && !imageUrl) {
                e.target.src = fallbackImage;
              }
            }}
          />
        </div>
      {/if}
      
      <div class="card-info">
        <h3 class="card-title">{title}</h3>
        {#if subtitle}
          <p class="card-subtitle">{subtitle}</p>
        {/if}
        
        {#if hasTopMeta}
          <div class="card-top-meta">
            {#if downloads > 0}
              <span class="meta-item meta-downloads">
                <Download size={14} />
                {formatNumber(downloads)}
              </span>
            {/if}
            
            {#if getVersions().length > 0}
              <span class="meta-item meta-version">
                <Gamepad size={14} />
                {getDisplayedVersion()}
                {#if getVersions().length > 1}
                  <span class="version-more">+{getVersions().length - 1}</span>
                {/if}
              </span>
            {/if}
          </div>
        {/if}
      </div>
    </div>
    
    {#if description}
      <div class="card-description">
        <p>{description}</p>
      </div>
    {/if}
    
    {#if hasBottomMeta}
      <div class="card-bottom-meta">
        {#if loaders.length > 0}
          <div class="meta-loaders">
            {#each ["forge", "neoforge", "fabric", "quilt"] as loader (loader)}
              {#if loaders.includes(loader)}
                <img
                  src="/images/static/loaders/{loader === 'neoforge' ? 'neoforged' : loader}.png"
                  alt={loader}
                  class="loader-icon"
                />
              {/if}
            {/each}
          </div>
        {/if}
        
        {#if lastUpdated}
          <span class="meta-item meta-updated">
            <Clock size={14} />
            {formatDate(lastUpdated)}
          </span>
        {/if}
        
        {#if variant === 'instance'}
          <span class="meta-item meta-played">
            <Clock size={14} />
            {formatDate(lastPlayed)}
          </span>
        {:else if lastPlayed}
          <span class="meta-item meta-played">
            <Clock size={14} />
            {formatDate(lastPlayed)}
          </span>
        {/if}
      </div>
    {/if}
    
    {#if actions.length > 0}
      <div class="card-actions">
        {#each actions as action, i (i)}
          <button
            class="card-action btn btn-{action.variant || 'default'}"
            on:click={(e) => handleActionClick(action, e)}
            aria-label={action.label}
            disabled={action.disabled || false}
          >
            {#if action.icon}
              {#if typeof action.icon === 'string'}
                <i class="fa {action.icon}"></i>
              {:else}
                <svelte:component this={action.icon} size={16} class={action.iconClass} />
              {/if}
            {/if}
            {action.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .card {
    background: var(--overlay-color);
    border: 2px solid var(--border-color);
    overflow: hidden;
    transition: all 0.3s ease;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .card--clickable {
    cursor: pointer;
    will-change: transform;
  }

  .card--clickable:hover {
    transform: translateY(-2px);
    border-color: var(--accent-color);
  }

  .card--small {
    min-height: 120px;
  }

  .card--medium {
    min-height: 180px;
  }

  .card--large {
    min-height: 240px;
  }

  .card--with-artwork .card-content {
    position: relative;
    z-index: 2;
    background: linear-gradient(to top, var(--surface-color) 60%, transparent);
  }

  .card-artwork {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 120px;
    z-index: 1;
    overflow: hidden;
  }

  .card-artwork img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: brightness(0.6);
  }

  .card-content {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
  }

  .card--with-artwork .card-content {
    padding-top: 100px;
  }

  .card-header {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .card-icon {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
  }

  .card-icon img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-info {
    flex: 1;
    min-width: 0;
  }

  .card-title {
    font-size: var(--font-size-body);
    font-weight: 600;
    margin: 0;
    color: var(--text-color);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-subtitle {
    font-size: var(--font-size-sm);
    color: var(--text-color-muted);
    margin: 0.25rem 0 0 0;
    line-height: 1.3;
  }

  .card-description {
    font-size: var(--font-size-body);
    color: var(--text-color-muted);
    line-height: 1.4;
    margin: 0;
  }

  .card-description p {
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-top-meta,
  .card-bottom-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: var(--font-size-sm);
  }

  .card-bottom-meta {
    justify-content: space-between;
    margin-top: auto;
    padding-top: 0.5rem;
    border-top: 1px solid color-mix(in srgb, var(--border-color), transparent 60%);
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-color-muted);
    white-space: nowrap;
  }

  .meta-item i {
    font-size: var(--font-size-sm);
    opacity: 0.8;
  }

  .meta-downloads {
    margin-top: 4px;
  }

  .meta-version {
    position: relative;
    padding-left: 0.5rem;
    border-left: 1px solid var(--border-color);
  }

  .version-more {
    font-size: var(--font-size-sm);
    opacity: 0.8;
    margin-left: 0.2rem;
  }

  .meta-loaders {
    display: flex;
    align-items: center;
    text-transform: uppercase;
    gap: 0.2rem;
  }

  .loader-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
    filter: brightness(0.8);
    transition: filter 0.2s ease;
  }

  .loader-icon:hover {
    filter: brightness(1);
  }

  .card-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: auto;
  }

  .card-action {
    padding: 0.5rem 0.75rem;
    border: none;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
  }

  .card-action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }

  .card-action--primary {
    /* background: var(--accent-color); */
    color: white;
  }

  .card-action--primary:hover {
    background: var(--accent-color-light);
  }

  .card-action--secondary {
    background: var(--base-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
  }

  .card-action--secondary:hover {
    background: var(--surface-color);
  }

  .card-action--danger {
    background: var(--error-color);
    border: none !important;
    color: white;
  }

  .card-action--danger:hover {
    background: var(--error-color-light);
  }

  /* Variant-specific styles */
  .card--instance {
    background: linear-gradient(135deg, var(--surface-color) 0%, var(--base-color) 100%);
  }

  .card--shader {
    background: linear-gradient(135deg, var(--overlay-color) 0%, var(--surface-color) 100%);
  }

  .card--resourcepack {
    background: linear-gradient(135deg, var(--surface-color) 0%, var(--overlay-color) 100%);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .card-content {
      padding: 0.75rem;
    }

    .card-icon {
      width: 40px;
      height: 40px;
    }

    .card-title {
      font-size: var(--font-size-body);
    }

    .card-actions {
      flex-direction: column;
    }

    .card-action {
      justify-content: center;
    }
  }
</style>