"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { startProfileSync } from "../lib/profile-bootstrap.mjs";

export default function ConvexProfileBootstrap() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensureCurrentProfile = useMutation("users:ensureCurrentProfile");
  const lastSyncedUserId = useRef(null);
  const syncVersion = useRef(0);

  useEffect(() => {
    syncVersion.current += 1;
    const version = syncVersion.current;

    if (!isLoaded) return undefined;
    if (!isSignedIn || !userId) {
      lastSyncedUserId.current = null;
      return undefined;
    }
    if (isLoading || !isAuthenticated || lastSyncedUserId.current === userId) return undefined;

    const cleanup = startProfileSync({
      userId,
      ensureCurrentProfile,
      onSynced: (syncedUserId) => {
        if (syncVersion.current === version) lastSyncedUserId.current = syncedUserId;
      },
      onExhausted: (failedUserId) => {
        if (syncVersion.current === version && lastSyncedUserId.current === failedUserId) {
          lastSyncedUserId.current = null;
        }
      },
    });

    return () => {
      syncVersion.current += 1;
      cleanup();
    };
  }, [ensureCurrentProfile, isAuthenticated, isLoaded, isLoading, isSignedIn, userId]);

  return null;
}
