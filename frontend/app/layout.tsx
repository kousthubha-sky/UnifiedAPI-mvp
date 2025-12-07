import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/lib/auth-context';
import PaymentErrorBoundary from '@/components/PaymentErrorBoundary';

export const metadata: Metadata = {
  title: 'PaymentHub - Unified Payment Processing',
  description: 'Accept payments with confidence using our unified payment API. Integrate Stripe, PayPal, and more through a single, secure endpoint.',
  keywords: ['payment api', 'payment processing', 'stripe integration', 'paypal integration', 'unified api'],
  authors: [{ name: 'PaymentHub Team' }],
  openGraph: {
    title: 'PaymentHub - Unified Payment Processing',
    description: 'Accept payments with confidence using our unified payment API.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        <AuthProvider>
          <Navbar />
          <PaymentErrorBoundary>
            <main>{children}</main>
          </PaymentErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
