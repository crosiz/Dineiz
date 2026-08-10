import Link from "next/link";

export default function NotFound() {
  return (
    <section className="bg-white min-h-[60vh] flex items-center justify-center py-24">
      <div className="text-center px-4">
        <div className="text-8xl font-bold text-gray-100 mb-2">404</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Page not found</h1>
        <p className="text-base text-gray-500 mb-8 max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist. Let&apos;s get you back on track.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold border border-gray-300 text-gray-700 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </section>
  );
}
