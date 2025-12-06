import crypto from 'crypto';
import supabase from '../utils/supabase.js';
import logger from '../utils/logger.js';

export interface ApiKey {
  id: string;
  customer_id: string;
  key_hash: string;
  key?: string;
  name?: string;
  is_active: boolean;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateApiKeyInput {
  customer_id: string;
  name?: string;
}

const generateKey = (): string => {
  return `sk_${crypto.randomBytes(32).toString('hex')}`;
};

const hashKey = (key: string): string => {
  return crypto.createHash('sha256').update(key).digest('hex');
};

export const generate = async (input: CreateApiKeyInput): Promise<{ key: string; apiKey: ApiKey } | null> => {
  try {
    const key = generateKey();
    const keyHash = hashKey(key);

    const { data, error } = await supabase
      .from('api_keys')
      .insert([
        {
          customer_id: input.customer_id,
          key_hash: keyHash,
          key: key,
          name: input.name || `Key-${new Date().toISOString().slice(0, 10)}`,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to generate API key');
      return null;
    }

    return {
      key,
      apiKey: data as ApiKey,
    };
  } catch (error) {
    logger.error({ error }, 'Error generating API key');
    return null;
  }
};

export const list = async (customerId: string): Promise<ApiKey[]> => {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ error }, 'Failed to list API keys');
      return [];
    }

    return (data || []) as ApiKey[];
  } catch (error) {
    logger.error({ error }, 'Error listing API keys');
    return [];
  }
};

export const findByKeyHash = async (keyHash: string): Promise<ApiKey | null> => {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .single();

    if (error || !data) {
      return null;
    }

    return data as ApiKey;
  } catch (error) {
    logger.error({ error }, 'Error finding API key by hash');
    return null;
  }
};

export const findByKey = async (key: string): Promise<ApiKey | null> => {
  try {
    const keyHash = hashKey(key);
    return findByKeyHash(keyHash);
  } catch (error) {
    logger.error({ error }, 'Error finding API key');
    return null;
  }
};

export const revoke = async (keyId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId);

    if (error) {
      logger.error({ error }, 'Failed to revoke API key');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error }, 'Error revoking API key');
    return false;
  }
};

export const rotate = async (keyId: string): Promise<{ key: string; apiKey: ApiKey } | null> => {
  try {
    const newKey = generateKey();
    const newKeyHash = hashKey(newKey);

    const { data, error } = await supabase
      .from('api_keys')
      .update({
        key_hash: newKeyHash,
        key: newKey,
      })
      .eq('id', keyId)
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to rotate API key');
      return null;
    }

    return {
      key: newKey,
      apiKey: data as ApiKey,
    };
  } catch (error) {
    logger.error({ error }, 'Error rotating API key');
    return null;
  }
};

export const delete_ = async (keyId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId);

    if (error) {
      logger.error({ error }, 'Failed to delete API key');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error }, 'Error deleting API key');
    return false;
  }
};
