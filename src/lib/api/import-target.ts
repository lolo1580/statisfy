import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getOptionalUser, type CurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { syncToken } from "@/lib/env";
import { verifyPassword } from "@/lib/password";

/** Vérifie un en-tête `Authorization: Basic <email:mot de passe>`. */
async function userFromBasic(header: string | null): Promise<CurrentUser | null> {
  if (!header || !/^basic\s+/i.test(header)) return null;
  try {
    const decoded = Buffer.from(
      header.replace(/^basic\s+/i, ""),
      "base64",
    ).toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    const email = decoded.slice(0, sep).trim();
    const password = decoded.slice(sep + 1);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    if (!(await verifyPassword(password, user.passwordHash))) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      isAdmin: user.isAdmin,
    };
  } catch {
    return null;
  }
}

export type ImportTarget =
  | { ok: true; user: CurrentUser }
  | { ok: false; response: NextResponse };

/**
 * Résout l'utilisateur cible d'un import en POST.
 *
 * Authentification acceptée (au choix) :
 *   - `Authorization: Bearer <SYNC_TOKEN>` (jeton global) ;
 *   - `Authorization: Basic <base64(email:mot de passe)>` (compte standard) ;
 *   - session admin (cookie).
 *
 * Avec le jeton ou une session admin, `?email=` permet de cibler un compte
 * (sinon le premier administrateur). Un compte standard ne peut importer que
 * dans son propre compte.
 */
export async function resolveImportTarget(
  request: NextRequest,
): Promise<ImportTarget> {
  const url = new URL(request.url);
  const authorization = request.headers.get("authorization");
  const tokenProvided =
    authorization?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("token") ??
    "";

  const [admin, basicUser] = await Promise.all([
    getOptionalUser(),
    userFromBasic(authorization),
  ]);
  const tokenOk = syncToken.length > 0 && tokenProvided === syncToken;
  const isAdmin = Boolean(admin?.isAdmin);

  if (!tokenOk && !isAdmin && !basicUser) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Statisfy"' } },
      ),
    };
  }

  const email = url.searchParams.get("email");
  let user: CurrentUser | null = null;
  if (email) {
    if (!tokenOk && !isAdmin && basicUser?.email !== email) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
    user = await prisma.user.findUnique({ where: { email } });
  } else if (basicUser) {
    user = basicUser;
  } else {
    user =
      (await prisma.user.findFirst({
        where: { isAdmin: true },
        orderBy: { createdAt: "asc" },
      })) ?? (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));
  }

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No target user" }, { status: 400 }),
    };
  }
  return { ok: true, user };
}
