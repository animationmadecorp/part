import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const clerkConfigured =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
  Boolean(process.env.CLERK_SECRET_KEY);

// The proxy only initializes Clerk when both server-side keys exist. With no
// configuration it is a transparent pass-through so public pages still work;
// protected resources enforce access again in their own server code.
const configuredProxy = clerkConfigured ? clerkMiddleware() : null;

export default function proxy(...args) {
  if (!configuredProxy) return NextResponse.next();
  return configuredProxy(...args);
}

export const config = {
  matcher: [
    "/nouveau/bibliotheque/:path*",
    "/nouveau/demandes/:path*",
    "/nouveau/studio/:path*",
    "/nouveau/reserver/:path*",
    "/nouveau/confirmation/:path*",
    "/admin/disponibilites/:path*",
    "/admin/reservations/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/api/:path*",
    "/trpc/:path*",
  ],
};
