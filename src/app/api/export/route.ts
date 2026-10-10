import { getOptionalUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Export CSV de tout l'historique de l'utilisateur connecté. */
export async function GET() {
  const user = await getOptionalUser();
  if (!user) {
    return new Response("Non autorisé.", { status: 401 });
  }

  const plays = await prisma.play.findMany({
    where: { userId: user.id },
    orderBy: { playedAt: "desc" },
    include: { track: { include: { artist: true, album: true } } },
  });

  const lines = [
    "played_at,ms_played,track,artist,album,source",
    ...plays.map((play) =>
      [
        play.playedAt.toISOString(),
        play.msPlayed,
        play.track.name,
        play.track.artist.name,
        play.track.album?.name ?? "",
        play.source,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="statisfy-export.csv"',
    },
  });
}
