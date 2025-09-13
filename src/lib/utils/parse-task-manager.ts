/**
 * @fileoverview Parse Task Manager - Handles auto-fetch operations that survive component lifecycle
 * Solves React navigation race condition issues by decoupling fetch from component mounting
 */

type TaskState = "pending" | "success" | "error";

interface ParseTask<T = unknown> {
  promise: Promise<T>;
  startedAt: number;
  state: TaskState;
  result?: T;
  error?: string;
}

// Module-scope task registry - survives component mounts/unmounts
const tasks = new Map<string, ParseTask>();
const listeners = new Map<string, Set<() => void>>();

// TTL to prevent memory leaks
const TTL_MS = 5 * 60_000; // 5 minutes

/**
 * Subscribe to task completion notifications
 */
export function subscribe(key: string, callback: () => void): () => void {
  let listenerSet = listeners.get(key);
  if (!listenerSet) {
    listenerSet = new Set();
    listeners.set(key, listenerSet);
  }

  listenerSet.add(callback);

  return () => {
    listenerSet!.delete(callback);
    if (listenerSet!.size === 0) {
      listeners.delete(key);
    }
  };
}

/**
 * Notify all listeners for a given key
 */
function notify(key: string) {
  const listenerSet = listeners.get(key);
  if (listenerSet) {
    listenerSet.forEach((callback) => callback());
  }
}

/**
 * Get task result if available
 */
export function getTaskResult<T = unknown>(key: string): T | undefined {
  const task = tasks.get(key) as ParseTask<T> | undefined;
  return task?.state === "success" ? task.result : undefined;
}

/**
 * Check if task is currently running
 */
export function isTaskRunning(key: string): boolean {
  const task = tasks.get(key);
  return task?.state === "pending";
}

/**
 * Get task error if failed
 */
export function getTaskError(key: string): string | undefined {
  const task = tasks.get(key);
  return task?.state === "error" ? task.error : undefined;
}

/**
 * Ensure parse task runs (deduplicates automatically)
 */
export function ensureParseTask<T = unknown>(
  key: string,
  fetcher: (signal?: AbortSignal) => Promise<T>
): ParseTask<T> {
  // Return existing task if already running
  const existingTask = tasks.get(key) as ParseTask<T> | undefined;
  if (existingTask && existingTask.state === "pending") {
    return existingTask;
  }

  // Create abort controller for cancellation
  const controller = new AbortController();

  // Create the promise
  const promise = fetcher(controller.signal)
    .then((result) => {
      const task = tasks.get(key) as ParseTask<T> | undefined;
      if (task) {
        task.state = "success";
        task.result = result;
      }
      notify(key);

      // Auto-cleanup after TTL
      setTimeout(() => {
        tasks.delete(key);
      }, TTL_MS);

      return result;
    })
    .catch((error) => {
      const task = tasks.get(key) as ParseTask<T> | undefined;
      if (task) {
        task.state = "error";
        task.error = error.message;
      }
      notify(key);
      throw error;
    });

  // Store the task
  const task: ParseTask<T> = {
    promise,
    startedAt: Date.now(),
    state: "pending",
  };

  tasks.set(key, task);
  return task;
}

/**
 * Cancel a specific task
 */
export function cancelTask(key: string) {
  const task = tasks.get(key);
  if (task && task.state === "pending") {
    // Note: We would need to store the AbortController to actually cancel
    // For now, just mark as cancelled
    tasks.delete(key);
  }
}

/**
 * Clear all completed tasks (for memory management)
 */
export function clearCompletedTasks() {
  for (const [key, task] of tasks.entries()) {
    if (task.state !== "pending") {
      tasks.delete(key);
    }
  }
}
