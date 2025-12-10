'use client';

import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import FeatureHighlights from '@/components/FeatureHighlights';
import Pricing from '@/components/Pricing';
import Testimonials from '@/components/Testimonials';
import Link from 'next/link';
import { SignUpButton, useUser } from '@clerk/nextjs';

export default function Home() {
  const { isSignedIn } = useUser();

  return (
    <>
      <Navbar />
      <Hero />
      <FeatureHighlights />
      <Features />
      <Pricing />
      <Testimonials />

      {/* Final CTA Section */}
      <section className="w-full py-20 md:py-28 bg-black text-white px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 font-mono">
            Ready to Get <span className="text-primary">Started</span>?
          </h2>
          <p className="text-lg mb-8 text-white/80 max-w-2xl mx-auto font-mono">
            Start processing payments securely today. Get your API keys in minutes
            and integrate with just a few lines of code.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isSignedIn ? (
              <Link href="/dashboard">
                <button className="inline-flex items-center justify-center px-8 py-3 bg-black text-primary font-bold rounded-lg hover:bg-gray-900 transition-colors font-mono">
                  Go to Dashboard
                </button>
              </Link>
            ) : (
              <SignUpButton>
                <button className="inline-flex items-center justify-center px-8 py-3 bg-black text-primary font-bold rounded-lg hover:bg-gray-900 transition-colors font-mono">
                  Create Free Account
                </button>
              </SignUpButton>
            )}
            <Link
              href="/docs"
              className="inline-flex items-center justify-center px-8 py-3  text-white font-bold rounded-lg hover:bg-black hover:text-primary transition-colors font-mono"
            >
              Read Documentation
            </Link>
          </div>
          <p className="text-white/70 text-sm mt-8 font-mono">
            No credit card required • Free tier available • 5-minute setup
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-12 bg-[#0a0a0a] text-gray-400 px-4 border-t border-[#222]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-semibold mb-4 font-mono">Product</h4>
              <ul className="space-y-2 text-sm font-mono">
                <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><Link href="/docs" className="hover:text-primary transition-colors">API Docs</Link></li>
                <li><Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 font-mono">Developers</h4>
              <ul className="space-y-2 text-sm font-mono">
                <li><Link href="/docs" className="hover:text-primary transition-colors">Documentation</Link></li>
                <li><a href="https://github.com/OneRouter" className="hover:text-primary transition-colors">GitHub</a></li>
                <li><Link href="/docs#sdk" className="hover:text-primary transition-colors">SDKs</Link></li>
                <li><Link href="/docs#examples" className="hover:text-primary transition-colors">Examples</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 font-mono">Company</h4>
              <ul className="space-y-2 text-sm font-mono">
                <li><a href="#" className="hover:text-primary transition-colors">About</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Careers</a></li>
                <li><a href="mailto:support@OneRouter.dev" className="hover:text-primary transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 font-mono">Legal</h4>
              <ul className="space-y-2 text-sm font-mono">
                <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Compliance</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#222] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-primary font-bold text-lg font-mono">OneRouter</span>
              <span className="text-sm font-mono">© {new Date().getFullYear()} All rights reserved.</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://twitter.com/OneRouter" className="hover:text-primary transition-colors" aria-label="Twitter">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="https://github.com/OneRouter" className="hover:text-primary transition-colors" aria-label="GitHub">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="https://linkedin.com/company/OneRouter" className="hover:text-primary transition-colors" aria-label="LinkedIn">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

