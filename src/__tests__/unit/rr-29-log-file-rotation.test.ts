import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { StatusChangeLogger } from '@/lib/logging/status-change-logger';

// Mock fs and zlib modules
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
      unlink: vi.fn(),
      mkdir: vi.fn(),
      access: vi.fn(),
      rename: vi.fn(),
      stat: vi.fn(),
    },
  };
});

vi.mock('zlib', () => ({
  gzip: vi.fn((data, callback) => {
    callback(null, Buffer.from('compressed-data'));
  }),
  gunzip: vi.fn((data, callback) => {
    callback(null, Buffer.from('uncompressed-data'));
  }),
}));

describe('Log File Rotation and Retention - RR-29', () => {
  let logger: StatusChangeLogger;
  const mockLogDir = '/mock/logs';
  
  beforeEach(() => {
    vi.clearAllMocks();
    logger = new StatusChangeLogger(mockLogDir);
    vi.setSystemTime(new Date('2025-08-06T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Daily Log Rotation', () => {
    it('should rotate log file at midnight', async () => {
      const yesterday = '2025-08-05';
      const today = '2025-08-06';
      
      // Mock existing log file
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      vi.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from('existing log content'));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.rename).mockResolvedValue(undefined);
      
      await logger.rotateLogFile();
      
      expect(fs.rename).toHaveBeenCalledWith(
        path.join(mockLogDir, 'status-changes.jsonl'),
        path.join(mockLogDir, `status-changes-${yesterday}.jsonl`)
      );
    });

    it('should create new log file after rotation', async () => {
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      vi.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from('old content'));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.rename).mockResolvedValue(undefined);
      
      await logger.rotateLogFile();
      
      // Should create new empty log file
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockLogDir, 'status-changes.jsonl'),
        '',
        expect.any(Object)
      );
    });

    it('should handle rotation when no existing log file exists', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
      
      await logger.rotateLogFile();
      
      expect(fs.rename).not.toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockLogDir, 'status-changes.jsonl'),
        '',
        expect.any(Object)
      );
    });

    it('should compress rotated log files', async () => {
      const zlib = await import('zlib');
      
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      vi.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from('log content to compress'));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.rename).mockResolvedValue(undefined);
      
      await logger.rotateLogFile();
      
      // Should compress the rotated file
      expect(zlib.gzip).toHaveBeenCalledWith(
        Buffer.from('log content to compress'),
        expect.any(Function)
      );
      
      // Should write compressed file
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.jsonl.gz'),
        Buffer.from('compressed-data'),
        expect.any(Object)
      );
    });
  });

  describe('7-Day Retention Policy', () => {
    it('should identify files older than 7 days', async () => {
      const currentDate = new Date('2025-08-06');
      const files = [
        'status-changes.jsonl', // Current file
        'status-changes-2025-08-05.jsonl.gz', // 1 day old
        'status-changes-2025-08-04.jsonl.gz', // 2 days old
        'status-changes-2025-08-01.jsonl.gz', // 5 days old
        'status-changes-2025-07-30.jsonl.gz', // 7 days old (keep)
        'status-changes-2025-07-29.jsonl.gz', // 8 days old (delete)
        'status-changes-2025-07-28.jsonl.gz', // 9 days old (delete)
        'other-file.txt', // Ignore non-log files
      ];
      
      vi.mocked(fs.readdir).mockResolvedValueOnce(files as any);
      
      const expiredFiles = await logger.getExpiredLogFiles(currentDate);
      
      expect(expiredFiles).toEqual([
        'status-changes-2025-07-29.jsonl.gz',
        'status-changes-2025-07-28.jsonl.gz',
      ]);
      
      expect(expiredFiles).not.toContain('status-changes-2025-07-30.jsonl.gz');
      expect(expiredFiles).not.toContain('status-changes.jsonl');
      expect(expiredFiles).not.toContain('other-file.txt');
    });

    it('should clean up expired log files', async () => {
      const expiredFiles = [
        'status-changes-2025-07-29.jsonl.gz',
        'status-changes-2025-07-28.jsonl.gz',
        'status-changes-2025-07-27.jsonl.gz',
      ];
      
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        'status-changes.jsonl',
        ...expiredFiles,
        'status-changes-2025-08-05.jsonl.gz', // Recent file to keep
      ] as any);
      
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      
      const deletedCount = await logger.cleanupExpiredLogs();
      
      expect(deletedCount).toBe(3);
      
      expiredFiles.forEach(file => {
        expect(fs.unlink).toHaveBeenCalledWith(path.join(mockLogDir, file));
      });
      
      // Should not delete recent files
      expect(fs.unlink).not.toHaveBeenCalledWith(
        path.join(mockLogDir, 'status-changes-2025-08-05.jsonl.gz')
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const files = ['status-changes-2025-07-29.jsonl.gz'];
      
      vi.mocked(fs.readdir).mockResolvedValueOnce(files as any);
      vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('Permission denied'));
      
      // Should not throw error
      const deletedCount = await logger.cleanupExpiredLogs();
      
      expect(deletedCount).toBe(0);
    });
  });

  describe('Log File Validation and Integrity', () => {
    it('should validate JSONL file format', async () => {
      const validContent = [
        '{"timestamp":"2025-08-06T10:00:00Z","articleId":"1","action":"read"}',
        '{"timestamp":"2025-08-06T10:01:00Z","articleId":"2","action":"star"}',
      ].join('\n');
      
      const isValid = await logger.validateLogFileIntegrity(validContent);
      
      expect(isValid).toBe(true);
    });

    it('should detect corrupted JSONL content', async () => {
      const corruptedContent = [
        '{"timestamp":"2025-08-06T10:00:00Z","articleId":"1","action":"read"}',
        'invalid json line',
        '{"timestamp":"2025-08-06T10:01:00Z","articleId":"2"}', // Missing required field
      ].join('\n');
      
      const isValid = await logger.validateLogFileIntegrity(corruptedContent);
      
      expect(isValid).toBe(false);
    });

    it('should repair corrupted log files by removing invalid lines', async () => {
      const mixedContent = [
        '{"timestamp":"2025-08-06T10:00:00Z","articleId":"1","feedId":"f1","action":"read","trigger":"user_click","previousValue":false,"newValue":true,"syncQueued":true,"userAgent":"Mozilla"}',
        'invalid json line',
        '{"timestamp":"2025-08-06T10:01:00Z","articleId":"2","feedId":"f2","action":"star","trigger":"user_click","previousValue":false,"newValue":true,"syncQueued":true,"userAgent":"Mozilla"}',
        '{"incomplete"',
      ].join('\n');
      
      vi.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from(mixedContent));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      
      const repairedCount = await logger.repairLogFile(
        path.join(mockLogDir, 'status-changes.jsonl')
      );
      
      expect(repairedCount).toBe(2); // Removed 2 invalid lines
      
      // Should write repaired content with only valid lines
      const expectedRepairedContent = [
        '{"timestamp":"2025-08-06T10:00:00Z","articleId":"1","feedId":"f1","action":"read","trigger":"user_click","previousValue":false,"newValue":true,"syncQueued":true,"userAgent":"Mozilla"}',
        '{"timestamp":"2025-08-06T10:01:00Z","articleId":"2","feedId":"f2","action":"star","trigger":"user_click","previousValue":false,"newValue":true,"syncQueued":true,"userAgent":"Mozilla"}',
      ].join('\n') + '\n';
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockLogDir, 'status-changes.jsonl'),
        expectedRepairedContent,
        expect.any(Object)
      );
    });
  });

  describe('Disk Space Constraint Handling', () => {
    it('should handle ENOSPC (no space left) error gracefully', async () => {
      const enospcError = new Error('ENOSPC: no space left on device');
      (enospcError as any).code = 'ENOSPC';
      
      vi.mocked(fs.writeFile).mockRejectedValueOnce(enospcError);
      
      const logEntry = {
        timestamp: '2025-08-06T10:00:00Z',
        articleId: 'article-123',
        feedId: 'feed-456',
        action: 'mark_read' as const,
        trigger: 'user_click' as const,
        previousValue: false,
        newValue: true,
        syncQueued: true,
        userAgent: 'Mozilla/5.0',
      };
      
      // Should handle error gracefully without throwing
      await expect(logger.logStatusChange(logEntry)).resolves.not.toThrow();
      
      // Should trigger emergency cleanup
      expect(logger.getLastDiskSpaceError()).toBeTruthy();
    });

    it('should trigger emergency cleanup when disk space is low', async () => {
      const enospcError = new Error('ENOSPC: no space left on device');
      (enospcError as any).code = 'ENOSPC';
      
      vi.mocked(fs.writeFile).mockRejectedValueOnce(enospcError);
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        'status-changes-2025-08-05.jsonl.gz',
        'status-changes-2025-08-04.jsonl.gz',
        'status-changes-2025-08-03.jsonl.gz',
      ] as any);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      
      const logEntry = {
        timestamp: '2025-08-06T10:00:00Z',
        articleId: 'article-123',
        feedId: 'feed-456',
        action: 'mark_read' as const,
        trigger: 'user_click' as const,
        previousValue: false,
        newValue: true,
        syncQueued: true,
        userAgent: 'Mozilla/5.0',
      };
      
      await logger.logStatusChange(logEntry);
      
      // Should have triggered emergency cleanup
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should monitor disk usage and proactively clean up', async () => {
      const mockStats = {
        size: 1024 * 1024 * 100, // 100MB total log size
      };
      
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        'status-changes.jsonl',
        'status-changes-2025-08-05.jsonl.gz',
        'status-changes-2025-08-04.jsonl.gz',
        'status-changes-2025-08-03.jsonl.gz',
      ] as any);
      
      vi.mocked(fs.stat).mockResolvedValue(mockStats as any);
      
      const diskUsage = await logger.calculateTotalLogSize();
      const maxLogSize = 50 * 1024 * 1024; // 50MB limit
      
      expect(diskUsage).toBe(100 * 1024 * 1024);
      
      if (diskUsage > maxLogSize) {
        const cleanupNeeded = await logger.triggerProactiveCleanup();
        expect(cleanupNeeded).toBe(true);
      }
    });
  });

  describe('Log File Locking and Concurrent Access', () => {
    it('should handle concurrent write attempts', async () => {
      const lockFilePath = path.join(mockLogDir, '.status-changes.lock');
      
      // Mock lock file operations
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT')); // No lock initially
      vi.mocked(fs.writeFile).mockImplementation(async (filePath, data) => {
        if (filePath === lockFilePath) {
          // Simulate lock creation
          return;
        }
        // Simulate actual log write
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      const logEntry = {
        timestamp: '2025-08-06T10:00:00Z',
        articleId: 'article-123',
        feedId: 'feed-456',
        action: 'mark_read' as const,
        trigger: 'user_click' as const,
        previousValue: false,
        newValue: true,
        syncQueued: true,
        userAgent: 'Mozilla/5.0',
      };
      
      // Simulate concurrent writes
      const concurrentWrites = [
        logger.logStatusChange(logEntry),
        logger.logStatusChange({ ...logEntry, articleId: 'article-124' }),
        logger.logStatusChange({ ...logEntry, articleId: 'article-125' }),
      ];
      
      await Promise.all(concurrentWrites);
      
      // Should have acquired and released locks properly
      expect(fs.writeFile).toHaveBeenCalledWith(lockFilePath, expect.any(String), expect.any(Object));
    });

    it('should timeout and continue if lock acquisition fails', async () => {
      const lockFilePath = path.join(mockLogDir, '.status-changes.lock');
      
      // Mock existing lock file (simulate another process holding lock)
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      const logEntry = {
        timestamp: '2025-08-06T10:00:00Z',
        articleId: 'article-123',
        feedId: 'feed-456',
        action: 'mark_read' as const,
        trigger: 'user_click' as const,
        previousValue: false,
        newValue: true,
        syncQueued: true,
        userAgent: 'Mozilla/5.0',
      };
      
      // Should timeout and continue without writing (graceful degradation)
      await expect(logger.logStatusChange(logEntry)).resolves.not.toThrow();
      
      // Should not have written the log entry due to lock timeout
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        expect.stringContaining('status-changes.jsonl'),
        expect.stringContaining('article-123'),
        expect.any(Object)
      );
    });
  });

  describe('Log Directory Creation and Permissions', () => {
    it('should create log directory with proper permissions', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      
      await logger.initialize();
      
      expect(fs.mkdir).toHaveBeenCalledWith(mockLogDir, { 
        recursive: true,
        mode: 0o755, // Proper directory permissions
      });
    });

    it('should handle permission errors during directory creation', async () => {
      const permissionError = new Error('EACCES: permission denied');
      (permissionError as any).code = 'EACCES';
      
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
      vi.mocked(fs.mkdir).mockRejectedValueOnce(permissionError);
      
      // Should handle gracefully and log error
      await expect(logger.initialize()).resolves.not.toThrow();
      
      expect(logger.isEnabled()).toBe(false); // Should disable logging due to permission error
    });
  });

  describe('Environment Variable Configuration', () => {
    it('should use custom retention period from environment', () => {
      process.env.STATUS_CHANGE_LOG_RETENTION_DAYS = '14';
      
      const customLogger = new StatusChangeLogger();
      
      expect(customLogger.getRetentionDays()).toBe(14);
      
      delete process.env.STATUS_CHANGE_LOG_RETENTION_DAYS;
    });

    it('should use custom log rotation schedule from environment', () => {
      process.env.STATUS_CHANGE_LOG_ROTATION_HOUR = '3'; // 3 AM rotation
      
      const customLogger = new StatusChangeLogger();
      
      expect(customLogger.getRotationHour()).toBe(3);
      
      delete process.env.STATUS_CHANGE_LOG_ROTATION_HOUR;
    });

    it('should validate environment configuration values', () => {
      process.env.STATUS_CHANGE_LOG_RETENTION_DAYS = 'invalid';
      process.env.STATUS_CHANGE_LOG_ROTATION_HOUR = '25'; // Invalid hour
      
      const logger = new StatusChangeLogger();
      
      // Should fall back to defaults for invalid values
      expect(logger.getRetentionDays()).toBe(7); // Default
      expect(logger.getRotationHour()).toBe(0); // Default (midnight)
      
      delete process.env.STATUS_CHANGE_LOG_RETENTION_DAYS;
      delete process.env.STATUS_CHANGE_LOG_ROTATION_HOUR;
    });
  });
});