"use client";
import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AccordionItem {
  question: string;
  answer: string;
}

interface AccordionProps {
  items: AccordionItem[];
  /** Allow multiple open at once? Default false */
  allowMultiple?: boolean;
  className?: string;
}

function AccordionRow({
  item,
  isOpen,
  onToggle,
  index,
}: {
  item: AccordionItem;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <div
      className={cn(
        "border-b border-gray-100 last:border-none",
        isOpen && "bg-gray-50/60"
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left group"
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            "text-sm font-semibold transition-colors",
            isOpen ? "text-brand-600" : "text-gray-900 group-hover:text-brand-600"
          )}
        >
          {item.question}
        </span>
        <span
          className={cn(
            "shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-200",
            isOpen
              ? "border-brand-400 bg-brand-50 text-brand-600"
              : "border-gray-300 bg-white text-gray-400 group-hover:border-brand-300 group-hover:text-brand-500"
          )}
        >
          {isOpen ? <Minus size={12} /> : <Plus size={12} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key={`faq-${index}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-4">
              <p className="text-sm text-gray-500 leading-relaxed">{item.answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Accordion({ items, allowMultiple = false, className }: AccordionProps) {
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setOpenIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        if (!allowMultiple) next.clear();
        next.add(i);
      }
      return next;
    });
  }

  return (
    <div
      className={cn(
        "bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-card divide-y divide-gray-100",
        className
      )}
    >
      {items.map((item, i) => (
        <AccordionRow
          key={i}
          item={item}
          index={i}
          isOpen={openIndexes.has(i)}
          onToggle={() => toggle(i)}
        />
      ))}
    </div>
  );
}
