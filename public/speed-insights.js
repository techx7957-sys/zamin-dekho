// Vercel Speed Insights - Vanilla JS Implementation
// This script initializes Vercel Speed Insights for performance monitoring

(function() {
  'use strict';
  
  // Initialize the Speed Insights queue
  if (!window.si) {
    window.si = function() {
      window.siq = window.siq || [];
      window.siq.push(arguments);
    };
  }

  // Configuration
  const config = {
    route: window.location.pathname,
    debug: false, // Set to true in development if needed
    framework: 'vanilla'
  };

  // Determine the script source
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const scriptSrc = isDev 
    ? 'https://va.vercel-scripts.com/v1/speed-insights/script.debug.js'
    : '/_vercel/speed-insights/script.js';

  // Check if script is already loaded
  if (document.head.querySelector(`script[src*="${scriptSrc}"]`)) {
    return;
  }

  // Create and inject the Speed Insights script
  const script = document.createElement('script');
  script.src = scriptSrc;
  script.defer = true;
  
  // Set data attributes for the script
  script.dataset.sdkn = '@vercel/speed-insights/vanilla';
  script.dataset.sdkv = '2.0.0';
  script.dataset.route = config.route;
  
  if (isDev && config.debug === false) {
    script.dataset.debug = 'false';
  }

  script.onerror = function() {
    console.log('[Vercel Speed Insights] Failed to load script from ' + scriptSrc + '. Please check if any content blockers are enabled and try again.');
  };

  document.head.appendChild(script);

  // Update route on navigation (for SPAs, though this project uses traditional navigation)
  window.addEventListener('popstate', function() {
    if (script.dataset) {
      script.dataset.route = window.location.pathname;
    }
  });
})();
