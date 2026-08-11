"use client";

import React from "react";
import { event } from "@/lib/gtag";

export function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/923141986044?text=Hi%2C%20I%27d%20like%20a%20Dineiz%20demo"
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => event({ action: 'whatsapp_contact', category: 'conversion', label: 'Contact Page WhatsApp' })}
      className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
    >
      WhatsApp Us Now
    </a>
  );
}
