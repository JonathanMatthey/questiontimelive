"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radio, Users, Clock, DollarSign } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/viewer/video-player";
import { QuestionForm } from "@/components/viewer/question-form";
import { QuestionsList } from "@/components/viewer/questions-list";
import { useAppStore } from "@/lib/store";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Session, SessionStats } from "@/lib/types";

export default function WatchPage() {
  const params = useParams();
  const sessionId = params?.id as string;

  const { getSessionById, getSessionStats } = useAppStore();
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [stats, setStats] = useState<SessionStats>({ totalQuestions: 0, answeredQuestions: 0, totalEarned: 0, viewerCount: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!sessionId || !mounted) return;
    
    setSession(getSessionById(sessionId));
    setStats(getSessionStats(sessionId));
    
    const interval = setInterval(() => {
      setSession(getSessionById(sessionId));
      setStats(getSessionStats(sessionId));
    }, 2000);
    return () => clearInterval(interval);
  }, [sessionId, getSessionById, getSessionStats, mounted]);

  if (!mounted) {
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
            <VideoPlayer
              streamUrl={session.streamUrl}
              sessionTitle={session.title}
              sessionId={session.id}
              role="viewer"
            />

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
