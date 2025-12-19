"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  Play,
  Square,
  Copy,
  ExternalLink,
  Filter,
  ArrowLeft,
  Users,
  Check,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuestionCard } from "@/components/host/question-card";
import { StatsBar } from "@/components/host/stats-bar";
import { HostVideoPublisher } from "@/components/host/host-video-publisher";
import { formatCurrency } from "@/lib/utils";
import type { QuestionSortOption, Session, Question, SessionStats } from "@/lib/types";

export default function SessionManagementPage() {
  const params = useParams();
  const sessionId = params?.id as string;

  const [session, setSession] = useState<Session | undefined>(undefined);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<SessionStats>({ totalQuestions: 0, answeredQuestions: 0, totalEarned: 0, viewerCount: 0 });
  const [sortBy, setSortBy] = useState<QuestionSortOption>("newest");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copyError, setCopyError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!sessionId || !mounted) return;

    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchSession(), fetchQuestions()]);
      } catch (error) {
        console.error("Failed to load session data:", error);
      } finally {
        setLoading(false);
      }
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
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "highest_paid":
        filtered.sort((a, b) => b.amountPaid - a.amountPaid);
        break;
      case "most_upvoted":
        filtered.sort((a, b) => b.upvotes - a.upvotes);
        break;
      default:
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return filtered;
  }, [questions, sortBy, filterStatus]);

  const viewerUrl = mounted && typeof window !== "undefined" ? `${window.location.origin}/watch/${sessionId}` : "";

  const copyToClipboard = useCallback(async (text: string) => {
    if (typeof navigator === "undefined" || typeof document === "undefined") {
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback for environments where Clipboard API is blocked
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        return success;
      } catch (fallbackError) {
        console.error("Clipboard copy failed", fallbackError);
        return false;
      }
    }
  }, []);

  const handleCopyLink = async () => {
    if (!viewerUrl) {
      setCopyError("Viewer link is not available yet.");
      return;
    }

    const copied = await copyToClipboard(viewerUrl);
    if (copied) {
      setCopyError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyError(`Could not copy viewer link automatically. Copy manually: ${viewerUrl}`);
    }
  };

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

  const handleInviteCoHost = async (hostNumber: 2 | 3 | 4) => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generateInvite", hostNumber }),
      });
      if (!response.ok) {
        setCopyError("Failed to generate invite link. Please try again.");
        return;
      }

      const { token } = await response.json();
      if (token && typeof window !== "undefined") {
        const inviteUrl = `${window.location.origin}/join/${sessionId}?token=${token}&host=${hostNumber}`;
        const copied = await copyToClipboard(inviteUrl);
        if (copied) {
          setCopyError(null);
          setCopiedInvite(hostNumber);
          setTimeout(() => setCopiedInvite(null), 2000);
        } else {
          setCopyError(`Could not copy invite automatically. Copy manually: ${inviteUrl}`);
        }
        // Refresh session to get updated tokens
        fetchSession();
      }
    } catch (error) {
      console.error("Failed to generate invite:", error);
      setCopyError("Something went wrong generating the invite link. Please try again.");
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

  const handleCompleteQuestion = async (questionId: string) => {
    try {
      await fetch("/api/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: questionId, action: "complete" }),
      });
      fetchQuestions();
    } catch (error) {
      console.error("Failed to complete question:", error);
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Session not found</h2>
          <Link href="/host">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const coHostTokens = session.coHostTokens || [];
  const isHostClaimed = (hostNum: 2 | 3 | 4) =>
    coHostTokens.some((token) => token.hostNumber === hostNum && token.claimed);
  const renderInviteButton = (hostNum: 2 | 3 | 4) => (
    <Button
      key={hostNum}
      variant="secondary"
      size="sm"
      onClick={() => handleInviteCoHost(hostNum)}
      className="shadow-sm"
    >
      {copiedInvite === hostNum ? (
        <>
          <Check className="w-4 h-4 mr-2" />
          Link copied!
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Host {hostNum}
        </>
      )}
    </Button>
  );
  const pendingHostInvites = ([3, 4] as const).filter((hostNum) => !isHostClaimed(hostNum));

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Header */}
      <header className="border-b border-border bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/host" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-foreground">LiveQuestionTime</span>
                <span className="text-xs text-muted-foreground ml-2">Dashboard</span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <Badge
                variant={session.status === "live" ? "live" : session.status === "draft" ? "outline" : "secondary"}
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
        {copyError && (
          <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {copyError}
          </div>
        )}

        {/* 4-host video grid */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Host 1 - Primary host (current user) */}
          <HostVideoPublisher
            sessionId={session.id}
            hostNumber={1}
            sessionTitle={session.title}
            isCurrentUser={true}
          />

          {/* Host 2 - Co-host slot (always shown) */}
          <div className="relative">
            <HostVideoPublisher
              sessionId={session.id}
              hostNumber={2}
              sessionTitle={session.title}
              isCurrentUser={false}
            />
            {!isHostClaimed(2) && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                {renderInviteButton(2)}
              </div>
            )}
          </div>

          {/* Hosts 3 & 4 - Only show video once claimed */}
          {([3, 4] as const).map((hostNum) => {
            if (!isHostClaimed(hostNum)) return null;
            return (
              <div key={hostNum} className="relative">
                <HostVideoPublisher
                  sessionId={session.id}
                  hostNumber={hostNum}
                  sessionTitle={session.title}
                  isCurrentUser={false}
                />
              </div>
            );
          })}
        </div>

        {/* Pending invites for hosts 3 & 4 (no big tiles) */}
        {pendingHostInvites.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-muted-foreground">Invite additional hosts:</p>
            {pendingHostInvites.map((hostNum) => renderInviteButton(hostNum))}
          </div>
        )}

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

            {/* Share link */}
            <div className="bg-white rounded-xl p-4 border border-border shadow-sm min-w-[300px]">
              <p className="text-sm font-medium mb-2 flex items-center gap-2 text-foreground">
                <Users className="w-4 h-4 text-accent" />
                Viewer link
              </p>
              <div className="flex gap-2">
                <code className="flex-1 bg-secondary rounded-lg px-3 py-2 text-xs text-muted-foreground truncate">
                  {viewerUrl}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Link href={viewerUrl} target="_blank">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </Link>
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
                Share your viewer link to start receiving paid questions!
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
                    onComplete={() => handleCompleteQuestion(question.id)}
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
