'use client';

import { useState, useEffect } from 'react';
import { apiClient, type ApiResponse } from '@/lib/api';
import { fetchApiKeys, type ApiKeyRecord } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface GeneratedKey {
  id: string;
  key: string;
}

export default function Dashboard() {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const keys = await fetchApiKeys();
      setApiKeys(keys);
    } catch (err) {
      setError('Failed to load API keys');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async (): Promise<void> => {
    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);

      const response = (await apiClient.generateApiKey()) as ApiResponse<GeneratedKey>;

      if (response.error) {
        setError(response.error);
        return;
      }

      if (response.data) {
        setSuccess(`API key generated successfully: ${response.data.key}`);
        await loadApiKeys();
      }
    } catch (err) {
      setError('Failed to generate API key');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (key: string, id: string): void => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your API keys and access credentials</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Generate New API Key</h2>
          <p className="text-gray-600 text-sm mb-6">
            Create a new API key to access the payment processing endpoints.
          </p>
          <button
            onClick={handleGenerateKey}
            disabled={generating}
            className="inline-flex items-center justify-center px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? 'Generating...' : 'Generate API Key'}
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Your API Keys</h2>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-600">Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="p-6 text-center text-gray-600">
              <p>No API keys yet. Generate one to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {apiKey.key.substring(0, 10)}...{apiKey.key.substring(apiKey.key.length - 6)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {new Date(apiKey.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopy(apiKey.key, apiKey.id)}
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      {copiedId === apiKey.id ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
