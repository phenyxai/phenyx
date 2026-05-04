/**
 * Onairos Laravel Blade Integration Helpers
 * 
 * This file provides utilities for integrating Onairos components
 * directly in PHP Blade templates without requiring React setup.
 */

import { getApiBaseUrl } from '../config/api-config.js';

// Global Onairos instance for Blade templates
let onairosInstance = null;

/**
 * Initialize Onairos for Blade template usage
 * @param {Object} config - Global configuration
 */
export function initializeOnairosForBlade(config = {}) {
  const defaultConfig = {
    apiKey: null,
    baseUrl: getApiBaseUrl(),
    testMode: false,
    autoDetectMobile: true,
    globalStyles: true
  };

  window.OnairosConfig = { ...defaultConfig, ...config };
  
  // Inject global styles if enabled
  if (window.OnairosConfig.globalStyles) {
    injectOnairosStyles();
  }

  // Initialize mobile detection
  window.OnairosUtils = {
    isMobile: detectMobileDevice(),
    detectMobile: detectMobileDevice
  };

  console.log('🔥 Onairos initialized for Laravel Blade templates');
}

/**
 * Create an Onairos button element that can be used in Blade templates
 * @param {string} targetElementId - ID of the element to mount to
 * @param {Object} options - Onairos button options
 */
export function createOnairosButton(targetElementId, options = {}) {
  let element = document.getElementById(targetElementId);
  if (!element) {
    if (window.OnairosUtils && window.OnairosUtils.isMobile) {
      const container = document.createElement('div');
      container.id = targetElementId;
      document.body.appendChild(container);
      element = container;
    } else {
      console.error(`❌ Element with ID "${targetElementId}" not found`);
      return;
    }
  }

  const defaultOptions = {
    requestData: ['email', 'profile'],
    webpageName: 'Laravel App',
    testMode: window.OnairosConfig?.testMode || false,
    /** Forward global Blade config so React gate + authHeaders resolve the same key. */
    apiKey: window.OnairosConfig?.apiKey || null,
    autoFetch: true,
    buttonType: 'pill',
    textColor: 'black'
  };

  const config = { ...defaultOptions, ...options };

  // Create button HTML
  element.innerHTML = `
    <div class="onairos-button-container">
      <button 
        id="${targetElementId}-btn" 
        class="onairos-btn onairos-btn-${config.buttonType}"
        data-onairos-config='${JSON.stringify(config)}'
      >
        <span class="onairos-btn-text" style="color: ${config.textColor}">
          Connect with Onairos
        </span>
        <span class="onairos-btn-loading" style="display: none;">
          Loading...
        </span>
      </button>
    </div>
  `;

  // Add event listener
  const button = document.getElementById(`${targetElementId}-btn`);
  // Ensure both property and event listener are set for testing compatibility
  button.onclick = () => handleOnairosButtonClick(config);
  button.addEventListener('click', () => handleOnairosButtonClick(config));
}

/**
 * Handle Onairos button click in Blade context
 * @param {Object} config - Button configuration
 */
function handleOnairosButtonClick(config) {
  // For Blade templates, reuse the React overlay logic by mounting the React component dynamically
  mountReactOverlay(config);
}

/**
 * Handle mobile OAuth flow (redirect-based)
 * @param {Object} config - Configuration
 */
function handleMobileFlow(config) {
  const authUrl = buildAuthUrl(config);
  window.location.href = authUrl;
}

/**
 * Handle desktop OAuth flow (popup-based)
 * @param {Object} config - Configuration
 */
function handleDesktopFlow(config) {
  const authUrl = buildAuthUrl(config);
  
  const popup = window.open(
    authUrl,
    'onairosAuth',
    'width=450,height=700,scrollbars=yes,resizable=yes'
  );

  if (popup) {
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        handleAuthComplete(config);
      }
    }, 1000);
  }
}

/**
 * Build authentication URL for OAuth flow
 * @param {Object} config - Configuration
 * @returns {string} Auth URL
 */
