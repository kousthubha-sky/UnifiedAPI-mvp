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
    "provider": "stripe",
    "customer_id": "cust_123",
    "payment_method": "pm_card_visa",
    "description": "Order #12345"
  }'`,
    node: `import { UnifiedAPIClient } from '@paymenthub/sdk';

const client = new UnifiedAPIClient({
  apiKey: 'YOUR_API_KEY',
  baseUrl: '${API_BASE_URL}'
});

const payment = await client.payments.create({
  amount: 2999,
  currency: 'USD',
  provider: 'stripe',
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
        'provider': 'stripe',
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
        className="absolute top-3 right-3 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="bg-gray-900 text-gray-300 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
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
      <div className="flex border-b border-gray-200 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">API Documentation</h1>
              <p className="text-gray-600 mt-2">
                Everything you need to integrate PaymentHub into your application.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
            <div className="sticky top-4 bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Contents</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#authentication" className="text-gray-600 hover:text-primary transition-colors">
                    Authentication
                  </a>
                </li>
                <li>
                  <a href="#base-url" className="text-gray-600 hover:text-primary transition-colors">
                    Base URL
                  </a>
                </li>
                <li>
                  <a href="#sdk" className="text-gray-600 hover:text-primary transition-colors">
                    SDKs
                  </a>
                </li>
                <li>
                  <a href="#examples" className="text-gray-600 hover:text-primary transition-colors">
                    Code Examples
                  </a>
                  <ul className="ml-4 mt-2 space-y-1">
                    <li>
                      <a href="#create-payment" className="text-gray-500 hover:text-primary transition-colors">
                        Create Payment
                      </a>
                    </li>
                    <li>
                      <a href="#get-payment" className="text-gray-500 hover:text-primary transition-colors">
                        Get Payment
                      </a>
                    </li>
                    <li>
                      <a href="#list-payments" className="text-gray-500 hover:text-primary transition-colors">
                        List Payments
                      </a>
                    </li>
                    <li>
                      <a href="#refund-payment" className="text-gray-500 hover:text-primary transition-colors">
                        Refund Payment
                      </a>
                    </li>
                  </ul>
                </li>
                <li>
                  <a href="#errors" className="text-gray-600 hover:text-primary transition-colors">
                    Error Handling
                  </a>
                </li>
                <li>
                  <a href="#swagger" className="text-gray-600 hover:text-primary transition-colors">
                    Interactive Docs
                  </a>
                </li>
              </ul>
            </div>
          </nav>

          {/* Main content */}
          <main className="lg:col-span-3 space-y-12">
            {/* Authentication */}
            <section id="authentication" className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication</h2>
              <p className="text-gray-600 mb-4">
                All API requests require authentication using an API key. Include your API key in the
                request headers:
              </p>
              <div className="bg-gray-900 text-gray-300 p-4 rounded-lg mb-4 font-mono text-sm">
                <span className="text-blue-400">x-api-key</span>: YOUR_API_KEY
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h4 className="font-medium text-yellow-800">Keep your API keys secure</h4>
                    <p className="text-yellow-700 text-sm mt-1">
                      Never expose your API keys in client-side code or public repositories. Use
                      environment variables and server-side calls to keep them safe.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Base URL */}
            <section id="base-url" className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Base URL</h2>
              <p className="text-gray-600 mb-4">
                All API requests should be made to:
              </p>
              <div className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-sm">
                {API_BASE_URL}/api/v1
              </div>
            </section>

            {/* SDKs */}
            <section id="sdk" className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Official SDKs</h2>
              <p className="text-gray-600 mb-6">
                We provide official SDKs to make integration easier. Choose your preferred language:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.985c-.275 0-.532-.074-.772-.202a2.545 2.545 0 01-.554-.389L4.9 15.62a2.5 2.5 0 01-.683-1.713V10.12c0-.639.254-1.254.707-1.707l5.759-5.774c.226-.226.487-.403.772-.517.285-.114.586-.171.891-.167.305-.004.606.053.891.167.285.114.546.29.772.517l5.773 5.774c.453.453.707 1.068.707 1.707v3.787c0 .64-.254 1.255-.707 1.707l-5.774 5.774c-.226.226-.487.403-.772.517-.285.114-.586.171-.891.167zM12 6.086l-4.893 4.893v1.965l4.893 4.893 4.893-4.893v-1.965L12 6.086z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Node.js SDK</h3>
                      <p className="text-sm text-gray-500">TypeScript/JavaScript</p>
                    </div>
                  </div>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
                    npm install @paymenthub/sdk
                  </code>
                </div>
                <div className="border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors opacity-60">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.77l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.17l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05L0 11.97l.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09zm13.09 3.95l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Python SDK</h3>
                      <p className="text-sm text-gray-500">Coming soon</p>
                    </div>
                  </div>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-500">
                    pip install paymenthub
                  </code>
                </div>
              </div>
            </section>

            {/* Code Examples */}
            <section id="examples" className="space-y-8">
              <h2 className="text-2xl font-bold text-gray-900">Code Examples</h2>

              {/* Create Payment */}
              <div id="create-payment" className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">POST</span>
                  <code className="text-sm text-gray-600">/api/v1/payments</code>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Create Payment</h3>
                <p className="text-gray-600 mb-4">
                  Create a new payment intent. The amount should be in the smallest currency unit (cents for USD).
                </p>
                <CodeTabs examples={codeExamples.createPayment} />
              </div>

              {/* Get Payment */}
              <div id="get-payment" className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">GET</span>
                  <code className="text-sm text-gray-600">/api/v1/payments/:id</code>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Get Payment</h3>
                <p className="text-gray-600 mb-4">
                  Retrieve a payment by its ID to check status and details.
                </p>
                <CodeTabs examples={codeExamples.getPayment} />
              </div>

              {/* List Payments */}
              <div id="list-payments" className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">GET</span>
                  <code className="text-sm text-gray-600">/api/v1/payments</code>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">List Payments</h3>
                <p className="text-gray-600 mb-4">
                  List all payments with optional filters for status, date range, and pagination.
                </p>
                <CodeTabs examples={codeExamples.listPayments} />
              </div>

              {/* Refund Payment */}
              <div id="refund-payment" className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">POST</span>
                  <code className="text-sm text-gray-600">/api/v1/payments/:id/refund</code>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Refund Payment</h3>
                <p className="text-gray-600 mb-4">
                  Create a full or partial refund for a completed payment.
                </p>
                <CodeTabs examples={codeExamples.refundPayment} />
              </div>
            </section>

            {/* Error Handling */}
            <section id="errors" className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Handling</h2>
              <p className="text-gray-600 mb-4">
                The API uses standard HTTP status codes and returns detailed error messages:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Status Code</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="py-3 px-4"><code className="text-green-600">200</code></td>
                      <td className="py-3 px-4 text-gray-600">Success</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-green-600">201</code></td>
                      <td className="py-3 px-4 text-gray-600">Created successfully</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-yellow-600">400</code></td>
                      <td className="py-3 px-4 text-gray-600">Bad request - validation error</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-yellow-600">401</code></td>
                      <td className="py-3 px-4 text-gray-600">Unauthorized - invalid or missing API key</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-yellow-600">403</code></td>
                      <td className="py-3 px-4 text-gray-600">Forbidden - insufficient permissions</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-yellow-600">404</code></td>
                      <td className="py-3 px-4 text-gray-600">Resource not found</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-yellow-600">429</code></td>
                      <td className="py-3 px-4 text-gray-600">Rate limit exceeded</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4"><code className="text-red-600">500</code></td>
                      <td className="py-3 px-4 text-gray-600">Internal server error</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-6">
                <h4 className="font-semibold text-gray-900 mb-2">Error Response Format</h4>
                <pre className="bg-gray-900 text-gray-300 p-4 rounded-lg text-sm overflow-x-auto">
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
                </pre>
              </div>
            </section>

            {/* Interactive Swagger Docs */}
            <section id="swagger" className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Interactive API Documentation</h2>
              <p className="text-gray-600 mb-4">
                Try out API requests directly in your browser using our interactive Swagger documentation.
              </p>
              
              <button
                onClick={() => setShowSwagger(!showSwagger)}
                className="inline-flex items-center px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-blue-700 transition-colors mb-4"
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
                <div className="border border-gray-200 rounded-lg overflow-hidden">
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
                  className="text-primary hover:underline inline-flex items-center gap-1"
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
