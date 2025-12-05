import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

function initializeSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = initializeSupabase();
  }

  return supabaseInstance;
}

export const supabase: SupabaseClient | null = (() => {
  if (typeof window !== 'undefined') {
    return getSupabase();
  }
  return null;
})();

export interface ApiKeyRecord {
  id: string;
  key: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchApiKeys(): Promise<ApiKeyRecord[]> {
  try {
    const client = getSupabase();
    if (!client) {
      console.warn('Supabase client not initialized');
      return [];
    }

    const { data, error } = await client
      .from('api_keys')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error('Error fetching API keys:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Failed to fetch API keys:', err);
    return [];
  }
}

export async function getApiKeyById(id: string): Promise<ApiKeyRecord | null> {
  try {
    const client = getSupabase();
    if (!client) {
      console.warn('Supabase client not initialized');
      return null;
    }

    const { data, error } = await client
      .from('api_keys')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching API key:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Failed to fetch API key:', err);
    return null;
  }
}
