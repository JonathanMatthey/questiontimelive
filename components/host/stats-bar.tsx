"use client";

import { motion } from "framer-motion";
import { Users, DollarSign, MessageSquare, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { SessionStats } from "@/lib/types";

interface StatsBarProps {
  stats: SessionStats;
  assetCode: string;
  assetScale: number;
}

export function StatsBar({ stats, assetCode, assetScale }: StatsBarProps) {
  const items = [
    {
      icon: Users,
      label: "Viewers",
      value: stats.viewerCount.toString(),
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: MessageSquare,
      label: "Questions",
      value: stats.totalQuestions.toString(),
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      icon: CheckCircle,
      label: "Answered",
      value: stats.answeredQuestions.toString(),
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      icon: DollarSign,
      label: "Earned",
      value: formatCurrency(stats.totalEarned, assetCode, assetScale),
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className="bg-white rounded-xl p-4 border border-border shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${item.bgColor}`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
