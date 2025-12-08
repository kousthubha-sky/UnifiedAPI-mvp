'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithMagicLink, loading: authLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authMode, setAuthMode] = useState<'password' | 'magic'>('password');

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await signIn(email, password);
    
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await signInWithMagicLink(email);
    
    if (error) {
      setError(error);
    } else {
      setMagicLinkSent(true);
    }
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-[#0a0a0a] border border-primary rounded-xl shadow-lg shadow-primary/20 p-8 text-center">
            <div className="h-16 w-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary">
              <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 font-mono">Check your email</h2>
            <p className="text-gray-400 mb-6 font-mono text-sm">
              We&apos;ve sent a magic link to <strong className="text-primary">{email}</strong>. Click the link in the email to sign in.
            </p>
            <button
              onClick={() => {
                setMagicLinkSent(false);
                setEmail('');
              }}
              className="text-primary hover:text-[#00dd77] transition-colors font-mono text-sm"
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0a0a0a_1px,transparent_1px),linear-gradient(to_bottom,#0a0a0a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
      
      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-primary hover:text-[#00dd77] transition-colors font-mono">
            OneRouter
          </Link>
          <h1 className="text-2xl font-bold text-white mt-6 font-mono">Welcome back</h1>
          <p className="text-gray-400 mt-2 font-mono text-sm">Sign in to your account to continue</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#222] rounded-xl shadow-lg p-8">
          {error && (
            <Alert
              type="error"
              message={error}
              onDismiss={() => setError(null)}
              className="mb-6"
            />
          )}

          {/* Auth mode toggle */}
          <div className="flex mb-6 bg-[#1a1a1a] rounded-lg p-1 border border-[#222]">
            <button
              onClick={() => setAuthMode('password')}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors font-mono ${
                authMode === 'password'
                  ? 'bg-primary text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Password
            </button>
            <button
              onClick={() => setAuthMode('magic')}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors font-mono ${
                authMode === 'magic'
                  ? 'bg-primary text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Magic Link
            </button>
          </div>

          <form onSubmit={authMode === 'password' ? handlePasswordLogin : handleMagicLinkLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1 font-mono">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#222] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                  placeholder="you@example.com"
                  required
                />
              </div>

              {authMode === 'password' && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-1 font-mono">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#222] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-black font-bold rounded-lg hover:bg-[#00dd77] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-mono"
              >
                {loading ? (
                  <LoadingSpinner size="sm" className="border-black border-t-transparent" />
                ) : authMode === 'password' ? (
                  'Sign In'
                ) : (
                  'Send Magic Link'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm font-mono">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-primary font-bold hover:text-[#00dd77] transition-colors">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-8 font-mono">
          By signing in, you agree to our{' '}
          <a href="#" className="text-primary hover:text-[#00dd77] transition-colors">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-primary hover:text-[#00dd77] transition-colors">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}