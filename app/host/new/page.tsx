"use client";

import { motion } from "framer-motion";
import { Radio, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreateSessionForm } from "@/components/host/create-session-form";

export default function NewSessionPage() {
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

            <Link href="/host">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold mb-2 text-foreground">
            Create a new session
          </h2>
          <p className="text-muted-foreground">
            Set up your Q&A session and start accepting paid questions.
          </p>
        </motion.div>

        <CreateSessionForm />

        {/* Info card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 bg-white rounded-xl p-6 border border-border shadow-sm"
        >
          <h3 className="font-semibold text-foreground mb-4">
            💡 How it works
          </h3>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="text-primary font-semibold">1.</span>
              Create a session with your wallet address and question price
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-semibold">2.</span>
              Share the viewer link with your audience
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-semibold">3.</span>
              Viewers pay micropayments to submit their questions
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-semibold">4.</span>
              Manage your question queue live from the dashboard
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-semibold">5.</span>
              Payments go directly to your wallet via Open Payments
            </li>
          </ol>
        </motion.div>
      </main>
    </div>
  );
}
