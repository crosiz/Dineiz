"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "dineiz-announcement-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function AnnouncementBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      if (Date.now() - ts < DISMISS_DURATION_MS) return;
    }
    setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative bg-[#f5f5f7] border-b border-[#d2d2d7] py-2.5 px-4 text-center text-[13px] text-[#6e6e73] font-medium">
      <span>
        Dineiz now supports configurable GST rates and SRB tax settings.{" "}
        <a href="/product/pos" className="font-semibold text-[#1d1d1f] hover:text-[#FF6B35] transition-colors">
          Learn more →
        </a>
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
