'use client';

import { RecoveryDialog } from './RecoveryDialog';
import { useLegacyRecovery } from '@/lib/hooks/use-legacy-recovery';

export function RecoveryProvider({ children }: { children: React.ReactNode }) {
  const {
    shouldShowRecovery,
    isChecking,
    handleRecoverySuccess,
    handleRecoveryClose
  } = useLegacyRecovery();

  return (
    <>
      {children}
      {!isChecking && (
        <RecoveryDialog
          open={shouldShowRecovery}
          onClose={handleRecoveryClose}
          onSuccess={handleRecoverySuccess}
        />
      )}
    </>
  );
}