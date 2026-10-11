import { getOptionalUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { csvCell } from "@/lib/csv";

export const dynamic = "force-dynamic";

const BATCH = 1000;
const HEADER = "played_at,ms_played,track,artist,album,source\n";

/**
 * Export CSV de tout l'historique de l'utilisateur connecté.
 *
 * Pagination par curseur + `ReadableStream` : l'historique n'est jamais chargé
 * entièrement en mémoire.
 */
export async function GET() {
  const user = await getOptionalUser();
  if (!user) {
    return new Response("Non autorisé.", { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(HEADER));
      let cursor: string | undefined;
      try {
        for (;;) {
          const plays = await prisma.play.findMany({
            where: { userId: user.id },
            orderBy: [{ playedAt: "desc" }, { id: "desc" }],
            take: BATCH,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            include: { track: { include: { artist: true, album: true } } },
          });
          if (plays.length === 0) break;

          let chunk = "";
          for (const play of plays) {
            chunk += `${[
              play.playedAt.toISOString(),
              play.msPlayed,
              play.track.name,
              play.track.artist.name,
              play.track.album?.name ?? "",
              play.source,
            ]
              .map(csvCell)
              .join(",")}\n`;
          }
          controller.enqueue(encoder.encode(chunk));

          if (plays.length < BATCH) break;
          cursor = plays[plays.length - 1].id;
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="statisfy-export.csv"',
      "Cache-Control": "no-store",
    },
  });
}
