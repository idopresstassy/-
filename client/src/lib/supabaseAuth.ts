import { SUPABASE_PASSWORD_RESET_ROUTE } from "./authNavigation";

export function getPasswordResetRedirect(origin: string) {
  return `${origin}${SUPABASE_PASSWORD_RESET_ROUTE}`;
}
