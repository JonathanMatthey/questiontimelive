"use client";

import { motion, AnimatePresence } from "framer-motion";
import { User } from "lucide-react";
import type { Question } from "@/lib/types";

interface CurrentQuestionProps {
  question: Question | null;
}

export function CurrentQuestion({ question }: CurrentQuestionProps) {
  return (
    <AnimatePresence mode="wait">
      {question && (
        <motion.div
          key={question.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-amber-50 rounded-xl p-4  border border-amber-200"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-2 bg-amber-200 rounded-full px-3 py-1">
              <span className="w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                Current Question
              </span>
            </div>
          </div>

          <div className="bg-white  border border-amber-300 rounded-lg p-4">
            <p className="text-amber-900 text-lg font-medium leading-relaxed mb-3">
              {question.text}
            </p>
            <div className="flex items-center gap-2 text-amber-700 text-sm">
              <User className="w-4 h-4" />
              <span>{question.submitterName}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
