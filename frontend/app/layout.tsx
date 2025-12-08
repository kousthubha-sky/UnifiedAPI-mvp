import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/lib/auth-context';
import PaymentErrorBoundary from '@/components/PaymentErrorBoundary';
import { ClerkProvider } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'OneRouter - Unified Payment Processing',
  description: 'Accept payments with confidence using our unified payment API. Integrate Stripe, PayPal, and more through a single, secure endpoint.',
  keywords: ['payment api', 'payment processing', 'stripe integration', 'paypal integration', 'unified api'],
  authors: [{ name: 'OneRouter Team' }],
  openGraph: {
    title: 'OneRouter - Unified Payment Processing',
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
    <ClerkProvider
      appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: '#00dd77',
          colorBackground: '#ffffff',
          colorInputBackground: '#0a0a0a',
          colorInputText: '#ffffff',
          colorText: '#000000',
          colorTextSecondary: '#1a1a1a',
          borderRadius: '0.5rem'
        },
        elements: {
          card: 'bg-white border-[#222] shadow-xl',
          headerTitle: 'text-white',
          headerSubtitle: 'text-gray-400',
          socialButtonsBlockButton: 'bg-[#1a1a1a] border-[#333] hover:bg-[#222]',
          socialButtonsBlockButtonText: 'text-white',
          formButtonPrimary: 'bg-[#00dd77] hover:bg-[#00b866] text-black font-bold',
          formFieldInput: 'bg-[#1a1a1a] border-[#333] text-white focus:ring-[#00dd77]',
          formFieldLabel: 'text-gray-300',
          footerActionLink: 'text-[#00dd77] hover:text-[#00b866]',
          dividerLine: 'bg-[#333]',
          dividerText: 'text-gray-400',
          formFieldInputShowPasswordButton: 'text-gray-400 hover:text-white',
          identityPreviewEditButton: 'text-[#00dd77] hover:text-[#00b866]',
          alert: 'bg-red-900/20 border-red-800 text-red-400',
          alertText: 'text-red-400',
          userPreviewTextContainer: 'text-black',
          profileSectionHeader: 'text-black font-bold',
          // pageScrollBox: 'bg-[#1a1a1a]',
                
         
        }
      }}
    >
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
    </ClerkProvider>
  );
}
