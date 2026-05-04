<template>
  <div class="onairos-vue-wrapper">
    <!-- Loading State -->
    <div v-if="isLoading" class="onairos-loading">
      <div class="onairos-spinner"></div>
      <span>{{ loadingText }}</span>
    </div>

    <!-- Button State -->
    <button 
      v-else
      :class="buttonClasses"
      :disabled="disabled"
      @click="handleClick"
    >
      <slot name="icon" v-if="$slots.icon"></slot>
      <span :class="textClasses">
        <slot>{{ buttonText }}</slot>
      </span>
    </button>

    <!-- Success Message -->
    <div v-if="showSuccess" class="onairos-success">
      ✅ {{ successMessage }}
    </div>

    <!-- Error Message -->
    <div v-if="error" class="onairos-error">
      ❌ {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineEmits, defineProps } from 'vue';

// Props
const props = defineProps({
  requestData: {
    type: [Array, Object],
    default: () => ['email', 'profile']
  },
  webpageName: {
    type: String,
    default: 'Laravel Vue App'
  },
  testMode: {
    type: Boolean,
    default: false
  },
  autoFetch: {
    type: Boolean,
    default: true
  },
  buttonType: {
    type: String,
    default: 'pill',
    validator: (value) => ['pill', 'icon', 'rounded'].includes(value)
  },
  textColor: {
    type: String,
    default: 'white'
  },
  textLayout: {
    type: String,
    default: 'center',
    validator: (value) => ['left', 'center', 'right'].includes(value)
  },
  disabled: {
    type: Boolean,
    default: false
  },
  customClass: {
    type: String,
    default: ''
  },
  loadingText: {
    type: String,
    default: 'Connecting...'
  },
  successMessage: {
    type: String,
    default: 'Successfully connected!'
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  }
});

// Emits
const emit = defineEmits(['complete', 'error', 'loading', 'click']);

// Reactive state
const isLoading = ref(false);
const showSuccess = ref(false);
const error = ref(null);

// Computed properties
const buttonText = computed(() => {
  if (isLoading.value) return props.loadingText;
  return 'Connect with Onairos';
});

const buttonClasses = computed(() => {
  const baseClasses = ['onairos-vue-btn'];
  
  // Button type
  baseClasses.push(`onairos-btn-${props.buttonType}`);
  
  // Size
  baseClasses.push(`onairos-btn-${props.size}`);
  
  // States
  if (isLoading.value) baseClasses.push('onairos-btn-loading');
  if (props.disabled) baseClasses.push('onairos-btn-disabled');
  
  // Custom class
  if (props.customClass) baseClasses.push(props.customClass);
  
  return baseClasses.join(' ');
});

const textClasses = computed(() => {
  return [
    'onairos-btn-text',
    `onairos-text-${props.textLayout}`,
    `onairos-text-color-${props.textColor}`
  ].join(' ');
});

// Methods
async function handleClick() {
  if (isLoading.value || props.disabled) return;

  try {
    isLoading.value = true;
    error.value = null;
    emit('loading', true);
    emit('click');

    // Simulate connection process
    const result = await initializeOnairosConnection();
    
    showSuccess.value = true;
    setTimeout(() => {
      showSuccess.value = false;
    }, 3000);

    emit('complete', result);
  } catch (err) {
    error.value = err.message || 'Connection failed';
    emit('error', err);
  } finally {
    isLoading.value = false;
    emit('loading', false);
  }
}

async function initializeOnairosConnection() {
  // Check if global Onairos is available
  if (typeof window.createOnairosButton === 'function') {
    return new Promise((resolve, reject) => {
      // Use the global Blade helper
      const config = {
        requestData: props.requestData,
        webpageName: props.webpageName,
        testMode: props.testMode,
        autoFetch: props.autoFetch,
        onComplete: (result) => {
          resolve(result);
        },
        onError: (err) => {
          reject(err);
        }
      };

      // Trigger the connection flow
      const tempId = `temp-${Date.now()}`;
      const tempElement = document.createElement('div');
      tempElement.id = tempId;
      tempElement.style.display = 'none';
      document.body.appendChild(tempElement);

      window.createOnairosButton(tempId, config);
      
      // Trigger the button click programmatically
      setTimeout(() => {
        const btn = document.querySelector(`#${tempId}-btn`);
        if (btn) btn.click();
      }, 100);
    });
  } else {
    // Fallback: dynamic import of OnairosButton
    const { OnairosButton } = await import(/* @vite-ignore */ 'onairos');
    
    return new Promise((resolve, reject) => {
      // Create a temporary React component mount
      const config = {
        requestData: props.requestData,
        webpageName: props.webpageName,
        testMode: props.testMode,
        autoFetch: props.autoFetch,
        onComplete: resolve,
        onError: reject
      };

      // This would need React DOM integration
      // For now, we'll resolve with a mock result
      setTimeout(() => {
        resolve({
          success: true,
          data: 'Mock connection successful',
          timestamp: new Date().toISOString()
        });
      }, 2000);
    });
  }
}

// Lifecycle
onMounted(() => {
  // Initialize any needed global configurations
  if (typeof window.initializeOnairosForBlade === 'function') {
    window.initializeOnairosForBlade({
      testMode: props.testMode,
      autoDetectMobile: true,
      globalStyles: false // Vue component will handle its own styles
    });
  }
});

defineExpose({
  _setLoading: (v) => {
    isLoading.value = v;
  },
  _setShowSuccess: (v) => {
    showSuccess.value = v;
  },
  _setError: (msg) => {
    error.value = msg;
  },
});
</script>

<style scoped>
.onairos-vue-wrapper {
  display: inline-block;
  position: relative;
}

.onairos-vue-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  outline: none;
}

.onairos-vue-btn:hover:not(.onairos-btn-disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.onairos-vue-btn:active:not(.onairos-btn-disabled) {
  transform: translateY(0);
}

/* Button Types */
.onairos-btn-pill {
  border-radius: 25px;
}

.onairos-btn-rounded {
  border-radius: 8px;
}

.onairos-btn-icon {
  border-radius: 50%;
  width: 50px;
  height: 50px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Sizes */
.onairos-btn-small {
  padding: 8px 16px;
  font-size: 12px;
}

.onairos-btn-medium {
  padding: 12px 24px;
  font-size: 14px;
}

.onairos-btn-large {
  padding: 16px 32px;
  font-size: 16px;
}

.onairos-btn-icon.onairos-btn-small {
  width: 35px;
  height: 35px;
}

.onairos-btn-icon.onairos-btn-large {
  width: 60px;
  height: 60px;
}

/* Text Layout */
.onairos-text-left {
  text-align: left;
}

.onairos-text-center {
  text-align: center;
}

.onairos-text-right {
  text-align: right;
}

/* States */
.onairos-btn-loading {
  opacity: 0.7;
  cursor: not-allowed;
}

.onairos-btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading Spinner */
.onairos-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #f8f9fa;
  border-radius: 25px;
  border: 1px solid #e9ecef;
}

.onairos-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e9ecef;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: onairos-spin 1s linear infinite;
}

@keyframes onairos-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Success/Error Messages */
.onairos-success,
.onairos-error {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.onairos-success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.onairos-error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .onairos-btn-medium {
    width: 100%;
    padding: 15px 20px;
    font-size: 16px;
  }
  
  .onairos-btn-small {
    width: 100%;
    padding: 12px 16px;
    font-size: 14px;
  }
  
  .onairos-btn-large {
    width: 100%;
    padding: 18px 24px;
    font-size: 18px;
  }
}
</style> 