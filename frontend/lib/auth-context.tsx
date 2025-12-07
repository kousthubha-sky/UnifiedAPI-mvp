'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import {
  apiClient,
  getStoredApiKey,
  setStoredApiKey,
  getStoredCustomerId,
  setStoredCustomerId,
  clearAllAuthData,
  getBootstrapApiKey,
} from './api';

export interface Customer {
  id: string;
  email: string;
  tier: 'starter' | 'growth' | 'scale';
  stripe_account_id?: string;
  paypal_account_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  name?: string;
  is_active: boolean;
  last_used_at?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  customer: Customer | null;
  apiKeys: ApiKey[];
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshCustomer: () => Promise<void>;
  refreshApiKeys: () => Promise<void>;
  updateCustomer: (updates: Partial<Customer>) => Promise<{ error: string | null }>;
  generateApiKey: (name?: string) => Promise<{ key: string | null; error: string | null }>;
  revokeApiKey: (id: string) => Promise<{ error: string | null }>;
  deleteApiKey: (id: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to get API key header - uses stored API key or bootstrap key as fallback
  const getApiKeyHeaders = useCallback((useBootstrap: boolean = false): HeadersInit => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (useBootstrap) {
      const bootstrapKey = getBootstrapApiKey();
      if (bootstrapKey) {
        headers['x-api-key'] = bootstrapKey;
      }
    } else {
      const storedKey = getStoredApiKey();
      if (storedKey) {
        headers['x-api-key'] = storedKey;
      }
    }

    return headers;
  }, []);

