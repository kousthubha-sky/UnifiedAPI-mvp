'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useUser, useAuth as useClerkAuth, useSignUp, useSignIn } from '@clerk/nextjs';
import {
  apiClient,
  getStoredApiKey,
  setStoredApiKey,
  getStoredCustomerId,
  setStoredCustomerId,
  clearStoredApiKey,
  clearStoredCustomerId,
  clearAllAuthData,
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
  user: any; // Clerk user
  session: any; // For compatibility, set to null
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
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, signOut: clerkSignOut } = useClerkAuth();
  const { signUp: clerkSignUp } = useSignUp();
  const { signIn: clerkSignIn } = useSignIn();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to get auth headers - uses Clerk token
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    try {
      const token = await getToken();
      console.log('Clerk token:', token ? 'present' : 'null');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Failed to get Clerk token:', error);
    }

    return headers;
  }, []);



  const refreshCustomer = useCallback(async () => {
    const customerId = getStoredCustomerId();
    if (!customerId) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/v1/customers/${customerId}`, {
        headers,
      });

      if (response.status === 401) {
        console.error('Authentication failed');
        clearStoredApiKey();
        clearStoredCustomerId();
        setCustomer(null);
        setApiKeys([]);
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
  }, [getAuthHeaders]);

  const refreshApiKeys = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
        headers,
      });

      if (response.status === 401) {
        console.error('Authentication failed');
        clearStoredApiKey();
        clearStoredCustomerId();
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
  }, [getAuthHeaders]);

  // Initialize auth state when Clerk user is loaded
  useEffect(() => {
    const initAuth = async () => {
      if (!userLoaded) return;

      try {
        if (user) {
          // Check localStorage for existing API key
          const storedKey = getStoredApiKey();
          const storedCustomerId = getStoredCustomerId();

          if (storedKey && storedCustomerId) {
            // Verify stored data
            try {
              const headers = await getAuthHeaders();
              const response = await fetch(`${API_BASE_URL}/api/v1/customers/${storedCustomerId}`, { headers });

              if (response.ok) {
                const customerData = await response.json();
                setCustomer(customerData);
                apiClient.setApiKey(storedKey);
              } else {
                // Invalid, clear
                clearStoredApiKey();
                clearStoredCustomerId();
                setCustomer(null);
                setApiKeys([]);
                apiClient.setApiKey(null);
              }
            } catch (err) {
              console.error('Failed to verify stored auth:', err);
              clearStoredApiKey();
              clearStoredCustomerId();
            }
          }

          // If no customer, create it
          if (!storedCustomerId) {
            const email = user.emailAddresses?.[0]?.emailAddress || '';
            const userId = user?.id || '';
            const { customerId, error: _error } = await createBackendCustomer(email, userId);
            if (customerId) {
              setStoredCustomerId(customerId);
              // Generate initial API key
              const { key } = await generateInitialApiKey();
              if (key) {
                setStoredApiKey(key);
                apiClient.setApiKey(key);
              }
              // Fetch customer data
              await refreshCustomer();
            }
          }

          // Refresh API keys
          if (getStoredCustomerId()) {
            await refreshApiKeys();
          }
        }
      } catch (_err) {
        console.error('Failed to initialize auth:', _err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [userLoaded, user]);



  // Refresh customer and API keys when auth state changes
  useEffect(() => {
    const storedKey = getStoredApiKey();
    if (storedKey) {
      refreshCustomer();
      refreshApiKeys();
    }
  }, [refreshCustomer, refreshApiKeys]);

  // Create customer in backend after getting customer ID
  const createBackendCustomer = async (email: string, userId: string): Promise<{ customerId: string | null; error: string | null }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/v1/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, user_id: userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { customerId: null, error: data.error || 'Failed to create customer' };
      }

      return { customerId: data.id, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create customer';
      return { customerId: null, error: message };
    }
  };

  // Generate initial API key using Clerk auth
  // The backend derives customer_id from the authenticated request context
  const generateInitialApiKey = async (): Promise<{ key: string | null; error: string | null }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Default API Key',
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
    if (!clerkSignUp) {
      return { error: 'Clerk not initialized' };
    }

    try {
      setError(null);
      const result = await clerkSignUp.create({
        emailAddress: email,
        password,
      });

       if (result.status === 'complete') {
        // User is signed in
        // Ensure we have customer record
        if (!user?.id) {
          return { error: 'User not found after sign up' };
        }
        const { customerId, error: customerError } = await createBackendCustomer(email, user.id);
        if (customerError && !customerId) {
          return { error: customerError };
        }

        if (customerId) {
          console.log('Customer ID set:', customerId);
          setStoredCustomerId(customerId);
          // Generate API key if not exists
          const storedKey = getStoredApiKey();
          if (!storedKey) {
            const { key } = await generateInitialApiKey();
            if (key) {
              setStoredApiKey(key);
              apiClient.setApiKey(key);
            }
          }
        }

        await refreshCustomer();
        await refreshApiKeys();

        return { error: null };
      } else {
        return { error: 'Sign up incomplete' };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setError(message);
      return { error: message };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!clerkSignIn) {
      return { error: 'Clerk not initialized' };
    }

    try {
      setError(null);
      console.log('Starting sign in for email:', email);
      const result = await clerkSignIn.create({
        identifier: email,
        password,
      });

       if (result.status === 'complete') {
        console.log('Sign in complete, checking backend customer');
        // User is signed in
        // Ensure we have customer record
        if (!user?.id) {
          return { error: 'User not found after sign in' };
        }
        const { customerId, error: customerError } = await createBackendCustomer(email, user.id);
        console.log('createBackendCustomer result:', { customerId, error: customerError });
        if (customerError && !customerId) {
          console.error('Failed to get customer record:', customerError);
          return { error: customerError };
        }

        if (customerId) {
          console.log('Customer ID set:', customerId);
          setStoredCustomerId(customerId);
        }

        await refreshCustomer();
        await refreshApiKeys();

        return { error: null };
      } else {
        return { error: 'Sign in incomplete' };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
      return { error: message };
    }
  };

  const signInWithMagicLink = async (email: string): Promise<{ error: string | null }> => {
    if (!clerkSignIn) {
      return { error: 'Clerk not initialized' };
    }

    try {
      setError(null);
      const result = await clerkSignIn.create({
        strategy: 'email_link',
        identifier: email,
        redirectUrl: `${window.location.origin}/dashboard`,
      });

      if (result.status === 'complete') {
        return { error: null };
      } else {
        return { error: 'Magic link sending failed' };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Magic link failed';
      setError(message);
      return { error: message };
    }
  };

  const signOut = async (): Promise<void> => {
    await clerkSignOut();

    // Clear all auth data
    clearAllAuthData();
    apiClient.setApiKey(null);

    setCustomer(null);
    setApiKeys([]);
  };

  const updateCustomer = async (updates: Partial<Customer>): Promise<{ error: string | null }> => {
    const customerId = getStoredCustomerId();
    if (!customerId) {
      return { error: 'Not authenticated' };
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/v1/customers/${customerId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates),
      });

      if (response.status === 401) {
        clearStoredApiKey();
        clearStoredCustomerId();
        setCustomer(null);
        setApiKeys([]);
        return { error: 'Authentication failed. Please try again.' };
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
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name }),
      });

      if (response.status === 401) {
        clearStoredApiKey();
        clearStoredCustomerId();
        setCustomer(null);
        setApiKeys([]);
        return { key: null, error: 'Authentication failed. Please try again.' };
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
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'revoke' }),
      });

      if (response.status === 401) {
        clearStoredApiKey();
        clearStoredCustomerId();
        setCustomer(null);
        setApiKeys([]);
        return { error: 'Authentication failed. Please try again.' };
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
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (response.status === 401) {
        clearStoredApiKey();
        clearStoredCustomerId();
        setCustomer(null);
        setApiKeys([]);
        return { error: 'Authentication failed. Please try again.' };
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
        session: null, // Clerk doesn't have session in same way
        customer,
        apiKeys,
        loading: loading || !userLoaded,
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
