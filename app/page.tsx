"use client";

import { motion } from "framer-motion";
import {
  Radio,
  Zap,
  DollarSign,
  MessageSquare,
  Users,
  ArrowRight,
  Check,
  Wallet,
  Globe,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const features = [
    {
      icon: DollarSign,
      title: "Micropayments",
      description: "Accept payments as low as $0.01 per question. No minimums, no hidden fees.",
    },
    {
      icon: MessageSquare,
      title: "Live Q&A Queue",
      description: "Manage incoming questions in real-time with upvoting and prioritization.",
    },
    {
      icon: Wallet,
      title: "Direct to Wallet",
      description: "Payments go straight to your Open Payments wallet. No intermediaries.",
    },
    {
      icon: Globe,
      title: "Global Reach",
      description: "Accept payments from anywhere via the Interledger network.",
    },
  ];

  const steps = [
    { step: "1", title: "Create a session", description: "Set your question price and wallet" },
    { step: "2", title: "Go live", description: "Share the link with your audience" },
    { step: "3", title: "Get paid questions", description: "Viewers pay to submit questions" },
    { step: "4", title: "Answer & earn", description: "Manage your queue, get paid instantly" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">
                LiveQuestionTime
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <Link href="/host">
                <Button>
                  Get started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 md:py-28">
          <div className="absolute inset-0 hero-questions-bg" aria-hidden="true" />
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" aria-hidden="true" />

          <div className="relative container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-3xl mx-auto"
            >
              <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2 mb-6">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary font-medium">
                  Powered by Open Payments
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground leading-tight">
                Get paid for your live Q&A sessions
              </h1>

              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Let your audience pay to ask questions during live sessions. 
                Instant micropayments, no minimums, global reach.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/host">
                  <Button size="xl">
                    Start hosting for free
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <a
                  href="https://openpayments.dev/overview/getting-started/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="xl">
                    Learn about Open Payments
                  </Button>
                </a>
              </div>
            </motion.div>

            {/* Hero illustration */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mt-16 max-w-4xl mx-auto"
            >
              <div className="bg-secondary/50 rounded-2xl p-6 md:p-8 border border-border">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-2 bg-red-100 text-red-600 rounded-full px-3 py-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full live-pulse" />
                    <span className="text-sm font-medium">LIVE</span>
                  </div>
                  <span className="text-muted-foreground">Tech Talk Q&A Session</span>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { name: "Sarah K.", amount: "$0.50", question: "What's your take on the future of Web3?", votes: 24 },
                    { name: "Mike R.", amount: "$1.00", question: "How do you handle scaling challenges?", votes: 18 },
                    { name: "Emma T.", amount: "$0.25", question: "Best resources for learning Rust?", votes: 31 },
                  ].map((q, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="bg-white rounded-xl p-4 border border-border shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-foreground">{q.name}</span>
                        <span className="text-sm font-semibold text-accent">{q.amount}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{q.question}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <span className="text-primary">▲</span>
                        <span>{q.votes}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-secondary/30">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
                Everything you need to get paid
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Built for podcasters, streamers, and creators who want to 
                engage their audience and monetize Q&A sessions.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-xl p-6 border border-border shadow-sm card-hover"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
                How it works
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Get started in minutes. No complex setup required.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {steps.map((step, index) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    {step.step}
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-primary/5">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 md:p-12 text-center max-w-2xl mx-auto border border-border shadow-sm"
            >
              <h2 className="text-3xl font-bold mb-4 text-foreground">
                Ready to start?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Create your first session and start receiving paid questions today.
              </p>

              <Link href="/host">
                <Button size="xl">
                  <Zap className="w-5 h-5 mr-2" />
                  Launch your first session
                </Button>
              </Link>

              <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent" />
                  Free to use
                </span>
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent" />
                  No minimums
                </span>
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-accent" />
                  Instant setup
                </span>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-10 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Radio className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-foreground">LiveQuestionTime</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a
                href="https://openpayments.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                Open Payments
              </a>
              <a
                href="https://interledger.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                Interledger
              </a>
            </div>

            <p className="text-sm text-muted-foreground">
              Built with ❤️ for the Interledger community
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
