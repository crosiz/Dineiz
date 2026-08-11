"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { event } from "@/lib/gtag";

const products = [
  { name: "Dineiz POS", desc: "Tablet-based billing terminal", href: "/product/pos" },
  { name: "Dineiz Go", desc: "Mobile PWA for counter service", href: "/product/go" },
  { name: "Dineiz Console", desc: "Analytics dashboard for owners", href: "/product/console" },
  { name: "WhatsApp Orders", desc: "Automated WhatsApp ordering", href: "/product/whatsapp" },
];

const industries = [
  { name: "Full-Service Restaurant", desc: "For fine dining & casual eateries", href: "/industries/restaurant" },
  { name: "Small Restaurants", desc: "For dhabas & local food spots", href: "/industries/dhaba" },
  { name: "Café & Bakery", desc: "For coffee shops & bakeries", href: "/industries/cafe" },
  { name: "Food Carts & Shops", desc: "For kiosks & takeaway stalls", href: "/industries/food-cart" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Prevent scrolling on body when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [mobileMenuOpen]);

  const isActive = (path: string) => pathname?.startsWith(path);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full bg-white transition-all duration-200",
          scrolled ? "backdrop-blur-xl bg-white/80 border-b border-gray-100" : ""
        )}
      >
        <div className="mx-auto flex h-14 md:h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Brand Logo & Wordmark */}
          <Link
            href="/"
            className="flex items-center"
          >
            <Image src="/logo.svg" alt="Dineiz Logo" width={110} height={28} className="h-7 w-auto object-contain" priority />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {/* Products Dropdown */}
            <div className="group relative">
              <button
                className={cn(
                  "flex items-center gap-1 text-[14px] font-medium transition-colors duration-150",
                  isActive("/product") || isActive("/industries") ? "text-[#FF6B35]" : "text-[#1A1A1A] hover:text-[#FF6B35]"
                )}
              >
                Products
                <ChevronDown size={14} className="opacity-50 transition-transform group-hover:rotate-180" />
              </button>

              {/* Dropdown Card */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-150 ease-out">
                <div className="w-[600px] bg-white border border-gray-100 rounded-xl shadow-xl p-6 grid grid-cols-2 gap-8">
                  {/* Products Column */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Products</h3>
                    <div className="flex flex-col gap-4">
                      {products.map((p) => (
                        <Link key={p.href} href={p.href} className="group/item">
                          <div className="text-[14px] font-medium text-[#1A1A1A] group-hover/item:text-[#FF6B35] transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[13px] text-gray-500 mt-0.5">
                            {p.desc}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Industries Column */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">By Industry</h3>
                    <div className="flex flex-col gap-4">
                      {industries.map((i) => (
                        <Link key={i.href} href={i.href} className="group/item">
                          <div className="text-[14px] font-medium text-[#1A1A1A] group-hover/item:text-[#FF6B35] transition-colors">
                            {i.name}
                          </div>
                          <div className="text-[13px] text-gray-500 mt-0.5">
                            {i.desc}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Link
              href="/pricing"
              className={cn(
                "text-[14px] font-medium transition-colors duration-150",
                isActive("/pricing") ? "text-[#FF6B35]" : "text-[#1A1A1A] hover:text-[#FF6B35]"
              )}
            >
              Pricing
            </Link>

            <Link
              href="/blog"
              className={cn(
                "text-[14px] font-medium transition-colors duration-150",
                isActive("/blog") ? "text-[#FF6B35]" : "text-[#1A1A1A] hover:text-[#FF6B35]"
              )}
            >
              Blog
            </Link>
          </nav>

          {/* Right Action Buttons (Desktop) */}
          <div className="hidden md:flex items-center gap-4 shrink-0">

            <Link
              href="/signup"
              onClick={() => event({ action: 'sign_up_click', category: 'conversion', label: 'Navbar Desktop CTA' })}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold bg-[#FF6B35] text-white rounded-full shadow-[0_2px_8px_rgba(255,107,53,0.25)] hover:bg-[#ea580c] hover:shadow-[0_4px_12px_rgba(255,107,53,0.35)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden text-[#1A1A1A] p-2 -mr-2"
            aria-label="Open menu"
          >
            <Menu size={24} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Mobile Full-Screen Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] bg-white flex flex-col"
          >
            <div className="flex h-14 items-center justify-between px-4 sm:px-6">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center"
              >
                <Image src="/logo.svg" alt="Dineiz Logo" width={110} height={28} className="h-7 w-auto object-contain" priority />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#1A1A1A] p-2 -mr-2"
                aria-label="Close menu"
              >
                <X size={24} strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pt-8 pb-24 flex flex-col gap-[20px]">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Products</div>
              {products.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center h-[48px] text-[20px] font-medium text-[#1A1A1A]"
                >
                  {p.name}
                </Link>
              ))}

              <div className="h-px bg-gray-100 my-4" />

              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">By Industry</div>
              {industries.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center h-[48px] text-[20px] font-medium text-[#1A1A1A]"
                >
                  {i.name}
                </Link>
              ))}

              <div className="h-px bg-gray-100 my-4" />

              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Company</div>
              <Link
                href="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center h-[48px] text-[20px] font-medium text-[#1A1A1A]"
              >
                Pricing
              </Link>
              <Link
                href="/blog"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center h-[48px] text-[20px] font-medium text-[#1A1A1A]"
              >
                Blog
              </Link>
            </div>

            {/* Mobile Bottom Action Area */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 flex flex-col gap-3">

              <Link
                href="/signup"
                onClick={() => {
                  setMobileMenuOpen(false);
                  event({ action: 'sign_up_click', category: 'conversion', label: 'Navbar Mobile CTA' });
                }}
                className="block text-center py-3.5 text-sm font-bold bg-[#FF6B35] text-white rounded-xl shadow-[0_4px_14px_rgba(255,107,53,0.3)] hover:bg-[#ea580c] transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
