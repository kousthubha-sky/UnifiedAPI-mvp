import supabase from '../utils/supabase.js';
import logger from '../utils/logger.js';

export interface AuditLogEntry {
  id?: string;
  trace_id: string;
  customer_id?: string;
  endpoint: string;
  method: string;
  provider?: string;
  status: number;
  latency_ms: number;
  error_message?: string;
  request_body?: Record<string, unknown>;
  response_body?: Record<string, unknown>;
}

export const log = async (entry: AuditLogEntry): Promise<boolean> => {
  try {
    const { error } = await supabase.from('audit_logs').insert([entry]);

    if (error) {
      logger.error({ error }, 'Failed to insert audit log');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error }, 'Error logging audit entry');
    return false;
  }
};

export const listByCustomer = async (
  customerId: string,
  limit: number = 100,
  offset: number = 0
): Promise<AuditLogEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error({ error }, 'Failed to list audit logs');
      return [];
    }

    return (data || []) as AuditLogEntry[];
  } catch (error) {
    logger.error({ error }, 'Error listing audit logs');
    return [];
  }
};

export const listByTraceId = async (traceId: string): Promise<AuditLogEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('trace_id', traceId);

    if (error) {
      logger.error({ error }, 'Failed to list audit logs by trace ID');
      return [];
    }

    return (data || []) as AuditLogEntry[];
  } catch (error) {
    logger.error({ error }, 'Error listing audit logs by trace ID');
    return [];
  }
};
