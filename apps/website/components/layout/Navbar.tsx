"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ChevronDown, Menu, X, ArrowRight,
  Monitor, Smartphone, LayoutDashboard, MessageCircle,
  UtensilsCrossed, Coffee, ShoppingCart, Store,
  BookOpen, FileText, History, Handshake,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const products = [
  {
    name: "Dineiz POS",
    description: "Tablet-based billing terminal for dine-in & takeaway",
    href: "/product/pos",
    icon: Monitor,
  },
  {
    name: "Dineiz Go",
    description: "Mobile PWA for food carts and counter-service restaurants",
    href: "/product/go",
    icon: Smartphone,
  },
  {
    name: "Dineiz Console",
    description: "Centralized analytics dashboard for owners",
    href: "/product/console",
    icon: LayoutDashboard,
  },
  {
    name: "WhatsApp AI",
    description: "Take orders via WhatsApp automatically — 24/7",
    href: "/product/whatsapp",
    icon: MessageCircle,
  },
];

const industries = [
  { name: "Full-Service Restaurant", href: "/industries/restaurant", icon: UtensilsCrossed },
  { name: "Small Restaurants", href: "/industries/dhaba", icon: Store },
  { name: "Café & Bakery", href: "/industries/cafe", icon: Coffee },
  { name: "Food Carts & Shops", href: "/industries/food-cart", icon: ShoppingCart },
];

const resources = [
  { name: "Blog", href: "/blog", icon: BookOpen },
  { name: "Case Studies", href: "/case-studies", icon: FileText },
  { name: "Changelog", href: "/changelog", icon: History },
  { name: "Partners", href: "/partners", icon: Handshake },
];

function Dropdown({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium transition-all duration-200 py-1.5 px-3 rounded-lg",
          open ? "text-brand-600 bg-brand-50" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        )}
      >
        {label}
        <ChevronDown
          size={14}
          className={cn("transition-transform duration-300", open ? "rotate-180 text-brand-600" : "text-gray-400")}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 mt-2 z-50 min-w-[280px] bg-white border border-[#d2d2d7]/50 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-1.5 origin-top-left"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 8); }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Prevent scrolling when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [mobileOpen]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-300",
        scrolled
          ? "bg-white/90 backdrop-blur-lg border-b border-[#d2d2d7]/50 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
          : "bg-white border-b border-[#d2d2d7]"
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Dineiz"
            className="block"
            style={{ height: 32, width: 'auto', objectFit: 'contain' }}
          />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-3 flex-1">
          {/* Products */}
          <Dropdown label="Products">
            <div className="p-1 space-y-0.5">
              {products.map((p) => {
                const Icon = p.icon;
                return (
                  <Link
                    key={p.href}
                    href={p.href}
                    className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-md bg-brand-50 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-brand-100 group-hover:scale-105 transition-all">
                      <Icon size={16} className="text-brand-500" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                        {p.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 leading-snug">{p.description}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-gray-100 px-4 py-3 mt-1 bg-gray-50/50 rounded-b-lg">
              <Link
                href="/pricing"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
              >
                View pricing and compare plans <ArrowRight size={12} />
              </Link>
            </div>
          </Dropdown>

          {/* Industries */}
          <Dropdown label="Industries">
            <div className="p-1 space-y-0.5">
              {industries.map((i) => {
                const Icon = i.icon;
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-600 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center group-hover:bg-brand-50 transition-colors shrink-0">
                      <Icon size={14} className="text-gray-500 group-hover:text-brand-500 transition-colors" />
                    </div>
                    {i.name}
                  </Link>
                );
              })}
            </div>
          </Dropdown>

          {/* Resources */}
          <Dropdown label="Resources">
            <div className="p-1 space-y-0.5">
              {resources.map((r) => {
                const Icon = r.icon;
                return (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-600 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center group-hover:bg-brand-50 transition-colors shrink-0">
                      <Icon size={14} className="text-gray-500 group-hover:text-brand-500 transition-colors" />
                    </div>
                    {r.name}
                  </Link>
                );
              })}
            </div>
          </Dropdown>

          <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-1.5 px-3 rounded-lg hover:bg-gray-50">
            Pricing
          </Link>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden lg:flex items-center gap-4 shrink-0">
          <Link
            href="/contact"
            className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            Book Demo
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold bg-brand-500 text-white rounded-full shadow-[0_2px_8px_rgba(255,107,53,0.25)] hover:bg-brand-600 hover:shadow-[0_4px_12px_rgba(255,107,53,0.35)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="lg:hidden p-2 -mr-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Menu size={22} />
        </button>
      </nav>

      {/* Mobile Drawer using Framer Motion */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-[90] bg-gray-900/40 backdrop-blur-sm"
            />
            
            {/* Sliding Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed inset-y-0 right-0 z-[100] w-[90%] max-w-sm bg-white shadow-2xl flex flex-col px-6 pb-8 pt-6 border-l border-gray-100"
            >
              {/* Header inside drawer */}
              <div className="flex items-center justify-end mb-6">
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                  className="p-2 -mr-2 rounded-full bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="flex-1 overflow-y-auto pr-2"
              >
                {/* Products */}
                <motion.div variants={itemVariants} className="mb-8">
                  <div className="text-[11px] font-bold text-brand-500 uppercase tracking-widest mb-4">Products</div>
                  <div className="space-y-4">
                    {products.map((p) => (
                      <Link
                        key={p.href}
                        href={p.href}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 text-lg font-bold text-gray-900 hover:text-brand-600 transition-colors"
                      >
                        <p.icon size={18} className="text-gray-400" />
                        {p.name}
                      </Link>
                    ))}
                  </div>
                </motion.div>

                {/* Industries */}
                <motion.div variants={itemVariants} className="mb-8">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Industries</div>
                  <div className="space-y-4">
                    {industries.map((i) => (
                      <Link
                        key={i.href}
                        href={i.href}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 text-base font-semibold text-gray-700 hover:text-brand-600 transition-colors"
                      >
                        <i.icon size={16} className="text-gray-400" />
                        {i.name}
                      </Link>
                    ))}
                  </div>
                </motion.div>
                
                {/* Resources */}
                <motion.div variants={itemVariants} className="mb-8">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Resources</div>
                  <div className="space-y-4">
                    {resources.map((r) => (
                      <Link
                        key={r.href}
                        href={r.href}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 text-base font-semibold text-gray-700 hover:text-brand-600 transition-colors"
                      >
                        <r.icon size={16} className="text-gray-400" />
                        {r.name}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-auto pt-6 border-t border-gray-100 flex flex-col gap-3"
              >
                <Link
                  href="/pricing"
                  onClick={() => setMobileOpen(false)}
                  className="block text-center py-3.5 text-sm font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  View Pricing
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setMobileOpen(false)}
                  className="block text-center py-3.5 text-sm font-bold bg-brand-500 text-white rounded-xl shadow-[0_4px_14px_rgba(255,107,53,0.3)] hover:bg-brand-600 transition-colors"
                >
                  Start Free Trial
                </Link>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
