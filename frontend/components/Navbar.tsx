'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { useAuth } from '@/lib/auth-context';

export default function Navbar() {
  const pathname = usePathname();
  const { customer, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string): boolean => pathname === href;

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/docs', label: 'Docs' },
    { href: '/#pricing', label: 'Pricing' },
  ];

  return (
    <nav className="bg-black  backdrop-blur-3xl sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 bg-[#0a0a0a]/80 backdrop-blur-md rounded-4xl">
        <div className="flex justify-between items-center-safe h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-bold text-xl text-primary hover:text-[#00dd77] transition-colors font-mono">
              OneRouter
            </Link>
            
          </div>
          <div className="hidden md:flex gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    'text-sm font-medium transition-colors font-mono',
                    isActive(link.href) ? 'text-primary' : 'text-gray-400 hover:text-white'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          <div className="hidden md:flex items-center gap-4">
            {loading ? (
              <div className="h-4 w-20 bg-[#1a1a1a] animate-pulse rounded" />
            ) : (
              <>
                <SignedOut>
                  <SignInButton>
                    <button className="text-sm font-medium text-gray-400 hover:text-white transition-colors font-mono">
                      Sign In
                    </button>
                  </SignInButton>
                  <SignUpButton>
                    <button className="text-sm font-bold px-4 py-2 bg-primary text-black rounded-lg hover:bg-[#00dd77] transition-colors font-mono">
                      Get Started
                    </button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  {customer && (
                    <Link
                      href="/dashboard"
                      className={clsx(
                        'text-sm font-medium transition-colors font-mono',
                        isActive('/dashboard') ? 'text-primary' : 'text-gray-400 hover:text-white'
                      )}
                    >
                      Dashboard
                    </Link>
                  )}
                  <UserButton />
                </SignedIn>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white"
            aria-label="Toggle menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#222] bg-[#0a0a0a]">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={clsx(
                  'block text-base font-medium transition-colors py-2 font-mono',
                  isActive(link.href) ? 'text-primary' : 'text-gray-400 hover:text-white'
                )}
              >
                {link.label}
              </Link>
            ))}
            <hr className="border-[#222]" />
            <SignedOut>
              <SignInButton>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-left text-base font-medium text-gray-400 hover:text-white py-2 font-mono"
                >
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-base font-bold text-center px-4 py-2 bg-primary text-black rounded-lg hover:bg-[#00dd77] transition-colors font-mono"
                >
                  Get Started
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              {customer && (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-base font-medium text-gray-400 hover:text-white py-2 font-mono"
                >
                  Dashboard
                </Link>
              )}
              <div className="py-2">
                <UserButton />
              </div>
            </SignedIn>
          </div>
        </div>
      )}
    </nav>
  );
}