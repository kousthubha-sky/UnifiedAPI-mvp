'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function SetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customer, updateCustomer } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Check for success/error parameters from OAuth callback
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success) {
      setSuccess('Stripe account connected successfully!');
    } else if (error) {
      setError(`Connection failed: ${error}`);
    }
  }, [searchParams]);

  const handleStripeConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      // Redirect to backend OAuth endpoint
      window.location.href = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/customers/oauth/stripe/connect`;
    } catch (err) {
      setError('Failed to initiate Stripe connection');
      setLoading(false);
    }
  };

  const handlePayPalConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      // In a real implementation, this would redirect to PayPal's OAuth flow
      // For MVP, we'll simulate by setting a mock account ID
      const mockAccountId = `merchant_mock_${Date.now()}`;

      const { error } = await updateCustomer({
        paypal_account_id: mockAccountId,
      });

      if (error) {
        setError(error);
      } else {
        setSuccess('PayPal account connected successfully!');
        setTimeout(() => router.push('/dashboard'), 2000);
      }
    } catch (err) {
      setError('Failed to connect PayPal account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-[#000000]">
        <div className="max-w-5xl pt-15 mx-auto border-b border-[#222] px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white font-mono">Payment Setup</h1>
              <p className="text-gray-400 mt-1 font-mono text-sm">
                Connect your payment providers to start processing payments
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-400 hover:text-primary transition-colors font-mono"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <Alert
            type="error"
            message={error}
            onDismiss={() => setError(null)}
            className="mb-6"
          />
        )}
        {success && (
          <Alert
            type="success"
            message={success}
            onDismiss={() => setSuccess(null)}
            className="mb-6"
          />
        )}

        {/* Setup Options */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Stripe Connect */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white font-mono flex items-center gap-2">
                    <span className="text-2xl">💳</span>
                    Stripe Connect
                  </CardTitle>
                  <CardDescription className="font-mono">
                    Connect your Stripe account for seamless payment processing
                  </CardDescription>
                </div>
                {customer?.stripe_account_id && (
                  <Badge className="font-mono">✅ Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-gray-300 font-mono">
                  <p className="mb-2">Benefits:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li>Automatic payment routing</li>
                    <li>Webhook handling</li>
                    <li>Secure key management</li>
                    <li>Real-time status updates</li>
                  </ul>
                </div>

                {customer?.stripe_account_id ? (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-sm text-green-400 font-mono">
                      Connected to Stripe account: {customer.stripe_account_id}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleStripeConnect}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-[#635bff] text-white font-bold rounded-lg hover:bg-[#5a52e8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-mono"
                  >
                    {loading ? <LoadingSpinner size="sm" className="border-white border-t-transparent mr-2" /> : null}
                    Connect Stripe Account
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* PayPal Connect */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white font-mono flex items-center gap-2">
                    <span className="text-2xl">🅿️</span>
                    PayPal Connect
                  </CardTitle>
                  <CardDescription className="font-mono">
                    Connect your PayPal business account
                  </CardDescription>
                </div>
                {customer?.paypal_account_id && (
                  <Badge className="font-mono">✅ Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-gray-300 font-mono">
                  <p className="mb-2">Benefits:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li>PayPal payment processing</li>
                    <li>Express Checkout integration</li>
                    <li>Global payment acceptance</li>
                    <li>Buyer protection</li>
                  </ul>
                </div>

                {customer?.paypal_account_id ? (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-sm text-green-400 font-mono">
                      Connected to PayPal account: {customer.paypal_account_id}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handlePayPalConnect}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-[#0070ba] text-white font-bold rounded-lg hover:bg-[#003087] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-mono"
                  >
                    {loading ? <LoadingSpinner size="sm" className="border-white border-t-transparent mr-2" /> : null}
                    Connect PayPal Account
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* BYOK Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-white font-mono flex items-center gap-2">
              <span className="text-2xl">🔑</span>
              Bring Your Own Keys (BYOK)
            </CardTitle>
            <CardDescription className="font-mono">
              Already have payment provider accounts? Enter your credentials directly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4 font-mono">
                For advanced users who prefer to manage their own API keys
              </p>
              <button
                onClick={() => router.push('/dashboard?tab=settings')}
                className="px-6 py-3 bg-primary text-black font-bold rounded-lg hover:bg-[#00dd77] transition-colors font-mono"
              >
                Configure API Keys →
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-white font-mono">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-white mb-2 font-mono">Stripe Setup</h4>
                <p className="text-sm text-gray-400 font-mono mb-3">
                  Learn how to set up your Stripe account for Connect.
                </p>
                <a
                  href="https://stripe.com/docs/connect"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-mono text-sm"
                >
                  Stripe Connect Documentation →
                </a>
              </div>
              <div>
                <h4 className="font-medium text-white mb-2 font-mono">PayPal Setup</h4>
                <p className="text-sm text-gray-400 font-mono mb-3">
                  Learn how to set up your PayPal business account.
                </p>
                <a
                  href="https://developer.paypal.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-mono text-sm"
                >
                  PayPal Developer Documentation →
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}