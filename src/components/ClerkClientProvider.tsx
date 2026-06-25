"use client";

import { ClerkProvider } from "@clerk/react";
import { dark } from "@clerk/themes";
import type { ReactNode } from "react";

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Client-side only Clerk provider using @clerk/react.
 * Used in static exports where @clerk/nextjs (server actions) can't be used.
 * Falls through gracefully when no key is set.
 */
export default function ClerkClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  if (!PUBLISHABLE_KEY) return <>{children}</>;

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#f59e0b",
          colorBackground: "#020617",
          colorTextOnPrimaryBackground: "#0f172a",
          colorTextSecondary: "#94a3b8",
          colorInputBackground: "#0f172a",
          colorInputText: "#e2e8f0",
          colorNeutral: "#e2e8f0",
          colorDanger: "#f87171",
        },
      } as any}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
