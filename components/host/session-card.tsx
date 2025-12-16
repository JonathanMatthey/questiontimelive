"use client";

import { motion } from "framer-motion";
import { Play, Users, DollarSign, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Session, SessionStats } from "@/lib/types";

interface SessionCardProps {
  session: Session;
  stats: SessionStats;
  index: number;
}

export function SessionCard({ session, stats, index }: SessionCardProps) {
  const statusVariants = {
    draft: "outline",
    live: "live",
    ended: "secondary",
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="card-hover bg-white">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row">
            {/* Left section */}
            <div className="flex-1 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={statusVariants[session.status]}>
                      {session.status === "live" && (
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5 live-pulse" />
                      )}
                      {session.status.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(session.createdAt)}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {session.title}
                  </h3>
                  {session.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {session.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-accent" />
                  {formatCurrency(session.questionPrice, session.assetCode, session.assetScale)} per question
                </span>
              </div>
            </div>

            {/* Right section - Stats */}
            <div className="flex md:flex-col items-center justify-between gap-4 p-5 bg-secondary/50 md:w-56 border-t md:border-t-0 md:border-l border-border">
              <div className="grid grid-cols-3 md:grid-cols-1 gap-4 w-full text-center">
                <div>
                  <div className="text-xl font-bold text-foreground">{stats.viewerCount}</div>
                  <span className="text-xs text-muted-foreground">Viewers</span>
                </div>
                <div>
                  <div className="text-xl font-bold text-accent">
                    {formatCurrency(stats.totalEarned, session.assetCode, session.assetScale)}
                  </div>
                  <span className="text-xs text-muted-foreground">Earned</span>
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">
                    {stats.answeredQuestions}/{stats.totalQuestions}
                  </div>
                  <span className="text-xs text-muted-foreground">Answered</span>
                </div>
              </div>

              <div className="w-full">
                {session.status === "draft" && (
                  <Link href={`/host/session/${session.id}`} className="block">
                    <Button className="w-full">
                      <Play className="w-4 h-4 mr-2" />
                      Start
                    </Button>
                  </Link>
                )}
                {session.status === "live" && (
                  <Link href={`/host/session/${session.id}`} className="block">
                    <Button variant="outline" className="w-full">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Manage
                    </Button>
                  </Link>
                )}
                {session.status === "ended" && (
                  <Link href={`/host/session/${session.id}`} className="block">
                    <Button variant="secondary" className="w-full">
                      <Clock className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
