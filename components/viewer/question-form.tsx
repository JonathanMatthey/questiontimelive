"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, User, Loader2, Check, Wallet, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Session, GuestBalance } from "@/lib/types";

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

// Generate or retrieve a guest ID (persist in sessionStorage)
function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  
  const stored = sessionStorage.getItem("guestId");
  if (stored) return stored;
  
  const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  sessionStorage.setItem("guestId", guestId);
  return guestId;
}

export function QuestionForm({ session }: QuestionFormProps) {
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [walletStatus, setWalletStatus] = useState<WalletStatus>("checking");
  const [totalSent, setTotalSent] = useState<{ value: number; currency: string }>({ value: 0, currency: "" });
  const [guestId] = useState(() => getOrCreateGuestId());
  const [balance, setBalance] = useState<GuestBalance | null>(null);
  const [incomingPaymentUrls, setIncomingPaymentUrls] = useState<Set<string>>(new Set());

  // Function to verify payment receipt at host wallet
  const verifyPaymentReceipt = async (incomingPaymentUrl: string, guestId: string, sessionId: string) => {
    try {
      console.log("[PAYMENT VERIFICATION] Verifying payment receipt", {
        guestId,
        sessionId,
        incomingPaymentUrl,
        timestamp: new Date().toISOString(),
      });

      // Poll the incoming payment URL to check received amount
      const response = await fetch(incomingPaymentUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });

      if (response.ok) {
        const paymentData = await response.json();
        const receivedAmount = paymentData.receivedAmount;
        
        console.log("[PAYMENT VERIFICATION] Payment receipt verified", {
          guestId,
          sessionId,
          incomingPaymentUrl,
          receivedAmount: receivedAmount?.value || "0",
          currency: receivedAmount?.assetCode || "unknown",
          completed: paymentData.completed || false,
          timestamp: new Date().toISOString(),
        });

        // Update backend with verified amount
        if (receivedAmount && parseFloat(receivedAmount.value) > 0) {
          const receivedValue = parseFloat(receivedAmount.value);
          const receivedInSmallestUnit = Math.floor(
            receivedValue * Math.pow(10, receivedAmount.assetScale)
          );

          // Update balance with verified amount
          fetch("/api/guest-payments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              guestId,
              sessionId,
              totalReceived: receivedInSmallestUnit,
              assetCode: receivedAmount.assetCode,
              assetScale: receivedAmount.assetScale,
            }),
          }).catch((error) => {
            console.error("[PAYMENT ERROR] Failed to update balance from verification", error);
          });
        }
      } else {
        console.warn("[PAYMENT VERIFICATION] Failed to verify payment", {
          guestId,
          sessionId,
          incomingPaymentUrl,
          status: response.status,
          statusText: response.statusText,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("[PAYMENT ERROR] Payment verification failed", {
        guestId,
        sessionId,
        incomingPaymentUrl,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  };

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

      // Log the monetization link details
      console.log("[WEB MONETIZATION] Monetization link found", {
        guestId,
        sessionId: session.id,
        linkHref: monetizationLink.href,
        linkRel: monetizationLink.rel,
        timestamp: new Date().toISOString(),
      });

      // Don't immediately assume not_connected - wait for events or balance data
      // Monetization might already be active when component mounts
      let hasReceivedEvent = false;
      
      // Set up a longer delay to check if monetization has already started
      // If we receive an event within 2 seconds, we know it's already active
      // Otherwise, we'll check balance data as a fallback
      const checkTimeout = setTimeout(() => {
        if (!hasReceivedEvent) {
          // Check if we have balance data - if so, monetization is likely active
          // This will be checked in the balance polling effect
          // For now, set to not_connected but balance check will override if needed
          setWalletStatus("not_connected");
        }
      }, 2000);

      // Listen for monetization events on the link element
      // Section 1.3: Events are dispatched to link elements and bubble up
      const handleMonetization = (event: Event) => {
        const monetizationEvent = event as MonetizationEvent;
        
        // Mark that we've received an event
        hasReceivedEvent = true;
        clearTimeout(checkTimeout);
        
        // When we receive a monetization event, the wallet is connected and streaming
        setWalletStatus("connected");
        
        // Track total sent (Section 9.4: amountSent attribute)
        // This is the actual amount being streamed - we should send this to backend
        if (monetizationEvent.amountSent) {
          const { value, currency } = monetizationEvent.amountSent;
          const amountValue = parseFloat(value);
          
          console.log("[PAYMENT STREAM] Web Monetization amountSent event", {
            guestId,
            sessionId: session.id,
            amountSent: value,
            currency,
            amountValue,
            timestamp: new Date().toISOString(),
          });
          
          setTotalSent((prev) => ({
            value: prev.value + amountValue,
            currency: currency || prev.currency,
          }));

          // Send the amount sent to backend to update balance in real-time
          // Convert to smallest unit based on session asset scale
          // Note: amountSent is typically a small increment (e.g., 0.000001 XRP per second)
          const amountInSmallestUnit = Math.floor(
            amountValue * Math.pow(10, session.assetScale)
          );

          console.log("[PAYMENT STREAM] Sending increment to backend", {
            guestId,
            sessionId: session.id,
            amountValue,
            amountInSmallestUnit,
            assetCode: session.assetCode,
            assetScale: session.assetScale,
            timestamp: new Date().toISOString(),
          });

          // Update balance on backend with the incremental amount
          // We'll track cumulative total on the backend
          fetch("/api/guest-payments/increment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              guestId,
              sessionId: session.id,
              amountReceived: amountInSmallestUnit,
              assetCode: session.assetCode,
              assetScale: session.assetScale,
            }),
          })
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                console.log("[PAYMENT STREAM] Balance incremented successfully", {
                  guestId,
                  sessionId: session.id,
                  amountReceived: amountInSmallestUnit,
                  newTotal: data.newTotal,
                  timestamp: new Date().toISOString(),
                });
                
                // Refresh balance in UI
                const balanceResponse = await fetch(
                  `/api/guest-payments?guestId=${encodeURIComponent(guestId)}&sessionId=${encodeURIComponent(session.id)}`
                );
                if (balanceResponse.ok) {
                  const balanceData = await balanceResponse.json();
                  setBalance(balanceData);
                }
              } else {
                const errorData = await response.json().catch(() => ({}));
                console.error("[PAYMENT ERROR] Failed to increment balance", {
                  guestId,
                  sessionId: session.id,
                  amountSent: value,
                  status: response.status,
                  error: errorData.error,
                  timestamp: new Date().toISOString(),
                });
              }
            })
            .catch((error) => {
              console.error("[PAYMENT ERROR] Failed to update balance from amountSent", {
                guestId,
                sessionId: session.id,
                amountSent: value,
                currency,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
              });
            });
        }

        // Register incoming payment URL with backend (Section 9.7: incomingPayment attribute)
        // This URL can be used to verify that payments actually arrived at the host wallet
        if (monetizationEvent.incomingPayment && guestId) {
          const url = monetizationEvent.incomingPayment;
          
          // Only register if we haven't seen this URL before
          if (!incomingPaymentUrls.has(url)) {
            setIncomingPaymentUrls((prev) => new Set(Array.from(prev).concat(url)));
            
            console.log("[PAYMENT EVENT] Web Monetization incoming payment URL detected", {
              guestId,
              sessionId: session.id,
              incomingPaymentUrl: url,
              amountSent: monetizationEvent.amountSent,
              paymentPointer: monetizationEvent.paymentPointer,
              note: "This URL can be used to verify payment receipt at host wallet",
              timestamp: new Date().toISOString(),
            });
            
            // Send to backend to track and verify
            fetch("/api/guest-payments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                guestId,
                sessionId: session.id,
                incomingPaymentUrl: url,
                assetCode: session.assetCode,
                assetScale: session.assetScale,
              }),
            })
              .then((response) => {
                if (response.ok) {
                  console.log("[PAYMENT EVENT] Incoming payment URL registered with backend", {
                    guestId,
                    sessionId: session.id,
                    incomingPaymentUrl: url,
                    timestamp: new Date().toISOString(),
                  });
                  
                  // Immediately poll this URL to verify payment receipt
                  verifyPaymentReceipt(url, guestId, session.id);
                } else {
                  console.error("[PAYMENT ERROR] Failed to register incoming payment URL", {
                    guestId,
                    sessionId: session.id,
                    incomingPaymentUrl: url,
                    status: response.status,
                    timestamp: new Date().toISOString(),
                  });
                }
              })
              .catch((error) => {
                console.error("[PAYMENT ERROR] Failed to register incoming payment URL", {
                  guestId,
                  sessionId: session.id,
                  incomingPaymentUrl: url,
                  error: error instanceof Error ? error.message : String(error),
                  timestamp: new Date().toISOString(),
                });
              });
          }
        }
      };

      monetizationLink.addEventListener("monetization", handleMonetization);

      // Store cleanup function
      cleanupFn = () => {
        clearTimeout(checkTimeout);
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
  }, [guestId, session.id, session.assetCode, session.assetScale, incomingPaymentUrls]);

  // Poll for balance updates and incoming payment status
  useEffect(() => {
    if (!guestId || !session.id) return;
    
    // If we have balance data or incoming payment URLs, monetization is active
    if ((balance && balance.totalReceived > 0) || incomingPaymentUrls.size > 0) {
      setWalletStatus((currentStatus) => {
        if (currentStatus !== "connected") {
          console.log("[WALLET STATUS] Setting to connected based on balance/payment data", {
            guestId,
            sessionId: session.id,
            hasBalance: !!balance,
            totalReceived: balance?.totalReceived || 0,
            incomingPaymentUrls: incomingPaymentUrls.size,
            previousStatus: currentStatus,
            timestamp: new Date().toISOString(),
          });
          return "connected";
        }
        return currentStatus;
      });
    }
    
    // Always poll balance, regardless of wallet status
    // This helps detect when monetization becomes active
    const pollBalance = async () => {
      try {
        const response = await fetch(
          `/api/guest-payments?guestId=${encodeURIComponent(guestId)}&sessionId=${encodeURIComponent(session.id)}`
        );
        if (response.ok) {
          const balanceData = await response.json();
          setBalance(balanceData);
          
          // If we get balance data with payments, ensure status is connected
          if (balanceData.totalReceived > 0) {
            setWalletStatus((currentStatus) => {
              if (currentStatus !== "connected") {
                console.log("[WALLET STATUS] Setting to connected based on balance poll", {
                  guestId,
                  sessionId: session.id,
                  totalReceived: balanceData.totalReceived,
                  previousStatus: currentStatus,
                  timestamp: new Date().toISOString(),
                });
                return "connected";
              }
              return currentStatus;
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch balance:", error);
      }
    };

    // Initial fetch immediately - don't wait for wallet status
    pollBalance();

    // Poll balance periodically - always poll to detect when monetization starts
    const balanceInterval = setInterval(pollBalance, 2000);

    // Poll incoming payments to update backend (every 5 seconds)
    const pollPayments = async () => {
      if (incomingPaymentUrls.size === 0) return;
      
      try {
        await fetch("/api/guest-payments/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestId,
            sessionId: session.id,
          }),
        });
      } catch (error) {
        console.error("Failed to poll payments:", error);
      }
    };

    const paymentInterval = setInterval(pollPayments, 5000);

    return () => {
      clearInterval(balanceInterval);
      clearInterval(paymentInterval);
    };
  }, [guestId, session.id, walletStatus, incomingPaymentUrls.size]);

  // Check if user has enough credits (credits are calculated based on host currency)
  const questionPriceInSmallestUnit = session.questionPrice; // Already in cents/smallest unit
  const questionPriceDisplay = (questionPriceInSmallestUnit / Math.pow(10, session.assetScale)).toFixed(session.assetScale);
  const questionCredits = balance ? balance.questionCredits : 0;
  const hasEnoughCredits = questionCredits >= 1;

  const canSubmit = 
    name.trim() && 
    question.trim() && 
    session.status === "live" && 
    walletStatus === "connected" &&
    hasEnoughCredits;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    setSubmitStatus("submitting");

    try {
      // Submit question with guest ID and amount paid
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          text: question.trim(),
          submitterName: name.trim(),
          submitterWalletAddress: guestId, // Use guestId as identifier
          amountPaid: questionPriceInSmallestUnit,
          guestId, // Include guestId for tracking
          status: "paid",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === "Insufficient credits" || errorData.error === "Insufficient balance") {
          // Refresh balance and show error
          const balanceResponse = await fetch(
            `/api/guest-payments?guestId=${encodeURIComponent(guestId)}&sessionId=${encodeURIComponent(session.id)}`
          );
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            setBalance(balanceData);
          }
          alert("Insufficient credits. Please add more credits to submit a question.");
        }
        throw new Error(errorData.error || "Failed to submit question");
      }

      const questionData = await response.json();
      console.log("[QUESTION SUBMITTED] Question created successfully", {
        guestId,
        sessionId: session.id,
        questionId: questionData.id,
        amountPaid: questionPriceInSmallestUnit,
        timestamp: new Date().toISOString(),
      });

      setSubmitStatus("success");

      // Refresh balance after submission to show updated balance (after deduction)
      const refreshBalance = async () => {
        try {
          const balanceResponse = await fetch(
            `/api/guest-payments?guestId=${encodeURIComponent(guestId)}&sessionId=${encodeURIComponent(session.id)}`
          );
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            const balanceDisplay = (balanceData.balance / Math.pow(10, balanceData.assetScale)).toFixed(balanceData.assetScale);
            const totalDisplay = (balanceData.totalReceived / Math.pow(10, balanceData.assetScale)).toFixed(balanceData.assetScale);
            
            setBalance(balanceData);
            console.log("[QUESTION SUBMITTED] Balance refreshed after submission", {
              guestId,
              sessionId: session.id,
              questionId: questionData.id,
              newBalance: `${balanceDisplay} ${balanceData.assetCode}`,
              totalReceived: `${totalDisplay} ${balanceData.assetCode}`,
              amountPaid: `${questionPriceDisplay} ${session.assetCode}`,
              creditsRemaining: balanceData.questionCredits,
              hasEnoughForAnother: balanceData.questionCredits >= 1,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error("[PAYMENT ERROR] Failed to refresh balance after submission:", error);
        }
      };

      // Refresh immediately and again after delays to ensure UI updates
      await refreshBalance();
      setTimeout(refreshBalance, 500);
      setTimeout(refreshBalance, 1500);

      setTimeout(() => {
        setQuestion("");
        setName(""); // Clear name too
        setSubmitStatus("idle");
        // Final refresh to ensure UI is up to date
        refreshBalance();
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
      const credits = questionCredits;
      const hasEnough = hasEnoughCredits;

      return (
        <div className={`rounded-lg p-4 border ${hasEnough ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasEnough ? "bg-green-100" : "bg-blue-100"}`}>
                <Zap className={`w-4 h-4 ${hasEnough ? "text-green-600" : "text-blue-600"}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${hasEnough ? "text-green-900" : "text-blue-900"}`}>
                  {hasEnough ? "Ready to Submit" : "Waiting for Credits"}
                </p>
                <p className={`text-xs ${hasEnough ? "text-green-700" : "text-blue-700"}`}>
                  {hasEnough ? "You have question credits" : "Streaming payments active"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${hasEnough ? "text-green-900" : "text-blue-900"}`}>
                {credits}
              </p>
              <p className={`text-xs ${hasEnough ? "text-green-700" : "text-blue-700"}`}>
                Question {credits === 1 ? "Credit" : "Credits"}
              </p>
            </div>
          </div>
          {!hasEnough && (
            <div className="mt-2 pt-2 border-t border-blue-200">
              <p className="text-xs text-blue-700">
                {balance && balance.totalReceived > 0 
                  ? `You need ${questionPriceDisplay} ${session.assetCode} more to get 1 credit`
                  : `Stream payments to earn credits (${questionPriceDisplay} ${session.assetCode} per credit)`}
              </p>
            </div>
          )}
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

              {/* Question Credits Display */}
              {walletStatus === "connected" && (
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Question Credits</p>
                      <p className="text-xs text-muted-foreground">
                        {questionCredits >= 1 
                          ? `You can submit ${questionCredits} question${questionCredits === 1 ? "" : "s"}`
                          : `Earn credits by streaming payments (${questionPriceDisplay} ${session.assetCode} per credit)`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{questionCredits}</p>
                      <p className="text-xs text-muted-foreground">credits</p>
                    </div>
                  </div>
                </div>
              )}

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
                ) : !hasEnoughCredits ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Need Credits...
                  </>
                ) : (
                  <>
                    Submit Question (1 credit)
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
