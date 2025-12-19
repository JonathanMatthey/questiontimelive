"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radio, VideoOff } from "lucide-react";
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

interface MultiHostViewerProps {
  sessionId: string;
  sessionTitle: string;
}

function HostStreams() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true }
  );

  // Find tracks for each host
  const hostTracks = [1, 2, 3, 4].map((hostNum) => {
    return tracks.find(
      (track) =>
        track.participant.identity.includes(`-host-${hostNum}`) &&
        track.publication
    );
  });

  // Count active hosts to determine grid layout
  const activeHostCount = hostTracks.filter((t) => t?.publication).length;

  // Determine grid classes based on active hosts
  const getGridClasses = () => {
    if (activeHostCount <= 1) return "grid-cols-1";
    if (activeHostCount === 2) return "grid-cols-1 md:grid-cols-2";
    return "grid-cols-1 md:grid-cols-2"; // 3-4 hosts: 2x2 grid
  };

  return (
    <div className={`grid ${getGridClasses()} gap-4 h-full`}>
      {hostTracks.map((hostTrack, index) => {
        const hostNum = index + 1;
        const hasTrack = hostTrack && hostTrack.publication;

        // Don't render slot if no host has joined and it's host 3 or 4
        // Only show host 3/4 slots if at least one of them is active
        if (!hasTrack && hostNum > 2 && !hostTracks[2]?.publication && !hostTracks[3]?.publication) {
          return null;
        }

        return (
          <div
            key={hostNum}
            className="relative aspect-video bg-black rounded-lg overflow-hidden"
          >
            {hasTrack ? (
              <>
                <VideoTrack
                  trackRef={hostTrack as any}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-semibold text-foreground px-3 py-1 rounded-full shadow-sm">
                  Host {hostNum}
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-2">
                  <VideoOff className="w-6 h-6 text-white/70" />
                </div>
                <p className="text-sm text-white/70">Host {hostNum} offline</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MultiHostViewer({
  sessionId,
  sessionTitle,
}: MultiHostViewerProps) {
  const livekitServerUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL;
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitError, setLivekitError] = useState<string | null>(null);
  const [loadingLivekit, setLoadingLivekit] = useState(false);

  useEffect(() => {
    if (!livekitServerUrl || !sessionId) return;

    const fetchToken = async () => {
      setLoadingLivekit(true);
      setLivekitError(null);

      try {
        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: sessionId,
            role: "viewer",
            identity: `viewer-${Math.random().toString(36).substr(2, 9)}`,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data?.token) {
          throw new Error(data?.error || "Failed to fetch LiveKit token");
        }

        setLivekitToken(data.token as string);
      } catch (error) {
        console.error("LiveKit token error", error);
        setLivekitError("Failed to connect to live video service");
      } finally {
        setLoadingLivekit(false);
      }
    };

    fetchToken();
  }, [sessionId, livekitServerUrl]);

  if (!livekitServerUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full bg-secondary rounded-xl overflow-hidden border border-border p-8"
      >
        <div className="flex flex-col items-center justify-center text-center min-h-[400px]">
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

  if (livekitError) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full bg-secondary rounded-xl overflow-hidden border border-border p-8"
      >
        <div className="flex flex-col items-center justify-center text-center min-h-[400px]">
          <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4">
            <VideoOff className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-foreground">
            Connection Error
          </h3>
          <p className="text-muted-foreground text-sm">{livekitError}</p>
        </div>
      </motion.div>
    );
  }

  if (loadingLivekit || !livekitToken) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full bg-black rounded-xl overflow-hidden border border-border"
      >
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-white text-sm">Connecting to live stream...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full bg-black rounded-xl overflow-hidden border border-border p-4"
    >
      <LiveKitRoom
        token={livekitToken}
        serverUrl={livekitServerUrl}
        connect={Boolean(livekitToken)}
        video={false}
        audio={true}
        connectOptions={{ autoSubscribe: true }}
        data-lk-theme="default"
      >
        <HostStreams />
      </LiveKitRoom>

      {/* Live indicator */}
      <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
        <span className="w-2 h-2 bg-red-500 rounded-full live-pulse" />
        <span className="text-xs font-semibold text-white">LIVE</span>
      </div>
    </motion.div>
  );
}
