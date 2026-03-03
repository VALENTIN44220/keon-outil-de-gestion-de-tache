import { useUserRole } from '@/hooks/useUserRole';

export function useInnoRole() {
  const { roles, isAdmin, isLoading } = useUserRole();
  const isInnoAdmin = isAdmin || roles.includes('inno_admin' as any);
  return { isInnoAdmin, isLoading };
}
