'use client';

export default function Features() {
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
    <section id="features" className="w-full py-20 md:py-28 bg-black px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-mono">
            Powerful Features <span className="text-primary">Built In</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto font-mono">
            Everything you need to process payments securely and efficiently
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="card card-hover p-8 group"
            >
              <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-2 font-mono">{feature.title}</h3>
              <p className="text-gray-400 font-mono text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Integration Steps */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-mono">
              Get Started in <span className="text-primary">3 Steps</span>
            </h2>
            <p className="text-gray-400 font-mono">
              Integration takes less than 5 minutes
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            {[
              {
                step: "01",
                title: "Install the SDK",
                code: "npm install @OneRouter/sdk",
              },
              {
                step: "02",
                title: "Initialize with your API key",
                code: "const hub = new OneRouter({ apiKey: 'your-key' });",
              },
              {
                step: "03",
                title: "Make your first payment",
                code: "await hub.payments.create({ amount: 2999, currency: 'USD' });",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-6 items-start">
                <div className="flex shrink-0 w-12 h-12 rounded-lg bg-primary text-black font-bold font-mono items-center justify-center text-lg">
                  {item.step}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2 font-mono text-white">{item.title}</h3>
                  <pre className="card p-4 text-sm font-mono text-primary overflow-x-auto border-primary">
                    {item.code}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}