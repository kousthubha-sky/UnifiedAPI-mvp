'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, ApiKey } from '@/lib/auth-context';
import { useMetrics } from '@/lib/use-metrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PaymentStatus from '@/components/PaymentStatus';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  customer_email?: string;
  customer_name?: string;
  provider: string;
  created_at: string;
}

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
  services?: {
    api?: { status: 'ok' | 'error' };
    auth?: { status: 'ok' | 'error' };
    payments?: { status: 'ok' | 'error' };
    customers?: { status: 'ok' | 'error' };
  };
}

export default function DashboardPage() {
  const { user, customer, apiKeys, generateApiKey, revokeApiKey, deleteApiKey, updateCustomer } = useAuth();
  const { metrics, loading: metricsLoading } = useMetrics(user?.id || null);

  const [activeTab, setActiveTab] = useState('payments');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // API Keys state
  const [newKeyName, setNewKeyName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Settings state
  const [stripeAccountId, setStripeAccountId] = useState(customer?.stripe_account_id || '');
  const [paypalAccountId, setPaypalAccountId] = useState(customer?.paypal_account_id || '');
  const [saving, setSaving] = useState(false);

  // Health check state
  const [healthCheck, setHealthCheck] = useState<HealthCheckResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Payments state
  const [paymentStats, setPaymentStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    successRate: 0,
    recentPayments: [] as Payment[],
  });
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const tabs = [
    { id: 'payments', label: 'Payments' },
    { id: 'api-keys', label: 'API Keys' },
    { id: 'settings', label: 'Settings' },
    { id: 'usage', label: 'Usage' },
    { id: 'health', label: 'Health' },
  ];

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPaymentStats();
    }
  }, [activeTab]);

  // Update settings when customer changes
  useEffect(() => {
    if (customer) {
      setStripeAccountId(customer.stripe_account_id || '');
      setPaypalAccountId(customer.paypal_account_id || '');
    }
  }, [customer]);

  const fetchPaymentStats = async () => {
    setPaymentsLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/payments?limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt') || ''}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setPaymentStats({
          totalPayments: data.data.total || 0,
          totalAmount: calculateTotal(data.data.data || []),
          successRate: calculateSuccessRate(data.data.data || []),
          recentPayments: data.data.data || [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch payment stats:', error);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const calculateTotal = (payments: Payment[]) => {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  };

  const calculateSuccessRate = (payments: Payment[]) => {
    if (payments.length === 0) return 0;
    const succeeded = payments.filter((p) => p.status === 'succeeded').length;
    return Math.round((succeeded / payments.length) * 100);
  };

  // API Key handlers
  const handleGenerateKey = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);

    const { key, error } = await generateApiKey(newKeyName || undefined);
    if (error) {
      setError(error);
    } else if (key) {
      setNewKey(key);
      setSuccess('API key generated successfully!');
      setNewKeyName('');
    }
    setGenerating(false);
  };

  const handleCopyKey = async (key: string, id: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRevokeKey = async (id: string) => {
    const { error } = await revokeApiKey(id);
    if (error) {
      setError(error);
    } else {
      setSuccess('API key revoked successfully!');
    }
  };

  const handleDeleteKey = async (id: string) => {
    const { error } = await deleteApiKey(id);
    if (error) {
      setError(error);
    } else {
      setSuccess('API key deleted successfully!');
    }
  };

  // Settings handlers
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error } = await updateCustomer({
      stripe_account_id: stripeAccountId || undefined,
      paypal_account_id: paypalAccountId || undefined,
    });

    if (error) {
      setError(error);
    } else {
      setSuccess('Settings saved successfully!');
    }
    setSaving(false);
  };

  // Health check handler
  const performHealthCheck = async () => {
    setHealthLoading(true);
    setHealthCheck(null);

    try {
      const startTime = Date.now();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/health`);
      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        setHealthCheck({
          status: 'healthy',
          latency,
          services: data.services,
        });
      } else {
        setHealthCheck({
          status: 'unhealthy',
          latency,
          error: `HTTP ${response.status}`,
        });
      }
    } catch (err) {
      setHealthCheck({
        status: 'unhealthy',
        error: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setHealthLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-card border-b border-muted">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white font-mono">Dashboard</h1>
              <p className="text-muted mt-1 font-mono text-sm">
                Welcome back, {user?.primaryEmailAddress?.emailAddress || 'User'}
              </p>
            </div>
            <PaymentStatus />
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

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-muted">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-mono text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            {/* Payment Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary font-mono">
                      {paymentStats.totalPayments.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-400 mt-1 font-mono">Total Payments</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-500 font-mono">
                      ${(paymentStats.totalAmount / 100).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-400 mt-1 font-mono">Total Amount</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary font-mono">
                      {paymentStats.successRate}%
                    </p>
                    <p className="text-sm text-gray-400 mt-1 font-mono">Success Rate</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary font-mono">
                      {paymentStats.recentPayments.filter(p => p.status === 'succeeded').length}
                    </p>
                    <p className="text-sm text-gray-400 mt-1 font-mono">Recent Successes</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-white font-mono">Quick Actions</CardTitle>
                <CardDescription className="font-mono">
                  Common payment operations and shortcuts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => window.open('/docs', '_blank')}
                    className="p-4 bg-[#1a1a1a] border border-[#222] rounded-lg hover:bg-[#222] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📚</span>
                      <div>
                        <p className="font-medium text-white font-mono">View Docs</p>
                        <p className="text-sm text-gray-400 font-mono">API documentation</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('api-keys')}
                    className="p-4 bg-[#1a1a1a] border border-[#222] rounded-lg hover:bg-[#222] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔑</span>
                      <div>
                        <p className="font-medium text-white font-mono">Manage Keys</p>
                        <p className="text-sm text-gray-400 font-mono">API key management</p>
                      </div>
                    </div>
                  </button>
                  <Link
                    href="/dashboard/setup"
                    className="p-4 bg-[#1a1a1a] border border-[#222] rounded-lg hover:bg-[#222] transition-colors text-left block"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔗</span>
                      <div>
                        <p className="font-medium text-white font-mono">Setup</p>
                        <p className="text-sm text-gray-400 font-mono">Connect providers</p>
                      </div>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Recent Payments Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-white font-mono">Recent Payments</CardTitle>
                <CardDescription className="font-mono">
                  Latest payment transactions and their status.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : paymentStats.recentPayments.length === 0 ? (
                  <EmptyState
                    icon="💳"
                    title="No payments yet"
                    description="Your payment transactions will appear here once you start processing payments."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#222]">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 font-mono">ID</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 font-mono">Amount</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 font-mono">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 font-mono">Provider</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 font-mono">Customer</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 font-mono">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentStats.recentPayments.map((payment) => (
                          <tr key={payment.id} className="border-b border-[#111] hover:bg-[#111]">
                            <td className="py-3 px-4 text-sm text-gray-300 font-mono">
                              {payment.id.slice(-8)}
                            </td>
                            <td className="py-3 px-4 text-sm text-white font-mono">
                              ${(payment.amount / 100).toFixed(2)} {payment.currency.toUpperCase()}
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={payment.status === 'succeeded' ? 'default' :
                                       payment.status === 'failed' ? 'destructive' : 'secondary'}
                                className="font-mono"
                              >
                                {payment.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-300 font-mono capitalize">
                              {payment.provider}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-300 font-mono">
                              {payment.customer_email || payment.customer_name || 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-400 font-mono">
                              {new Date(payment.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'api-keys' && (
          <div className="space-y-6">
            {/* Generate new key */}
            <Card>
              <CardHeader>
                <CardTitle className="text-white font-mono">Generate New API Key</CardTitle>
                <CardDescription className="font-mono">
                  Create a new API key to access the payment processing endpoints.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Key name (optional)"
                    className="flex-1 px-4 py-2 bg-[#1a1a1a] border border-[#222] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                  />
                  <button
                    onClick={handleGenerateKey}
                    disabled={generating}
                    className="px-6 py-2 bg-primary text-black font-bold rounded-lg hover:bg-[#00dd77] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-mono"
                  >
                    {generating ? <LoadingSpinner size="sm" className="border-black border-t-transparent" /> : 'Generate Key'}
                  </button>
                </div>

                {/* New key display */}
                {newKey && (
                  <div className="mt-4 p-4 bg-primary/10 border border-primary rounded-lg">
                    <p className="text-sm text-primary mb-2 font-bold font-mono">
                      🎉 Your new API key (copy it now!):
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-[#0a0a0a] border border-primary rounded text-sm font-mono break-all text-white">
                        {newKey}
                      </code>
                      <button
                        onClick={() => handleCopyKey(newKey, 'new')}
                        className="px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:bg-[#00dd77] transition-colors font-mono"
                      >
                        {copiedId === 'new' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Keys List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-white font-mono">Your API Keys</CardTitle>
              </CardHeader>

              {apiKeys.length === 0 ? (
                <CardContent>
                  <EmptyState
                    icon="🔑"
                    title="No API keys yet"
                    description="Generate your first API key to start making API requests."
                    action={{
                      label: 'Generate API Key',
                      onClick: () => document.querySelector('input')?.focus(),
                    }}
                  />
                </CardContent>
              ) : (
                <div className="divide-y divide-[#222]">
                  {apiKeys.map((apiKey: ApiKey) => (
                    <ApiKeyRow
                      key={apiKey.id}
                      apiKey={apiKey}
                      onRevoke={() => handleRevokeKey(apiKey.id)}
                      onDelete={() => handleDeleteKey(apiKey.id)}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Account Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-white font-mono">Account Information</CardTitle>
                <CardDescription className="font-mono">
                  Your account details and subscription tier.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 font-mono">Email</label>
                    <p className="text-white font-mono">{user?.email || 'Loading...'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 font-mono">Plan</label>
                    <Badge className="capitalize font-mono">
                      {customer?.tier || 'starter'}
                    </Badge>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 font-mono">Customer ID</label>
                    <code className="text-sm text-gray-300 bg-[#1a1a1a] px-2 py-1 rounded font-mono">
                      {customer?.id || user.id}
                    </code>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 font-mono">Member Since</label>
                    <p className="text-white font-mono">
                      {customer?.created_at 
                        ? new Date(customer.created_at).toLocaleDateString()
                        : new Date().toLocaleDateString()
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Provider Credentials */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white font-mono">Payment Provider Credentials</CardTitle>
                    <CardDescription className="font-mono">
                      Configure your payment provider account IDs for routing payments.
                    </CardDescription>
                  </div>
                  <Link
                    href="/dashboard/setup"
                    className="text-primary hover:underline font-mono text-sm"
                  >
                    Setup Guide →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="stripeAccountId" className="block text-sm font-medium text-gray-400 mb-1 font-mono">
                        Stripe Account ID
                      </label>
                      <input
                        id="stripeAccountId"
                        type="text"
                        value={stripeAccountId}
                        onChange={(e) => setStripeAccountId(e.target.value)}
                        placeholder="acct_xxx..."
                        className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#222] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor="paypalAccountId" className="block text-sm font-medium text-gray-400 mb-1 font-mono">
                        PayPal Account ID
                      </label>
                      <input
                        id="paypalAccountId"
                        type="text"
                        value={paypalAccountId}
                        onChange={(e) => setPaypalAccountId(e.target.value)}
                        placeholder="merchant_xxx..."
                        className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#222] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2 bg-primary text-black font-bold rounded-lg hover:bg-[#00dd77] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center font-mono"
                    >
                      {saving ? <LoadingSpinner size="sm" className="border-black border-t-transparent mr-2" /> : null}
                      Save Changes
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary font-mono">
                      {metrics?.total_requests.toLocaleString() || '—'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1 font-mono">Total Requests</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-500 font-mono">
                      {metrics?.total_success.toLocaleString() || '—'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1 font-mono">Successful</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-500 font-mono">
                      {metrics?.total_errors.toLocaleString() || '—'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1 font-mono">Errors</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary font-mono">
                      {metrics?.success_rate ? `${metrics.success_rate.toFixed(1)}%` : '—'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1 font-mono">Success Rate</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-white font-mono">Daily Request Volume</CardTitle>
                <CardDescription className="font-mono">
                  API requests over the last 14 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : metrics?.daily_metrics ? (
                  <UsageChart data={metrics.daily_metrics} />
                ) : (
                  <EmptyState
                    title="No usage data yet"
                    description="Start making API requests to see your usage analytics."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="space-y-6">
            {/* Health Check Button */}
            <Card>
              <CardHeader>
                <CardTitle className="text-white font-mono">System Health Check</CardTitle>
                <CardDescription className="font-mono">
                  Comprehensive health check of the SDK and backend services.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <button
                  onClick={performHealthCheck}
                  disabled={healthLoading}
                  className="px-6 py-2 bg-primary text-black font-bold rounded-lg hover:bg-[#00dd77] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center font-mono"
                >
                  {healthLoading ? <LoadingSpinner size="sm" className="border-black border-t-transparent mr-2" /> : null}
                  Run Health Check
                </button>
              </CardContent>
            </Card>

            {/* Health Status */}
            {healthCheck && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Overall Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-white font-mono">Overall Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Badge variant={healthCheck.status === 'healthy' ? 'default' : 'destructive'} className="font-mono">
                        {healthCheck.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}
                      </Badge>
                      <span className="text-sm text-gray-400 font-mono">
                        {healthCheck.latency ? `${healthCheck.latency}ms` : 'N/A'}
                      </span>
                    </div>
                    {healthCheck.error && (
                      <p className="text-red-400 text-sm mt-2 font-mono">{healthCheck.error}</p>
                    )}
                  </CardContent>
                </Card>

                {/* Service Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-white font-mono">Service Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {healthCheck.services && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 font-mono">API Connectivity</span>
                            <Badge variant={healthCheck.services.api?.status === 'ok' ? 'default' : 'destructive'} className="font-mono">
                              {healthCheck.services.api?.status === 'ok' ? '✅ OK' : '❌ Error'}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 font-mono">Authentication</span>
                            <Badge variant={healthCheck.services.auth?.status === 'ok' ? 'default' : 'destructive'} className="font-mono">
                              {healthCheck.services.auth?.status === 'ok' ? '✅ OK' : '❌ Error'}
                            </Badge>
                          </div>
                          {healthCheck.services.payments && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 font-mono">Payments Service</span>
                              <Badge variant={healthCheck.services.payments.status === 'ok' ? 'default' : 'destructive'} className="font-mono">
                                {healthCheck.services.payments.status === 'ok' ? '✅ OK' : '❌ Error'}
                              </Badge>
                            </div>
                          )}
                          {healthCheck.services.customers && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 font-mono">Customers Service</span>
                              <Badge variant={healthCheck.services.customers.status === 'ok' ? 'default' : 'destructive'} className="font-mono">
                                {healthCheck.services.customers.status === 'ok' ? '✅ OK' : '❌ Error'}
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* SDK Environment Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-white font-mono">SDK Configuration</CardTitle>
                <CardDescription className="font-mono">
                  Current SDK environment and configuration details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 font-mono">Environment</label>
                    <Badge className="font-mono">
                      {typeof window !== 'undefined' && window.location.hostname.includes('.lc') ? 'local' :
                       typeof window !== 'undefined' && window.location.hostname.includes('.st') ? 'staging' :
                       typeof window !== 'undefined' && window.location.hostname.includes('.pr') ? 'production' : 'local'}
                    </Badge>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 font-mono">API Base URL</label>
                    <code className="text-sm text-gray-300 bg-[#1a1a1a] px-2 py-1 rounded font-mono">
                      {process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}
                    </code>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 font-mono">SDK Version</label>
                    <code className="text-sm text-gray-300 bg-[#1a1a1a] px-2 py-1 rounded font-mono">
                      Latest
                    </code>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 font-mono">Features</label>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs font-mono">Interceptors</Badge>
                      <Badge variant="outline" className="text-xs font-mono">Metrics</Badge>
                      <Badge variant="outline" className="text-xs font-mono">Caching</Badge>
                      <Badge variant="outline" className="text-xs font-mono">Compression</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function ApiKeyRow({ 
  apiKey, 
  onRevoke, 
  onDelete 
}: { 
  apiKey: ApiKey; 
  onRevoke: () => void; 
  onDelete: () => void;
}) {
  return (
    <div className="p-6 hover:bg-[#1a1a1a] transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-white font-mono">
              {apiKey.name || 'Unnamed Key'}
            </p>
            <Badge variant={apiKey.is_active ? 'default' : 'secondary'} className="font-mono">
              {apiKey.is_active ? 'Active' : 'Revoked'}
            </Badge>
          </div>
          <p className="text-sm text-gray-400 mt-1 font-mono">
            Created: {new Date(apiKey.created_at).toLocaleDateString()}
            {apiKey.last_used_at && (
              <> · Last used: {new Date(apiKey.last_used_at).toLocaleDateString()}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {apiKey.is_active && (
            <button
              onClick={onRevoke}
              className="px-3 py-1.5 text-sm font-medium text-yellow-400 hover:bg-[#1a1a1a] border border-yellow-400/30 rounded-lg transition-colors font-mono"
            >
              Revoke
            </button>
          )}
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-[#1a1a1a] border border-red-400/30 rounded-lg transition-colors font-mono"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function UsageChart({ data }: { data: { date: string; request_count: number; success_count: number; error_count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.request_count), 1);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary rounded" />
          <span className="text-gray-400 font-mono">Total Requests</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span className="text-gray-400 font-mono">Successful</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span className="text-gray-400 font-mono">Errors</span>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex items-end gap-2 h-48">
        {data.map((day, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col justify-end h-40 relative group">
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1a1a1a] border border-primary text-primary text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-mono">
                {day.request_count} requests
              </div>
              
              {/* Bar */}
              <div
                className="w-full bg-primary/20 rounded-t relative overflow-hidden"
                style={{ height: `${(day.request_count / maxCount) * 100}%` }}
              >
                {/* Success portion */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-green-500"
                  style={{ height: `${(day.success_count / day.request_count) * 100}%` }}
                />
                {/* Error portion */}
                <div
                  className="absolute top-0 left-0 right-0 bg-red-500"
                  style={{ height: `${(day.error_count / day.request_count) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-500 -rotate-45 origin-top-left translate-y-2 font-mono">
              {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}