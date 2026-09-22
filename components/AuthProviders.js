"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import ConvexProfileBootstrap from "@/components/ConvexProfileBootstrap";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";

function createConvexClient(url) {
  if (!url) return null;
  try {
    return new ConvexReactClient(url);
  } catch {
    // A malformed or placeholder URL must not take down public pages.
    return null;
  }
}

const convex = createConvexClient(convexUrl);

export default function AuthProviders({ children }) {
  // A local checkout without provider configuration must keep the public site
  // renderable. It must not silently create a fake authenticated state.
  if (!publishableKey) return children;

  return (
    <ClerkProvider publishableKey={publishableKey}>
      {convex ? (
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ConvexProfileBootstrap />
          {children}
        </ConvexProviderWithClerk>
      ) : (
        children
      )}
    </ClerkProvider>
  );
}
