import type { NotificationBroadcast } from "@/lib/notifications/broadcast-types";
import { subscribeBroadcasts } from "@/lib/notifications/broadcast-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (broadcast: NotificationBroadcast) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(broadcast)}\n\n`),
        );
      };

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15_000);

      const unsubscribe = subscribeBroadcasts(send);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
