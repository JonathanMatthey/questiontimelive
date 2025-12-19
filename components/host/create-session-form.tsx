"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Wallet, DollarSign, Video, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { parseWalletAddress, isValidWalletAddress } from "@/lib/utils";

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
    if (isNaN(price) || price < 0.01) {
      newErrors.questionPrice = "Price must be at least $0.01";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      setHostWalletAddress(parseWalletAddress(walletAddress));

      // Create session via API (server-side storage)
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          hostWalletAddress: parseWalletAddress(walletAddress),
          questionPrice: Math.round(parseFloat(questionPrice) * 100),
          assetCode: "USD",
          assetScale: 2,
          streamUrl: streamUrl.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const session = await response.json();
      router.push(`/host/session/${session.id}`);
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setIsSubmitting(false);
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
                Price per question (USD)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.01"
                  value={questionPrice}
                  onChange={(e) => setQuestionPrice(e.target.value)}
                  className={`pl-8 ${errors.questionPrice ? "border-destructive" : ""}`}
                />
              </div>
              {errors.questionPrice && (
                <p className="text-xs text-destructive">{errors.questionPrice}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Micropayments as low as $0.01 are supported.
              </p>
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
