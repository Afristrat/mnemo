// Hook d'instrumentation Next 15 — exécuté une fois au démarrage du serveur. Arme la veille vendor
// périodique (broadcast d'alertes prix, S-084) DANS le process Node long-running (output: standalone),
// sans dépendre d'un cron externe ni d'un binaire du conteneur. Garde-fous : runtime Node uniquement,
// production uniquement (pas de scrape en dev), désactivable par VENDOR_WATCH_DISABLED=1. L'import est
// dynamique et conditionnel : le module server-only n'est jamais tiré dans le runtime edge.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.VENDOR_WATCH_DISABLED === "1") return;
  const { startVendorWatchScheduler } = await import("@/lib/network/vendor-watch");
  startVendorWatchScheduler();
}
