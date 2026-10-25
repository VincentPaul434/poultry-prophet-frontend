export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-primary">Poultry Prophet</p>
        <h1 className="mt-2 text-2xl font-bold">Field mode is ready</h1>
        <p className="mt-2 text-sm text-muted-foreground">This screen is only shown when the page itself has not been cached yet. Open the batch once while connected to prepare it for field recording. Saved supported records remain on this device and sync automatically when the server is reachable.</p>
      </section>
    </main>
  );
}
