<script>
  // @ts-nocheck
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicInOut, elasticOut } from 'svelte/easing';
  import { ChevronRight, ChevronLeft, X, Rocket, Settings, Gamepad2, Sparkles } from '@lucide/svelte';
  import { t } from '../../stores/i18n';
  import { showToast } from '../../stores/ui';

  export let open = true;

  const dispatch = createEventDispatcher();

  let currentStep = 0;
  let agreedToTos = false;
  let animationDirection = 'next';

  // User can only interact (close, skip) if they are past step 0 OR have agreed to TOS
  $: canInteract = currentStep > 0 || agreedToTos;

  const steps = [
    {
      icon: Rocket,
      banner: './images/static/winterland-image.png',
      title: $t('mainContent.onboarding.welcome.title'),
      description: $t('mainContent.onboarding.welcome.description'),
      features: [
        $t('mainContent.onboarding.welcome.feature1'),
        $t('mainContent.onboarding.welcome.feature2'),
        $t('mainContent.onboarding.welcome.feature3')
      ]
    },
    {
      icon: Gamepad2,
      banner: './images/static/winterland-image.png',
      title: $t('mainContent.onboarding.instances.title'),
      description: $t('mainContent.onboarding.instances.description'),
      features: [
        $t('mainContent.onboarding.instances.feature1'),
        $t('mainContent.onboarding.instances.feature2'),
        $t('mainContent.onboarding.instances.feature3')
      ]
    },
    {
      icon: Settings,
      banner: './images/static/winterland-image.png',
      title: $t('mainContent.onboarding.customization.title'),
      description: $t('mainContent.onboarding.customization.description'),
      features: [
        $t('mainContent.onboarding.customization.feature1'),
        $t('mainContent.onboarding.customization.feature2'),
        $t('mainContent.onboarding.customization.feature3')
      ]
    },
    {
      icon: Sparkles,
      banner: './images/static/winterland-image.png',
      title: $t('mainContent.onboarding.ready.title'),
      description: $t('mainContent.onboarding.ready.description'),
      features: []
    }
  ];

  $: currentStepData = steps[currentStep];
  $: isFirstStep = currentStep === 0;
  $: isLastStep = currentStep === steps.length - 1;

  function nextStep() {
    if (!isLastStep) {
      animationDirection = 'next';
      currentStep++;
    } else {
      completeOnboarding();
    }
  }

  function prevStep() {
    if (!isFirstStep) {
      animationDirection = 'prev';
      currentStep--;
    }
  }

  function skipOnboarding() {
    if (!canInteract) return;
    completeOnboarding();
  }

  function completeOnboarding() {
    dispatch('close');
    showToast($t('mainContent.onboarding.toasts.welcomeMessage'), 'success');
  }

  function close() {
    if (!canInteract) return;
    dispatch('close');
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && canInteract) close();
    if (e.key === 'ArrowRight' && !isLastStep) nextStep();
    if (e.key === 'ArrowLeft' && !isFirstStep) prevStep();
  }

  function jumpToStep(i) {
    animationDirection = i > currentStep ? 'next' : 'prev';
    currentStep = i;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="onboarding-overlay"
    on:keydown={handleKeydown}
    tabindex="0"
    transition:fade={{ duration: 200 }}
  >
    <div
      class="onboarding-modal"
      on:click|stopPropagation
      transition:fly={{ y: 20, duration: 300, opacity: 0.9 }}
    >
      <!-- Header -->
      <div class="onboarding-header">
        <div class="step-indicators">
          {#each steps as _, i}
            <div
              class="step-dot {i === currentStep ? 'active' : ''} {i < currentStep ? 'completed' : ''}"
              on:click={() => jumpToStep(i)}
            ></div>
          {/each}
        </div>
        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button class="close-btn btn btn-default" on:click={close} disabled={!canInteract} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <!-- Banner -->
      {#key currentStep}
        <div
          class="onboarding-banner"
          style={`background-image: url('${currentStepData.banner}')`}
          in:fly={{ y: animationDirection === 'next' ? -30 : 30, duration: 350, easing: cubicInOut, opacity: 0 }}
          out:fly={{ y: animationDirection === 'next' ? 30 : -30, duration: 200, easing: cubicInOut, opacity: 0 }}
        >
          <div class="banner-icon" in:fly={{ y: 15, duration: 400, delay: 100, easing: elasticOut, opacity: 0 }}>
            <svelte:component this={currentStepData.icon} size={48} />
          </div>
        </div>
      {/key}

      <!-- Content -->
      <div class="onboarding-content">
        {#key currentStep}
          <div
            in:fly={{ y: animationDirection === 'next' ? 25 : -25, duration: 350, delay: 80, easing: cubicInOut, opacity: 0 }}
            out:fly={{ y: animationDirection === 'next' ? -25 : 25, duration: 150, easing: cubicInOut, opacity: 0 }}
          >
            <h2 class="onboarding-title">{currentStepData.title}</h2>
            <p class="onboarding-description">{currentStepData.description}</p>

            {#if currentStepData.features.length > 0}
              <ul class="feature-list">
                {#each currentStepData.features as feature, i}
                  <li
                    class="feature-item"
                    in:fly={{ y: 15, duration: 300, delay: 150 + (i * 80), easing: cubicInOut, opacity: 0 }}
                  >
                    <span>{feature}</span>
                  </li>
                {/each}
              </ul>
            {/if}

            {#if isFirstStep}
              <div class="tos-agreement">
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <!-- svelte-ignore a11y_label_has_associated_control -->
                <label class="checkbox-container" on:click={() => agreedToTos = !agreedToTos}>
                  <span class="custom-checkbox {agreedToTos ? 'checked' : ''}">
                    {#if agreedToTos}
                      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    {/if}
                  </span>
                  <span class="tos-text">
                    {$t('mainContent.onboarding.tosAgreement')}
                  </span>
                </label>
              </div>
            {/if}
          </div>
        {/key}
      </div>

      <!-- Footer -->
      <div class="onboarding-footer">
        {#if isFirstStep}
          <button class="btn btn-default skip-btn" on:click={skipOnboarding} disabled={!canInteract}>
            {$t('mainContent.onboarding.buttons.skip')}
          </button>
          <button class="btn btn-primary get-started-btn" on:click={nextStep} disabled={!agreedToTos}>
            {$t('mainContent.onboarding.buttons.getStarted')}
            <ChevronRight size={18} />
          </button>
        {:else}
          <button
            class="btn btn-default prev-btn"
            on:click={prevStep}
            disabled={isFirstStep}
          >
            <ChevronLeft size={18} />
            {$t('mainContent.onboarding.buttons.previous')}
          </button>

          <span class="step-counter">
            {currentStep} / {steps.length - 1}
          </span>

          <button
            class="btn btn-primary next-btn"
            on:click={nextStep}
          >
            {#if isLastStep}
              {$t('mainContent.onboarding.buttons.finish')}
              <Sparkles size={18} />
            {:else}
              {$t('mainContent.onboarding.buttons.next')}
              <ChevronRight size={18} />
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .onboarding-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
    -web-region-drag: no-drag;
  }

  .onboarding-modal {
    background: var(--surface-color);
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    border-bottom-width: 5px;
  }

  .onboarding-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    background: var(--overlay-color);
    -webkit-app-region: no-drag;
  }

  .step-indicators {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .step-dot {
    width: 10px;
    height: 10px;
    background: var(--border-color);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .step-dot.active {
    background: var(--accent-color-light);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-color), transparent 70%);
  }

  .step-dot.completed {
    background: var(--accent-color-dark);
  }

  .onboarding-banner {
    height: 200px;
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .banner-icon {
    background: var(--surface-color);
    padding: 16px;
    color: var(--accent-color-light);
    backdrop-filter: blur(8px);
    border: 3px solid var(--border-color);
  }

  .onboarding-content {
    padding: 24px 15px;
    overflow-y: auto;
    flex: 1;
  }

  .onboarding-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 12px 0;
  }

  .onboarding-description {
    font-size: var(--font-size-sm);
    color: var(--text-color-muted);
    line-height: 1.6;
    margin: 0 0 20px 0;
  }

  .feature-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    background: var(--overlay-color);
    border: 1px solid var(--border-color);
    border-left: 3px solid var(--accent-color);
  }


  .feature-item span {
    font-size: var(--font-size-sm);
    color: var(--text-color-muted);
  }

  .onboarding-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-top: 1px solid var(--border-color);
    background: var(--overlay-color);
    gap: 12px;
  }

  .skip-btn {
    background: transparent !important;
    color: var(--text-color-muted) !important;
    box-shadow: none !important;
  }

  .skip-btn:hover {
    color: var(--text-color) !important;
  }

  .get-started-btn, .next-btn {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .prev-btn {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .step-counter {
    font-size: var(--font-size-sm);
    color: var(--text-color-muted);
    font-weight: 500;
  }

  /* TOS Agreement Styles */
  .tos-agreement {
    margin-top: 20px;
    padding: 12px;
    background: var(--overlay-color);
    border: 1px solid var(--border-color);
    border-left-width: 5px;
    transition: all .3s ease;

    &:hover {
      border-left-width: 10px;
    }
  }

  .checkbox-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: var(--text-color-muted);
    user-select: none;
  }

  .custom-checkbox {
    width: 18px;
    height: 18px;
    min-width: 18px;
    border: 2px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    background: var(--base-color);
    color: var(--text-color);
    margin-top: 1px;

    svg {
      width: 12px;
      height: 12px;
    }

    &.checked {
      background: var(--accent-color);
      border-color: var(--accent-color);
      color: #ffffff;
    }
  }

  .checkbox-container:hover .custom-checkbox {
    border-color: var(--accent-color);
  }

  .checkbox-container:hover .custom-checkbox.checked {
    background: var(--accent-color-light);
    border-color: var(--accent-color-light);
  }
</style>
