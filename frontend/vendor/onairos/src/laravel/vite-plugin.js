/**
 * Onairos Vite Plugin for Laravel
 * 
 * This plugin provides seamless integration of Onairos components
 * within Laravel Vite applications, handling both development and
 * production builds.
 */

import { resolve } from 'path';

export function onairosLaravelPlugin(options = {}) {
  const defaultOptions = {
    autoImport: true,
    injectGlobals: true,
    optimizeDeps: true,
    enableHMR: true,
    bladeSupport: true
  };

  const config = { ...defaultOptions, ...options };

  return {
    name: 'onairos-laravel',
    config(viteConfig, { command }) {
      // Optimize dependencies for faster dev server startup
      if (config.optimizeDeps) {
        viteConfig.optimizeDeps = viteConfig.optimizeDeps || {};
        viteConfig.optimizeDeps.include = viteConfig.optimizeDeps.include || [];
        viteConfig.optimizeDeps.include.push('onairos');
      }

      // Add alias for easier imports
      viteConfig.resolve = viteConfig.resolve || {};
      viteConfig.resolve.alias = viteConfig.resolve.alias || {};
      viteConfig.resolve.alias['@onairos'] = resolve('node_modules/onairos');

      // Configure for Laravel Blade support
      if (config.bladeSupport && command === 'serve') {
        viteConfig.server = viteConfig.server || {};
        viteConfig.server.watch = viteConfig.server.watch || {};
        viteConfig.server.watch.include = viteConfig.server.watch.include || [];
        viteConfig.server.watch.include.push('resources/views/**/*.blade.php');
      }
    },

    configureServer(server) {
      if (config.enableHMR) {
        // Add custom HMR handling for Onairos components
        server.ws.on('onairos:reload', () => {
          server.ws.send({
            type: 'full-reload'
          });
        });
      }
    },

    transformIndexHtml: {
      enforce: 'pre',
      transform(html, context) {
        if (config.injectGlobals && context.server) {
          // Inject Onairos initialization script for development
          const initScript = `
            <script type="module">
              import { initializeOnairosForBlade } from '/node_modules/onairos/src/laravel/blade-helpers.js';
              
              // Initialize Onairos for Laravel Blade templates
              initializeOnairosForBlade({
                testMode: true,
                autoDetectMobile: true,
                globalStyles: true
              });
              
              // Enable HMR for Onairos components
              if (import.meta.hot) {
                import.meta.hot.on('onairos:update', () => {
                  console.log('🔥 Onairos components updated');
                  window.location.reload();
                });
              }
            </script>
          `;
          
          return html.replace('<head>', `<head>${initScript}`);
        }
        return html;
      }
    },

    generateBundle(options, bundle) {
      // Add Onairos assets to the build output
      if (config.autoImport) {
        // Create a separate chunk for Laravel integration
        this.emitFile({
          type: 'chunk',
          id: 'onairos-laravel-integration',
          fileName: 'onairos-laravel.js'
        });
      }
    },

    writeBundle(options, bundle) {
      // Create Laravel-specific integration files
      const laravelIntegrationCode = `
// Onairos Laravel Integration
import { initializeOnairosForBlade, createOnairosButton } from 'onairos/blade';

// Auto-initialize for production
document.addEventListener('DOMContentLoaded', () => {
  initializeOnairosForBlade({
    testMode: false,
    autoDetectMobile: true,
    globalStyles: true
  });
});

// Export for manual usage
window.Onairos = {
  init: initializeOnairosForBlade,
  createButton: createOnairosButton
};
      `;

      // Write the integration file
      this.emitFile({
        type: 'asset',
        fileName: 'onairos-laravel-integration.js',
        source: laravelIntegrationCode
      });
    }
  };
}

// Vue.js specific plugin for Laravel
export function onairosVuePlugin(options = {}) {
  return {
    name: 'onairos-vue-laravel',
    config(viteConfig) {
      // Add Vue-specific optimizations for Onairos
      viteConfig.optimizeDeps = viteConfig.optimizeDeps || {};
      viteConfig.optimizeDeps.include = viteConfig.optimizeDeps.include || [];
      viteConfig.optimizeDeps.include.push('onairos', 'vue');
    },
    
    transform(code, id) {
      // Auto-import Onairos in Vue components
      if (id.endsWith('.vue') && options.autoImport) {
        if (code.includes('OnairosButton') && !code.includes('import.*OnairosButton')) {
          return `import { OnairosButton } from 'onairos';\n${code}`;
        }
      }
      return null;
    }
  };
}

// React specific plugin for Laravel  
export function onairosReactPlugin(options = {}) {
  return {
    name: 'onairos-react-laravel',
    config(viteConfig) {
      // Add React-specific optimizations for Onairos
      viteConfig.optimizeDeps = viteConfig.optimizeDeps || {};
      viteConfig.optimizeDeps.include = viteConfig.optimizeDeps.include || [];
      viteConfig.optimizeDeps.include.push('onairos', 'react', 'react-dom');
    },
    
    transform(code, id) {
      // Auto-import Onairos in React components
      if ((id.endsWith('.jsx') || id.endsWith('.tsx')) && options.autoImport) {
        if (code.includes('OnairosButton') && !code.includes('import.*OnairosButton')) {
          return `import { OnairosButton } from 'onairos';\n${code}`;
        }
      }
      return null;
    }
  };
}

export default onairosLaravelPlugin; 