'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Setup', href: '/dashboard/setup', icon: '⚙️' },
  ];

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-primary font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Top Navigation */}
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium font-mono transition-colors ${
                      isActive
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-muted hover:bg-muted hover:text-white'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}