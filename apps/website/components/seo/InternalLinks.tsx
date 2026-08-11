import Link from "next/link";
import React from "react";

const LINKS = [
  { href: "/industries/restaurant", label: "Full-Service Restaurant POS" },
  { href: "/industries/dhaba", label: "Dhaba & Local Eatery Billing" },
  { href: "/industries/cafe", label: "Cafe & Coffee Shop System" },
  { href: "/industries/food-cart", label: "Food Cart & Kiosk Software" },
  { href: "/pricing", label: "Dineiz Pricing Plans" },
  { href: "/blog", label: "Restaurant Management Blog" }
];

export function InternalLinks({ currentPath }: { currentPath: string }) {
  // Filter out the current path and grab 3 random/relevant links
  const availableLinks = LINKS.filter(link => link.href !== currentPath);
  
  // A deterministic way to pick 3 links based on the path length to avoid hydration mismatch
  const index1 = currentPath.length % availableLinks.length;
  const index2 = (index1 + 1) % availableLinks.length;
  const index3 = (index1 + 2) % availableLinks.length;

  const linksToRender = [availableLinks[index1], availableLinks[index2], availableLinks[index3]];

  return (
    <div className="border-t border-gray-100 py-8 mt-12 bg-gray-50/50 rounded-xl px-6">
      <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Related Pages</h3>
      <ul className="grid sm:grid-cols-3 gap-4">
        {linksToRender.map((link) => (
          <li key={link.href}>
            <Link 
              href={link.href} 
              className="text-sm text-brand-600 hover:text-brand-800 hover:underline underline-offset-4 font-medium transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
