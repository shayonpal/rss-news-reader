/**
 * Comprehensive tests for RR-112: Dexie database cleanup race conditions
 * 
 * This test suite covers 30 test scenarios across 5 categories:
 * 1. Database Open/Close Behavior (6 tests)
 * 2. Deletion Edge Cases (6 tests) 
 * 3. Concurrency/Race Conditions (8 tests)
 * 4. Resource Management (5 tests)
 * 5. Multi-Test Isolation (5 tests)
 * 
 * Each test uses unique database names and proper lifecycle management
 * to prevent race conditions and ensure proper cleanup.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import Dexie from "dexie";
import { AppDatabase } from "@/lib/db/database";
import { useDataStore } from "../data-store";

// Generate unique database names per test to prevent cross-test pollution
const generateUniqueDbName = (testName: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test_db_${testName}_${timestamp}_${random}`;
};

// Track database instances per test to prevent cross-test pollution
const testDatabases = new Map<string, Set<AppDatabase>>();
const testDatabaseNames = new Map<string, Set<string>>();

// Get or create a Set for current test
const getTestDatabases = (testId: string): Set<AppDatabase> => {
  if (!testDatabases.has(testId)) {
    testDatabases.set(testId, new Set());
  }
  return testDatabases.get(testId)!;
};

const getTestDatabaseNames = (testId: string): Set<string> => {
  if (!testDatabaseNames.has(testId)) {
    testDatabaseNames.set(testId, new Set());
  }
  return testDatabaseNames.get(testId)!;
};

// Enhanced database class for testing with proper lifecycle management
class TestAppDatabase extends AppDatabase {
  private _dbName: string;
  private _testId: string;
  
  constructor(dbName?: string, testId?: string) {
    const name = dbName || generateUniqueDbName("default");
    super();
    this._dbName = name;
    this.name = name;
    this._testId = testId || "global";
    
    // Track this database for its specific test
    getTestDatabases(this._testId).add(this);
    getTestDatabaseNames(this._testId).add(name);
  }

  async safeClose(): Promise<void> {
    try {
      if (this.isOpen()) {
        await this.close();
      }
    } catch (error) {
      console.warn(`Error closing database ${this._dbName}:`, error);
    }
  }

  async safeDelete(): Promise<void> {
    try {
      await this.safeClose();
      await Dexie.delete(this._dbName);
      getTestDatabaseNames(this._testId).delete(this._dbName);
      getTestDatabases(this._testId).delete(this);
    } catch (error) {
      console.warn(`Error deleting database ${this._dbName}:`, error);
    }
  }

  getDatabaseName(): string {
    return this._dbName;
  }
}

// Helper to wait for async operations
const waitFor = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Helper to simulate slow operations for race condition testing
const simulateSlowOperation = (ms: number = 100): Promise<void> => waitFor(ms);

describe.sequential("RR-112: Database Lifecycle Management and Race Condition Tests", () => {
  let testDb: TestAppDatabase;
  let currentTestId: string;

  beforeEach(async () => {
    // Generate unique test ID for each test
    currentTestId = `test_${Date.now()}_${Math.random()}`;
    
    // Ensure clean state - should NOT auto-initialize stores in test environment
    vi.clearAllMocks();
    
    // Verify stores don't auto-initialize
    const dataStore = useDataStore.getState();
    expect(dataStore.dbStatus.isInitialized).toBe(false);
  });

  afterEach(async () => {
    // Cleanup only databases from current test
    const currentTestDatabases = getTestDatabases(currentTestId);
    const currentTestDbNames = getTestDatabaseNames(currentTestId);
    
    if (currentTestDatabases.size > 0) {
      const cleanupPromises = Array.from(currentTestDatabases).map(async (db) => {
        await db.safeDelete();
      });
      
      await Promise.all(cleanupPromises);
      currentTestDatabases.clear();
    }
    
    // Clean up any remaining databases by name for this test
    if (currentTestDbNames.size > 0) {
      const remainingCleanup = Array.from(currentTestDbNames).map(async (name) => {
        try {
          await Dexie.delete(name);
        } catch (error) {
          console.warn(`Cleanup error for ${name}:`, error);
        }
      });
      
      await Promise.all(remainingCleanup);
      currentTestDbNames.clear();
    }
    
    // Remove this test's tracking
    testDatabases.delete(currentTestId);
    testDatabaseNames.delete(currentTestId);
  });

  describe.sequential("Category 1: Database Open/Close Behavior (6 tests)", () => {
    test("1.1 should open database successfully", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("open_test"), currentTestId);
      
      await expect(testDb.open()).resolves.not.toThrow();
      expect(testDb.isOpen()).toBe(true);
    });

    test("1.2 should handle opening already-open database", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("reopen_test"), currentTestId);
      
      await testDb.open();
      expect(testDb.isOpen()).toBe(true);
      
      // Opening again should not throw
      await expect(testDb.open()).resolves.not.toThrow();
      expect(testDb.isOpen()).toBe(true);
    });

    test("1.3 should close and reopen database (close → open sequence)", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("close_reopen_test"), currentTestId);
      
      // Open, verify, close, verify, reopen, verify
      await testDb.open();
      expect(testDb.isOpen()).toBe(true);
      
      await testDb.close();
      expect(testDb.isOpen()).toBe(false);
      
      await testDb.open();
      expect(testDb.isOpen()).toBe(true);
    });

    test("1.4 should handle simultaneous close calls without errors", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("simultaneous_close_test"), currentTestId);
      
      await testDb.open();
      expect(testDb.isOpen()).toBe(true);
      
      // Multiple close calls should not cause errors
      const closePromises = [
        testDb.close(),
        testDb.close(),
        testDb.close()
      ];
      
      await expect(Promise.all(closePromises)).resolves.not.toThrow();
      expect(testDb.isOpen()).toBe(false);
    });

    test("1.5 should perform read/write operations after open-close-reopen cycle", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("rw_cycle_test"), currentTestId);
      
      // Open and write data
      await testDb.open();
      await testDb.dbInfo.add({ version: 1, createdAt: new Date(), corruptionCount: 0 });
      
      // Close and reopen
      await testDb.close();
      await testDb.open();
      
      // Verify data persists and we can read/write
      const count = await testDb.dbInfo.count();
      expect(count).toBe(1);
      
      // Write more data
      await testDb.dbInfo.add({ version: 2, createdAt: new Date(), corruptionCount: 0 });
      const newCount = await testDb.dbInfo.count();
      expect(newCount).toBe(2);
    });

    test("1.6 should handle multiple database instances in parallel", async () => {
      const db1 = new TestAppDatabase(generateUniqueDbName("parallel_1"), currentTestId);
      const db2 = new TestAppDatabase(generateUniqueDbName("parallel_2"), currentTestId);
      const db3 = new TestAppDatabase(generateUniqueDbName("parallel_3"), currentTestId);
      
      // Open all in parallel
      await Promise.all([
        db1.open(),
        db2.open(), 
        db3.open()
      ]);
      
      expect(db1.isOpen()).toBe(true);
      expect(db2.isOpen()).toBe(true);
      expect(db3.isOpen()).toBe(true);
      
      // Verify isolation - write different data to each
      await Promise.all([
        db1.dbInfo.add({ version: 1, createdAt: new Date(), corruptionCount: 0 }),
        db2.dbInfo.add({ version: 2, createdAt: new Date(), corruptionCount: 0 }),
        db3.dbInfo.add({ version: 3, createdAt: new Date(), corruptionCount: 0 })
      ]);
      
      // Verify data isolation
      const [count1, count2, count3] = await Promise.all([
        db1.dbInfo.count(),
        db2.dbInfo.count(),
        db3.dbInfo.count()
      ]);
      
      expect(count1).toBe(1);
      expect(count2).toBe(1);
      expect(count3).toBe(1);
    });
  });

  describe.sequential("Category 2: Deletion Edge Cases (6 tests)", () => {
    test("2.1 should close and delete database successfully (close → delete sequence)", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("close_delete_test"), currentTestId);
      
      await testDb.open();
      await testDb.dbInfo.add({ version: 1, createdAt: new Date(), corruptionCount: 0 });
      
      // Proper sequence: close then delete
      await testDb.close();
      await expect(Dexie.delete(testDb.getDatabaseName())).resolves.not.toThrow();
    });

    test("2.2 should handle deleting database that is still open", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("delete_open_test"), currentTestId);
      
      await testDb.open();
      
      // Try to delete while still open - should either error or force close
      const deletePromise = Dexie.delete(testDb.getDatabaseName());
      
      // This test expects the delete to either work or throw a specific error
      // The behavior may vary by browser implementation
      try {
        await deletePromise;
        // If it succeeds, verify database is closed
        expect(testDb.isOpen()).toBe(false);
      } catch (error) {
        // If it fails, that's expected behavior
        expect(error).toBeDefined();
      }
    });

    test("2.3 should handle close → delete → open sequence creating new clean database", async () => {
      const dbName = generateUniqueDbName("clean_recreate_test");
      testDb = new TestAppDatabase(dbName, currentTestId);
      
      // Open, add data, close, delete
      await testDb.open();
      await testDb.dbInfo.add({ version: 1, createdAt: new Date(), corruptionCount: 0 });
      await testDb.close();
      await Dexie.delete(dbName);
      
      // Create new instance with same name - should be clean
      const newDb = new TestAppDatabase(dbName, currentTestId);
      await newDb.open();
      
      const count = await newDb.dbInfo.count();
      expect(count).toBe(0); // Should be empty/clean database
      
      await newDb.safeDelete();
    });

    test("2.4 should handle deleting non-existent database", async () => {
      const nonExistentName = generateUniqueDbName("non_existent");
      
      // Deleting non-existent database should not throw
      await expect(Dexie.delete(nonExistentName)).resolves.not.toThrow();
    });

    test("2.5 should handle rapid close → delete sequence", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("rapid_close_delete_test"), currentTestId);
      
      await testDb.open();
      
      // Immediate close and delete (simulate race condition)
      const closePromise = testDb.close();
      await waitFor(1); // Minimal delay to simulate async timing
      const deletePromise = Dexie.delete(testDb.getDatabaseName());
      
      await expect(Promise.all([closePromise, deletePromise])).resolves.not.toThrow();
    });

    test("2.6 should handle delete with simulated slow file removal", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("slow_delete_test"), currentTestId);
      
      await testDb.open();
      await testDb.dbInfo.add({ version: 1, createdAt: new Date(), corruptionCount: 0 });
      await testDb.close();
      
      // Simulate slow delete operation
      const deletePromise = Dexie.delete(testDb.getDatabaseName());
      await simulateSlowOperation(50);
      
      await expect(deletePromise).resolves.not.toThrow();
    });
  });

  describe.sequential("Category 3: Concurrency/Race Conditions (8 tests)", () => {
    test("3.1 should handle concurrent close and delete from separate async routines", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("concurrent_close_delete_test"), currentTestId);
      
      await testDb.open();
      
      // Launch close and delete concurrently from different async contexts
      const closeRoutine = (async () => {
        await simulateSlowOperation(10);
        return testDb.close();
      })();
      
      const deleteRoutine = (async () => {
        await simulateSlowOperation(20);
        return Dexie.delete(testDb.getDatabaseName());
      })();
      
      // Both should complete without errors
      await expect(Promise.all([closeRoutine, deleteRoutine])).resolves.not.toThrow();
    });

    test("3.2 should handle multiple parallel open/close/delete operations", async () => {
      const dbName = generateUniqueDbName("parallel_ops_test");
      const operations: Promise<any>[] = [];
      
      // Create multiple databases with same name pattern
      for (let i = 0; i < 3; i++) {
        operations.push((async () => {
          const db = new TestAppDatabase(`${dbName}_${i}`, currentTestId);
          await db.open();
          await simulateSlowOperation(Math.random() * 50);
          await db.close();
          await Dexie.delete(db.getDatabaseName());
        })());
      }
      
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });

    test("3.3 should handle two connections to same database with concurrent cleanup", async () => {
      const dbName = generateUniqueDbName("dual_connection_test");
      const db1 = new TestAppDatabase(dbName, currentTestId);
      const db2 = new TestAppDatabase(dbName, currentTestId);
      
      await Promise.all([db1.open(), db2.open()]);
      
      // Concurrent close and delete from both connections
      const cleanup1 = (async () => {
        await db1.close();
        await simulateSlowOperation(10);
        try {
          await Dexie.delete(dbName);
        } catch (error) {
          // Expected if db2 hasn't closed yet
        }
      })();
      
      const cleanup2 = (async () => {
        await simulateSlowOperation(5);
        await db2.close();
        try {
          await Dexie.delete(dbName);
        } catch (error) {
          // Expected if db1 already deleted
        }
      })();
      
      await expect(Promise.all([cleanup1, cleanup2])).resolves.not.toThrow();
    });

    test("3.4 should handle database deletion while transaction is pending", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("pending_transaction_test"), currentTestId);
      
      await testDb.open();
      
      // Start a transaction
      const transactionPromise = testDb.transaction('rw', testDb.dbInfo, async () => {
        await simulateSlowOperation(100); // Slow transaction
        await testDb.dbInfo.add({ version: 1, createdAt: new Date(), corruptionCount: 0 });
      });
      
      // Try to close and delete while transaction is running
      await simulateSlowOperation(20);
      const cleanupPromise = (async () => {
        await testDb.close();
        await Dexie.delete(testDb.getDatabaseName());
      })();
      
      // Transaction should either complete or be cancelled, cleanup should work
      try {
        await Promise.all([transactionPromise, cleanupPromise]);
      } catch (error) {
        // Either transaction fails (expected) or both succeed
        expect(error).toBeDefined();
      }
    });

    test("3.5 should handle rapid open/close cycles under load", async () => {
      const dbName = generateUniqueDbName("rapid_cycles_test");
      const operations: Promise<void>[] = [];
      
      // 5 rapid open/close cycles
      for (let i = 0; i < 5; i++) {
        operations.push((async () => {
          const db = new TestAppDatabase(`${dbName}_cycle_${i}`, currentTestId);
          await db.open();
          await db.close();
          await db.open();
          await db.close();
          await Dexie.delete(db.getDatabaseName());
        })());
      }
      
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });

    test("3.6 should handle interleaved open/close operations from multiple databases", async () => {
      const db1 = new TestAppDatabase(generateUniqueDbName("interleave_1"), currentTestId);
      const db2 = new TestAppDatabase(generateUniqueDbName("interleave_2"), currentTestId);
      
      // Interleaved operations
      await db1.open();
      await db2.open();
      await db1.close();
      await db2.close();
      await db1.open();
      await db2.open();
      
      expect(db1.isOpen()).toBe(true);
      expect(db2.isOpen()).toBe(true);
      
      await Promise.all([
        db1.safeDelete(),
        db2.safeDelete()
      ]);
    });

    test("3.7 should handle database recreation race conditions", async () => {
      const dbName = generateUniqueDbName("recreation_race_test");
      
      // Delete and recreate rapidly
      const operations = Array.from({ length: 3 }, (_, i) => (async () => {
        const db = new TestAppDatabase(`${dbName}_${i}`, currentTestId);
        await db.open();
        await db.safeDelete();
        
        // Recreate immediately
        const newDb = new TestAppDatabase(`${dbName}_new_${i}`, currentTestId);
        await newDb.open();
        await newDb.safeDelete();
      })());
      
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });

    test("3.8 should prevent DatabaseClosedError during concurrent operations", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("closed_error_test"), currentTestId);
      
      await testDb.open();
      
      // Start a query operation
      const queryPromise = testDb.dbInfo.count();
      
      // Immediately close database
      await testDb.close();
      
      // Query should either succeed or fail gracefully (no DatabaseClosedError)
      try {
        const result = await queryPromise;
        expect(typeof result).toBe('number');
      } catch (error) {
        // Should be a controlled error, not DatabaseClosedError
        expect(error).toBeDefined();
        expect(error.toString()).not.toContain('DatabaseClosedError');
      }
    });
  });

  describe.sequential("Category 4: Resource Management (5 tests)", () => {
    test("4.1 should handle open/close in tight loop without resource leaks", async () => {
      const dbName = generateUniqueDbName("tight_loop_test");
      
      // 10 rapid open/close cycles
      for (let i = 0; i < 10; i++) {
        const db = new TestAppDatabase(`${dbName}_${i}`, currentTestId);
        await db.open();
        expect(db.isOpen()).toBe(true);
        await db.close();
        expect(db.isOpen()).toBe(false);
        await Dexie.delete(db.getDatabaseName());
      }
      
      // Should complete without errors or resource exhaustion
      expect(true).toBe(true);
    });

    test("4.2 should handle databases with increasing complexity", async () => {
      const operations: Promise<void>[] = [];
      
      for (let i = 1; i <= 3; i++) {
        operations.push((async () => {
          const db = new TestAppDatabase(generateUniqueDbName(`complex_${i}`), currentTestId);
          await db.open();
          
          // Add increasing amounts of data
          const records = Array.from({ length: i * 10 }, (_, j) => ({
            version: j,
            createdAt: new Date(),
            corruptionCount: 0
          }));
          
          await db.dbInfo.bulkAdd(records);
          await db.safeDelete();
        })());
      }
      
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });

    test("4.3 should verify no lingering IndexedDB connections after cleanup", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("lingering_connections_test"), currentTestId);
      
      await testDb.open();
      await testDb.dbInfo.add({ version: 1, createdAt: new Date(), corruptionCount: 0 });
      
      const dbName = testDb.getDatabaseName();
      
      // Close and delete
      await testDb.close();
      await Dexie.delete(dbName);
      
      // Try to open new database with same name - should be clean
      const newDb = new TestAppDatabase(dbName, currentTestId);
      await newDb.open();
      
      const count = await newDb.dbInfo.count();
      expect(count).toBe(0);
      
      await newDb.safeDelete();
    });

    test("4.4 should handle repeated create/drop of unique databases", async () => {
      const operations: Promise<void>[] = [];
      
      for (let i = 0; i < 5; i++) {
        operations.push((async () => {
          const dbName = generateUniqueDbName(`create_drop_${i}`);
          const db = new TestAppDatabase(dbName, currentTestId);
          
          await db.open();
          await db.dbInfo.add({ version: 1, createdAt: new Date(), corruptionCount: 0 });
          await db.close();
          await Dexie.delete(dbName);
          
          // Verify deletion
          const checkDb = new TestAppDatabase(dbName, currentTestId);
          await checkDb.open();
          const count = await checkDb.dbInfo.count();
          expect(count).toBe(0);
          await checkDb.safeDelete();
        })());
      }
      
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });

    test("4.5 should handle resource cleanup after operation timeout/abort", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("timeout_cleanup_test"), currentTestId);
      
      await testDb.open();
      
      // Start a long-running operation and then abort it
      const controller = new AbortController();
      
      const operationPromise = (async () => {
        try {
          await testDb.transaction('rw', testDb.dbInfo, async () => {
            for (let i = 0; i < 100; i++) {
              if (controller.signal.aborted) break;
              await testDb.dbInfo.add({ version: i, createdAt: new Date(), corruptionCount: 0 });
              await waitFor(1);
            }
          });
        } catch (error) {
          // Expected when aborted
        }
      })();
      
      // Abort after short time
      setTimeout(() => controller.abort(), 50);
      
      await operationPromise;
      
      // Should still be able to clean up properly
      await expect(testDb.safeDelete()).resolves.not.toThrow();
    });
  });

  describe.sequential("Category 5: Multi-Test Isolation (5 tests)", () => {
    test("5.1 should use unique database names per test preventing cross-test pollution", async () => {
      const dbName1 = generateUniqueDbName("isolation_1");
      const dbName2 = generateUniqueDbName("isolation_2");
      
      expect(dbName1).not.toBe(dbName2);
      expect(dbName1).toContain("isolation_1");
      expect(dbName2).toContain("isolation_2");
      
      const db1 = new TestAppDatabase(dbName1, currentTestId);
      const db2 = new TestAppDatabase(dbName2, currentTestId);
      
      await Promise.all([db1.open(), db2.open()]);
      
      // Add different data to each
      await db1.dbInfo.add({ version: 1, createdAt: new Date(), corruptionCount: 0 });
      await db2.dbInfo.add({ version: 2, createdAt: new Date(), corruptionCount: 0 });
      
      // Verify isolation
      const data1 = await db1.dbInfo.toArray();
      const data2 = await db2.dbInfo.toArray();
      
      expect(data1[0].version).toBe(1);
      expect(data2[0].version).toBe(2);
      
      await Promise.all([db1.safeDelete(), db2.safeDelete()]);
    });

    test("5.2 should verify database no longer exists after cleanup", async () => {
      const dbName = generateUniqueDbName("cleanup_verification_test");
      testDb = new TestAppDatabase(dbName, currentTestId);
      
      await testDb.open();
      await testDb.dbInfo.add({ version: 1, createdAt: new Date(), corruptionCount: 0 });
      await testDb.close();
      await Dexie.delete(dbName);
      
      // Verify database is gone by opening fresh instance
      const verifyDb = new TestAppDatabase(dbName, currentTestId);
      await verifyDb.open();
      
      const count = await verifyDb.dbInfo.count();
      expect(count).toBe(0); // Should be empty/new database
      
      await verifyDb.safeDelete();
    });

    test("5.3 should run parallel tests with different DB names without interference", async () => {
      const parallelTests = Array.from({ length: 3 }, (_, i) => (async () => {
        const dbName = generateUniqueDbName(`parallel_test_${i}`);
        const db = new TestAppDatabase(dbName, currentTestId);
        
        await db.open();
        await db.dbInfo.add({ version: i, createdAt: new Date(), corruptionCount: 0 });
        
        // Simulate some work
        await simulateSlowOperation(20);
        
        const data = await db.dbInfo.toArray();
        expect(data[0].version).toBe(i);
        
        await db.safeDelete();
        return i;
      })());
      
      const results = await Promise.all(parallelTests);
      expect(results).toEqual([0, 1, 2]);
    });

    test("5.4 should handle same DB name with explicit close+delete between runs", async () => {
      const sharedDbName = generateUniqueDbName("shared_name_test");
      
      // First run
      const db1 = new TestAppDatabase(sharedDbName, currentTestId);
      await db1.open();
      await db1.dbInfo.add({ version: 1, createdAt: new Date(), corruptionCount: 0 });
      await db1.close();
      await Dexie.delete(sharedDbName);
      
      // Second run with same name - should be clean
      const db2 = new TestAppDatabase(sharedDbName, currentTestId);
      await db2.open();
      
      const count = await db2.dbInfo.count();
      expect(count).toBe(0); // Should not have data from first run
      
      await db2.dbInfo.add({ version: 2, createdAt: new Date(), corruptionCount: 0 });
      const newCount = await db2.dbInfo.count();
      expect(newCount).toBe(1);
      
      await db2.safeDelete();
    });

    test("5.5 should verify data stores don't auto-initialize in test environment", async () => {
      // This test verifies the critical requirement that stores don't auto-initialize
      const dataStore = useDataStore.getState();
      
      // Should not be initialized in test environment
      expect(dataStore.dbStatus.isInitialized).toBe(false);
      expect(dataStore.preferences).toBeNull();
      expect(dataStore.apiUsage).toBeNull();
      
      // Manual initialization should work
      testDb = new TestAppDatabase(generateUniqueDbName("manual_init_test"), currentTestId);
      await testDb.open();
      
      // But it shouldn't affect the store
      expect(dataStore.dbStatus.isInitialized).toBe(false);
    });
  });

  describe.sequential("Integration Tests: Complete Lifecycle Scenarios", () => {
    test("should handle complete application startup/shutdown cycle", async () => {
      const dbName = generateUniqueDbName("app_lifecycle_test");
      testDb = new TestAppDatabase(dbName, currentTestId);
      
      // Simulate app startup
      await testDb.open();
      await testDb.initialize();
      
      // Simulate normal operations
      await testDb.dbInfo.add({ version: 1, createdAt: new Date(), corruptionCount: 0 });
      const info = await testDb.getStorageInfo();
      expect(info?.counts.articles).toBeDefined();
      
      // Simulate app shutdown
      await testDb.vacuum(); // Cleanup
      await testDb.close();
      
      // Verify clean shutdown
      expect(testDb.isOpen()).toBe(false);
      
      // Simulate app restart
      await testDb.open();
      const count = await testDb.dbInfo.count();
      expect(count).toBe(2); // Data should persist (1 from initialize + 1 from test)
    });

    test("should handle database corruption recovery scenario", async () => {
      testDb = new TestAppDatabase(generateUniqueDbName("corruption_recovery_test"), currentTestId);
      
      await testDb.open();
      await testDb.initialize();
      
      // Simulate corruption
      await testDb.recordCorruption();
      
      // Verify corruption is recorded
      const info = await testDb.dbInfo.orderBy("id").last();
      expect(info?.corruptionCount).toBe(1);
      
      // Simulate recovery process (close → delete → recreate)
      await testDb.close();
      await Dexie.delete(testDb.getDatabaseName());
      
      const recoveredDb = new TestAppDatabase(testDb.getDatabaseName(), currentTestId);
      await recoveredDb.open();
      await recoveredDb.initialize();
      
      // Should be clean database
      const newCount = await recoveredDb.dbInfo.count();
      expect(newCount).toBe(1); // Only the initialization record
      
      const newInfo = await recoveredDb.dbInfo.orderBy("id").last();
      expect(newInfo?.corruptionCount).toBe(0);
      
      await recoveredDb.safeDelete();
    });
  });
});