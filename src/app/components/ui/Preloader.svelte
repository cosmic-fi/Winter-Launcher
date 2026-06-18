<div class="loading-container">
  <div class="loader-grid">
    <span></span>
    <span></span>
    <span></span>
    <span></span>
  </div>
</div>

<style>
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-grow: 1;
}

.loader-grid {
  display: grid;
  grid-template-columns: repeat(2, 20px);
  grid-template-rows: repeat(2, 20px);
  gap: 5px;
}

.loader-grid span {
  width: 20px;
  height: 20px;
  background: var(--overlay-color-1);
  border: 2px solid var(--border-color);
  animation: fill 1s infinite;
}

.loader-grid span:nth-child(1) {
  animation-delay: 0s;
}

.loader-grid span:nth-child(2) {
  animation-delay: 0.2s;
}

.loader-grid span:nth-child(3) {
  animation-delay: 0.4s;
}

.loader-grid span:nth-child(4) {
  animation-delay: 0.6s;
}

@keyframes fill {
  0%, 100% {
    background: var(--overlay-color-2);
    border-color: var(--border-color);
  }

  50% {
    background: var(--accent-color);
    border-color: var(--accent-color-light);
  }
}
</style>