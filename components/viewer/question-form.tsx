"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, User, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Session } from "@/lib/types";

interface QuestionFormProps {
  session: Session;
}

type SubmitStatus = "idle" | "submitting" | "success";

export function QuestionForm({ session }: QuestionFormProps) {
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");

  const canSubmit = name.trim() && question.trim() && session.status === "live";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    setSubmitStatus("submitting");

    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          text: question.trim(),
          submitterName: name.trim(),
          amountPaid: 0,
          status: "paid", // Skip payment, go straight to paid
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit question");
      }

      setSubmitStatus("success");

      setTimeout(() => {
        setQuestion("");
        setSubmitStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Submit error:", error);
      setSubmitStatus("idle");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="bg-white shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="w-5 h-5 text-primary" />
            Ask a question
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {session.status !== "live" ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {session.status === "draft"
                  ? "This session hasn't started yet. Check back soon!"
                  : "This session has ended. Thanks for watching!"}
              </p>
            </div>
          ) : submitStatus === "success" ? (
            <div className="py-6 flex items-center justify-center gap-3 text-accent">
              <Check className="w-5 h-5" />
              <span>Question submitted!</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Your name
                </label>
                <Input
                  placeholder="How should we address you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  disabled={submitStatus === "submitting"}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Send className="w-4 h-4 text-muted-foreground" />
                  Your question
                </label>
                <Textarea
                  placeholder="What would you like to ask?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={4}
                  maxLength={500}
                  disabled={submitStatus === "submitting"}
                />
                <p className="text-xs text-muted-foreground text-right">{question.length}/500</p>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!canSubmit || submitStatus === "submitting"}
              >
                {submitStatus === "submitting" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Question
                    <Send className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
