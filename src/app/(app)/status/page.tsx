import { redirect } from "next/navigation";

/**
 * Le statut de l'instance est désormais intégré à la page Réglages.
 * On conserve la route pour les liens existants.
 */
export default function StatusPage() {
  redirect("/settings");
}
