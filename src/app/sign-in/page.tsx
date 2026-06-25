"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const ClerkSignIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignIn),
  { ssr: false }
);

export default function SignInCatchAll() {
  if (!CLERK_ENABLED) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <div className="w-full max-w-md px-4 text-center">
          <h1 className="text-2xl font-bold text-amber-400">TravelBoard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Authentication is not configured yet.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block px-6 py-3 bg-amber-500 text-slate-950 font-semibold rounded-lg hover:bg-amber-400 transition"
          >
            Back to Map
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950">
      <ClerkSignIn
        routing="hash"
        signUpUrl="/sign-up"
        forceRedirectUrl="/"
        appearance={{
          variables: {
            colorPrimary: "#f59e0b",
            colorBackground: "#020617",
            colorTextOnPrimaryBackground: "#0f172a",
            colorTextSecondary: "#94a3b8",
            colorInputBackground: "#0f172a",
            colorInputText: "#e2e8f0",
            colorNeutral: "#e2e8f0",
            colorDanger: "#f87171",
          } as Record<string, string>,
          elements: {
            rootBox: "mx-auto",
            card: "bg-slate-950 border border-slate-700/70 shadow-2xl",
            cardBox: "bg-slate-950",
            headerTitle: "text-slate-100",
            headerSubtitle: "text-slate-400",
            formFieldLabel: "text-slate-300",
            formFieldInput: "bg-slate-900 text-slate-100 border-slate-700",
            formFieldHintText: "text-slate-400",
            formFieldErrorText: "text-red-400",
            formFieldSuccessText: "text-green-400",
            formFieldWarningText: "text-amber-400",
            footerAction: "text-slate-400",
            footerActionText: "text-slate-400",
            footerActionLink: "text-amber-400 hover:text-amber-300",
            footerPages: "text-slate-400",
            footerPagesLink: "text-slate-400 hover:text-slate-300",
            formButtonPrimary: "bg-amber-500 hover:bg-amber-400 text-slate-950",
            dividerLine: "bg-slate-700",
            dividerText: "text-slate-500",
            socialButtonsBlockButton: "border-slate-700 text-slate-200 hover:bg-slate-800",
            socialButtonsBlockButtonText: "text-slate-200",
            socialButtonsBlockButtonArrow: "text-slate-400",
            socialButtonsProviderIcon: "brightness-0 invert opacity-80",
            identityPreview: "bg-slate-900 border-slate-700",
            identityPreviewText: "text-slate-300",
            identityPreviewEditButton: "text-amber-400",
            identityPreviewEditButtonIcon: "text-amber-400",
            formFieldInputShowPasswordButton: "text-slate-400 hover:text-slate-200",
            formFieldInputShowPasswordIcon: "text-slate-400",
            otpCodeFieldInput: "border-slate-700 text-slate-100 bg-slate-900",
            alternativeMethodsBlockButton: "text-slate-300 border-slate-700 hover:bg-slate-800",
            badge: "text-slate-300 bg-slate-800 border-slate-700",
            alert: "bg-slate-900 border-slate-700 text-slate-200",
            alertText: "text-slate-200",
            alertIcon: "text-slate-400",
            selectButton: "bg-slate-900 text-slate-200 border-slate-700",
            selectOption: "text-slate-200",
            selectOptionText: "text-slate-200",
            navbar: "bg-slate-950 border-slate-700",
            navbarButton: "text-slate-300",
            profileSectionTitle: "text-slate-300",
            profileSectionContent: "text-slate-400",
            profileSectionPrimaryButton: "text-amber-400",
            profilePage: "text-slate-300",
            menuButton: "text-slate-300",
            menuItem: "text-slate-300",
            tagInputContainer: "bg-slate-900 border-slate-700",
            tagPillContainer: "bg-slate-800 text-slate-200",
            providerIcon: "brightness-0 invert opacity-80",
            formResendCodeLink: "text-amber-400 hover:text-amber-300",
            backLink: "text-slate-400 hover:text-slate-200",
            buttonArrowIcon: "text-slate-400",
            internal: "text-slate-300",
          },
        }}
      />
    </div>
  );
}
