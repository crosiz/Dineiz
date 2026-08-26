"use client";
import { Lock, Users, FileText, Server } from "lucide-react";
import { motion } from "framer-motion";

const items = [
  {
    icon: Lock,
    title: "Role-Based Access Control",
    desc: "Set exact permissions for owners, managers, and cashiers. Staff can only access what they need.",
  },
  {
    icon: FileText,
    title: "Full Audit Trail",
    desc: "Every void, discount, and refund is logged with timestamp, device, and staff name — permanently.",
  },
  {
    icon: Users,
    title: "Staff Theft Prevention",
    desc: "Blind closing reports, cash drawer logs, and override alerts catch discrepancies before they become losses.",
  },
  {
    icon: Server,
    title: "Encrypted Cloud Database",
    desc: "Order and payment data is stored in a managed, encrypted PostgreSQL database — not a local file that can be lost or tampered with.",
  },
];

export function SecuritySection() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">
            Security & Reliability
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Built to protect your business
          </h2>
          <p className="mt-3 text-base text-gray-500 max-w-lg mx-auto">
            From staff access controls to encrypted backups — Dineiz keeps your data and cash safe.
          </p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-gray-50 border border-gray-200 rounded-xl p-5"
              >
                <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-card">
                  <Icon size={18} className="text-brand-500" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{item.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
