'use client';

const highlights = [
  {
    title: 'One API',
    subtitle: 'Unified Integration',
    description: 'Connect to Stripe, PayPal, and more through a single, consistent API. No need to learn multiple payment provider interfaces.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    ),
    color: 'bg-blue-500',
  },
  {
    title: 'Auto Retry',
    subtitle: 'Smart Recovery',
    description: 'Automatic exponential backoff with intelligent retry logic. Never lose a payment due to temporary network issues.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    color: 'bg-green-500',
  },
  {
    title: 'Fast Setup',
    subtitle: '5-Minute Integration',
    description: 'From signup to first payment in under 5 minutes. Comprehensive SDKs, copy-paste examples, and clear documentation.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: 'bg-purple-500',
  },
];

export default function FeatureHighlights() {
  return (
    <section className="w-full py-20 md:py-28 bg-white px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-primary">
            Why PaymentHub
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-6 mb-4">
            Built for Developer Productivity
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            We&apos;ve handled the complexity so you can focus on building your product.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {highlights.map((highlight) => (
            <div
              key={highlight.title}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl transform group-hover:scale-105 transition-transform duration-300 opacity-0 group-hover:opacity-100" />
              
              <div className="relative bg-white border border-gray-200 rounded-2xl p-8 hover:border-primary/50 transition-colors">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${highlight.color} text-white mb-6`}>
                  {highlight.icon}
                </div>

                <div className="text-sm font-medium text-primary uppercase tracking-wide mb-2">
                  {highlight.subtitle}
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {highlight.title}
                </h3>

                <p className="text-gray-600 leading-relaxed">
                  {highlight.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-gradient-to-r from-primary to-secondary rounded-2xl p-8 md:p-12 text-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold mb-4">
                Ready to Simplify Your Payments?
              </h3>
              <p className="text-blue-100 mb-6">
                Join thousands of developers who trust PaymentHub for their payment infrastructure.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="/signup"
                  className="inline-flex items-center justify-center px-6 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Start Free Trial
                </a>
                <a
                  href="/docs"
                  className="inline-flex items-center justify-center px-6 py-3 border border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
                >
                  View Documentation
                </a>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="bg-white/10 rounded-lg p-6 font-mono text-sm">
                <div className="text-blue-200 mb-2"># Install the SDK</div>
                <div className="text-white">npm install @paymenthub/sdk</div>
                <div className="text-blue-200 mt-4 mb-2"># Create a payment</div>
                <div className="text-white">
                  <span className="text-green-300">const</span> payment = <span className="text-green-300">await</span> client.payments.create(&#123;
                </div>
                <div className="text-white pl-4">amount: <span className="text-yellow-300">1000</span>,</div>
                <div className="text-white pl-4">currency: <span className="text-yellow-300">&apos;USD&apos;</span>,</div>
                <div className="text-white pl-4">provider: <span className="text-yellow-300">&apos;stripe&apos;</span></div>
                <div className="text-white">&#125;);</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
