import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950">
      <div className="w-full max-w-md px-4">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-amber-400 glow-text">TravelBoard</h1>
          <p className="mt-1 text-sm text-slate-400">Create your account</p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-slate-900/95 border border-slate-700/70 shadow-2xl",
            },
          }}
        />
      </div>
    </div>
  );
}
