'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const TerminalWindow = () => {
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  const commands = [
    { text: "$ npm install @OneRouter/sdk", delay: 50 },
    { text: "✓ Package installed successfully", delay: 30, color: "text-primary" },
    { text: "", delay: 0 },
    { text: "$ OneRouter init", delay: 50 },
    { text: "→ Initializing OneRouter...", delay: 30, color: "text-gray-400" },
    { text: "✓ Connected to Stripe, PayPal, and more", delay: 30, color: "text-primary" },
    { text: "", delay: 0 },
    { text: "$ OneRouter.payments.create(...)", delay: 50 },
    { text: '{"status": "success", "amount": 2999}', delay: 30, color: "text-[#ff3366]" },
    { text: "⚡ Response: 87ms", delay: 30, color: "text-primary" },
  ];

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    if (currentLine >= commands.length) {
      setTimeout(() => {
        setCurrentLine(0);
        setCurrentChar(0);
      }, 3000);
      return;
    }

    const currentCommand = commands[currentLine];
    
    if (currentChar < currentCommand.text.length) {
      const timeout = setTimeout(() => {
        setCurrentChar(currentChar + 1);
      }, currentCommand.delay);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setCurrentLine(currentLine + 1);
        setCurrentChar(0);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [currentLine, currentChar]);

  return (
    <div className="w-full max-w-3xl mx-auto terminal-window">
      <div className="terminal-header h-10 flex items-center justify-between px-4 rounded-t-lg bg-[#1a1a1a] ">
        <div className="flex gap-2 ">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          <span className="ml-2 text-xs text-gray-500 font-mono">OneRouter-terminal</span>
        </div>
        
      </div>

      <div className="terminal-content min-h-[400px] bg-[#090909] rounded-b-xl p-6 font-mono text-sm flex flex-col items-start">
        {commands.slice(0, currentLine).map((cmd, idx) => (
          <div key={idx} className={`${cmd.color || "text-white"} mb-1`}>
            {cmd.text}
          </div>
        ))}
        {currentLine < commands.length && (
          <div className={`${commands[currentLine].color || "text-white"}`}>
            {commands[currentLine].text.slice(0, currentChar)}
            <span className={`inline-block w-2 h-4 ml-1 bg-primary ${showCursor ? "opacity-100" : "opacity-0"}`} />
          </div>
        )}
      </div>
    </div>
  );
};

export default function Hero() {
  return (
    <section className="relative w-full py-20 md:py-28 lg:py-36 px-4 overflow-hidden bg-black">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0a0a0a_1px,transparent_1px),linear-gradient(to_bottom,#0a0a0a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
      
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <div className="mb-6 inline-block">
          <span className="px-4 py-2 bg-[#1a1a1a] border border-primary rounded-full text-sm font-medium text-primary font-mono">
            <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" />
            Unified Payment Processing
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight font-mono">
          Your Single API.
          <br />
          <span className="glow-text text-primary">Their Complexity.</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-3xl mx-auto leading-relaxed font-mono">
          Stop juggling multiple SDKs. OneRouter connects you to Stripe, PayPal, and more
          through a unified API. From setup to first payment in under 5 minutes.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-8 py-4 bg-primary text-black font-bold rounded-lg hover:bg-[#00dd77] transition-colors text-lg shadow-lg shadow-primary/25 font-mono"
          >
            Get Started Free
            <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center px-8 py-4 border border-primary text-primary font-bold rounded-lg hover:bg-primary hover:text-black transition-colors text-lg font-mono"
          >
            <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            View Documentation
          </Link>
        </div>

        {/* Terminal Demo */}
        <TerminalWindow />

        {/* Stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary mb-2 font-mono">99.99%</div>
            <p className="text-gray-400 font-mono text-sm">Uptime SLA</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary mb-2 font-mono">250K+</div>
            <p className="text-gray-400 font-mono text-sm">Transactions/Day</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary mb-2 font-mono">&lt;100ms</div>
            <p className="text-gray-400 font-mono text-sm">Avg. Latency</p>
          </div>
        </div>

        {/* Trusted by */}
        <div className="mt-16 pt-8 border-t border-[#222]">
          <p className="text-sm text-gray-500 mb-6 font-mono">Trusted by innovative companies worldwide</p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-50">
            <div className="text-xl font-bold text-gray-600 font-mono">TechFlow</div>
            <div className="text-xl font-bold text-gray-600 font-mono">ShopScale</div>
            <div className="text-xl font-bold text-gray-600 font-mono">StartupXYZ</div>
            <div className="text-xl font-bold text-gray-600 font-mono">MegaCommerce</div>
            <div className="text-xl font-bold text-gray-600 font-mono">DevAgency</div>
          </div>
        </div>
      </div>
    </section>
  );
}