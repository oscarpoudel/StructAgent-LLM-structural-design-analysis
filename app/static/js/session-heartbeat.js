/* Counts active workspace tabs, not background status polling. */
(() => {
  const ping = async () => {
    if (document.visibilityState !== "visible") return;
    try {
      await fetch("/api/session/heartbeat", {
        method: "POST",
        headers: { "X-StructAgent-Action": "1" },
        credentials: "same-origin",
        cache: "no-store"
      });
    } catch (_) { /* session may be stopping */ }
  };
  ping();
  setInterval(ping, 30000);
  document.addEventListener("visibilitychange", ping);
})();
