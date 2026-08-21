import { useAuth } from "./useAuth";

/**
 * Atalho para acessar o profile do usuário autenticado.
 * O fetch + cache em memória já é feito por useAuth/AuthProvider.
 */
export function useProfile() {
  const { profile, loading, refreshProfile } = useAuth();
  return { profile, loading, refresh: refreshProfile };
}
