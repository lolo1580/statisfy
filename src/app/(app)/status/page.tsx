import { redirect } from "next/navigation";

/**
 * Le statut de l'instance est désormais intégré à l'espace d'administration
 * (`/admin`). On conserve la route pour les liens existants : le layout admin
 * redirige les comptes non administrateurs et non connectés.
 */
export default function StatusPage() {
  redirect("/admin");
}
