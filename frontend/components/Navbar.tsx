'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (href: string): boolean => pathname === href;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-bold text-lg text-primary hover:text-blue-700 transition-colors">
              PaymentHub
            </Link>
            <div className="hidden md:flex gap-6">
              <Link
                href="/"
                className={clsx(
                  'text-sm font-medium transition-colors',
                  isActive('/') ? 'text-primary' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                Home
              </Link>
              <Link
                href="/dashboard"
                className={clsx(
                  'text-sm font-medium transition-colors',
                  isActive('/dashboard') ? 'text-primary' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                Dashboard
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-sm font-medium text-primary hover:text-blue-700 transition-colors"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
