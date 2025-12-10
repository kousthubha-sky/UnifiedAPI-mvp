/**
 * Environment-aware configuration system for OneRouter SDK
 *
 * Handles automatic environment detection and configuration merging.
 */

import { Environment, ClientConfig } from './types.js';

/**
 * Environment-specific configuration defaults
 */
const ENVIRONMENT_CONFIGS: Record<Environment, Partial<ClientConfig>> = {
  local: {
    baseUrl: 'http://localhost:8000',
    timeout: 30000,
    maxRetries: 3,
    enableSigning: false,
  },
  staging: {
    baseUrl: 'https://api-staging.onerouter.com',
    timeout: 30000,
    maxRetries: 3,
    enableSigning: true,
  },
  production: {
    baseUrl: 'https://api.onerouter.com',
    timeout: 30000,
    maxRetries: 3,
    enableSigning: true,
  },
};

/**
 * Detect the current environment based on hostname and NODE_ENV
 *
 * Priority order:
 * 1. Explicit UNIFIED_ENV environment variable
 * 2. Hostname patterns (.lc, .st, .pr)
 * 3. NODE_ENV fallback
 * 4. Default to 'local'
 */
export function detectEnvironment(): Environment {
  // Priority 1: Explicit environment variable
  if (process.env.UNIFIED_ENV) {
    const env = process.env.UNIFIED_ENV as Environment;
    if (['local', 'staging', 'production'].includes(env)) {
      return env;
    }
  }

  // Priority 2: Check hostname for .lc/.st/.pr patterns
  const hostname = (globalThis as any).window?.location?.hostname || '';
  if (hostname.includes('.lc') || hostname.includes('localhost')) {
    return 'local';
  }
  if (hostname.includes('.st')) {
    return 'staging';
  }
  if (hostname.includes('.pr') || hostname === 'api.onerouter.com') {
    return 'production';
  }

  // Priority 3: Fallback to NODE_ENV (standard values only)
  // NODE_ENV is typically 'development', 'production', or 'test'
  // For staging, use UNIFIED_ENV, hostname patterns, or APP_ENV instead
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }

  // Default to local
  return 'local';
}

/**
 * Merge configuration with environment-aware defaults
 *
 * Priority order:
 * 1. Explicit config (defined values only)
 * 2. Environment-specific config
 * 3. Global defaults
 */
export function mergeConfig(explicitConfig: ClientConfig): ClientConfig {
  const environment = explicitConfig.environment || detectEnvironment();
  const envConfig = ENVIRONMENT_CONFIGS[environment];

  // Filter out undefined values from explicit config
  const filteredExplicitConfig: Partial<ClientConfig> = {};
  for (const [key, value] of Object.entries(explicitConfig)) {
    if (value !== undefined) {
      (filteredExplicitConfig as any)[key] = value;
    }
  }

  return {
    ...envConfig,
    ...filteredExplicitConfig,
    environment,
  } as ClientConfig;
}

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string): void {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (typeof apiKey !== 'string') {
    throw new Error('API key must be a string');
  }

  if (!apiKey.startsWith('sk_')) {
    throw new Error('API key must start with "sk_"');
  }

  // Allow shorter keys for testing (at least 6 characters after sk_)
  if (apiKey.length < 9) {
    throw new Error('API key appears to be too short');
  }
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(environment: Environment): Partial<ClientConfig> {
  return ENVIRONMENT_CONFIGS[environment];
}