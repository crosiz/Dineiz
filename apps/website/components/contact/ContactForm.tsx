"use client";

import React, { useState } from "react";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          source: "Website Contact Form",
        }),
      });
      
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch (err) {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-6 text-center font-medium">
        <h3 className="text-lg font-bold mb-2">Message Sent!</h3>
        <p className="text-sm">Thank you. Our team will contact you soon.</p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Name *</label>
          <input
            type="text"
            name="name"
            required
            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone / WhatsApp *</label>
          <input
            type="tel"
            name="phone"
            required
            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email *</label>
        <input
          type="email"
          name="email"
          required
          className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Restaurant Name *</label>
        <input
          type="text"
          name="restaurantName"
          required
          className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message *</label>
        <textarea
          name="message"
          required
          rows={4}
          className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full py-3 text-sm font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
      >
        {status === "loading" ? "Sending..." : "Send Message"}
      </button>
      {status === "error" && (
        <div className="text-red-500 text-sm mt-2 text-center">Something went wrong. Please try again.</div>
      )}
    </form>
  );
}
