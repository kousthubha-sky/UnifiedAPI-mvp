import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'PaymentHub - Unified Payment Processing',
  description: 'Accept payments with confidence using our unified payment API.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
