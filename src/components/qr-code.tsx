import QRCode from "qrcode";

/** QR code SVG généré côté serveur (aucune dépendance navigateur). */
export async function QrCode({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    margin: 1,
    width: 180,
    errorCorrectionLevel: "M",
    color: { dark: "#0d1117", light: "#ffffff" },
  });

  return (
    <details className="w-fit">
      <summary className="cursor-pointer text-xs text-muted transition-colors hover:text-accent">
        {label}
      </summary>
      <div
        className="mt-2 w-fit rounded-xl bg-white p-2"
        // SVG produit par la bibliothèque `qrcode` à partir d'une URL interne.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </details>
  );
}
