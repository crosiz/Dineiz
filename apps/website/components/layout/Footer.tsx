import Link from "next/link";
import Image from "next/image";
import { Instagram, Linkedin, MessageCircle, Youtube } from "lucide-react";

const productLinks = [
  { label: "Dineiz POS", href: "/product/pos" },
  { label: "Dineiz Go", href: "/product/go" },
  { label: "Dineiz Console", href: "/product/console" },
  { label: "WhatsApp Orders", href: "/product/whatsapp" },
  { label: "Pricing", href: "/pricing" },
];

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "/contact" },
  { label: "Built by Crosiz", href: "https://crosiz.com" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Cookie Policy", href: "/cookie-policy" },
];

export function Footer() {
  return (
    <footer className="bg-gray-50 py-16 md:py-24 border-t border-gray-100">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-8 mb-16">
          
          {/* Column 1: Brand & Socials */}
          <div className="flex flex-col gap-5">
            <Link href="/" className="inline-block mb-6">
              <Image src="/logo.png" alt="Dineiz Logo" width={112} height={28} className="h-[23px] md:h-7 w-auto object-contain" />
            </Link>
            <p className="text-[14px] text-gray-500 leading-snug">
              Smart billing for Pakistan&apos;s restaurants.
            </p>
            <div className="flex items-center gap-5 mt-2">
              <a href="https://instagram.com/dineiz.com" aria-label="Instagram" className="text-gray-400 hover:text-[#FF6B35] transition-colors duration-200">
                <Instagram size={20} />
              </a>
              <a href="https://linkedin.com/company/dineiz" aria-label="LinkedIn" className="text-gray-400 hover:text-[#FF6B35] transition-colors duration-200">
                <Linkedin size={20} />
              </a>
              <a href="https://wa.me/923141986044" aria-label="WhatsApp" className="text-gray-400 hover:text-[#FF6B35] transition-colors duration-200">
                <MessageCircle size={20} />
              </a>
              <a href="https://youtube.com/@dineiz" aria-label="YouTube" className="text-gray-400 hover:text-[#FF6B35] transition-colors duration-200">
                <Youtube size={20} />
              </a>
            </div>
          </div>

          {/* Column 2: Product */}
          <div className="flex flex-col gap-5">
            <h3 className="text-[14px] font-semibold text-gray-900 tracking-tight">Product</h3>
            <div className="flex flex-col gap-3.5">
              {productLinks.map((link) => (
                <Link key={link.href} href={link.href} className="text-[14px] text-gray-500 hover:text-[#FF6B35] transition-colors duration-200">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Column 3: Company */}
          <div className="flex flex-col gap-5">
            <h3 className="text-[14px] font-semibold text-gray-900 tracking-tight">Company</h3>
            <div className="flex flex-col gap-3.5">
              {companyLinks.map((link) => (
                <Link key={link.href} href={link.href} className="text-[14px] text-gray-500 hover:text-[#FF6B35] transition-colors duration-200">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Column 4: Legal */}
          <div className="flex flex-col gap-5">
            <h3 className="text-[14px] font-semibold text-gray-900 tracking-tight">Legal</h3>
            <div className="flex flex-col gap-3.5">
              {legalLinks.map((link) => (
                <Link key={link.href} href={link.href} className="text-[14px] text-gray-500 hover:text-[#FF6B35] transition-colors duration-200">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-[13px] text-gray-500 font-medium">
            &copy; {new Date().getFullYear()} Dineiz by Crosiz Technologies
          </div>
          <div className="text-[13px] text-gray-500">
            Made with <span className="text-red-500">❤</span> in Pakistan
          </div>
        </div>

      </div>
    </footer>
  );
}
