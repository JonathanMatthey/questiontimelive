"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Wallet, DollarSign, Video, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { parseWalletAddress, isValidWalletAddress } from "@/lib/utils";
import type { WalletAddressInfo } from "@/lib/types";

export function CreateSessionForm() {
  const router = useRouter();
  const { createSession, hostWalletAddress, setHostWalletAddress } = useAppStore();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [walletAddress, setWalletAddress] = useState(hostWalletAddress);
  const [questionPrice, setQuestionPrice] = useState("0.01");
  const [streamUrl, setStreamUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletAddressInfo | null>(null);
  const [isFetchingWalletInfo, setIsFetchingWalletInfo] = useState(false);

  // Fetch wallet info when wallet address changes
  const fetchWalletInfo = useCallback(async (address: string) => {
    if (!address.trim() || !isValidWalletAddress(address)) {
      setWalletInfo(null);
      return;
    }

    setIsFetchingWalletInfo(true);
    try {
      const parsedAddress = parseWalletAddress(address);
      const response = await fetch(`/api/wallet-info?address=${encodeURIComponent(parsedAddress)}`);
      
      if (response.ok) {
        const info = await response.json();
        setWalletInfo(info);
      } else {
        setWalletInfo(null);
      }
    } catch (error) {
      console.error("Failed to fetch wallet info:", error);
      setWalletInfo(null);
    } finally {
      setIsFetchingWalletInfo(false);
    }
  }, []);

  // Debounce wallet info fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      if (walletAddress.trim()) {
        fetchWalletInfo(walletAddress);
      } else {
        setWalletInfo(null);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [walletAddress, fetchWalletInfo]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!walletAddress.trim()) {
      newErrors.walletAddress = "Wallet address is required";
    } else if (!isValidWalletAddress(walletAddress)) {
      newErrors.walletAddress = "Invalid wallet address format";
    }

    const price = parseFloat(questionPrice);
    const minPrice = walletInfo ? Math.pow(10, -walletInfo.assetScale) : 0.01;
    if (isNaN(price) || price < minPrice) {
      const currencySymbol = walletInfo?.assetCode || "USD";
      newErrors.questionPrice = `Price must be at least ${formatCurrencyValue(minPrice, walletInfo?.assetCode || "USD", walletInfo?.assetScale || 2)}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatCurrencyValue = (value: number, assetCode: string, assetScale: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: assetCode,
      minimumFractionDigits: assetScale,
      maximumFractionDigits: assetScale,
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const parsedWalletAddress = parseWalletAddress(walletAddress);
      setHostWalletAddress(parsedWalletAddress);

      // Convert question price to smallest unit using the wallet's asset scale
      const priceValue = parseFloat(questionPrice);
      const assetScale = walletInfo?.assetScale || 2;
      const assetCode = walletInfo?.assetCode || "USD";
      const questionPriceInSmallestUnit = Math.round(priceValue * Math.pow(10, assetScale));

      // Create session via API (server-side storage)
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          hostWalletAddress: parsedWalletAddress,
          questionPrice: questionPriceInSmallestUnit,
          assetCode: assetCode,
          assetScale: assetScale,
          streamUrl: streamUrl.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to create session" }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const session = await response.json();
      
      if (!session || !session.id) {
        throw new Error("Invalid response from server - session ID missing");
      }
      
      // Clear form before navigation
      setTitle("");
      setDescription("");
      setQuestionPrice("0.01");
      setStreamUrl("");
      setSubmitError(null);
      
      // Navigate to the session page
      // Use window.location as fallback if router.push fails
      try {
        router.push(`/host/session/${session.id}`);
      } catch (navError) {
        console.error("Router navigation failed, using window.location:", navError);
        window.location.href = `/host/session/${session.id}`;
      }
    } catch (error) {
      console.error("Failed to create session:", error);
      setIsSubmitting(false);
      setSubmitError(
        error instanceof Error 
          ? error.message 
          : "Failed to create session. Please check your wallet address and try again."
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="w-5 h-5 text-primary" />
            Session details
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submitError && (
            <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {submitError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Session title
              </label>
              <Input
                placeholder="e.g., Tech Talk Live Q&A"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="Tell your audience what this session is about..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Wallet Address */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Wallet className="w-4 h-4 text-accent" />
                Your wallet address
              </label>
              <Input
                placeholder="$wallet.example/yourname or https://..."
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className={errors.walletAddress ? "border-destructive" : ""}
              />
              {errors.walletAddress && (
                <p className="text-xs text-destructive">{errors.walletAddress}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Must be an Open Payments-enabled wallet address.
              </p>
            </div>

            {/* Question Price */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Price per question
                {walletInfo && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({walletInfo.assetCode})
                  </span>
                )}
              </label>
              <div className="relative">
                {walletInfo && (
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {(() => {
                      try {
                        const formatter = new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: walletInfo.assetCode,
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        });
                        return formatter.format(0).replace(/[\d.,\s]/g, "").trim() || walletInfo.assetCode;
                      } catch {
                        return walletInfo.assetCode;
                      }
                    })()}
                  </span>
                )}
                {!walletInfo && (
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                )}
                <Input
                  type="number"
                  min={walletInfo ? Math.pow(10, -walletInfo.assetScale).toFixed(walletInfo.assetScale) : "0.01"}
                  step={walletInfo ? Math.pow(10, -walletInfo.assetScale).toFixed(walletInfo.assetScale) : "0.01"}
                  placeholder={walletInfo ? formatCurrencyValue(Math.pow(10, -walletInfo.assetScale), walletInfo.assetCode, walletInfo.assetScale) : "0.01"}
                  value={questionPrice}
                  onChange={(e) => setQuestionPrice(e.target.value)}
                  className={`pl-8 ${errors.questionPrice ? "border-destructive" : ""}`}
                  disabled={isFetchingWalletInfo}
                />
              </div>
              {isFetchingWalletInfo && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Detecting wallet currency...
                </div>
              )}
              {walletInfo && !isFetchingWalletInfo && (
                <p className="text-xs text-muted-foreground">
                  Wallet currency: <span className="font-medium">{walletInfo.assetCode}</span> (scale: {walletInfo.assetScale})
                </p>
              )}
              {errors.questionPrice && (
                <p className="text-xs text-destructive">{errors.questionPrice}</p>
              )}
              {!walletInfo && !isFetchingWalletInfo && (
                <p className="text-xs text-muted-foreground">
                  Enter wallet address to detect currency.
                </p>
              )}
            </div>

            {/* Stream URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Video className="w-4 h-4 text-muted-foreground" />
                Stream URL <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                placeholder="YouTube, Twitch, or embed URL"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Embed your live stream for viewers.
              </p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create session
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
