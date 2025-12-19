"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, User, Loader2, Check, Wallet, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Session } from "@/lib/types";

interface QuestionFormProps {
  session: Session;
}

type SubmitStatus = "idle" | "submitting" | "success";
type WalletStatus = "checking" | "not_supported" | "not_connected" | "connecting" | "connected";

// Web Monetization types based on the specification
// https://webmonetization.org/specification/
interface MonetizationCurrencyAmount {
  value: string;
  currency: string;
}

interface MonetizationEvent extends Event {
  amountSent?: MonetizationCurrencyAmount;
  incomingPayment?: string;
  paymentPointer?: string;
}

export function QuestionForm({ session }: QuestionFormProps) {
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [walletStatus, setWalletStatus] = useState<WalletStatus>("checking");
  const [totalSent, setTotalSent] = useState<{ value: number; currency: string }>({ value: 0, currency: "" });

  // Check for Web Monetization support and listen for monetization events
  // Following the spec: https://webmonetization.org/specification/
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    // Check if Web Monetization is supported using the spec method
    // Section 1.1: Use link.relList.supports("monetization")
    const testLink = document.createElement("link");
    const isSupported = testLink.relList.supports("monetization");

    if (!isSupported) {
      setWalletStatus("not_supported");
      return;
    }

    // Wait for the monetization link to be added by the parent page
    // It may take a moment for the watch page to add it
    let timeoutId: NodeJS.Timeout | null = null;
    let cleanupFn: (() => void) | null = null;
    let isCleanedUp = false;

    const findAndSetupLink = () => {
      if (isCleanedUp) return;

      const monetizationLink = document.querySelector('link[rel="monetization"]') as HTMLLinkElement | null;
      
      if (!monetizationLink) {
        // Link not found yet, try again after a short delay
        timeoutId = setTimeout(findAndSetupLink, 100);
        return;
      }

      // Initially set to not_connected - will change when monetization starts
      setWalletStatus("not_connected");

      // Listen for monetization events on the link element
      // Section 1.3: Events are dispatched to link elements and bubble up
      const handleMonetization = (event: Event) => {
        const monetizationEvent = event as MonetizationEvent;
        
        // When we receive a monetization event, the wallet is connected and streaming
        setWalletStatus("connected");
        
        // Track total sent (Section 9.4: amountSent attribute)
        if (monetizationEvent.amountSent) {
          const { value, currency } = monetizationEvent.amountSent;
          setTotalSent((prev) => ({
            value: prev.value + parseFloat(value),
            currency: currency || prev.currency,
          }));
        }
      };

      monetizationLink.addEventListener("monetization", handleMonetization);

      // Store cleanup function
      cleanupFn = () => {
        monetizationLink.removeEventListener("monetization", handleMonetization);
      };
    };

    // Start looking for the link
    findAndSetupLink();

    // Cleanup
    return () => {
      isCleanedUp = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, []);

  const canSubmit = 
    name.trim() && 
    question.trim() && 
    session.status === "live" && 
    walletStatus === "connected";

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
          amountPaid: totalSent.value,
          status: "paid",
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

  const renderWalletStatus = () => {
    if (walletStatus === "checking") {
      return (
        <div className="bg-secondary/50 rounded-lg p-4 border border-border">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            <div>
              <p className="text-sm font-medium text-foreground">Checking Web Monetization...</p>
              <p className="text-xs text-muted-foreground">Detecting wallet connection</p>
            </div>
          </div>
        </div>
      );
    }

    if (walletStatus === "not_supported") {
      return (
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">Web Monetization Not Detected</p>
              <p className="text-xs text-amber-700 mt-1">
                To submit questions, you need a Web Monetization provider. 
                <a 
                  href="https://webmonetization.org/docs/intro/sending-payments" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline ml-1 hover:text-amber-900"
                >
                  Learn more
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (walletStatus === "not_connected") {
      return (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-start gap-3">
            <Wallet className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Connect Your Wallet</p>
              <p className="text-xs text-blue-700 mt-1">
                Web Monetization detected! Please connect your wallet to start streaming payments and submit questions.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                <span className="text-xs text-blue-600">Waiting for connection...</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (walletStatus === "connected") {
      return (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Zap className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-900">Wallet Connected</p>
                <p className="text-xs text-green-700">Streaming payments active</p>
              </div>
            </div>
            {totalSent.value > 0 && (
              <div className="text-right">
                <p className="text-sm font-semibold text-green-900">
                  {totalSent.value.toFixed(6)} {totalSent.currency}
                </p>
                <p className="text-xs text-green-700">sent</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
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

              {/* Web Monetization Wallet Status */}
              {renderWalletStatus()}

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
                ) : walletStatus !== "connected" ? (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet to Submit
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
