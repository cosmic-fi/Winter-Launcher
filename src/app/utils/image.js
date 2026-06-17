export function image(node, options = {}) {
  const fallback = options.fallback || '/images/placeholder.png';

  const originalSrc = node.src;

  const preload = new Image();

  preload.onload = () => {
    node.src = originalSrc;
  };

  preload.onerror = () => {
    node.src = fallback;
  };

  preload.src = originalSrc;

  node.loading ??= 'lazy';

  function handleError() {
    node.src = fallback;
  }

  node.addEventListener('error', handleError);

  return {
    destroy() {
      node.removeEventListener('error', handleError);
    }
  };
}