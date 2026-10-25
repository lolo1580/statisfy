/** Vrai si `pathname` correspond au lien ou à une de ses sous-pages. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
