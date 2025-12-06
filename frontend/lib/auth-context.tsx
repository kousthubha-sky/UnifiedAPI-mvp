'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

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

  const getAuthHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, [session]);

  const refreshCustomer = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/customers/${user.id}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setCustomer(data);
      }
    } catch (err) {
      console.error('Failed to fetch customer:', err);
    }
  }, [user, getAuthHeaders]);

  const refreshApiKeys = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    }
  }, [session, getAuthHeaders]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      } catch (err) {
        console.error('Failed to get session:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (!newSession) {
          setCustomer(null);
          setApiKeys([]);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user && session) {
      refreshCustomer();
      refreshApiKeys();
    }
  }, [user, session, refreshCustomer, refreshApiKeys]);

  const signUp = async (email: string, password: string): Promise<{ error: string | null }> => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: 'Supabase not initialized' };
    }

    try {
      setError(null);
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return { error: authError.message };
      }

      if (data.user) {
        const response = await fetch(`${API_BASE_URL}/api/v1/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        if (!response.ok) {
          const errData = await response.json();
          if (errData.code !== 'CUSTOMER_EXISTS') {
            console.error('Failed to create customer record:', errData);
          }
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
    if (!supabase) return;

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setCustomer(null);
    setApiKeys([]);
  };

  const updateCustomer = async (updates: Partial<Customer>): Promise<{ error: string | null }> => {
    if (!user) {
      return { error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/customers/${user.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });

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
    if (!session?.access_token) {
      return { key: null, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name }),
      });

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
    if (!session?.access_token) {
      return { error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'revoke' }),
      });

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
    if (!session?.access_token) {
      return { error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

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
