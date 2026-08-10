
import Link from "next/link";

const footerLinks = [
  {
    group: "Product",
    links: [
      { label: "Dineiz POS", href: "/product/pos" },
      { label: "Dineiz Go", href: "/product/go" },
      { label: "Dineiz Console", href: "/product/console" },
      { label: "WhatsApp AI", href: "/product/whatsapp" },
      { label: "Pricing", href: "/pricing" },
      { label: "Features", href: "/features" },
    ],
  },
  {
    group: "Industries",
    links: [
      { label: "Restaurant", href: "/industries/restaurant" },
      { label: "Small Restaurants", href: "/industries/dhaba" },
      { label: "Café & Bakery", href: "/industries/cafe" },
      { label: "Food Carts & Shops", href: "/industries/food-cart" },
    ],
  },
  {
    group: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Partners", href: "/partners" },
      { label: "Contact", href: "/contact" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    group: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Case Studies", href: "/case-studies" },
    ],
  },
];

const legal = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Cookie Policy", href: "/cookie-policy" },
];

const socials = [
  { label: "WhatsApp", href: "https://wa.me/923001234567" },
  { label: "Instagram", href: "https://instagram.com/dineiz.com" },
  { label: "LinkedIn", href: "https://linkedin.com/company/dineiz" },
  { label: "Facebook", href: "https://facebook.com/dineizpk" },
];

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Main grid */}
        <div className="py-14 grid grid-cols-2 md:grid-cols-6 gap-x-8 gap-y-10 border-b border-gray-100">

          {/* Brand column — spans 2 cols on md */}
          <div className="col-span-2">
            <Link href="/" className="inline-block mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Dineiz" className="block" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed mb-5 max-w-xs">
              Restaurant POS, billing, and management — built for Pakistan and the MENA region.
            </p>

            {/* Socials */}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-gray-400 hover:text-brand-600 transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerLinks.map((col) => (
            <div key={col.group} className="col-span-1">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                {col.group}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap justify-center sm:justify-start gap-x-5 gap-y-1.5">
            {legal.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center sm:text-right" suppressHydrationWarning>
            &copy; {new Date().getFullYear()}{" "}
            <span className="text-gray-500 font-medium">Crosiz Technologies</span>
            {" "}· All rights reserved
          </p>
        </div>
      </div>
    </footer>
  );
}
