"use client";

import { useEffect, useState, useMemo } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuestionCard } from "@/components/host/question-card";
import { StatsBar } from "@/components/host/stats-bar";
import { VideoPlayer } from "@/components/viewer/video-player";
import { useAppStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import type { QuestionSortOption, Session } from "@/lib/types";

export default function SessionManagementPage() {
  const params = useParams();
  const sessionId = params?.id as string;

  const {
    getSessionById,
    getQuestionsBySession,
    getSessionStats,
    startSession,
    endSession,
    markQuestionAnswered,
    markQuestionSkipped,
    upvoteQuestion,
  } = useAppStore();

  const [session, setSession] = useState<Session | undefined>(undefined);
  const [sortBy, setSortBy] = useState<QuestionSortOption>("newest");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
  setMounted(true);
}, []);

useEffect(() => {
  if (!sessionId || !mounted) return;
    
    setSession(getSessionById(sessionId));
    
    const interval = setInterval(() => {
      setSession(getSessionById(sessionId));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId, getSessionById, mounted]);

  const questions = sessionId ? getQuestionsBySession(sessionId) : [];
  const stats = sessionId ? getSessionStats(sessionId) : { totalQuestions: 0, answeredQuestions: 0, totalEarned: 0, viewerCount: 0 };

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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(viewerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!mounted) {
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
                <Button onClick={() => startSession(session.id)}>
                  <Play className="w-4 h-4 mr-2" />
                  Go live
                </Button>
              )}
              {session.status === "live" && (
                <Button variant="destructive" onClick={() => endSession(session.id)}>
                  <Square className="w-4 h-4 mr-2" />
                  End session
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VideoPlayer
            sessionId={session.id}
            streamUrl={session.streamUrl}
            sessionTitle={session.title}
            role="host"
            participantIdentity={`${session.id}-host-1`}
            label="Host 1"
          />
          <VideoPlayer
            sessionId={session.id}
            streamUrl={session.streamUrl}
            sessionTitle={session.title}
            role="host"
            participantIdentity={`${session.id}-host-2`}
            label="Host 2"
          />
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
                    onAnswer={() => markQuestionAnswered(question.id)}
                    onSkip={() => markQuestionSkipped(question.id)}
                    onUpvote={() => upvoteQuestion(question.id)}
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
