"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Video, VideoOff, Mic, MicOff, Radio } from "lucide-react";
import { LiveKitRoom, useLocalParticipant, VideoTrack, useTracks } from "@livekit/components-react";
import { Track, Room } from "livekit-client";
import { Button } from "@/components/ui/button";
import "@livekit/components-styles";

interface HostVideoPublisherProps {
  sessionId: string;
  hostNumber: 1 | 2 | 3 | 4;
  sessionTitle: string;
  isCurrentUser?: boolean; // Only show controls if this is the current user's slot
}

function HostViewer({ hostNumber }: { hostNumber: number }) {
  // Subscribe to the specific host's video track
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: true }
  );

  const hostTrack = tracks.find(
    (track) =>
      track.participant.identity.includes(`-host-${hostNumber}`) &&
      track.publication
  );

  if (hostTrack && hostTrack.publication) {
    return (
      <>
        <VideoTrack
          trackRef={hostTrack as any}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
          <span className="w-2 h-2 bg-red-500 rounded-full live-pulse" />
          <span className="text-xs font-semibold text-white">LIVE</span>
        </div>
      </>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-3">
        <VideoOff className="w-8 h-8 text-white/70" />
      </div>
      <p className="text-sm text-white/70">Host {hostNumber} offline</p>
    </div>
  );
}

function HostControls() {
  const { localParticipant } = useLocalParticipant();
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    if (localParticipant) {
      setIsConnecting(false);
      setIsCameraEnabled(localParticipant.isCameraEnabled);
      setIsMicEnabled(localParticipant.isMicrophoneEnabled);

      // Auto-enable camera and microphone on mount with a slight delay
      const enableDevices = async () => {
        // Wait for connection to be fully established
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          await localParticipant.setCameraEnabled(true);
          await localParticipant.setMicrophoneEnabled(true);
          setIsCameraEnabled(true);
          setIsMicEnabled(true);
        } catch (error) {
          console.error("Failed to enable camera or microphone", error);
        }
      };
      enableDevices();
    }
  }, [localParticipant]);

  const toggleCamera = async () => {
    if (!localParticipant) return;
    try {
      const enabled = !isCameraEnabled;
      await localParticipant.setCameraEnabled(enabled);
      setIsCameraEnabled(enabled);
    } catch (error) {
      console.error("Failed to toggle camera:", error);
    }
  };

  const toggleMic = async () => {
    if (!localParticipant) return;
    try {
      const enabled = !isMicEnabled;
      await localParticipant.setMicrophoneEnabled(enabled);
      setIsMicEnabled(enabled);
    } catch (error) {
      console.error("Failed to toggle microphone:", error);
    }
  };

  const videoTrack = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  }).find((track) => track.participant.identity === localParticipant?.identity);

  if (isConnecting) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div className="text-white text-sm">Connecting...</div>
      </div>
    );
  }

  return (
    <>
      {/* Video preview */}
      <div className="absolute inset-0 bg-black">
        {videoTrack && isCameraEnabled ? (
          <VideoTrack
            trackRef={videoTrack}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-3">
              <VideoOff className="w-8 h-8 text-white/70" />
            </div>
            <p className="text-sm text-white/70">Camera off</p>
          </div>
        )}
      </div>

      {/* Control buttons */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
        <Button
          onClick={toggleCamera}
          variant={isCameraEnabled ? "default" : "destructive"}
          size="sm"
          className="rounded-full w-10 h-10 p-0"
        >
          {isCameraEnabled ? (
            <Video className="w-4 h-4" />
          ) : (
            <VideoOff className="w-4 h-4" />
          )}
        </Button>
        <Button
          onClick={toggleMic}
          variant={isMicEnabled ? "default" : "destructive"}
          size="sm"
          className="rounded-full w-10 h-10 p-0"
        >
          {isMicEnabled ? (
            <Mic className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Status indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
        <span className="w-2 h-2 bg-red-500 rounded-full live-pulse" />
        <span className="text-xs font-semibold text-white">LIVE</span>
      </div>
    </>
  );
}

export function HostVideoPublisher({
  sessionId,
  hostNumber,
  sessionTitle,
  isCurrentUser = true,
}: HostVideoPublisherProps) {
  const livekitServerUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL;
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitError, setLivekitError] = useState<string | null>(null);
  const [loadingLivekit, setLoadingLivekit] = useState(false);

  useEffect(() => {
    // Only fetch token if this is the current user's slot
    if (!livekitServerUrl || !sessionId || !isCurrentUser) return;

    const fetchToken = async () => {
      setLoadingLivekit(true);
      setLivekitError(null);

      try {
        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: sessionId,
            role: "host",
            identity: `${sessionId}-host-${hostNumber}`,
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
  }, [sessionId, hostNumber, livekitServerUrl, isCurrentUser]);

  // Fetch token for viewing other hosts' streams (when not current user)
  useEffect(() => {
    if (!livekitServerUrl || !sessionId || isCurrentUser) return;

    const fetchViewerToken = async () => {
      setLoadingLivekit(true);
      setLivekitError(null);

      try {
        const response = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: sessionId,
            role: "viewer",
            identity: `viewer-${sessionId}-host${hostNumber}`,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data?.token) {
          throw new Error(data?.error || "Failed to fetch LiveKit token");
        }

        setLivekitToken(data.token as string);
      } catch (error) {
        console.error("LiveKit viewer token error", error);
        setLivekitError("Failed to connect to live video service");
      } finally {
        setLoadingLivekit(false);
      }
    };

    fetchViewerToken();
  }, [sessionId, hostNumber, livekitServerUrl, isCurrentUser]);

  const handleConnected = useCallback((room?: Room) => {
    console.log("Connected to LiveKit room:", room?.name);
  }, []);

  if (!livekitServerUrl) {
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
          <h3 className="text-lg font-semibold mb-2 text-foreground">
            Host {hostNumber}
          </h3>
          <p className="text-muted-foreground text-sm">
            LiveKit not configured
          </p>
        </div>
      </motion.div>
    );
  }

  if (livekitError) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative aspect-video bg-secondary rounded-xl overflow-hidden border border-border"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
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
        className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-white text-sm">Connecting to Host {hostNumber}...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border"
    >
      <LiveKitRoom
        token={livekitToken}
        serverUrl={livekitServerUrl}
        connect={Boolean(livekitToken)}
        video={isCurrentUser}
        audio={isCurrentUser}
        connectOptions={{ autoSubscribe: true }}
        onConnected={handleConnected}
        data-lk-theme="default"
      >
        {isCurrentUser ? (
          <HostControls />
        ) : (
          <HostViewer hostNumber={hostNumber} />
        )}
      </LiveKitRoom>

      {/* Label */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-xs font-semibold text-foreground px-3 py-1 rounded-full shadow-sm z-10">
        Host {hostNumber}
      </div>
    </motion.div>
  );
}
