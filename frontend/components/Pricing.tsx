'use client';

import Link from 'next/link';
import { SignUpButton } from '@clerk/nextjs';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth-context';

interface PricingTier {
  name: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    description: 'Perfect for small businesses and startups getting started with payments.',
    price: '$0',
    period: '/month',
    features: [
      '1,000 API requests/month',
      '1 API key',
      'Email support',
      'Basic analytics',
      'Stripe integration',
      'Community access',
    ],
    cta: 'Get Started Free',
  },
  {
    name: 'Growth',
    description: 'For growing businesses that need more capacity and features.',
    price: '$49',
    period: '/month',
    features: [
      '50,000 API requests/month',
      '5 API keys',
      'Priority email support',
      'Advanced analytics',
      'Stripe + PayPal integration',
      'Webhook support',
      'Auto-retry mechanism',
      'Team collaboration',
    ],
    highlighted: true,
    cta: 'Start Free Trial',
  },
  {
    name: 'Scale',
    description: 'For enterprises requiring unlimited access and premium support.',
    price: '$199',
    period: '/month',
    features: [
      'Unlimited API requests',
      'Unlimited API keys',
      '24/7 phone & email support',
      'Real-time analytics',
      'All payment providers',
      'Custom webhooks',
      'Dedicated account manager',
      'SLA guarantee (99.99%)',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
  },
];

export default function Pricing() {
  const { user } = useAuth();

  const getCtaLink = (tier: PricingTier) => {
    if (user) {
      return '/dashboard';
    }
    if (tier.name === 'Scale') {
      return '/signup?plan=scale';
    } else if (tier.name === 'Growth') {
      return '/signup?plan=growth';
    }
    return '/signup';
  };

  return (
    <section id="pricing" className="w-full py-20 md:py-28 bg-[#050505] px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="px-4 py-2 bg-[#1a1a1a] border border-primary rounded-full text-sm font-medium text-primary font-mono">
            Simple Pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-6 mb-4 font-mono">
            Choose the Plan That <span className="text-primary">Fits</span> Your Business
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto font-mono">
            Start free and scale as you grow. No hidden fees, no surprises.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={clsx(
                'relative rounded-2xl border p-8 flex flex-col transition-all duration-300',
                tier.highlighted
                  ? 'border-primary bg-[#0a0a0a] shadow-lg shadow-primary/20 scale-105 z-10'
                  : 'border-[#222] bg-[#0a0a0a] hover:border-[#444]'
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-black text-sm font-bold px-4 py-1 rounded-full font-mono">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-white font-mono">{tier.name}</h3>
                <p className="text-gray-400 text-sm mt-2 font-mono">{tier.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-white font-mono">{tier.price}</span>
                <span className="text-gray-400 font-mono">{tier.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <svg
                      className={clsx(
                        'h-5 w-5 flex shrink-0 mt-0.5',
                        tier.highlighted ? 'text-primary' : 'text-green-500'
                      )}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-gray-300 text-sm font-mono">{feature}</span>
                  </li>
                ))}
              </ul>

              <SignUpButton>
                <button
                  className={clsx(
                    'block w-full text-center py-3 px-4 rounded-lg font-bold transition-colors font-mono',
                    tier.highlighted
                      ? 'bg-primary text-black hover:bg-[#00dd77]'
                      : 'bg-[#1a1a1a] border border-primary text-primary hover:bg-primary hover:text-black'
                  )}
                >
                  {tier.cta}
                </button>
              </SignUpButton>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-500 text-sm mt-12 font-mono">
          All plans include SSL encryption, PCI compliance, and basic fraud detection.
          <br />
          Need a custom plan?{' '}
          <a href="mailto:sales@OneRouter.dev" className="text-primary hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </section>
  );
}