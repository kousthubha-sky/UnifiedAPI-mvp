'use client';

import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative w-full py-20 md:py-28 lg:py-32 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-6 inline-block">
          <span className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-primary">
            Unified Payment Processing
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
          Accept Payments with Confidence
        </h1>

        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Simplify your payment infrastructure with our unified API. Integrate Stripe, PayPal, and more
          through a single, secure endpoint.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
          <button
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Learn More
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16">
          <div className="p-4 text-center">
            <div className="text-3xl font-bold text-primary mb-2">99.9%</div>
            <p className="text-gray-600 text-sm">Uptime SLA</p>
          </div>
          <div className="p-4 text-center border-l border-r border-gray-200">
            <div className="text-3xl font-bold text-primary mb-2">250K+</div>
            <p className="text-gray-600 text-sm">Transactions/Day</p>
          </div>
          <div className="p-4 text-center">
            <div className="text-3xl font-bold text-primary mb-2">&lt;100ms</div>
            <p className="text-gray-600 text-sm">Avg. Latency</p>
          </div>
        </div>
      </div>
    </section>
  );
}
