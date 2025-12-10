/**
 * Tests for environment-aware configuration system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detectEnvironment,
  mergeConfig,
  validateApiKey,
  getEnvironmentConfig,
} from '../src/config.js';
import { Environment } from '../src/types.js';

describe('Environment Detection', () => {
  const originalEnv = { ...process.env };
  const originalWindow = global.window;

  beforeEach(() => {
    // Reset environment variables
    delete process.env.UNIFIED_ENV;
    delete process.env.NODE_ENV;
    // Reset window to original state
    global.window = originalWindow as any;
  });

  afterEach(() => {
    // Restore original environment
    Object.assign(process.env, originalEnv);
    // Clean up window mock
    global.window = originalWindow as any;
  });

  describe('detectEnvironment', () => {
    it('should detect local environment from UNIFIED_ENV', () => {
      process.env.UNIFIED_ENV = 'local';
      expect(detectEnvironment()).toBe('local');
    });

    it('should detect staging environment from UNIFIED_ENV', () => {
      process.env.UNIFIED_ENV = 'staging';
      expect(detectEnvironment()).toBe('staging');
    });

    it('should detect production environment from UNIFIED_ENV', () => {
      process.env.UNIFIED_ENV = 'production';
      expect(detectEnvironment()).toBe('production');
    });

    it('should detect local from hostname with .lc', () => {
      // Mock window.location for browser environment
      global.window = { location: { hostname: 'app.lc' } } as any;
      expect(detectEnvironment()).toBe('local');
    });

    it('should detect local from hostname with localhost', () => {
      global.window = { location: { hostname: 'localhost' } } as any;
      expect(detectEnvironment()).toBe('local');
    });

    it('should detect staging from hostname with .st', () => {
      global.window = { location: { hostname: 'api.st' } } as any;
      expect(detectEnvironment()).toBe('staging');
    });

    it('should detect production from hostname with .pr', () => {
      global.window = { location: { hostname: 'myapp.pr' } } as any;
      expect(detectEnvironment()).toBe('production');
    });

    it('should detect production from api.onerouter.com', () => {
      global.window = { location: { hostname: 'api.onerouter.com' } } as any;
      expect(detectEnvironment()).toBe('production');
    });

    it('should fallback to NODE_ENV production', () => {
      process.env.NODE_ENV = 'production';
      expect(detectEnvironment()).toBe('production');
    });

    it('should ignore non-standard NODE_ENV values like staging', () => {
      // NODE_ENV should only be 'development', 'production', or 'test'
      // Staging should be set via UNIFIED_ENV or hostname patterns instead
      process.env.NODE_ENV = 'staging';
      expect(detectEnvironment()).toBe('local');
    });

    it('should default to local', () => {
      expect(detectEnvironment()).toBe('local');
    });
  });

  describe('mergeConfig', () => {
    it('should merge explicit config with environment defaults', () => {
      const explicit = {
        apiKey: 'sk_test_123',
        timeout: 5000,
      };

      const merged = mergeConfig(explicit);

      expect(merged.apiKey).toBe('sk_test_123');
      expect(merged.timeout).toBe(5000);
      expect(merged.baseUrl).toBe('http://localhost:8000'); // local default
      expect(merged.maxRetries).toBe(3);
      expect(merged.environment).toBe('local');
    });

    it('should override environment defaults with explicit config', () => {
      const explicit = {
        apiKey: 'sk_test_123',
        baseUrl: 'https://custom.api.com',
        environment: 'production' as Environment,
      };

      const merged = mergeConfig(explicit);

      expect(merged.baseUrl).toBe('https://custom.api.com');
      expect(merged.environment).toBe('production');
      expect(merged.enableSigning).toBe(true); // production default
    });

    it('should use staging environment config', () => {
      const explicit = {
        apiKey: 'sk_test_123',
        environment: 'staging' as Environment,
      };

      const merged = mergeConfig(explicit);

      expect(merged.baseUrl).toBe('https://api-staging.onerouter.com');
      expect(merged.enableSigning).toBe(true);
      expect(merged.environment).toBe('staging');
    });
  });

  describe('validateApiKey', () => {
    it('should accept valid API key', () => {
      expect(() => validateApiKey('sk_test_123456789')).not.toThrow();
      expect(() => validateApiKey('sk_live_abcdef123456')).not.toThrow();
    });

    it('should reject missing API key', () => {
      expect(() => validateApiKey('')).toThrow('API key is required');
    });

    it('should reject non-string API key', () => {
      expect(() => validateApiKey(123 as any)).toThrow('API key must be a string');
    });

    it('should reject API key without sk_ prefix', () => {
      expect(() => validateApiKey('test_123')).toThrow('API key must start with "sk_"');
    });

    it('should reject API key that is too short', () => {
      expect(() => validateApiKey('sk_12')).toThrow('API key appears to be too short');
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return local environment config', () => {
      const config = getEnvironmentConfig('local');
      expect(config.baseUrl).toBe('http://localhost:8000');
      expect(config.enableSigning).toBe(false);
    });

    it('should return staging environment config', () => {
      const config = getEnvironmentConfig('staging');
      expect(config.baseUrl).toBe('https://api-staging.onerouter.com');
      expect(config.enableSigning).toBe(true);
    });

    it('should return production environment config', () => {
      const config = getEnvironmentConfig('production');
      expect(config.baseUrl).toBe('https://api.onerouter.com');
      expect(config.enableSigning).toBe(true);
    });
  });
});