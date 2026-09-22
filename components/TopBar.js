"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";

const hasClerkProvider = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function TopBar({ user }) {
  return hasClerkProvider ? <ConfiguredTopBar user={user} /> : <TopBarContent user={user} />;
}

function ConfiguredTopBar({ user }) {
  const { signOut } = useClerk();

  async function logout() {
    await signOut({ redirectUrl: "/nouveau" });
  }

  return <TopBarContent user={user} onLogout={logout} />;
}

function TopBarContent({ user, onLogout }) {
  return (
    <header className="border-b border-line bg-surface/70 backdrop-blur">
      <div className="mx-auto max-w-5xl px-5 min-h-16 py-3 flex flex-wrap items-center justify-between gap-3">
        <Link href="/nouveau" className="font-display text-xl">
          Animation&nbsp;<span className="text-accent">Made</span>
        </Link>
        <nav className="flex w-full sm:w-auto flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm" aria-label="Navigation de l’espace">
          {user ? (
            <>
              <Link href="/nouveau/bibliotheque" className="hover:text-accent">
                Mon espace
              </Link>
              <Link href="/nouveau/demandes" className="hover:text-accent">
                Demandes
              </Link>
              {user.role === "admin" && (
                <>
                  <Link href="/admin" className="hover:text-accent">Administration</Link>
                  <Link href="/admin/disponibilites" className="hover:text-accent">Disponibilités</Link>
                </>
              )}
              <span className="text-muted hidden sm:inline">{user.email}</span>
              {onLogout ? <button onClick={onLogout} className="pill btn-ghost text-sm">Se déconnecter</button> : null}
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
