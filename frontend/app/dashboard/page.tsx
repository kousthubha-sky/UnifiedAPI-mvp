'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type ApiKey } from '@/lib/auth-context';
import { useMetrics } from '@/lib/use-metrics';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import Tabs, { type Tab } from '@/components/ui/Tabs';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

const tabs: Tab[] = [
  { id: 'api-keys', label: 'API Keys', icon: '🔑' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'usage', label: 'Usage Analytics', icon: '📊' },
];

export default function Dashboard() {
  const router = useRouter();
  const { 
    user, 
    session,
    customer, 
    apiKeys, 
    loading: authLoading,
    generateApiKey,
    revokeApiKey,
    deleteApiKey,
    updateCustomer,
    signOut,
  } = useAuth();
  const { metrics, loading: metricsLoading } = useMetrics(session?.access_token ?? null);

  const [activeTab, setActiveTab] = useState('api-keys');
  const [generating, setGenerating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Settings form state
  const [stripeAccountId, setStripeAccountId] = useState('');
  const [paypalAccountId, setPaypalAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  // Clerk handles authentication redirects

  useEffect(() => {
    if (customer) {
      setStripeAccountId(customer.stripe_account_id || '');
      setPaypalAccountId(customer.paypal_account_id || '');
    }
  }, [customer]);

  const handleGenerateKey = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setNewKey(null);

    const { key, error } = await generateApiKey(newKeyName || undefined);
    
    if (error) {
      setError(error);
    } else if (key) {
      setNewKey(key);
      setSuccess('API key generated successfully! Copy it now - you won\'t be able to see it again.');
      setNewKeyName('');
    }
    
    setGenerating(false);
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    const { error } = await revokeApiKey(id);
    if (error) {
      setError(error);
    } else {
      setSuccess('API key revoked successfully');
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    const { error } = await deleteApiKey(id);
    if (error) {
      setError(error);
    } else {
      setSuccess('API key deleted successfully');
    }
  };

  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
      setSuccess('Settings saved successfully');
    }
    
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Dashboard Header */}
      <div className="bg-[#000000] ">
        <div className="max-w-5xl pt-15 mx-auto border-b border-[#222] px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white font-mono">Dashboard</h1>
              <p className="text-gray-400 mt-1 font-mono text-sm">
                Manage your API keys, settings, and view usage analytics
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 font-mono">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-400 hover:text-primary transition-colors font-mono"
              >
                Sign out
              </button>
            </div>
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
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} className="mb-8" />

        {/* Tab Content */}
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
                    <p className="text-white font-mono">{user.email}</p>
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
                <CardTitle className="text-white font-mono">Payment Provider Credentials</CardTitle>
                <CardDescription className="font-mono">
                  Configure your payment provider account IDs for routing payments.
                </CardDescription>
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