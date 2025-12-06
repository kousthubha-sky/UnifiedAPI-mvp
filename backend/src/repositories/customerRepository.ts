import supabase from '../utils/supabase.js';
import logger from '../utils/logger.js';

export interface Customer {
  id: string;
  email: string;
  api_key?: string;
  tier: string;
  stripe_account_id?: string;
  paypal_account_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerInput {
  email: string;
  tier?: string;
}

export interface UpdateCustomerInput {
  tier?: string;
  stripe_account_id?: string;
  paypal_account_id?: string;
}

export const create = async (input: CreateCustomerInput): Promise<Customer | null> => {
  try {
    const { data, error } = await supabase.from('customers').insert([
      {
        email: input.email,
        tier: input.tier || 'starter',
      },
    ]).select().single();

    if (error) {
      logger.error({ error }, 'Failed to create customer');
      return null;
    }

    return data as Customer;
  } catch (error) {
    logger.error({ error }, 'Error creating customer');
    return null;
  }
};

export const findById = async (id: string): Promise<Customer | null> => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Customer;
  } catch (error) {
    logger.error({ error }, 'Error finding customer by ID');
    return null;
  }
};

export const findByEmail = async (email: string): Promise<Customer | null> => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Customer;
  } catch (error) {
    logger.error({ error }, 'Error finding customer by email');
    return null;
  }
};

export const findByApiKey = async (apiKey: string): Promise<Customer | null> => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Customer;
  } catch (error) {
    logger.error({ error }, 'Error finding customer by API key');
    return null;
  }
};

export const update = async (id: string, input: UpdateCustomerInput): Promise<Customer | null> => {
  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      ...input,
    };

    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to update customer');
      return null;
    }

    return data as Customer;
  } catch (error) {
    logger.error({ error }, 'Error updating customer');
    return null;
  }
};
