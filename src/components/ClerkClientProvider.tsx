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
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#f59e0b",
          colorBackground: "#020617",
          colorText: "#e2e8f0",
        },
      }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
