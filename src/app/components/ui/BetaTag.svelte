<script>
  export let text = 'BETA';
</script>

<div class="beta-tag">
  {text}
</div>

<style>
  .beta-tag {
    user-select: none;
    top: 3px;
    right: -45px;
    position: absolute;
    padding-inline: .5rem;
    color: #ffffff;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, #ffffff, transparent 70%);
    font-size: var(--font-size-sm);
    backdrop-filter: blur(8px);
    background-color: #cc004e;
  }
  
  /* Animation for pulse variant */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
</style>