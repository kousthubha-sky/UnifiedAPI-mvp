import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { AuthProvider } from '@/lib/auth-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OneRouter - Payment Integration Platform',
  description: 'Connect your payment providers in seconds',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
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
        }
      }}
    >
      <html lang="en">
        <body className={inter.className}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