function buildAuthUrl(config) {
  const baseUrl = window.OnairosConfig.baseUrl;
  const params = new URLSearchParams({
    webpageName: config.webpageName,
    requestData: JSON.stringify(config.requestData),
    testMode: config.testMode,
    returnUrl: window.location.href
  });
  
  return `${baseUrl}/auth/laravel?${params.toString()}`;
}

/**
 * Handle authentication completion
 * @param {Object} config - Configuration
 */
function handleAuthComplete(config) {
  if (config.onComplete && typeof config.onComplete === 'function') {
    config.onComplete({
      success: true,
      timestamp: new Date().toISOString()
    });
  }
  
  // Trigger custom event for Laravel apps to listen to
  const event = new CustomEvent('onairosAuthComplete', {
    detail: { config, success: true }
  });
  window.dispatchEvent(event);
}

/**
 * Detect if device is mobile
 * @returns {boolean}
 */
function detectMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768);
}

/**
 * Inject Onairos styles into the page
 */
function injectOnairosStyles() {
  if (document.getElementById('onairos-styles')) return;

  const styles = `
    <style id="onairos-styles">
      .onairos-button-container {
        display: inline-block;
        margin: 10px 0;
      }
      
      .onairos-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        border-radius: 25px;
        padding: 12px 24px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      }
      
      .onairos-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
      }
      
      .onairos-btn-pill {
        border-radius: 25px;
      }
      
      .onairos-btn-icon {
        border-radius: 50%;
        width: 45px;
        height: 45px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .onairos-btn-loading {
        color: #888;
      }
      
      @media (max-width: 768px) {
        .onairos-btn {
          width: 100%;
          padding: 15px 20px;
          font-size: 16px;
        }
      }
    </style>
  `;
  
  document.head.insertAdjacentHTML('beforeend', styles);
}

/**
 * Laravel Blade template directive helper
 * Usage in Blade: @onairos(['requestData' => ['email'], 'webpageName' => 'My App'])
 */
export function renderOnairosDirective(options = {}) {
  const elementId = `onairos-${Math.random().toString(36).substr(2, 9)}`;
  
  return `
    <div id="${elementId}"></div>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        if (window.createOnairosButton) {
          window.createOnairosButton('${elementId}', ${JSON.stringify(options)});
        }
      });
    </script>
  `;
}

// Dynamically mount the React OnairosButton to reuse overlay flow
async function mountReactOverlay(config) {
  try {
    const containerId = `onairos-react-${Math.random().toString(36).substr(2, 9)}`;
    const container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);

    const React = (await import(/* @vite-ignore */ 'react')).default || (await import(/* @vite-ignore */ 'react'));
    const ReactDOM = (await import(/* @vite-ignore */ 'react-dom')).default || (await import(/* @vite-ignore */ 'react-dom'));
    const { OnairosButton } = await import(/* @vite-ignore */ '../onairosButton.jsx');

    const onComplete = (result) => {
      if (config.onComplete && typeof config.onComplete === 'function') {
        config.onComplete(result);
      }
      setTimeout(() => {
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }, 0);
    };

    const element = React.createElement(OnairosButton, {
      requestData: config.requestData,
      webpageName: config.webpageName,
      apiKey: config.apiKey || window.OnairosConfig?.apiKey || null,
      autoFetch: config.autoFetch,
      testMode: config.testMode,
      textColor: config.textColor || 'white',
      buttonType: config.buttonType || 'pill',
      onComplete
    });

    ReactDOM.render(element, container);

    // Programmatically click the button to open overlay immediately
    setTimeout(() => {
      const btn = container.querySelector('button');
      if (btn) {
        btn.click();
      }
    }, 0);
  } catch (error) {
    console.error('Failed to mount React overlay for Laravel:', error);
  }
}

// Expose functions globally for Blade template access
if (typeof window !== 'undefined') {
  window.initializeOnairosForBlade = initializeOnairosForBlade;
  window.createOnairosButton = createOnairosButton;
  window.renderOnairosDirective = renderOnairosDirective;
} 