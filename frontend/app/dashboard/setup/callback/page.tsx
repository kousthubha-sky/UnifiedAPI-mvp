'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const error = searchParams.get('error');
      const success = searchParams.get('success');

      if (error) {
        setStatus('error');
        setMessage(`Connection failed: ${error}`);
      } else if (success) {
        setStatus('success');
        setMessage('Stripe account connected successfully!');
        // Redirect to dashboard after success
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setStatus('error');
        setMessage('Invalid callback parameters');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-white font-mono text-center">
            {status === 'loading' && 'Connecting...'}
            {status === 'success' && '✅ Connected!'}
            {status === 'error' && '❌ Connection Failed'}
          </CardTitle>
          <CardDescription className="text-center font-mono">
            {status === 'loading' && 'Please wait while we connect your Stripe account'}
            {status === 'success' && 'Your Stripe account has been successfully connected'}
            {status === 'error' && 'There was an error connecting your Stripe account'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'loading' && (
            <div className="flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          )}
          {status === 'success' && (
            <div className="text-primary font-mono">
              Redirecting to dashboard...
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <Alert type="error" message={message} />
              <button
                onClick={() => router.push('/dashboard/setup')}
                className="w-full px-4 py-2 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors font-mono"
              >
                Try Again
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}