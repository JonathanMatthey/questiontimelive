"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Send, DollarSign, User, Wallet, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, parseWalletAddress } from "@/lib/utils";
import type { Session } from "@/lib/types";

interface QuestionFormProps {
  session: Session;
}

type PaymentStatus = "idle" | "creating" | "awaiting" | "completed" | "error";

export function QuestionForm({ session }: QuestionFormProps) {
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [showWalletInput, setShowWalletInput] = useState(false);
  const questionIdRef = useRef<string | null>(null);

  const canSubmit = name.trim() && question.trim() && session.status === "live";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    setPaymentStatus("creating");
    setErrorMessage("");

    try {
      // Create the question via server API
      const questionResponse = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          text: question.trim(),
          submitterName: name.trim(),
          submitterWalletAddress: walletAddress ? parseWalletAddress(walletAddress) : undefined,
          amountPaid: session.questionPrice,
          status: "pending_payment",
        }),
      });

      if (!questionResponse.ok) {
        throw new Error("Failed to create question");
      }

      const newQuestion = await questionResponse.json();
      questionIdRef.current = newQuestion.id;

      // Create incoming payment via API
      const paymentResponse = await fetch("/api/payments/create-incoming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostWalletAddress: session.hostWalletAddress,
          amount: session.questionPrice,
          questionId: newQuestion.id,
          sessionId: session.id,
          assetCode: session.assetCode,
          assetScale: session.assetScale,
        }),
      });

      let paymentData;
      try {
        const text = await paymentResponse.text();
        paymentData = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error("Failed to parse payment response:", parseError);
        paymentData = { error: "Invalid response from server" };
      }

      if (!paymentResponse.ok) {
        console.error("Payment creation failed:", {
          status: paymentResponse.status,
          statusText: paymentResponse.statusText,
          error: paymentData.error,
          details: paymentData.details,
        });
        throw new Error(paymentData.error || paymentData.details || `Failed to create payment (${paymentResponse.status})`);
      }

      // Update question with payment ID
      await fetch("/api/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newQuestion.id,
          paymentId: paymentData.paymentId,
        }),
      });

      // If viewer provided wallet address, initiate outgoing payment
      // Otherwise, simulate payment for demo purposes
      if (walletAddress && !paymentData.mock) {
        try {
          // In a real implementation, you'd need viewer's wallet credentials
          // For now, we'll simulate the payment
          console.log("Viewer wallet provided, but credentials needed for real payment");
        } catch (error) {
          console.error("Failed to initiate outgoing payment:", error);
        }
      }

      setPaymentStatus("awaiting");

      // Poll for payment completion
      const pollPaymentStatus = async () => {
        const maxAttempts = 30; // 30 seconds max
        let attempts = 0;

        const checkStatus = async () => {
          attempts++;

          try {
            const statusResponse = await fetch(
              `/api/payments/status?paymentUrl=${encodeURIComponent(paymentData.incomingPaymentUrl)}`
            );
            const statusData = await statusResponse.json();

            if (statusData.completed) {
              // Payment confirmed! Update question status via API
              await fetch("/api/questions", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: newQuestion.id,
                  action: "markPaid",
                  paymentId: paymentData.paymentId || paymentData.incomingPaymentUrl,
                }),
              });
              setPaymentStatus("completed");

              setTimeout(() => {
                setQuestion("");
                setName("");
                setWalletAddress("");
                setShowWalletInput(false);
                setPaymentStatus("idle");
              }, 2000);
              return;
            }

            if (attempts < maxAttempts) {
              // Keep polling
              setTimeout(checkStatus, 1000);
            } else {
              // Timeout - for demo purposes, mark as paid if it's a mock payment
              // In production, you'd want to handle this differently
              if (paymentData.mock) {
                await fetch("/api/questions", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: newQuestion.id,
                    action: "markPaid",
                    paymentId: paymentData.paymentId || paymentData.incomingPaymentUrl,
                  }),
                });
                setPaymentStatus("completed");

                setTimeout(() => {
                  setQuestion("");
                  setName("");
                  setWalletAddress("");
                  setShowWalletInput(false);
                  setPaymentStatus("idle");
                }, 2000);
              } else {
                setPaymentStatus("error");
                setErrorMessage("Payment timeout. Please check your payment status.");
              }
            }
          } catch (error) {
            console.error("Status check error:", error);
            // Continue polling even on error
            if (attempts < maxAttempts) {
              setTimeout(checkStatus, 1000);
            }
          }
        };

        checkStatus();
      };

      pollPaymentStatus();

    } catch (error) {
      console.error("Payment error:", error);
      setPaymentStatus("error");
      setErrorMessage("Payment failed. Please try again.");
    }
  };

  const renderPaymentState = () => {
    switch (paymentStatus) {
      case "creating":
        return (
          <div className="flex items-center gap-3 text-primary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Creating payment request...</span>
          </div>
        );
      case "awaiting":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Awaiting payment confirmation...</span>
            </div>
            <div className="bg-secondary rounded-lg p-4 text-sm">
              <p className="text-muted-foreground mb-2">
                In production, you would authorize the payment of{" "}
                <span className="text-primary font-semibold">
                  {formatCurrency(session.questionPrice, session.assetCode, session.assetScale)}
                </span>{" "}
                from your wallet.
              </p>
              <p className="text-xs text-muted-foreground">
                (Simulating payment for demo purposes...)
              </p>
            </div>
          </div>
        );
      case "completed":
        return (
          <div className="flex items-center gap-3 text-accent">
            <Check className="w-5 h-5" />
            <span>Payment complete! Your question has been submitted.</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span>{errorMessage}</span>
          </div>
        );
      default:
        return null;
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
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Ask a question
            </span>
            <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-accent" />
              {formatCurrency(session.questionPrice, session.assetCode, session.assetScale)}
            </span>
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
          ) : paymentStatus !== "idle" ? (
            <div className="py-6">{renderPaymentState()}</div>
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
                />
                <p className="text-xs text-muted-foreground text-right">{question.length}/500</p>
              </div>

              {!showWalletInput ? (
                <button
                  type="button"
                  onClick={() => setShowWalletInput(true)}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Wallet className="w-3 h-3" />
                  Add your wallet address (optional)
                </button>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-accent" />
                    Your wallet address <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Input
                    placeholder="$wallet.example/you"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
                Pay {formatCurrency(session.questionPrice, session.assetCode, session.assetScale)} & submit
                <Send className="w-4 h-4 ml-2" />
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Powered by{" "}
                <a
                  href="https://openpayments.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Open Payments
                </a>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
