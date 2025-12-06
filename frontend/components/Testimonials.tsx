'use client';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatar: string;
}

const testimonials: Testimonial[] = [
  {
    quote: "PaymentHub simplified our entire payment infrastructure. We went from managing three separate integrations to just one API. Setup took less than a day.",
    author: "Sarah Chen",
    role: "CTO",
    company: "TechFlow",
    avatar: "SC",
  },
  {
    quote: "The auto-retry mechanism has saved us countless failed transactions. Our payment success rate improved by 15% within the first month of switching.",
    author: "Marcus Johnson",
    role: "Engineering Lead",
    company: "ShopScale",
    avatar: "MJ",
  },
  {
    quote: "Outstanding API documentation and the Node SDK made integration a breeze. Their support team is incredibly responsive. Highly recommended!",
    author: "Emily Rodriguez",
    role: "Full Stack Developer",
    company: "StartupXYZ",
    avatar: "ER",
  },
  {
    quote: "We process over 100,000 transactions daily through PaymentHub. The reliability and analytics have been game-changers for our business.",
    author: "David Kim",
    role: "VP of Engineering",
    company: "MegaCommerce",
    avatar: "DK",
  },
  {
    quote: "The unified API approach means our team doesn't need to learn multiple payment provider APIs. It's been a huge productivity boost.",
    author: "Lisa Thompson",
    role: "Senior Developer",
    company: "DevAgency",
    avatar: "LT",
  },
  {
    quote: "Security and compliance were our top concerns. PaymentHub handles all PCI requirements, letting us focus on building features.",
    author: "James Wilson",
    role: "Security Lead",
    company: "SecureFinance",
    avatar: "JW",
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="w-full py-20 md:py-28 bg-gray-50 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-primary">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-6 mb-4">
            Loved by Developers & Businesses
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            See what our customers have to say about their experience with PaymentHub.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="h-5 w-5 text-yellow-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <blockquote className="text-gray-600 mb-6 leading-relaxed">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.author}</p>
                  <p className="text-sm text-gray-500">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
