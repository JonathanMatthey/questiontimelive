"use client";

import { motion } from "framer-motion";
import { Check, X, ChevronUp, Clock, DollarSign, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Question } from "@/lib/types";

interface QuestionCardProps {
  question: Question;
  assetCode: string;
  assetScale: number;
  onAnswer?: () => void;
  onSkip?: () => void;
  onUpvote?: () => void;
  isHost?: boolean;
  index: number;
}

export function QuestionCard({
  question,
  assetCode,
  assetScale,
  onAnswer,
  onSkip,
  onUpvote,
  isHost = false,
  index,
}: QuestionCardProps) {
  const statusVariants = {
    pending_payment: "warning",
    paid: "accent",
    queued: "default",
    answered: "success",
    skipped: "secondary",
  } as const;

  const isActive = question.status === "paid" || question.status === "queued";
  const canInteract = isHost && isActive;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      layout
    >
      <Card className={`bg-white transition-all ${isActive ? "border-primary/30" : ""} ${question.status === "answered" ? "opacity-60" : ""}`}>
        <CardContent className="p-4">
          <div className="flex gap-4">
            {/* Upvote section */}
            <div className="flex flex-col items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                onClick={onUpvote}
                disabled={!isActive}
              >
                <ChevronUp className="w-5 h-5" />
              </Button>
              <span className="text-sm font-semibold text-foreground">{question.upvotes}</span>
            </div>

            {/* Question content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant={statusVariants[question.status]} className="text-xs">
                  {question.status.replace("_", " ").toUpperCase()}
                </Badge>
                <span className="text-xs font-medium text-accent flex items-center gap-0.5">
                  <DollarSign className="w-3 h-3" />
                  {formatCurrency(question.amountPaid, assetCode, assetScale)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(question.createdAt)}
                </span>
              </div>

              <p className="text-foreground mb-3 leading-relaxed">{question.text}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <User className="w-3.5 h-3.5" />
                  <span>{question.submitterName}</span>
                </div>

                {canInteract && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onSkip}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Skip
                    </Button>
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={onAnswer}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Answered
                    </Button>
                  </div>
                )}

                {question.status === "answered" && question.answeredAt && (
                  <div className="flex items-center gap-1 text-xs text-accent">
                    <Clock className="w-3 h-3" />
                    <span>Answered {formatRelativeTime(question.answeredAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
