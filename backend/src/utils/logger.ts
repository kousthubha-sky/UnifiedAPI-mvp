import * as pino from 'pino';
import * as auditRepository from '../repositories/auditRepository.js';

const isDevelopment = process.env.NODE_ENV === 'development';

const logger: pino.Logger = isDevelopment
  ? pino.pino(
      {
        level: process.env.LOG_LEVEL || 'debug',
      },
      pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      })
    )
  : pino.pino({
      level: process.env.LOG_LEVEL || 'info',
    });

export const auditLog = (action: string, details: Record<string, unknown>) => {
  logger.info({
    type: 'AUDIT',
    action,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

export const auditLogToDatabase = async (entry: auditRepository.AuditLogEntry): Promise<void> => {
  try {
    await auditRepository.log(entry);
  } catch (error) {
    logger.error({ error }, 'Failed to log audit entry to database');
  }
};

export const errorLog = (error: Error | unknown, context: Record<string, unknown> = {}) => {
  if (error instanceof Error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      ...context,
    });
  } else {
    logger.error({
      error: String(error),
      ...context,
    });
  }
};

export default logger;
