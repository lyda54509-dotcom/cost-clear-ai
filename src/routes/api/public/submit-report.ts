import { createFileRoute } from "@tanstack/react-router";

// Stub webhook: mirrors the report payload back. Replace with your n8n workflow
// URL in Settings → Business, and this route becomes optional. Kept so that
// external systems can post here too if you route them through this app.
export const Route = createFileRoute("/api/public/submit-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown = null;
        try { body = await request.json(); } catch { /* ignore */ }
        console.log("[submit-report] received", body);
        return Response.json({ ok: true, received: body });
      },
      GET: async () =>
        Response.json({ ok: true, hint: "POST a report payload here, or configure an n8n webhook URL in Settings." }),
    },
  },
});
