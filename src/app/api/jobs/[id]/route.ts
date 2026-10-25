import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Avancement d'un import en cours (job créé par l'action d'import).
 * Réservé au propriétaire du job : l'identifiant est fourni par le client.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, userId: user.id },
    select: {
      status: true,
      total: true,
      processed: true,
      inserted: true,
      error: true,
    },
  });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(job, {
    headers: { "Cache-Control": "no-store" },
  });
}
