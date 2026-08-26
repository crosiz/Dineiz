"use client";
import { motion } from "framer-motion";

const integrations = [
  { name: "Foodpanda", category: "Delivery", color: "bg-pink-50 text-pink-600" },
  { name: "Careem Food", category: "Delivery", color: "bg-teal-50 text-teal-700" },
  { name: "HBL Konnect", category: "Banking", color: "bg-emerald-50 text-emerald-700" },
  { name: "ZKTeco", category: "Hardware", color: "bg-gray-100 text-gray-700" },
  { name: "MCB Bank", category: "Banking", color: "bg-orange-50 text-orange-700" },
  { name: "UBL Pay", category: "Payments", color: "bg-purple-50 text-purple-700" },
  { name: "WhatsApp", category: "Ordering", color: "bg-green-50 text-green-600" },
  { name: "SMS/USSD", category: "Notify", color: "bg-yellow-50 text-yellow-700" },
];

export function IntegrationLogos() {
  return (
    <section className="bg-gray-50 border-y border-gray-100 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">
            Integrations
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Connects with what Pakistan uses
          </h2>
          <p className="mt-3 text-base text-gray-500 max-w-lg mx-auto">
            Payments, delivery, compliance, and hardware — all connected out of the box.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {integrations.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-card hover:shadow-card-md transition-shadow"
            >
              <div className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${item.color}`}>
                {item.category}
              </div>
              <div className="text-sm font-semibold text-gray-800">{item.name}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
