import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getOptionalAdmin, type CurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { hasValidSyncToken } from "@/lib/auth/sync-token";
import { clientIp, resetTokens, takeToken } from "@/lib/auth/rate-limit";
import { verifyPasswordOrDummy } from "@/lib/password";

/** Vérifie un en-tête `Authorization: Basic <email:mot de passe>`. */
async function userFromBasic(
  header: string | null,
): Promise<CurrentUser | null> {
  if (!header || !/^basic\s+/i.test(header)) return null;
  try {
    const decoded = Buffer.from(
      header.replace(/^basic\s+/i, ""),
      "base64",
    ).toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    const email = decoded.slice(0, sep).trim().toLowerCase();
    const password = decoded.slice(sep + 1);

    // Anti force-brute : même limiteur que la connexion (l'auth Basic ne doit
    // pas offrir un contournement du throttle du formulaire de login).
    const ip = await clientIp();
    const userKey = `import-basic:${ip ?? "-"}|${email}`;
    const userAllowed = takeToken(userKey, 10, 15 * 60 * 1000);
    const ipAllowed = ip
      ? takeToken(`import-basic-ip:${ip}`, 30, 15 * 60 * 1000)
      : true;
    if (!userAllowed || !ipAllowed) {
      return null;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // scrypt exécuté même si l'email est inconnu (hash factice) : pas d'oracle
    // temporel sur l'existence du compte, comme pour le formulaire de connexion.
    const passwordOk = await verifyPasswordOrDummy(
      password,
      user?.passwordHash,
    );
    if (!user || !passwordOk) return null;

    resetTokens(userKey);
    if (ip) resetTokens(`import-basic-ip:${ip}`);
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
  { ok: true; user: CurrentUser } | { ok: false; response: NextResponse };

/**
 * Résout l'utilisateur cible d'un import en POST.
 *
 * Authentification acceptée (au choix) :
 *   - `Authorization: Bearer <SYNC_TOKEN>` (jeton global) ;
 *   - `Authorization: Basic <base64(email:mot de passe)>` (compte standard) ;
 *   - session admin (cookie).
 * Avec le jeton ou une session admin, `?email=` permet de cibler un compte
 * (sinon le premier administrateur). Un compte standard ne peut importer que
 * dans son propre compte.
 */
export async function resolveImportTarget(
  request: NextRequest,
): Promise<ImportTarget> {
  const url = new URL(request.url);
  const authorization = request.headers.get("authorization");

  const [admin, basicUser] = await Promise.all([
    getOptionalAdmin(),
    userFromBasic(authorization),
  ]);
  const tokenOk = hasValidSyncToken(authorization);
  const isAdmin = admin !== null;

  if (!tokenOk && !isAdmin && !basicUser) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="Statisfy"' },
        },
      ),
    };
  }

  const email = url.searchParams.get("email")?.trim().toLowerCase() ?? null;
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
