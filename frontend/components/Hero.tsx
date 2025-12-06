'use client';

import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative w-full py-20 md:py-28 lg:py-36 px-4 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto text-center">
        <div className="mb-6 inline-block">
          <span className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-primary">
            🚀 Unified Payment Processing API
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Accept Payments with
          <span className="text-primary"> Confidence</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
          Simplify your payment infrastructure with our unified API. Integrate Stripe, PayPal, and more
          through a single, secure endpoint. From setup to first payment in under 5 minutes.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-8 py-4 bg-primary text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg shadow-lg shadow-primary/25"
          >
            Get Started Free
            <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center px-8 py-4 border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-lg"
          >
            <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            View Documentation
          </Link>
        </div>

        {/* Code preview */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-800">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="ml-2 text-gray-400 text-sm">payment.ts</span>
            </div>
            <pre className="p-6 text-left text-sm overflow-x-auto">
              <code className="text-gray-300">
                <span className="text-purple-400">import</span>{' '}
                <span className="text-gray-100">{'{ PaymentHub }'}</span>{' '}
                <span className="text-purple-400">from</span>{' '}
                <span className="text-green-400">&apos;@paymenthub/sdk&apos;</span>;{'\n\n'}
                <span className="text-purple-400">const</span>{' '}
                <span className="text-gray-100">client</span> ={' '}
                <span className="text-purple-400">new</span>{' '}
                <span className="text-yellow-400">PaymentHub</span>(<span className="text-green-400">&apos;pk_live_xxx&apos;</span>);{'\n\n'}
                <span className="text-purple-400">const</span>{' '}
                <span className="text-gray-100">payment</span> ={' '}
                <span className="text-purple-400">await</span>{' '}
                <span className="text-gray-100">client.payments.</span>
                <span className="text-yellow-400">create</span>({'{'}
                {'\n'}  <span className="text-gray-100">amount:</span>{' '}
                <span className="text-orange-400">2999</span>,{' '}
                <span className="text-gray-500">// $29.99 in cents</span>
                {'\n'}  <span className="text-gray-100">currency:</span>{' '}
                <span className="text-green-400">&apos;USD&apos;</span>,
                {'\n'}  <span className="text-gray-100">provider:</span>{' '}
                <span className="text-green-400">&apos;stripe&apos;</span>
                {'\n'}{'}'});
              </code>
            </pre>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary mb-2">99.99%</div>
            <p className="text-gray-600">Uptime SLA</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary mb-2">250K+</div>
            <p className="text-gray-600">Transactions/Day</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary mb-2">&lt;100ms</div>
            <p className="text-gray-600">Avg. Latency</p>
          </div>
        </div>

        {/* Trusted by */}
        <div className="mt-16 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-6">Trusted by innovative companies worldwide</p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-50">
            <div className="text-xl font-bold text-gray-400">TechFlow</div>
            <div className="text-xl font-bold text-gray-400">ShopScale</div>
            <div className="text-xl font-bold text-gray-400">StartupXYZ</div>
            <div className="text-xl font-bold text-gray-400">MegaCommerce</div>
            <div className="text-xl font-bold text-gray-400">DevAgency</div>
          </div>
        </div>
      </div>
    </section>
  );
}
