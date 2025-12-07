// backend/debug-server.ts
// Run with: npx tsx debug-server.ts
import 'dotenv/config';


console.log('🔍 Starting debug server...\n');

// Catch all unhandled errors
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

console.log('✅ Error handlers registered');

// Test imports one by one
console.log('\n📦 Testing imports...');

try {
  console.log('  1. dotenv/config...');
  await import('dotenv/config');
  console.log('  ✅ dotenv imported');
} catch (error) {
  console.error('  ❌ dotenv failed:', error);
  process.exit(1);
}

try {
  console.log('  2. Fastify...');
  const { default: Fastify } = await import('fastify');
  console.log('  ✅ Fastify imported');
} catch (error) {
  console.error('  ❌ Fastify failed:', error);
  process.exit(1);
}

try {
  console.log('  3. Logger...');
  const { default: logger } = await import('./src/utils/logger.js');
  console.log('  ✅ Logger imported');
  logger.info('Logger test');
} catch (error) {
  console.error('  ❌ Logger failed:', error);
  process.exit(1);
}

try {
  console.log('  4. Cache...');
  const { initCache } = await import('./src/utils/cache.js');
  console.log('  ✅ Cache module imported');
} catch (error) {
  console.error('  ❌ Cache failed:', error);
  process.exit(1);
}

try {
  console.log('  5. Supabase...');
  const { default: supabase } = await import('./src/utils/supabase.js');
  console.log('  ✅ Supabase imported');
} catch (error) {
  console.error('  ❌ Supabase failed:', error);
  process.exit(1);
}

// Now try to start the actual server
console.log('\n🚀 Starting actual server...\n');

try {
  const { startServer } = await import('./src/server.js');
  console.log('✅ Server module imported');
  
  await startServer();
  console.log('✅ startServer() called');
} catch (error) {
  console.error('❌ Server start failed:', error);
  if (error instanceof Error) {
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
  process.exit(1);
}

// Keep alive
console.log('\n✅ Server should be running now...');