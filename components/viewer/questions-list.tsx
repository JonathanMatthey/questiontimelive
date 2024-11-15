"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ChevronUp, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Question, QuestionSortOption } from "@/lib/types";

interface QuestionsListProps {
  sessionId: string;
  assetCode: string;
  assetScale: number;
}

export function QuestionsList({ sessionId, assetCode, assetScale }: QuestionsListProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sortBy, setSortBy] = useState<QuestionSortOption>("newest");

  // Fetch questions from server
  const fetchQuestions = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/questions?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
      }
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchQuestions();

    // Poll for updates
    const interval = setInterval(fetchQuestions, 2000);
    return () => clearInterval(interval);
  }, [fetchQuestions]);

  const handleUpvote = async (questionId: string) => {
    try {
      await fetch("/api/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: questionId, action: "upvote" }),
      });
      fetchQuestions();
    } catch (error) {
      console.error("Failed to upvote question:", error);
    }
  };

  const displayQuestions = useMemo(() => {
    const filtered = questions.filter((q) => q.status !== "pending_payment" && q.status !== "skipped");

    switch (sortBy) {
      case "oldest":
        return [...filtered].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case "highest_paid":
        return [...filtered].sort((a, b) => b.amountPaid - a.amountPaid);
      case "most_upvoted":
        return [...filtered].sort((a, b) => b.upvotes - a.upvotes);
      default:
        return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [questions, sortBy]);

  const answeredCount = displayQuestions.filter((q) => q.status === "answered").length;

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="w-5 h-5 text-primary" />
            Questions
            <Badge variant="secondary" className="ml-1">{displayQuestions.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as QuestionSortOption)}
              className="bg-transparent border-none text-sm text-muted-foreground focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="highest_paid">Top Paid</option>
              <option value="most_upvoted">Most Upvoted</option>
            </select>
          </div>
        </div>
        {answeredCount > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            {answeredCount} question{answeredCount !== 1 ? "s" : ""} answered
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {displayQuestions.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No questions yet</p>
            <p className="text-sm text-muted-foreground">Be the first to ask!</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {displayQuestions.map((question, index) => (
                <QuestionItem
                  key={question.id}
                  question={question}
                  assetCode={assetCode}
                  assetScale={assetScale}
                  onUpvote={() => handleUpvote(question.id)}
                  index={index}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface QuestionItemProps {
  question: Question;
  assetCode: string;
  assetScale: number;
  onUpvote: () => void;
  index: number;
}

function QuestionItem({ question, assetCode, assetScale, onUpvote, index }: QuestionItemProps) {
  const isAnswered = question.status === "answered";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className={`p-4 transition-colors ${isAnswered ? "bg-accent/5" : "hover:bg-secondary/50"}`}
    >
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={onUpvote}
            disabled={isAnswered}
          >
            <ChevronUp className="w-5 h-5" />
          </Button>
          <span className="text-sm font-semibold text-foreground">{question.upvotes}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-sm font-medium text-foreground">{question.submitterName}</span>
            <span className="text-xs font-medium text-accent">
              {formatCurrency(question.amountPaid, assetCode, assetScale)}
            </span>
            {isAnswered && <Badge variant="success" className="text-xs">Answered</Badge>}
          </div>
          <p className={`text-sm leading-relaxed ${isAnswered ? "text-muted-foreground" : "text-foreground"}`}>
            {question.text}
          </p>
          <span className="text-xs text-muted-foreground mt-2 block">
            {formatRelativeTime(question.createdAt)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
