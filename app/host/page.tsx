"use client";

import { motion } from "framer-motion";
import { Radio, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SessionCard } from "@/components/host/session-card";
import { useAppStore } from "@/lib/store";

export default function HostDashboard() {
  const { sessions, getSessionStats } = useAppStore();

  const sortedSessions = [...sessions].sort((a, b) => {
    const statusOrder = { live: 0, draft: 1, ended: 2 };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Header */}
      <header className="border-b border-border bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-foreground">LiveQuestionTime</span>
                <span className="text-xs text-muted-foreground ml-2">Dashboard</span>
              </div>
            </Link>

            <Link href="/host/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New session
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-foreground">
              Ready to monetize your Q&A?
            </h2>
            <p className="text-muted-foreground max-w-md mb-8">
              Create your first live session and let your audience submit questions
              through micropayments.
            </p>
            <Link href="/host/new">
              <Button size="lg">
                <Plus className="w-5 h-5 mr-2" />
                Create your first session
              </Button>
            </Link>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-3xl">
              {[
                { title: "Instant payments", description: "Receive micropayments directly via Interledger" },
                { title: "No minimums", description: "Accept questions for as little as $0.01" },
                { title: "Real-time queue", description: "Manage questions live with upvoting" },
              ].map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="bg-white rounded-xl p-5 border border-border text-left shadow-sm"
                >
                  <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Your sessions</h2>
              <p className="text-sm text-muted-foreground">
                {sessions.length} session{sessions.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="space-y-4">
              {sortedSessions.map((session, index) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  stats={getSessionStats(session.id)}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
