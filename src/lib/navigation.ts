export type NavAuth = "any" | "authenticated" | "guest";

export type NavIconName = "home" | "dashboard" | "plants" | "plus" | "map" | "sign-in" | "sign-up";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  auth: NavAuth;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: "home", auth: "any" },
  { href: "/plants", label: "My plants", icon: "plants", auth: "authenticated" },
  { href: "/plants/new", label: "Add Plant", icon: "plus", auth: "authenticated" },
  { href: "/garden-map", label: "Garden Map", icon: "map", auth: "authenticated" },
  { href: "/auth/signin", label: "Sign In", icon: "sign-in", auth: "guest" },
  { href: "/auth/signup", label: "Sign Up", icon: "sign-up", auth: "guest" },
];

export function getVisibleNavItems(isAuthenticated: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.auth === "any") return true;
    if (item.auth === "authenticated") return isAuthenticated;
    return !isAuthenticated;
  });
}

export function isNavItemActive(href: string, currentPath: string): boolean {
  if (href === "/") return currentPath === "/";

  const matches = currentPath === href || currentPath.startsWith(`${href}/`);
  if (!matches) return false;

  const hasMoreSpecificNavMatch = NAV_ITEMS.some(
    (item) =>
      item.href !== href &&
      item.href !== "/" &&
      item.href.startsWith(`${href}/`) &&
      (currentPath === item.href || currentPath.startsWith(`${item.href}/`)),
  );

  return !hasMoreSpecificNavMatch;
}
