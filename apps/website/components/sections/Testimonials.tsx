"use client";
import { motion } from "framer-motion";

export function Testimonials() {
  return (
    <section className="bg-white border-y border-[#d2d2d7] py-20">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-2xl font-bold text-[#1d1d1f] tracking-tight mb-4"
        >
          Built for the future of food businesses in Pakistan &amp; MENA.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-[#6e6e73] text-[15px]"
        >
          Designed from the ground up to solve the real problems of local restaurants, cafes, and food carts.
        </motion.p>
      </div>
    </section>
  );
}
