"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  Play,
  Square,
  Filter,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuestionCard } from "@/components/host/question-card";
import { StatsBar } from "@/components/host/stats-bar";
import { HostVideoPublisher } from "@/components/host/host-video-publisher";
import { formatCurrency } from "@/lib/utils";
import type { QuestionSortOption, Session, Question, SessionStats } from "@/lib/types";

export default function CoHostJoinPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params?.sessionId as string;
  const token = searchParams?.get("token");
  const hostNumberParam = searchParams?.get("host");

  const [session, setSession] = useState<Session | undefined>(undefined);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<SessionStats>({ totalQuestions: 0, answeredQuestions: 0, totalEarned: 0, viewerCount: 0 });
  const [sortBy, setSortBy] = useState<QuestionSortOption>("newest");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [myHostNumber, setMyHostNumber] = useState<number | null>(null);

  // Fetch session data from server
  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setSession(data);
        return data;
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
    }
    return null;
  }, [sessionId]);

  // Fetch questions from server
  const fetchQuestions = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/questions?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
        setStats(data.stats || { totalQuestions: 0, answeredQuestions: 0, totalEarned: 0, viewerCount: 0 });
      }
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    }
  }, [sessionId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Validate token and claim co-host slot via API
  useEffect(() => {
    if (!sessionId || !token || !mounted) return;

    const hostNum = parseInt(hostNumberParam || "0", 10);
    if (hostNum !== 2) {
      setTokenValid(false);
      return;
    }

    const claimInvite = async () => {
      try {
        // Try to claim the invite via API
        const response = await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "claimInvite", token }),
        });

        if (response.ok) {
          const result = await response.json();
          setTokenValid(true);
          setMyHostNumber(result.hostNumber);
        } else {
          // Check if session exists and token is already claimed
          const sess = await fetchSession();
          const existingToken = sess?.coHostTokens?.find((t: { token: string; claimed: boolean; hostNumber: number }) => t.token === token);
          if (existingToken?.claimed) {
            setTokenValid(true);
            setMyHostNumber(existingToken.hostNumber);
          } else {
            setTokenValid(false);
          }
        }
      } catch (error) {
        console.error("Failed to claim invite:", error);
        setTokenValid(false);
      }
    };

    claimInvite();
  }, [sessionId, token, hostNumberParam, mounted, fetchSession]);

  useEffect(() => {
    if (!sessionId || !mounted) return;

    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSession(), fetchQuestions()]);
      setLoading(false);
    };

    loadData();

    // Poll for updates
    const interval = setInterval(() => {
      fetchSession();
      fetchQuestions();
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId, mounted, fetchSession, fetchQuestions]);

  const filteredQuestions = useMemo(() => {
    let filtered = [...questions];

    if (filterStatus !== "all") {
      filtered = filtered.filter((q) => q.status === filterStatus);
    }

    filtered = filtered.filter((q) => q.status !== "pending_payment");

    switch (sortBy) {
      case "oldest":
        filtered.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case "highest_paid":
        filtered.sort((a, b) => b.amountPaid - a.amountPaid);
        break;
      case "most_upvoted":
        filtered.sort((a, b) => b.upvotes - a.upvotes);
        break;
      default:
        filtered.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    return filtered;
  }, [questions, sortBy, filterStatus]);

  const handleStartSession = async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (response.ok) {
        const updated = await response.json();
        setSession(updated);
      }
    } catch (error) {
      console.error("Failed to start session:", error);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
      if (response.ok) {
        const updated = await response.json();
        setSession(updated);
      }
    } catch (error) {
      console.error("Failed to end session:", error);
    }
  };

  const handleAnswerQuestion = async (questionId: string) => {
    try {
      await fetch("/api/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: questionId, action: "answer" }),
      });
      fetchQuestions();
    } catch (error) {
      console.error("Failed to answer question:", error);
    }
  };

  const handleSkipQuestion = async (questionId: string) => {
    try {
      await fetch("/api/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: questionId, action: "skip" }),
      });
      fetchQuestions();
    } catch (error) {
      console.error("Failed to skip question:", error);
    }
  };

  const handleUpvoteQuestion = async (questionId: string) => {
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

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-secondary/30 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-foreground">Invalid Invite Link</h2>
          <p className="text-muted-foreground mb-6">
            This invite link is invalid or has expired. Please ask the session host for a new invite.
          </p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Session not found</h2>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-secondary/30 flex items-center justify-center">
        <div className="text-muted-foreground">Validating invite...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Header */}
      <header className="border-b border-border bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-foreground">LiveQuestionTime</span>
                <span className="text-xs text-muted-foreground ml-2">Co-Host {myHostNumber}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge
                variant={
                  session.status === "live"
                    ? "live"
                    : session.status === "draft"
                    ? "outline"
                    : "secondary"
                }
                className="px-3 py-1"
              >
                {session.status === "live" && (
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-2 live-pulse" />
                )}
                {session.status.toUpperCase()}
              </Badge>

              {session.status === "draft" && (
                <Button onClick={handleStartSession}>
                  <Play className="w-4 h-4 mr-2" />
                  Go live
                </Button>
              )}
              {session.status === "live" && (
                <Button variant="destructive" onClick={handleEndSession}>
                  <Square className="w-4 h-4 mr-2" />
                  End session
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* 2-host video grid - only current user's slot is active */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {([1, 2] as const).map((hostNum) => (
            <HostVideoPublisher
              key={hostNum}
              sessionId={session.id}
              hostNumber={hostNum}
              sessionTitle={session.title}
              isCurrentUser={hostNum === myHostNumber}
            />
          ))}
        </div>

        {/* Session info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-2 text-foreground">{session.title}</h2>
              {session.description && (
                <p className="text-muted-foreground max-w-2xl">{session.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span>
                  Price:{" "}
                  <span className="text-accent font-semibold">
                    {formatCurrency(session.questionPrice, session.assetCode, session.assetScale)}
                  </span>{" "}
                  per question
                </span>
              </div>
            </div>
          </div>

          <StatsBar stats={stats} assetCode={session.assetCode} assetScale={session.assetScale} />
        </motion.div>

        {/* Questions section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-foreground">Question queue</h3>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All</option>
                  <option value="paid">New</option>
                  <option value="queued">Queued</option>
                  <option value="answered">Answered</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as QuestionSortOption)}
                className="bg-white border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="highest_paid">Highest paid</option>
                <option value="most_upvoted">Most upvoted</option>
              </select>
            </div>
          </div>

          {filteredQuestions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-xl p-12 text-center border border-border shadow-sm"
            >
              <p className="text-muted-foreground mb-2">No questions yet</p>
              <p className="text-sm text-muted-foreground">
                Questions will appear here when viewers submit them.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredQuestions.map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    assetCode={session.assetCode}
                    assetScale={session.assetScale}
                    isHost={true}
                    onAnswer={() => handleAnswerQuestion(question.id)}
                    onSkip={() => handleSkipQuestion(question.id)}
                    onUpvote={() => handleUpvoteQuestion(question.id)}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