  const refreshCustomer = useCallback(async () => {
    const customerId = getStoredCustomerId();
    if (!customerId) return;

    const storedKey = getStoredApiKey();
    if (!storedKey) {
      console.warn('No API key available to refresh customer');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/customers/${customerId}`, {
        headers: getApiKeyHeaders(),
      });

      if (response.status === 401) {
        console.error('API key invalid or expired');
        clearAllAuthData();
        setCustomer(null);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setCustomer(data);
      } else {
        console.error('Failed to fetch customer:', response.status);
      }
    } catch (err) {
      console.error('Failed to fetch customer:', err);
    }
  }, [getApiKeyHeaders]);

  const refreshApiKeys = useCallback(async () => {
    const storedKey = getStoredApiKey();
    if (!storedKey) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
        headers: getApiKeyHeaders(),
      });

      if (response.status === 401) {
        console.error('API key invalid or expired');
        clearAllAuthData();
        setApiKeys([]);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    }
  }, [getApiKeyHeaders]);

  // Initialize auth state from localStorage and Supabase
  useEffect(() => {
    const initAuth = async () => {
      try {
        // First check localStorage for existing API key
        const storedKey = getStoredApiKey();
        const storedCustomerId = getStoredCustomerId();

        if (storedKey && storedCustomerId) {
          // Set API key in client
          apiClient.setApiKey(storedKey);

          // Try to fetch customer data with stored API key
          try {
            const response = await fetch(`${API_BASE_URL}/api/v1/customers/${storedCustomerId}`, {
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': storedKey,
              },
            });

            if (response.ok) {
              const customerData = await response.json();
              setCustomer(customerData);
            } else if (response.status === 401) {
              // API key is invalid, clear auth data
              clearAllAuthData();
              apiClient.setApiKey(null);
            }
          } catch (err) {
            console.error('Failed to fetch customer on init:', err);
          }
        }

        // Also initialize Supabase session if available
        const supabase = getSupabase();
        if (supabase) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
        }
      } catch (err) {
        console.error('Failed to initialize auth:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Set up Supabase auth state change listener
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (!newSession) {
          // Keep API key auth even if Supabase session ends
          // Only clear if we don't have an API key
          const storedKey = getStoredApiKey();
          if (!storedKey) {
            setCustomer(null);
            setApiKeys([]);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Refresh customer and API keys when auth state changes
  useEffect(() => {
    const storedKey = getStoredApiKey();
    if (storedKey) {
      refreshCustomer();
      refreshApiKeys();
    }
  }, [refreshCustomer, refreshApiKeys]);

  // Create customer in backend after getting customer ID
  const createBackendCustomer = async (email: string): Promise<{ customerId: string | null; error: string | null }> => {
    try {
      // Use bootstrap key for customer creation (POST /api/v1/customers is public, but we'll send key anyway)
      const response = await fetch(`${API_BASE_URL}/api/v1/customers`, {
        method: 'POST',
        headers: getApiKeyHeaders(true),
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.status === 409 && data.code === 'CUSTOMER_EXISTS') {
        // Customer exists, try to find them
        // For now, we'll need to generate an API key with the bootstrap key
        return { customerId: null, error: null };
      }

      if (!response.ok) {
        return { customerId: null, error: data.error || 'Failed to create customer' };
      }

      return { customerId: data.id, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create customer';
      return { customerId: null, error: message };
    }
  };

  // Generate initial API key using bootstrap key
  const generateInitialApiKey = async (customerId: string): Promise<{ key: string | null; error: string | null }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
        method: 'POST',
        headers: getApiKeyHeaders(true),
        body: JSON.stringify({ 
          name: 'Default API Key',
          customer_id: customerId, // Include customer ID for bootstrap auth
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        return { key: null, error: data.error || 'Failed to generate API key' };
      }

      const data = await response.json();
      return { key: data.key, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate API key';
      return { key: null, error: message };
    }
  };

  const signUp = async (email: string, password: string): Promise<{ error: string | null }> => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: 'Supabase not initialized' };
    }

    try {
      setError(null);

      // Step 1: Sign up with Supabase
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return { error: authError.message };
      }

      if (!data.user) {
        return { error: 'Failed to create user account' };
      }

      // Step 2: Create customer in backend
      const { customerId, error: customerError } = await createBackendCustomer(email);
      
      if (customerError && !customerId) {
        console.error('Failed to create customer record:', customerError);
        // Continue anyway - customer may already exist
      }

      // Step 3: If we got a customer ID, store it and generate API key
      if (customerId) {
        setStoredCustomerId(customerId);

        // Step 4: Generate initial API key using bootstrap key
        const { key, error: keyError } = await generateInitialApiKey(customerId);
        
        if (key) {
          // Store the API key
          setStoredApiKey(key);
          apiClient.setApiKey(key);
          
          // Fetch customer data with new API key
          await refreshCustomer();
          await refreshApiKeys();
        } else if (keyError) {
          console.error('Failed to generate initial API key:', keyError);
        }
      }

      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setError(message);
      return { error: message };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: 'Supabase not initialized' };
    }

    try {
      setError(null);
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return { error: authError.message };
      }

      // After sign in, check if we have stored API key
      const storedKey = getStoredApiKey();
      if (storedKey) {
        apiClient.setApiKey(storedKey);
        await refreshCustomer();
        await refreshApiKeys();
      }

      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
      return { error: message };
    }
  };

  const signInWithMagicLink = async (email: string): Promise<{ error: string | null }> => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: 'Supabase not initialized' };
    }

    try {
      setError(null);
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (authError) {
        setError(authError.message);
        return { error: authError.message };
      }

      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Magic link failed';
      setError(message);
      return { error: message };
    }
  };

  const signOut = async (): Promise<void> => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }

    // Clear all auth data
    clearAllAuthData();
    apiClient.setApiKey(null);
    
    setUser(null);
    setSession(null);
    setCustomer(null);
    setApiKeys([]);
  };

  const updateCustomer = async (updates: Partial<Customer>): Promise<{ error: string | null }> => {
    const customerId = getStoredCustomerId();
    if (!customerId) {
      return { error: 'Not authenticated' };
    }

    const storedKey = getStoredApiKey();
    if (!storedKey) {
      return { error: 'No API key available' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/customers/${customerId}`, {
        method: 'PATCH',
        headers: getApiKeyHeaders(),
        body: JSON.stringify(updates),
      });

      if (response.status === 401) {
        clearAllAuthData();
        return { error: 'Authentication failed. Please log in again.' };
      }

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to update customer' };
      }

      const data = await response.json();
      setCustomer(data);
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      return { error: message };
    }
  };

  const generateApiKey = async (name?: string): Promise<{ key: string | null; error: string | null }> => {
    const storedKey = getStoredApiKey();
    if (!storedKey) {
      return { key: null, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
        method: 'POST',
        headers: getApiKeyHeaders(),
        body: JSON.stringify({ name }),
      });

      if (response.status === 401) {
        clearAllAuthData();
        return { key: null, error: 'Authentication failed. Please log in again.' };
      }

      if (!response.ok) {
        const data = await response.json();
        return { key: null, error: data.error || 'Failed to generate API key' };
      }

      const data = await response.json();
      await refreshApiKeys();
      return { key: data.key, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate API key';
      return { key: null, error: message };
    }
  };

  const revokeApiKey = async (id: string): Promise<{ error: string | null }> => {
    const storedKey = getStoredApiKey();
    if (!storedKey) {
      return { error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/${id}`, {
        method: 'PATCH',
        headers: getApiKeyHeaders(),
        body: JSON.stringify({ action: 'revoke' }),
      });

      if (response.status === 401) {
        clearAllAuthData();
        return { error: 'Authentication failed. Please log in again.' };
      }

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to revoke API key' };
      }

      await refreshApiKeys();
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke API key';
      return { error: message };
    }
  };

  const deleteApiKey = async (id: string): Promise<{ error: string | null }> => {
    const storedKey = getStoredApiKey();
    if (!storedKey) {
      return { error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/${id}`, {
        method: 'DELETE',
        headers: getApiKeyHeaders(),
      });

      if (response.status === 401) {
        clearAllAuthData();
        return { error: 'Authentication failed. Please log in again.' };
      }

      if (!response.ok) {
        const data = await response.json();
        return { error: data.error || 'Failed to delete API key' };
      }

      await refreshApiKeys();
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete API key';
      return { error: message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        customer,
        apiKeys,
        loading,
        error,
        signUp,
        signIn,
        signInWithMagicLink,
        signOut,
        refreshCustomer,
        refreshApiKeys,
        updateCustomer,
        generateApiKey,
        revokeApiKey,
        deleteApiKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
