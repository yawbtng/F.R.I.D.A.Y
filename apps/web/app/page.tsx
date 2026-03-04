export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-friday-bg">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-friday-accent/20 border border-friday-accent/30 animate-pulse" />
        <h1 className="text-3xl font-semibold text-friday-text-primary tracking-tight">
          F.R.I.D.A.Y.
        </h1>
        <p className="text-friday-text-secondary font-mono text-sm">
          Voice Browser Agent — initializing...
        </p>
      </div>
    </main>
  );
}
