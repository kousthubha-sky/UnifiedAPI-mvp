// Test SDK integration with backend
import { UnifiedAPIClient } from './dist/index.js';

async function testSDK() {
  console.log('Testing SDK integration with backend...');

  // Create client with test API key
  const client = new UnifiedAPIClient({
    apiKey: 'sk_test_123456789', // Test key
    baseUrl: 'http://localhost:8000',
  });

  try {
    // Test health check
    console.log('Testing health check...');
    const health = await client.health();
    console.log('✅ Health check passed:', health);

    // Test payment creation (will fail without proper auth, but should get proper error)
    console.log('Testing payment creation...');
    try {
      const payment = await client.payments.create({
        amount: 1000,
        currency: 'usd',
        description: 'Test payment'
      });
      console.log('✅ Payment created:', payment);
    } catch (error) {
      console.log('Expected auth error:', error.message);
    }

  } catch (error) {
    console.error('❌ SDK test failed:', error);
  }
}

testSDK();