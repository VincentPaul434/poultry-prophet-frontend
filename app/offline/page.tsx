export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-primary">Poultry Prophet</p>
        <h1 className="mt-2 text-2xl font-bold">You are offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">Open a previously visited batch to record supported farm events. Records will sync when the connection returns.</p>
      </section>
    </main>
  );
}
