"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Radio, Users, Clock, DollarSign } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { MultiHostViewer } from "@/components/viewer/multi-host-viewer";
import { CurrentQuestion } from "@/components/viewer/current-question";
import { QuestionForm } from "@/components/viewer/question-form";
import { QuestionsList } from "@/components/viewer/questions-list";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Session, SessionStats, Question } from "@/lib/types";

// Default wallet address for Web Monetization
const DEFAULT_WALLET_ADDRESS = "https://ilp.interledger-test.dev/d376ecbd";

export default function WatchPage() {
  const params = useParams();
  const sessionId = params?.id as string;

  const [session, setSession] = useState<Session | undefined>(undefined);
  const [stats, setStats] = useState<SessionStats>({ totalQuestions: 0, answeredQuestions: 0, totalEarned: 0, viewerCount: 0 });
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch session data from server
  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setSession(data);
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
    }
  }, [sessionId]);

  // Fetch stats and active question from server
  const fetchStats = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/questions?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || { totalQuestions: 0, answeredQuestions: 0, totalEarned: 0, viewerCount: 0 });
        // Find the active question
        const active = (data.questions || []).find((q: Question) => q.status === "active");
        setActiveQuestion(active || null);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [sessionId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Add Web Monetization link tag to document head
  // Following Web Monetization spec: https://webmonetization.org/specification/
  useEffect(() => {
    if (!mounted) return;

    let walletAddress = session?.hostWalletAddress || DEFAULT_WALLET_ADDRESS;
    
    // Normalize the wallet address - remove any duplicate protocols and spaces
    // Handle cases like "https:// https://example.com" or "https://https://example.com"
    walletAddress = walletAddress.trim();
    
    // Remove any spaces after https:// or http://
    walletAddress = walletAddress.replace(/https:\/\/\s+/g, "https://");
    walletAddress = walletAddress.replace(/http:\/\/\s+/g, "http://");
    
    // Remove duplicate protocols
    walletAddress = walletAddress.replace(/https:\/\/https:\/\//g, "https://");
    walletAddress = walletAddress.replace(/http:\/\/https:\/\//g, "https://");
    walletAddress = walletAddress.replace(/https:\/\/http:\/\//g, "https://");
    
    // Ensure it starts with https:// (normalize http:// to https://)
    if (walletAddress.startsWith("http://") && !walletAddress.startsWith("https://")) {
      walletAddress = walletAddress.replace("http://", "https://");
    }
    
    // Final trim
    walletAddress = walletAddress.trim();
    
    // Check if monetization link already exists
    let monetizationLink = document.querySelector('link[rel="monetization"]') as HTMLLinkElement | null;
    
    if (!monetizationLink) {
      // Create the monetization link according to spec Section 4
      monetizationLink = document.createElement("link");
      monetizationLink.rel = "monetization";
      document.head.appendChild(monetizationLink);
    }
    
    // Set/update the wallet address (payment pointer)
    // The href should be a payment pointer URL
    monetizationLink.href = walletAddress;

    console.log("[WEB MONETIZATION] Monetization link set up", {
      sessionId: session?.id,
      hostWalletAddress: walletAddress,
      linkHref: monetizationLink.href,
      timestamp: new Date().toISOString(),
    });

    // Cleanup on unmount
    return () => {
      const link = document.querySelector('link[rel="monetization"]');
      if (link && link.parentNode) {
        link.remove();
      }
    };
  }, [mounted, session?.hostWalletAddress]);

  // Track viewer count
  useEffect(() => {
    if (!sessionId || !mounted) return;

    // Join
    fetch("/api/viewers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "join" }),
    }).catch(console.error);

    // Leave on unmount or tab close
    const handleLeave = () => {
      navigator.sendBeacon(
        "/api/viewers",
        JSON.stringify({ sessionId, action: "leave" })
      );
    };

    window.addEventListener("beforeunload", handleLeave);
    return () => {
      window.removeEventListener("beforeunload", handleLeave);
      handleLeave();
    };
  }, [sessionId, mounted]);

  useEffect(() => {
    if (!sessionId || !mounted) return;

    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSession(), fetchStats()]);
      setLoading(false);
    };

    loadData();

    // Poll for updates
    const interval = setInterval(() => {
      fetchSession();
      fetchStats();
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId, mounted, fetchSession, fetchStats]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Session not found</h2>
          <p className="text-muted-foreground mb-8">
            This session may have ended or the link is invalid.
          </p>
          <Link href="/" className="text-primary hover:underline">
            Go to homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-border bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Radio className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-foreground">LiveQuestionTime</span>
            </Link>

            <div className="flex items-center gap-4">
              {session.status === "live" && (
                <Badge variant="live" className="px-3 py-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-2 live-pulse" />
                  LIVE
                </Badge>
              )}
              {session.status === "ended" && <Badge variant="secondary">ENDED</Badge>}

              <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-primary" />
                  {stats.viewerCount}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-accent" />
                  {formatCurrency(stats.totalEarned, session.assetCode, session.assetScale)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Session title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl md:text-3xl font-bold mb-2 text-foreground">{session.title}</h1>
          {session.description && (
            <p className="text-muted-foreground">{session.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-accent" />
              {formatCurrency(session.questionPrice, session.assetCode, session.assetScale)} per question
            </span>
            {session.startedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Started {formatRelativeTime(session.startedAt)}
              </span>
            )}
          </div>
        </motion.div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <MultiHostViewer
              sessionId={session.id}
              sessionTitle={session.title}
            />

            {/* Current Question */}
            <CurrentQuestion question={activeQuestion} />

            <div className="lg:hidden">
              <QuestionsList
                sessionId={session.id}
                assetCode={session.assetCode}
                assetScale={session.assetScale}
              />
            </div>
          </div>

          <div className="space-y-6">
            <QuestionForm session={session} />

            <div className="hidden lg:block">
              <QuestionsList
                sessionId={session.id}
                assetCode={session.assetCode}
                assetScale={session.assetScale}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6 bg-white">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by{" "}
            <a
              href="https://openpayments.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Open Payments
            </a>{" "}
            &{" "}
            <a
              href="https://interledger.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Interledger
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
