import type { Metadata } from 'next';
import { PasswordRecovery } from '@/components/relationship/password-recovery';
export const metadata: Metadata = {
  title: 'Recuperar acesso',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default function RecoveryPage() {
  return <PasswordRecovery />;
}
