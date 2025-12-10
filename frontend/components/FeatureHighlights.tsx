'use client';

'use client';

import { SignUpButton } from '@clerk/nextjs';

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
    color: 'bg-primary',
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

// Code Comparison Component
const CodeComparison = () => {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Without OneRouter */}
      <div className="terminal-window border-[#ff3366]">
        <div className="bg-[#1a1a1a] px-4 py-2 border-b rounded-t-xl border-[#ff3366]">
          <span className="text-xs font-mono text-[#ff3366]">❌ Without OneRouter</span>
        </div>
        <pre className="p-4 text-xs font-mono bg-[#080808] text-white overflow-x-auto">
{`// Multiple SDK imports
import Stripe from 'stripe';
import { PayPal } from 'paypal-sdk';

// Multiple configurations
const stripe = new Stripe(KEY);
const paypal = new PayPal(CONFIG);

// Different API patterns
await stripe.charges.create({...});
await paypal.payments.create({...});`}
        </pre>
      </div>

      {/* With OneRouter */}
      <div className="terminal-window border-primary">
        <div className="bg-[#1a1a1a] px-4 py-2 border-b rounded-t-xl border-primary">
          <span className="text-xs font-mono text-primary">✓ With OneRouter</span>
        </div>
        <pre className="p-4 text-xs font-mono bg-[#080808] text-white overflow-x-auto">
{`// Single import
import { OneRouter } from '@OneRouter/sdk';

// Single configuration
const hub = new OneRouter({ apiKey });

// Unified API pattern
await hub.payments.create({...});`}
        </pre>
      </div>
    </div>
  );
};

export default function FeatureHighlights() {
  return (
    <>
      {/* Why OneRouter Section */}
      <section className="w-full py-20 md:py-28 bg-[#050505] px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="px-4 py-2 bg-[#1a1a1a] border border-primary rounded-full text-sm font-medium text-primary font-mono">
              Why OneRouter
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-6 mb-4 font-mono">
              Built for Developer <span className="text-primary">Productivity</span>
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto font-mono">
              We&apos;ve handled the complexity so you can focus on building your product.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {highlights.map((highlight) => (
              <div
                key={highlight.title}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-2xl transform group-hover:scale-105 transition-transform duration-300 opacity-0 group-hover:opacity-100" />
                
                <div className="relative card card-hover p-8">
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${highlight.color} text-black mb-6`}>
                    {highlight.icon}
                  </div>

                  <div className="text-sm font-medium text-primary uppercase tracking-wide mb-2 font-mono">
                    {highlight.subtitle}
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-3 font-mono">
                    {highlight.title}
                  </h3>

                  <p className="text-gray-400 leading-relaxed font-mono text-sm">
                    {highlight.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Comparison Section */}
      <section className="w-full py-20 bg-black px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4 font-mono text-white">
            The <span className="text-[#ff3366]">Difference</span>
          </h2>
          <p className="text-gray-400 text-center mb-12 font-mono">
            See how much simpler your code becomes
          </p>

          <CodeComparison />
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-20 bg-[#050505] px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-white to-white rounded-2xl p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl md:text-3xl font-bold mb-4 text-black font-mono">
                  Ready to <span className="text-primary">Simplify</span>?
                </h3>
                <p className="text-black/80 mb-6 font-mono">
                  Join thousands of developers who trust OneRouter for their payment infrastructure.
                </p>
                 <div className="flex flex-col sm:flex-row gap-4">
                   <SignUpButton>
                     <button className="inline-flex items-center justify-center px-6 py-3 bg-black text-primary font-bold rounded-lg hover:bg-gray-900 transition-colors font-mono">
                       Start Free Trial
                     </button>
                   </SignUpButton>
                  <a
                    href="/docs"
                    className="inline-flex items-center justify-center px-6 py-3 border-2 border-black text-black font-bold rounded-lg hover:bg-black hover:text-primary transition-colors font-mono"
                  >
                    View Documentation
                  </a>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="bg-black/20 rounded-lg p-6 font-mono text-sm">
                  <div className="text-black/60 mb-2"># Install the SDK</div>
                  <div className="text-black font-bold">npm install @OneRouter/sdk</div>
                  <div className="text-black/60 mt-4 mb-2"># Create a payment</div>
                  <div className="text-black">
                    <span className="text-black/80">const</span> payment = <span className="text-black/80">await</span> hub.payments.create(&#123;
                  </div>
                  <div className="text-black pl-4">amount: <span className="text-yellow-600">2999</span>,</div>
                  <div className="text-black pl-4">currency: <span className="text-yellow-600">&apos;USD&apos;</span></div>
                  <div className="text-black">&#125;);</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}