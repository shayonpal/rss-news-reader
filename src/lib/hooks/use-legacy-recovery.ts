"use client";

import { useState, useEffect } from "react";
import {
  createRecoverySystem,
  LegacyDatabaseInfo,
  RecoveryResult,
} from "@/lib/db/legacy-recovery";

export function useLegacyRecovery() {
  const [shouldShowRecovery, setShouldShowRecovery] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [legacyDatabases, setLegacyDatabases] = useState<LegacyDatabaseInfo[]>(
    []
  );

  useEffect(() => {
    checkForLegacyData();
  }, []);

  const checkForLegacyData = async () => {
    try {
      // Check if user has already seen the recovery dialog
      const hasSeenRecovery = localStorage.getItem("legacy-recovery-seen");
      if (hasSeenRecovery) {
        setIsChecking(false);
        return;
      }

      const recoverySystem = createRecoverySystem();
      const databases = await recoverySystem.discoverLegacyDatabases();

      setLegacyDatabases(databases);

      // Only show recovery dialog if there are databases with meaningful data
      const hasSignificantData = databases.some(
        (db) =>
          (db.recordCounts.articles || 0) > 0 ||
          (db.recordCounts.feeds || 0) > 0
      );

      setShouldShowRecovery(hasSignificantData);
    } catch (error) {
      console.error("Failed to check for legacy data:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const markRecoveryAsSeen = () => {
    localStorage.setItem("legacy-recovery-seen", "true");
    setShouldShowRecovery(false);
  };

  const handleRecoverySuccess = (result: RecoveryResult) => {
    markRecoveryAsSeen();

    // Show success notification
    console.log("Recovery completed successfully:", result);

    // Could trigger a notification here
    // toast.success(`Successfully recovered ${result.migratedData.articles} articles`);
  };

  const handleRecoveryClose = () => {
    markRecoveryAsSeen();
  };

  return {
    shouldShowRecovery,
    isChecking,
    legacyDatabases,
    handleRecoverySuccess,
    handleRecoveryClose,
    checkForLegacyData,
  };
}
