/**
 * Performance and Resource Usage Validation Tests for RR-123
 * 
 * These tests validate that the memory fix actually prevents resource exhaustion
 * and maintains system performance within acceptable limits.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

describe('RR-123: Performance and Resource Usage Validation', () => {
  const projectRoot = path.join(__dirname, '../../../..');
  let testProcesses: ChildProcess[] = [];
  let performanceData: Array<{
    timestamp: number;
    memory: number;
    cpu: number;
    processes: number;
  }> = [];

  beforeEach(async () => {
    // Clean up any existing processes
    try {
      await execAsync('pkill -f vitest || true');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // Ignore cleanup errors
    }
    testProcesses = [];
    performanceData = [];
  });

  afterEach(async () => {
    // Clean up test processes
    for (const proc of testProcesses) {
      try {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      } catch (error) {
        // Ignore if already dead
      }
    }
    
    try {
      await execAsync('pkill -f "vitest|test.*sleep" || true');
      await execAsync('rm -f /tmp/perf-*.log /tmp/test-*.pid');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Memory Usage Validation', () => {
    it('MUST NOT exceed 1GB total memory usage during test execution', async () => {
      const startMemory = await getDetailedMemoryInfo();
      const memoryLog: Array<{ timestamp: number; memory: number }> = [];
      
      // Start memory monitoring
      const monitorInterval = setInterval(async () => {
        try {
          const memInfo = await getDetailedMemoryInfo();
          memoryLog.push({
            timestamp: Date.now(),
            memory: memInfo.used
          });
        } catch (error) {
          // Ignore monitoring errors
        }
      }, 500); // Check every 500ms
      
      try {
        // Run tests with memory monitoring
        await execAsync(
          'timeout 15s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts || true',
          {
            cwd: projectRoot,
            timeout: 20000
          }
        );
        
      } finally {
        clearInterval(monitorInterval);
      }
      
      const endMemory = await getDetailedMemoryInfo();
      
      // Calculate memory metrics
      const memoryIncrease = endMemory.used - startMemory.used;
      const maxMemoryUsed = Math.max(...memoryLog.map(log => log.memory));
      const peakIncrease = maxMemoryUsed - startMemory.used;
      
      // Critical: Should not use more than 1GB
      expect(memoryIncrease).toBeLessThan(1024 * 1024 * 1024); // 1GB
      expect(peakIncrease).toBeLessThan(1024 * 1024 * 1024); // 1GB peak
      
      // Log results for analysis
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      console.log(`Peak increase: ${Math.round(peakIncrease / 1024 / 1024)}MB`);
      console.log(`Memory samples: ${memoryLog.length}`);
    });

    it('MUST have stable memory usage (no memory leaks)', async () => {
      const memoryReadings = [];
      
      // Take multiple memory readings during test execution
      for (let i = 0; i < 3; i++) {
        const beforeTest = await getDetailedMemoryInfo();
        
        try {
          await execAsync(
            'timeout 10s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts || true',
            {
              cwd: projectRoot,
              timeout: 15000
            }
          );
        } catch (error) {
          // Ignore test execution errors
        }
        
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterTest = await getDetailedMemoryInfo();
        memoryReadings.push(afterTest.used - beforeTest.used);
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Memory usage should be stable across iterations
      const avgIncrease = memoryReadings.reduce((a, b) => a + b, 0) / memoryReadings.length;
      const maxIncrease = Math.max(...memoryReadings);
      
      // Should not have significant memory leaks (< 100MB per iteration)
      expect(avgIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
      expect(maxIncrease).toBeLessThan(200 * 1024 * 1024); // 200MB max
      
      console.log(`Average memory increase per test run: ${Math.round(avgIncrease / 1024 / 1024)}MB`);
    });

    it('MUST release memory after test completion', async () => {
      const baselineMemory = await getDetailedMemoryInfo();
      
      // Run a series of tests
      try {
        await execAsync(
          'timeout 20s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/ || true',
          {
            cwd: projectRoot,
            timeout: 25000
          }
        );
      } catch (error) {
        // Ignore test execution errors
      }
      
      // Wait for full cleanup
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const finalMemory = await getDetailedMemoryInfo();
      const retainedMemory = finalMemory.used - baselineMemory.used;
      
      // Should release most memory (allow 200MB retention for normal operations)
      expect(retainedMemory).toBeLessThan(200 * 1024 * 1024); // 200MB
      
      console.log(`Retained memory after tests: ${Math.round(retainedMemory / 1024 / 1024)}MB`);
    });
  });

  describe('Process Count Validation', () => {
    it('MUST NOT spawn more than 4 vitest processes', async () => {
      const processCountLog: number[] = [];
      
      // Monitor process count during test execution
      const processMonitor = setInterval(async () => {
        try {
          const count = await getVitestProcessCount();
          processCountLog.push(count);
        } catch (error) {
          // Ignore monitoring errors
        }
      }, 1000);
      
      try {
        // Run tests with process monitoring
        await execAsync(
          'timeout 15s npm run test:unit -- --run --no-coverage src/__tests__/unit/ || true',
          {
            cwd: projectRoot,
            timeout: 20000
          }
        );
        
      } finally {
        clearInterval(processMonitor);
      }
      
      const maxProcesses = Math.max(...processCountLog);
      const avgProcesses = processCountLog.reduce((a, b) => a + b, 0) / processCountLog.length;
      
      // Critical: Should never exceed 4 vitest processes
      expect(maxProcesses).toBeLessThanOrEqual(4);
      expect(avgProcesses).toBeLessThanOrEqual(3);
      
      console.log(`Max vitest processes: ${maxProcesses}`);
      console.log(`Average vitest processes: ${avgProcesses.toFixed(1)}`);
    });

    it('MUST clean up processes after test completion', async () => {
      const baselineProcesses = await getVitestProcessCount();
      
      // Run tests
      try {
        await execAsync(
          'timeout 15s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts || true',
          {
            cwd: projectRoot,
            timeout: 20000
          }
        );
      } catch (error) {
        // Ignore test execution errors
      }
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const finalProcesses = await getVitestProcessCount();
      
      // Should return to baseline (allow 1 process difference)
      expect(finalProcesses - baselineProcesses).toBeLessThanOrEqual(1);
      
      console.log(`Process cleanup: ${baselineProcesses} -> ${finalProcesses}`);
    });

    it('MUST prevent process accumulation during multiple test runs', async () => {
      const processReadings = [];
      
      // Run multiple test iterations
      for (let i = 0; i < 3; i++) {
        const beforeTest = await getVitestProcessCount();
        
        try {
          await execAsync(
            'timeout 8s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts || true',
            {
              cwd: projectRoot,
              timeout: 12000
            }
          );
        } catch (error) {
          // Ignore test execution errors
        }
        
        // Wait for cleanup between runs
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterTest = await getVitestProcessCount();
        processReadings.push(afterTest - beforeTest);
        
        console.log(`Iteration ${i + 1}: ${beforeTest} -> ${afterTest} processes`);
      }
      
      // Should not accumulate processes
      const avgProcessIncrease = processReadings.reduce((a, b) => a + b, 0) / processReadings.length;
      expect(avgProcessIncrease).toBeLessThanOrEqual(1);
    });
  });

  describe('System Performance Validation', () => {
    it('MUST complete test execution in reasonable time', async () => {
      const testFiles = [
        'src/__tests__/unit/health-endpoints/app.test.ts',
        'src/__tests__/unit/health-endpoints/db.test.ts'
      ];
      
      for (const testFile of testFiles) {
        const startTime = Date.now();
        
        try {
          await execAsync(
            `timeout 20s npm run test:unit -- --run --no-coverage ${testFile} || true`,
            {
              cwd: projectRoot,
              timeout: 25000
            }
          );
        } catch (error) {
          // Ignore test execution errors
        }
        
        const duration = Date.now() - startTime;
        
        // Should complete within reasonable time (< 20 seconds per file)
        expect(duration).toBeLessThan(20000);
        
        console.log(`${path.basename(testFile)}: ${duration}ms`);
      }
    });

    it('MUST maintain low CPU usage during tests', async () => {
      const cpuReadings: number[] = [];
      
      // Monitor CPU usage
      const cpuMonitor = setInterval(async () => {
        try {
          const cpuUsage = await getSystemCpuUsage();
          cpuReadings.push(cpuUsage);
        } catch (error) {
          // Ignore monitoring errors
        }
      }, 2000);
      
      try {
        await execAsync(
          'timeout 15s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/ || true',
          {
            cwd: projectRoot,
            timeout: 20000
          }
        );
        
      } finally {
        clearInterval(cpuMonitor);
      }
      
      if (cpuReadings.length > 0) {
        const avgCpu = cpuReadings.reduce((a, b) => a + b, 0) / cpuReadings.length;
        const maxCpu = Math.max(...cpuReadings);
        
        // CPU usage should be reasonable (< 80% average, < 95% peak)
        expect(avgCpu).toBeLessThan(80);
        expect(maxCpu).toBeLessThan(95);
        
        console.log(`Average CPU: ${avgCpu.toFixed(1)}%, Max CPU: ${maxCpu.toFixed(1)}%`);
      }
    });

    it('MUST not impact PM2 service performance', async () => {
      // Check PM2 service status before tests
      const beforeServices = await execAsync('pm2 status | grep -E "rss-reader|sync"');
      const servicesBefore = beforeServices.stdout.split('\n').filter(line => line.includes('online')).length;
      
      // Monitor PM2 memory usage
      const { stdout: beforeMemory } = await execAsync('pm2 monit --json | grep -o \'"memory":[0-9]*\' || echo "0"');
      
      try {
        // Run tests
        await execAsync(
          'timeout 15s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/ || true',
          {
            cwd: projectRoot,
            timeout: 20000
          }
        );
      } catch (error) {
        // Ignore test execution errors
      }
      
      // Check PM2 services after tests
      const afterServices = await execAsync('pm2 status | grep -E "rss-reader|sync"');
      const servicesAfter = afterServices.stdout.split('\n').filter(line => line.includes('online')).length;
      
      // Services should remain stable
      expect(servicesAfter).toBeGreaterThanOrEqual(servicesBefore);
      
      console.log(`PM2 services: ${servicesBefore} -> ${servicesAfter}`);
    });
  });

  describe('Resource Limit Compliance', () => {
    it('MUST respect maxConcurrency settings', async () => {
      // This test validates that vitest actually respects the maxConcurrency setting
      const concurrentProcesses: number[] = [];
      
      const monitor = setInterval(async () => {
        try {
          const { stdout } = await execAsync('ps aux | grep -E "vitest.*worker|vitest.*test" | grep -v grep | wc -l');
          const count = parseInt(stdout.trim());
          concurrentProcesses.push(count);
        } catch (error) {
          // Ignore monitoring errors
        }
      }, 500);
      
      try {
        await execAsync(
          'timeout 15s npm run test:unit -- --run --no-coverage src/__tests__/unit/ || true',
          {
            cwd: projectRoot,
            timeout: 20000
          }
        );
      } finally {
        clearInterval(monitor);
      }
      
      const maxConcurrent = Math.max(...concurrentProcesses);
      
      // Should respect the maxConcurrency limit (allowing for main process)
      expect(maxConcurrent).toBeLessThanOrEqual(3); // 2 workers + 1 main
      
      console.log(`Max concurrent test processes: ${maxConcurrent}`);
    });

    it('MUST respect memory limits per process', async () => {
      // Monitor individual vitest process memory usage
      const processMemories: number[] = [];
      
      const memoryMonitor = setInterval(async () => {
        try {
          const { stdout } = await execAsync('ps aux | grep vitest | grep -v grep | awk \'{print $6}\' || echo "0"');
          const memories = stdout.split('\n')
            .filter(line => line.trim())
            .map(mem => parseInt(mem) * 1024); // Convert KB to bytes
          
          if (memories.length > 0) {
            processMemories.push(...memories);
          }
        } catch (error) {
          // Ignore monitoring errors
        }
      }, 1000);
      
      try {
        await execAsync(
          'timeout 15s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/ || true',
          {
            cwd: projectRoot,
            timeout: 20000
          }
        );
      } finally {
        clearInterval(memoryMonitor);
      }
      
      if (processMemories.length > 0) {
        const maxProcessMemory = Math.max(...processMemories);
        const avgProcessMemory = processMemories.reduce((a, b) => a + b, 0) / processMemories.length;
        
        // Individual processes should not exceed reasonable limits
        expect(maxProcessMemory).toBeLessThan(512 * 1024 * 1024); // 512MB per process
        expect(avgProcessMemory).toBeLessThan(256 * 1024 * 1024); // 256MB average
        
        console.log(`Max process memory: ${Math.round(maxProcessMemory / 1024 / 1024)}MB`);
        console.log(`Avg process memory: ${Math.round(avgProcessMemory / 1024 / 1024)}MB`);
      }
    });
  });

  describe('Stress Testing', () => {
    it('SHOULD handle sustained test execution without degradation', async () => {
      const performanceMetrics = [];
      
      // Run multiple test cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        const startTime = Date.now();
        const startMemory = await getDetailedMemoryInfo();
        const startProcesses = await getVitestProcessCount();
        
        try {
          await execAsync(
            'timeout 10s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts || true',
            {
              cwd: projectRoot,
              timeout: 15000
            }
          );
        } catch (error) {
          // Ignore test execution errors
        }
        
        const endTime = Date.now();
        const endMemory = await getDetailedMemoryInfo();
        const endProcesses = await getVitestProcessCount();
        
        performanceMetrics.push({
          cycle,
          duration: endTime - startTime,
          memoryIncrease: endMemory.used - startMemory.used,
          processIncrease: endProcesses - startProcesses
        });
        
        // Wait between cycles
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Performance should not degrade significantly
      const durations = performanceMetrics.map(m => m.duration);
      const memoryIncreases = performanceMetrics.map(m => m.memoryIncrease);
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const maxMemoryIncrease = Math.max(...memoryIncreases);
      
      // Should maintain consistent performance
      expect(maxDuration).toBeLessThan(avgDuration * 2); // No more than 2x average
      expect(maxMemoryIncrease).toBeLessThan(100 * 1024 * 1024); // < 100MB increase
      
      console.log('Stress test results:', performanceMetrics);
    });
  });
});

// Helper functions for monitoring

async function getDetailedMemoryInfo(): Promise<{ total: number; used: number; free: number }> {
  try {
    if (os.platform() === 'darwin') {
      const { stdout } = await execAsync('vm_stat');
      const lines = stdout.split('\n');
      const pageSize = 4096;
      
      let freePages = 0;
      let activePages = 0;
      let inactivePages = 0;
      let wiredPages = 0;
      
      for (const line of lines) {
        if (line.includes('Pages free:')) {
          freePages = parseInt(line.match(/\d+/)?.[0] || '0');
        } else if (line.includes('Pages active:')) {
          activePages = parseInt(line.match(/\d+/)?.[0] || '0');
        } else if (line.includes('Pages inactive:')) {
          inactivePages = parseInt(line.match(/\d+/)?.[0] || '0');
        } else if (line.includes('Pages wired down:')) {
          wiredPages = parseInt(line.match(/\d+/)?.[0] || '0');
        }
      }
      
      const total = (freePages + activePages + inactivePages + wiredPages) * pageSize;
      const used = (activePages + inactivePages + wiredPages) * pageSize;
      const free = freePages * pageSize;
      
      return { total, used, free };
    }
  } catch (error) {
    // Fallback
  }
  
  return { total: 0, used: 0, free: 0 };
}

async function getVitestProcessCount(): Promise<number> {
  try {
    const { stdout } = await execAsync('ps aux | grep vitest | grep -v grep | wc -l');
    return parseInt(stdout.trim()) || 0;
  } catch (error) {
    return 0;
  }
}

async function getSystemCpuUsage(): Promise<number> {
  try {
    // macOS - use top command
    const { stdout } = await execAsync('top -l 1 -n 0 | grep "CPU usage" | awk \'{print $3}\' | sed \'s/%//\'');
    return parseFloat(stdout.trim()) || 0;
  } catch (error) {
    return 0;
  }
}