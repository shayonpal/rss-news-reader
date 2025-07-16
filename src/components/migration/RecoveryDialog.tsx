'use client';

import { useState, useEffect } from 'react';
import { 
  createRecoverySystem,
  LegacyDatabaseInfo,
  RecoveryProgress,
  RecoveryResult 
} from '@/lib/db/legacy-recovery';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  CheckCircle, 
  Database, 
  Download, 
  Upload, 
  Search, 
  Shield, 
  Trash2,
  Clock,
  HardDrive
} from 'lucide-react';

interface RecoveryDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: RecoveryResult) => void;
}

export function RecoveryDialog({ open, onClose, onSuccess }: RecoveryDialogProps) {
  const [step, setStep] = useState<'discovery' | 'confirm' | 'migrate' | 'complete'>('discovery');
  const [discoveredDatabases, setDiscoveredDatabases] = useState<LegacyDatabaseInfo[]>([]);
  const [selectedDatabases, setSelectedDatabases] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<RecoveryProgress | null>(null);
  const [result, setResult] = useState<RecoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Start discovery when dialog opens
  useEffect(() => {
    if (open && step === 'discovery') {
      discoverDatabases();
    }
  }, [open, step]);

  const discoverDatabases = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const recoverySystem = createRecoverySystem((progress) => {
        setProgress(progress);
      });
      
      const databases = await recoverySystem.discoverLegacyDatabases();
      setDiscoveredDatabases(databases);
      
      if (databases.length > 0) {
        // Auto-select all discovered databases
        setSelectedDatabases(new Set(databases.map(db => db.name)));
        setStep('confirm');
      } else {
        setStep('complete');
        setResult({
          success: true,
          migratedData: { users: 0, feeds: 0, articles: 0, folders: 0 },
          errors: [],
          duration: 0
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover databases');
    } finally {
      setLoading(false);
    }
  };

  const toggleDatabaseSelection = (dbName: string) => {
    const newSelection = new Set(selectedDatabases);
    if (newSelection.has(dbName)) {
      newSelection.delete(dbName);
    } else {
      newSelection.add(dbName);
    }
    setSelectedDatabases(newSelection);
  };

  const startMigration = async () => {
    if (selectedDatabases.size === 0) return;
    
    setLoading(true);
    setError(null);
    setStep('migrate');
    
    try {
      const recoverySystem = createRecoverySystem((progress) => {
        setProgress(progress);
      });
      
      const selectedDbInfos = discoveredDatabases.filter(db => 
        selectedDatabases.has(db.name)
      );
      
      const migrationResult = await recoverySystem.performMigration(selectedDbInfos);
      setResult(migrationResult);
      
      if (migrationResult.success) {
        onSuccess(migrationResult);
      }
      
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getPhaseIcon = (phase: RecoveryProgress['phase']) => {
    switch (phase) {
      case 'discovery':
        return <Search className="w-4 h-4" />;
      case 'extraction':
        return <Download className="w-4 h-4" />;
      case 'upload':
        return <Upload className="w-4 h-4" />;
      case 'verification':
        return <Shield className="w-4 h-4" />;
      case 'cleanup':
        return <Trash2 className="w-4 h-4" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Recovery
          </DialogTitle>
          <DialogDescription>
            Recover your articles and feeds from previous sessions
          </DialogDescription>
        </DialogHeader>

        {/* Discovery Step */}
        {step === 'discovery' && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
              <h3 className="text-lg font-semibold mb-2">Scanning for Legacy Data</h3>
              <p className="text-muted-foreground">
                Looking for existing RSS reader data in your browser...
              </p>
              {progress && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    {getPhaseIcon(progress.phase)}
                    <span className="text-sm">{progress.currentStep}</span>
                  </div>
                  <Progress value={progress.progress} className="w-full" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Step */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Found Legacy Data</h3>
              <p className="text-sm text-muted-foreground">
                Select which databases to recover data from:
              </p>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {discoveredDatabases.map((db) => (
                <div
                  key={db.name}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedDatabases.has(db.name)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => toggleDatabaseSelection(db.name)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="w-4 h-4" />
                        <span className="font-medium">{db.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          v{db.version}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            <span>{formatFileSize(db.estimatedSize)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{db.lastModified.toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs">
                          {db.recordCounts.articles && (
                            <span>{db.recordCounts.articles} articles</span>
                          )}
                          {db.recordCounts.feeds && (
                            <span>{db.recordCounts.feeds} feeds</span>
                          )}
                          {db.recordCounts.folders && (
                            <span>{db.recordCounts.folders} folders</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        selectedDatabases.has(db.name)
                          ? 'bg-primary border-primary'
                          : 'border-border'
                      }`}>
                        {selectedDatabases.has(db.name) && (
                          <CheckCircle className="w-3 h-3 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={startMigration}
                disabled={selectedDatabases.size === 0}
              >
                Recover Data ({selectedDatabases.size} database{selectedDatabases.size !== 1 ? 's' : ''})
              </Button>
            </div>
          </div>
        )}

        {/* Migration Step */}
        {step === 'migrate' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto mb-4 border-2 border-primary rounded-full flex items-center justify-center">
                {progress && getPhaseIcon(progress.phase)}
              </div>
              <h3 className="text-lg font-semibold mb-2">Migrating Data</h3>
              <p className="text-muted-foreground">
                This may take a few minutes...
              </p>
            </div>

            {progress && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {progress.phase}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(progress.progress)}%
                  </span>
                </div>
                
                <Progress value={progress.progress} className="w-full" />
                
                <div className="text-sm text-muted-foreground text-center">
                  {progress.currentStep}
                </div>
                
                {progress.errors.length > 0 && (
                  <div className="space-y-1">
                    {progress.errors.map((error, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="w-3 h-3" />
                        {error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${
                result?.success 
                  ? 'bg-green-100 text-green-600' 
                  : 'bg-red-100 text-red-600'
              }`}>
                {result?.success ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>
              
              <h3 className="text-lg font-semibold mb-2">
                {result?.success ? 'Migration Complete!' : 'Migration Failed'}
              </h3>
              
              <p className="text-muted-foreground">
                {result?.success 
                  ? 'Your data has been successfully recovered and migrated.'
                  : 'There was an error during the migration process.'
                }
              </p>
            </div>

            {result && (
              <div className="space-y-3">
                {result.success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">Migration Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-green-600">Users:</span> {result.migratedData.users}
                      </div>
                      <div>
                        <span className="text-green-600">Feeds:</span> {result.migratedData.feeds}
                      </div>
                      <div>
                        <span className="text-green-600">Articles:</span> {result.migratedData.articles}
                      </div>
                      <div>
                        <span className="text-green-600">Folders:</span> {result.migratedData.folders}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-green-600">
                      Completed in {formatDuration(result.duration)}
                    </div>
                  </div>
                )}
                
                {result.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-semibold text-red-800 mb-2">Errors</h4>
                    <div className="space-y-1">
                      {result.errors.map((error, index) => (
                        <div key={index} className="text-sm text-red-600">
                          • {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-semibold">Error</span>
                </div>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            )}

            <div className="flex justify-between">
              {!result?.success && (
                <Button variant="outline" onClick={() => setStep('discovery')}>
                  Try Again
                </Button>
              )}
              <Button onClick={onClose} className="ml-auto">
                {result?.success ? 'Continue' : 'Close'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}