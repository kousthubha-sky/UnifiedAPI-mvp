import Hero from '@/components/Hero';
import Features from '@/components/Features';

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <section className="w-full py-16 md:py-20 bg-primary text-white px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-lg mb-8 text-blue-100">
            Start processing payments securely today. Get your API keys in minutes.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center px-8 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Access Dashboard
          </a>
        </div>
      </section>
    </>
  );
}
