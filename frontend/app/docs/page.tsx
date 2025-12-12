'use client';

import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';

type CodeLanguage = 'curl' | 'node' | 'python';

interface CodeExample {
  curl: string;
  node: string;
  python: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL || `${API_BASE_URL}/docs`;

const codeExamples: Record<string, CodeExample> = {
  createPayment: {
    curl: `curl -X POST ${API_BASE_URL}/api/v1/payments \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "amount": 2999,
    "currency": "USD",
    "provider": "paypal",
    "customer_id": "cust_123",
    "payment_method": "pm_card_visa",
    "description": "Order #12345"
  }'`,
    node: `import { UnifiedAPIClient } from '@OneRouter/sdk';

const client = new UnifiedAPIClient({
  apiKey: 'YOUR_API_KEY',
  baseUrl: '${API_BASE_URL}'
});

const payment = await client.payments.create({
  amount: 2999,
  currency: 'USD',
  provider: 'paypal',
  customerId: 'cust_123',
  paymentMethod: 'pm_card_visa',
  description: 'Order #12345'
});

console.log('Payment created:', payment.id);`,
    python: `import requests

response = requests.post(
    '${API_BASE_URL}/api/v1/payments',
    headers={
        'Content-Type': 'application/json',
        'x-api-key': 'YOUR_API_KEY'
    },
    json={
        'amount': 2999,
        'currency': 'USD',
        'provider': 'paypal',
        'customer_id': 'cust_123',
        'payment_method': 'pm_card_visa',
        'description': 'Order #12345'
    }
)

payment = response.json()
print(f"Payment created: {payment['id']}")`,
  },
  getPayment: {
    curl: `curl -X GET ${API_BASE_URL}/api/v1/payments/pay_abc123 \\
  -H "x-api-key: YOUR_API_KEY"`,
    node: `const payment = await client.payments.get('pay_abc123');
console.log('Payment status:', payment.status);`,
    python: `response = requests.get(
    '${API_BASE_URL}/api/v1/payments/pay_abc123',
    headers={'x-api-key': 'YOUR_API_KEY'}
)
payment = response.json()
print(f"Payment status: {payment['status']}")`,
  },
  listPayments: {
    curl: `curl -X GET "${API_BASE_URL}/api/v1/payments?status=completed&limit=10" \\
  -H "x-api-key: YOUR_API_KEY"`,
    node: `const payments = await client.payments.list({
  status: 'completed',
  limit: 10
});

payments.data.forEach(p => {
  console.log(p.id, p.amount, p.status);
});`,
    python: `response = requests.get(
    '${API_BASE_URL}/api/v1/payments',
    headers={'x-api-key': 'YOUR_API_KEY'},
    params={'status': 'completed', 'limit': 10}
)
payments = response.json()
for p in payments['payments']:
    print(p['id'], p['amount'], p['status'])`,
  },
  refundPayment: {
    curl: `curl -X POST ${API_BASE_URL}/api/v1/payments/pay_abc123/refund \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "amount": 1000,
    "reason": "Customer requested refund"
  }'`,
    node: `const refund = await client.payments.refund('pay_abc123', {
  amount: 1000,
  reason: 'Customer requested refund'
});

console.log('Refund ID:', refund.refund_id);`,
    python: `response = requests.post(
    '${API_BASE_URL}/api/v1/payments/pay_abc123/refund',
    headers={
        'Content-Type': 'application/json',
        'x-api-key': 'YOUR_API_KEY'
    },
    json={
        'amount': 1000,
        'reason': 'Customer requested refund'
    }
)
refund = response.json()
print(f"Refund ID: {refund['refund_id']}")`,
  },
};

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 px-3 py-1 text-xs bg-[#1a1a1a] hover:bg-[#222] text-primary border border-[#222] rounded transition-colors font-mono font-bold"
      >
        {copied ? '✓ Copied!' : 'Copy'}
      </button>
      <pre className="bg-[#0a0a0a] border border-[#222] text-gray-300 p-4 rounded-lg overflow-x-auto text-sm">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

function CodeTabs({ examples }: { examples: CodeExample }) {
  const [activeTab, setActiveTab] = useState<CodeLanguage>('curl');

  const tabs: { id: CodeLanguage; label: string }[] = [
    { id: 'curl', label: 'cURL' },
    { id: 'node', label: 'Node.js' },
    { id: 'python', label: 'Python' },
  ];

  return (
    <div>
      <div className="flex border-b border-[#222] mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors font-mono',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-400 hover:text-white'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <CodeBlock code={examples[activeTab]} />
    </div>
  );
}

export default function DocsPage() {
  const [showSwagger, setShowSwagger] = useState(false);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-[#0a0a0a] border-b border-[#222]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white font-mono">API Documentation</h1>
              <p className="text-gray-400 mt-2 font-mono text-sm">
                Everything you need to integrate OneRouter into your application.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 bg-primary text-black font-bold rounded-lg hover:bg-[#00dd77] transition-colors font-mono"
            >
              Get API Keys
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <nav className="lg:col-span-1">
            <div className="sticky top-4 bg-[#0a0a0a] border border-[#222] rounded-lg p-4">
              <h3 className="font-semibold text-white mb-4 font-mono">Contents</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#authentication" className="text-gray-400 hover:text-primary transition-colors font-mono">
                    Authentication
                  </a>
                </li>
                <li>
                  <a href="#base-url" className="text-gray-400 hover:text-primary transition-colors font-mono">
                    Base URL
                  </a>
                </li>
                <li>
                  <a href="#sdk" className="text-gray-400 hover:text-primary transition-colors font-mono">
                    SDKs
                  </a>
                </li>
                <li>
                  <a href="#examples" className="text-gray-400 hover:text-primary transition-colors font-mono">
                    Code Examples
                  </a>
                  <ul className="ml-4 mt-2 space-y-1">
                    <li>
                      <a href="#create-payment" className="text-gray-500 hover:text-primary transition-colors font-mono">
                        Create Payment
                      </a>
                    </li>
                    <li>
                      <a href="#get-payment" className="text-gray-500 hover:text-primary transition-colors font-mono">
                        Get Payment
                      </a>
                    </li>
                    <li>
                      <a href="#list-payments" className="text-gray-500 hover:text-primary transition-colors font-mono">
                        List Payments
                      </a>
                    </li>
                    <li>
                      <a href="#refund-payment" className="text-gray-500 hover:text-primary transition-colors font-mono">
                        Refund Payment
                      </a>
                    </li>
                  </ul>
                </li>
                <li>
                  <a href="#errors" className="text-gray-400 hover:text-primary transition-colors font-mono">
                    Error Handling
                  </a>
                </li>
                <li>
                  <a href="#swagger" className="text-gray-400 hover:text-primary transition-colors font-mono">
                    Interactive Docs
                  </a>
                </li>
              </ul>
            </div>
          </nav>

          {/* Main content */}
          <main className="lg:col-span-3 space-y-12">
            {/* Authentication */}
            <section id="authentication" className="bg-[#0a0a0a] border border-[#222] rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4 font-mono">Authentication</h2>
              <p className="text-gray-400 mb-4 font-mono text-sm">
                All API requests require authentication using an API key. Include your API key in the
                request headers:
              </p>
              <div className="bg-[#000] border border-primary text-primary p-4 rounded-lg mb-4 font-mono text-sm">
                <span className="text-gray-500">x-api-key</span>: YOUR_API_KEY
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h4 className="font-bold text-yellow-500 font-mono">Keep your API keys secure</h4>
                    <p className="text-yellow-500/80 text-sm mt-1 font-mono">
                      Never expose your API keys in client-side code or public repositories. Use
                      environment variables and server-side calls to keep them safe.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Base URL */}
            <section id="base-url" className="bg-[#0a0a0a] border border-[#222] rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4 font-mono">Base URL</h2>
              <p className="text-gray-400 mb-4 font-mono text-sm">
                All API requests should be made to:
              </p>
              <div className="bg-[#000] border border-primary text-primary p-4 rounded-lg font-mono text-sm">
                {API_BASE_URL}/api/v1
              </div>
            </section>

            {/* SDKs */}
            <section id="sdk" className="bg-[#0a0a0a] border border-[#222] rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4 font-mono">Official SDKs</h2>
              <p className="text-gray-400 mb-6 font-mono text-sm">
                We provide official SDKs to make integration easier. Choose your preferred language:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-[#222] rounded-lg p-4 hover:border-primary transition-colors bg-[#0a0a0a]">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 bg-primary/20 rounded-lg flex items-center justify-center border border-primary">
                      <span className="text-primary text-xl">📦</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white font-mono">Node.js SDK</h3>
                      <p className="text-sm text-gray-400 font-mono">TypeScript/JavaScript</p>
                    </div>
                  </div>
                  <code className="text-sm bg-[#000] border border-[#222] px-2 py-1 rounded text-primary font-mono block">
                    npm install @OneRouter/sdk
                  </code>
                </div>
                <div className="border border-[#222] rounded-lg p-4 opacity-60 bg-[#0a0a0a]">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 bg-gray-700/20 rounded-lg flex items-center justify-center border border-gray-700">
                      <span className="text-gray-500 text-xl">🐍</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-500 font-mono">Python SDK</h3>
                      <p className="text-sm text-gray-500 font-mono">Coming soon</p>
                    </div>
                  </div>
                  <code className="text-sm bg-[#000] border border-[#222] px-2 py-1 rounded text-gray-500 font-mono block">
                    pip install OneRouter
                  </code>
                </div>
              </div>
            </section>

            {/* Code Examples */}
            <section id="examples" className="space-y-8">
              <h2 className="text-2xl font-bold text-white font-mono">Code Examples</h2>

              {/* Create Payment */}
              <div id="create-payment" className="bg-[#0a0a0a] border border-[#222] rounded-lg p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-bold rounded border border-primary font-mono">POST</span>
                  <code className="text-sm text-gray-400 font-mono">/api/v1/payments</code>
                </div>
                <h3 className="text-xl font-semibold text-white mb-4 font-mono">Create Payment</h3>
                <p className="text-gray-400 mb-4 font-mono text-sm">
                  Create a new payment intent. The amount should be in the smallest currency unit (cents for USD).
                </p>
                <CodeTabs examples={codeExamples.createPayment} />
              </div>

              {/* Get Payment */}
              <div id="get-payment" className="bg-[#0a0a0a] border border-[#222] rounded-lg p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded border border-blue-500/30 font-mono">GET</span>
                  <code className="text-sm text-gray-400 font-mono">/api/v1/payments/:id</code>
                </div>
                <h3 className="text-xl font-semibold text-white mb-4 font-mono">Get Payment</h3>
                <p className="text-gray-400 mb-4 font-mono text-sm">
                  Retrieve a payment by its ID to check status and details.
                </p>
                <CodeTabs examples={codeExamples.getPayment} />
              </div>

              {/* List Payments */}
              <div id="list-payments" className="bg-[#0a0a0a] border border-[#222] rounded-lg p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded border border-blue-500/30 font-mono">GET</span>
                  <code className="text-sm text-gray-400 font-mono">/api/v1/payments</code>
                </div>
                <h3 className="text-xl font-semibold text-white mb-4 font-mono">List Payments</h3>
                <p className="text-gray-400 mb-4 font-mono text-sm">
                  List all payments with optional filters for status, date range, and pagination.
                </p>
                <CodeTabs examples={codeExamples.listPayments} />
              </div>

              {/* Refund Payment */}
              <div id="refund-payment" className="bg-[#0a0a0a] border border-[#222] rounded-lg p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-bold rounded border border-primary font-mono">POST</span>
                  <code className="text-sm text-gray-400 font-mono">/api/v1/payments/:id/refund</code>
                </div>
                <h3 className="text-xl font-semibold text-white mb-4 font-mono">Refund Payment</h3>
                <p className="text-gray-400 mb-4 font-mono text-sm">
                  Create a full or partial refund for a completed payment.
                </p>
                <CodeTabs examples={codeExamples.refundPayment} />
              </div>
            </section>

            {/* Error Handling */}
            <section id="errors" className="bg-[#0a0a0a] border border-[#222] rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4 font-mono">Error Handling</h2>
              <p className="text-gray-400 mb-4 font-mono text-sm">
                The API uses standard HTTP status codes and returns detailed error messages:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#222]">
                      <th className="text-left py-3 px-4 font-semibold text-white font-mono">Status Code</th>
                      <th className="text-left py-3 px-4 font-semibold text-white font-mono">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222]">
                    <tr>
                      <td className="py-3 px-4"><code className="text-primary font-mono">200</code></td>
                      <td className="py-3 px-4 text-gray-400 font-mono">Success</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-primary font-mono">201</code></td>
                      <td className="py-3 px-4 text-gray-400 font-mono">Created successfully</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-yellow-500 font-mono">400</code></td>
                      <td className="py-3 px-4 text-gray-400 font-mono">Bad request - validation error</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-yellow-500 font-mono">401</code></td>
                      <td className="py-3 px-4 text-gray-400 font-mono">Unauthorized - invalid or missing API key</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-yellow-500 font-mono">403</code></td>
                      <td className="py-3 px-4 text-gray-400 font-mono">Forbidden - insufficient permissions</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-yellow-500 font-mono">404</code></td>
                      <td className="py-3 px-4 text-gray-400 font-mono">Resource not found</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-yellow-500 font-mono">429</code></td>
                      <td className="py-3 px-4 text-gray-400 font-mono">Rate limit exceeded</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-red-500 font-mono">500</code></td>
                      <td className="py-3 px-4 text-gray-400 font-mono">Internal server error</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-6">
                <h4 className="font-semibold text-white mb-2 font-mono">Error Response Format</h4>
                <pre className="bg-[#000] border border-[#222] text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
                  <code className="font-mono">
{`{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "trace_id": "abc-123-def",
  "details": [
    {
      "field": "amount",
      "message": "Amount must be positive"
    }
  ]
}`}
                  </code>
                </pre>
              </div>
            </section>

            {/* Interactive Swagger Docs */}
            <section id="swagger" className="bg-[#0a0a0a] border border-[#222] rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4 font-mono">Interactive API Documentation</h2>
              <p className="text-gray-400 mb-4 font-mono text-sm">
                Try out API requests directly in your browser using our interactive Swagger documentation.
              </p>
              
              <button
                onClick={() => setShowSwagger(!showSwagger)}
                className="inline-flex items-center px-4 py-2 bg-primary text-black font-bold rounded-lg hover:bg-[#00dd77] transition-colors mb-4 font-mono"
              >
                {showSwagger ? 'Hide' : 'Show'} Interactive Docs
                <svg
                  className={clsx('ml-2 h-4 w-4 transition-transform', showSwagger && 'rotate-180')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showSwagger && (
                <div className="border border-[#222] rounded-lg overflow-hidden bg-white">
                  <iframe
                    src={DOCS_URL}
                    className="w-full h-[800px]"
                    title="Swagger API Documentation"
                  />
                </div>
              )}

              <div className="mt-4">
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-[#00dd77] inline-flex items-center gap-1 font-mono text-sm font-bold"
                >
                  Open in new tab
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}