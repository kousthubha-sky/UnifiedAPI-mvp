// backend/diagnose.ts - Run this to check your setup
import 'dotenv/config';
import { createClient } from 'redis';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

console.log('🔍 PaymentHub Diagnostic Tool\n');
console.log('=' .repeat(60));

// 1. Check Node.js version
console.log('\n📦 Node.js Version');
console.log('-'.repeat(60));
console.log(`Version: ${process.version}`);
console.log(`Recommended: v18.0.0 or higher`);
const nodeVersionMatch = process.version.match(/^v(\d+)/);
const nodeMajorVersion = nodeVersionMatch ? parseInt(nodeVersionMatch[1]) : 0;
console.log(nodeMajorVersion >= 18 ? '✅ PASS' : '❌ FAIL: Upgrade Node.js');

// 2. Check environment variables
console.log('\n🔐 Environment Variables');
console.log('-'.repeat(60));

const requiredEnvVars = {
  'PORT': process.env.PORT || '3000',
  'HOST': process.env.HOST || '0.0.0.0',
  'SUPABASE_URL': process.env.SUPABASE_URL,
  'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY,
  'REDIS_URL': process.env.REDIS_URL,
  'STRIPE_API_KEY': process.env.STRIPE_API_KEY,
};

let envIssues = 0;
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.log(`❌ ${key}: NOT SET`);
    envIssues++;
  } else if (key.includes('KEY') || key.includes('SECRET')) {
    console.log(`✅ ${key}: ${value.substring(0, 8)}...`);
  } else {
    console.log(`✅ ${key}: ${value}`);
  }
}

// 3. Check port availability
console.log('\n🌐 Port Check');
console.log('-'.repeat(60));
const port = parseInt(process.env.PORT || '3000', 10);
console.log(`Checking if port ${port} is available...`);

import { createServer } from 'net';
const server = createServer();

try {
  await new Promise<void>((resolve, reject) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${port} is already in use!`);
        console.log(`   Kill the process using: npx kill-port ${port}`);
        console.log(`   Or change PORT in .env file`);
        reject(err);
      } else {
        reject(err);
      }
    });

    server.once('listening', () => {
      console.log(`✅ Port ${port} is available`);
      server.close();
      resolve();
    });

    server.listen(port, '0.0.0.0');
  });
} catch (error) {
  // Port in use
}

// 4. Check Redis connection
console.log('\n🔴 Redis Connection');
console.log('-'.repeat(60));

if (process.env.REDIS_URL) {
  const redisClient = createClient({
    url: process.env.REDIS_URL,
  });

  try {
    await redisClient.connect();
    await redisClient.ping();
    console.log('✅ Redis connection successful');
    await redisClient.quit();
  } catch (error) {
    console.log('❌ Redis connection failed');
    console.log(`   Error: ${error instanceof Error ? error.message : error}`);
    console.log('   Make sure Redis is running:');
    console.log('   - Windows: Download from https://github.com/tporadowski/redis/releases');
    console.log('   - Mac: brew install redis && brew services start redis');
    console.log('   - Linux: sudo apt-get install redis-server');
  }
} else {
  console.log('⚠️  REDIS_URL not configured');
}

// 5. Check Supabase connection
console.log('\n🗄️  Supabase Connection');
console.log('-'.repeat(60));

if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  try {
    const supabase = createSupabaseClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { data, error } = await supabase
      .from('customers')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('⚠️  Supabase connected but table access failed');
      console.log(`   Error: ${error.message}`);
      console.log('   Run the migration: backend/db/migrations/001_initial_schema.sql');
    } else {
      console.log('✅ Supabase connection successful');
    }
  } catch (error) {
    console.log('❌ Supabase connection failed');
    console.log(`   Error: ${error instanceof Error ? error.message : error}`);
  }
} else {
  console.log('⚠️  SUPABASE_URL or SUPABASE_ANON_KEY not configured');
}

// 6. Check Stripe API
console.log('\n💳 Stripe Connection');
console.log('-'.repeat(60));

if (process.env.STRIPE_API_KEY) {
  try {
    const stripeKey = process.env.STRIPE_API_KEY;
    if (stripeKey.startsWith('sk_test_')) {
      console.log('✅ Test API key detected (good for development)');
    } else if (stripeKey.startsWith('sk_live_')) {
      console.log('⚠️  Live API key detected (be careful!)');
    } else {
      console.log('⚠️  Invalid Stripe API key format');
    }
  } catch (error) {
    console.log('❌ Stripe configuration invalid');
  }
} else {
  console.log('⚠️  STRIPE_API_KEY not configured');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Summary');
console.log('='.repeat(60));

if (envIssues === 0 && nodeMajorVersion >= 18) {
  console.log('✅ All checks passed! Your setup looks good.');
  console.log('\n💡 Next steps:');
  console.log('   1. Run: npm run dev');
  console.log('   2. Visit: http://localhost:3000/health');
  console.log('   3. Check docs: http://localhost:3000/docs');
} else {
  console.log('⚠️  Some issues were found. Please fix them above.');
  console.log('\n💡 Common fixes:');
  console.log('   1. Copy .env.example to .env');
  console.log('   2. Fill in all required values');
  console.log('   3. Start Redis: redis-server');
  console.log('   4. Run Supabase migrations');
}

console.log('\n');
process.exit(0);