'use client';

import Link from 'next/link';
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
      // Authenticated users go to dashboard
      return '/dashboard';
    }
    // Non-authenticated users go to signup with plan
    if (tier.name === 'Scale') {
      return '/signup?plan=scale';
    } else if (tier.name === 'Growth') {
      return '/signup?plan=growth';
    }
    return '/signup';
  };

  return (
    <section id="pricing" className="w-full py-20 md:py-28 bg-white px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-primary">
            Simple Pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-6 mb-4">
            Choose the Plan That Fits Your Business
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Start free and scale as you grow. No hidden fees, no surprises.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={clsx(
                'relative rounded-2xl border p-8 flex flex-col',
                tier.highlighted
                  ? 'border-primary bg-blue-50/50 shadow-lg scale-105 z-10'
                  : 'border-gray-200 bg-white hover:border-gray-300 transition-colors'
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-white text-sm font-medium px-4 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900">{tier.name}</h3>
                <p className="text-gray-500 text-sm mt-2">{tier.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                <span className="text-gray-500">{tier.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <svg
                      className={clsx(
                        'h-5 w-5 flex-shrink-0 mt-0.5',
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
                    <span className="text-gray-600 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

               <Link
                 href={getCtaLink(tier)}
                 className={clsx(
                   'block w-full text-center py-3 px-4 rounded-lg font-semibold transition-colors',
                   tier.highlighted
                     ? 'bg-primary text-white hover:bg-blue-700'
                     : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                 )}
               >
                 {tier.cta}
               </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-500 text-sm mt-12">
          All plans include SSL encryption, PCI compliance, and basic fraud detection.
          <br />
          Need a custom plan?{' '}
          <a href="mailto:sales@paymenthub.dev" className="text-primary hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </section>
  );
}
