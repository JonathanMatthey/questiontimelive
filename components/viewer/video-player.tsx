"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import type { Room } from "livekit-client";
import "@livekit/components-styles";

interface VideoPlayerProps {
  streamUrl?: string;
  sessionTitle: string;
  sessionId?: string;
  role?: "host" | "viewer";
  participantIdentity?: string;
  label?: string;
}

export function VideoPlayer({
  streamUrl,
  sessionTitle,
  sessionId,
  role = "viewer",
  participantIdentity,
  label,
}: VideoPlayerProps) {
  const livekitServerUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL;
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitError, setLivekitError] = useState<string | null>(null);
  const [loadingLivekit, setLoadingLivekit] = useState(false);

  const getEmbedUrl = (url: string): string | null => {
    const youtubeMatch = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/
    );
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`;
    }

    const twitchMatch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
    if (twitchMatch) {
      return `https://player.twitch.tv/?channel=${twitchMatch[1]}&parent=${
        typeof window !== "undefined" ? window.location.hostname : "localhost"
      }`;
    }

    if (url.includes("embed") || url.includes("iframe")) {
      return url;
    }

    return null;
  };

  const embedUrl = streamUrl ? getEmbedUrl(streamUrl) : null;
  const shouldUseLivekit = Boolean(sessionId && livekitServerUrl);

  useEffect(() => {
    if (!shouldUseLivekit || !sessionId) return;

    const fetchToken = async () => {
      setLoadingLivekit(true);
      setLivekitError(null);

      try {
        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: sessionId,
            role,
            identity: participantIdentity,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data?.token) {
          throw new Error(data?.error || "Failed to fetch LiveKit token");
        }

        setLivekitToken(data.token as string);
      } catch (error) {
        console.error("LiveKit token error", error);
        setLivekitError(
          "Live video is unavailable right now. Falling back to placeholder."
        );
      } finally {
        setLoadingLivekit(false);
      }
    };

    fetchToken();
  }, [sessionId, role, shouldUseLivekit]);

  const handleConnected = useCallback(async (room: Room) => {
    if (role !== "host") return;

    try {
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (error) {
      console.error("Failed to enable camera or microphone", error);
    }
  }, [role]);

  const livekitContent = useMemo(() => {
    if (!shouldUseLivekit) return null;

    if (livekitError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/50 text-muted-foreground text-sm">
          {livekitError}
        </div>
      );
    }

    if (loadingLivekit || !livekitToken) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      );
    }

    return (
      <LiveKitRoom
        token={livekitToken}
        serverUrl={livekitServerUrl}
        connect={Boolean(livekitToken)}
        video
        audio
        connectOptions={{ autoSubscribe: true }}
        onConnected={handleConnected}
        data-lk-theme="default"
      >
        <div className="absolute inset-0">
          <VideoConference />
        </div>
        {label && (
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm text-xs font-semibold text-foreground px-3 py-1 rounded-full shadow-sm">
            {label}
          </div>
        )}
      </LiveKitRoom>
    );
  }, [
    shouldUseLivekit,
    livekitToken,
    livekitServerUrl,
    livekitError,
    loadingLivekit,
    handleConnected,
    label,
  ]);

  if (shouldUseLivekit) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border"
      >
        {livekitContent}
      </motion.div>
    );
  }

  if (!streamUrl || !embedUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative aspect-video bg-secondary rounded-xl overflow-hidden border border-border"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Radio className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-foreground">{sessionTitle}</h3>
          <p className="text-muted-foreground text-sm">Live Q&A session in progress</p>
          <div className="flex items-center gap-2 mt-4">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full live-pulse" />
            <span className="text-sm font-medium text-red-600">LIVE</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border group"
    >
      <iframe
        src={embedUrl}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />

      {/* Live indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
        <span className="w-2 h-2 bg-red-500 rounded-full live-pulse" />
        <span className="text-xs font-semibold text-red-600">LIVE</span>
      </div>
    </motion.div>
  );
}
