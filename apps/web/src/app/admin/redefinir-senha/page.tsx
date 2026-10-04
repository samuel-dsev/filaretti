import type { Metadata } from 'next';
import { PasswordRecovery } from '@/components/relationship/password-recovery';
export const metadata: Metadata = {
  title: 'Redefinir senha',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default function ResetPage() {
  return <PasswordRecovery reset />;
}
