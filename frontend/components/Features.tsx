'use client';

export default function Features(): JSX.Element {
  const features = [
    {
      title: 'Multi-Provider Support',
      description: 'Seamlessly integrate Stripe, PayPal, and other payment providers through a unified API.',
      icon: '🔗',
    },
    {
      title: 'Built-in Security',
      description: 'Enterprise-grade encryption, PCI compliance, and comprehensive fraud detection out of the box.',
      icon: '🔒',
    },
    {
      title: 'Real-time Analytics',
      description: 'Monitor transactions, identify trends, and optimize revenue with advanced analytics.',
      icon: '📊',
    },
    {
      title: 'API Key Management',
      description: 'Generate, rotate, and manage API keys with granular permissions and audit logs.',
      icon: '🔑',
    },
    {
      title: 'Webhook Support',
      description: 'Real-time event notifications for payment status updates and transaction confirmations.',
      icon: '📡',
    },
    {
      title: 'Developer-Friendly',
      description: 'Comprehensive documentation, SDKs, and code samples to get you up and running fast.',
      icon: '👨‍💻',
    },
  ];

  return (
    <section id="features" className="w-full py-20 md:py-28 bg-gray-50 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Powerful Features Built In
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to process payments securely and efficiently
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white p-8 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
