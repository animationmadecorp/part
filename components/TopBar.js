"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";

export default function TopBar({ user }) {
  const { signOut } = useClerk();

  async function logout() {
    await signOut({ redirectUrl: "/nouveau" });
  }

  return (
    <header className="border-b border-line bg-surface/70 backdrop-blur">
      <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between">
        <Link href="/nouveau" className="font-display text-xl">
          Animation&nbsp;<span className="text-accent">Made</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href="/nouveau/bibliotheque" className="hover:text-accent">
                Mon espace
              </Link>
              <Link href="/nouveau/demandes" className="hover:text-accent">
                Demandes
              </Link>
              {user.role === "admin" && (
                <Link href="/admin/disponibilites" className="hover:text-accent">
                  Disponibilités
                </Link>
              )}
              <span className="text-muted hidden sm:inline">{user.email}</span>
              <button onClick={logout} className="pill btn-ghost text-sm">
                Se déconnecter
              </button>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hover:text-accent">
                Se connecter
              </Link>
              <Link href="/sign-up" className="pill btn-primary text-sm">
                Commencer
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
