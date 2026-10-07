export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-primary">Poultry Prophet</p>
        <h1 className="mt-2 text-2xl font-bold">You are offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page isn’t available offline. Reconnect to load it. Previously saved batch data stays on this device, and supported records sync when you’re back online.</p>
      </section>
    </main>
  );
}
