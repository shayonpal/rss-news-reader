import { db, type StoredApiUsage } from "../database";
import type { ApiUsage } from "@/types";

export class ApiUsageRepository {
  async getTodaysUsage(): Promise<ApiUsage> {
    const today = new Date().toISOString().split("T")[0];

    try {
      const usage = await db.apiUsage.where("date").equals(today).first();

      if (usage) {
        return {
          inoreaderCalls: usage.inoreaderCalls,
          claudeCalls: usage.claudeCalls,
          date: usage.date,
          estimatedCost: usage.estimatedCost,
        };
      }

      // Return default if no usage recorded today
      return {
        inoreaderCalls: 0,
        claudeCalls: 0,
        date: today,
        estimatedCost: 0,
      };
    } catch (error) {
      console.error("Failed to get today's usage:", error);
      return {
        inoreaderCalls: 0,
        claudeCalls: 0,
        date: today,
        estimatedCost: 0,
      };
    }
  }

  async recordInoreaderCall(cost: number = 0): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    try {
      const existing = await db.apiUsage.where("date").equals(today).first();

      if (existing) {
        await db.apiUsage.update(existing.id!, {
          inoreaderCalls: existing.inoreaderCalls + 1,
          estimatedCost: existing.estimatedCost + cost,
        });
      } else {
        await db.apiUsage.add({
          date: today,
          inoreaderCalls: 1,
          claudeCalls: 0,
          estimatedCost: cost,
        });
      }
    } catch (error) {
      console.error("Failed to record Inoreader call:", error);
    }
  }

  async recordClaudeCall(cost: number = 0): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    try {
      const existing = await db.apiUsage.where("date").equals(today).first();

      if (existing) {
        await db.apiUsage.update(existing.id!, {
          claudeCalls: existing.claudeCalls + 1,
          estimatedCost: existing.estimatedCost + cost,
        });
      } else {
        await db.apiUsage.add({
          date: today,
          inoreaderCalls: 0,
          claudeCalls: 1,
          estimatedCost: cost,
        });
      }
    } catch (error) {
      console.error("Failed to record Claude call:", error);
    }
  }

  async getUsageHistory(days: number = 30): Promise<ApiUsage[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffString = cutoffDate.toISOString().split("T")[0];

    try {
      const history = await db.apiUsage
        .where("date")
        .aboveOrEqual(cutoffString)
        .toArray();

      return history.map((stored) => ({
        inoreaderCalls: stored.inoreaderCalls,
        claudeCalls: stored.claudeCalls,
        date: stored.date,
        estimatedCost: stored.estimatedCost,
      }));
    } catch (error) {
      console.error("Failed to get usage history:", error);
      return [];
    }
  }

  async getWeeklyUsage(): Promise<{
    thisWeek: ApiUsage;
    lastWeek: ApiUsage;
  }> {
    const today = new Date();
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of this week

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

    try {
      const thisWeekData = await db.apiUsage
        .where("date")
        .aboveOrEqual(thisWeekStart.toISOString().split("T")[0])
        .toArray();

      const lastWeekData = await db.apiUsage
        .where("date")
        .between(
          lastWeekStart.toISOString().split("T")[0],
          lastWeekEnd.toISOString().split("T")[0],
          true,
          true
        )
        .toArray();

      const aggregateUsage = (data: StoredApiUsage[]): ApiUsage => {
        const totals = data.reduce(
          (acc, usage) => ({
            inoreaderCalls: acc.inoreaderCalls + usage.inoreaderCalls,
            claudeCalls: acc.claudeCalls + usage.claudeCalls,
            estimatedCost: acc.estimatedCost + usage.estimatedCost,
          }),
          { inoreaderCalls: 0, claudeCalls: 0, estimatedCost: 0 }
        );

        return {
          ...totals,
          date: "aggregated",
        };
      };

      return {
        thisWeek: aggregateUsage(thisWeekData),
        lastWeek: aggregateUsage(lastWeekData),
      };
    } catch (error) {
      console.error("Failed to get weekly usage:", error);
      return {
        thisWeek: {
          inoreaderCalls: 0,
          claudeCalls: 0,
          date: "aggregated",
          estimatedCost: 0,
        },
        lastWeek: {
          inoreaderCalls: 0,
          claudeCalls: 0,
          date: "aggregated",
          estimatedCost: 0,
        },
      };
    }
  }

  async getMonthlyTotal(): Promise<{
    inoreaderCalls: number;
    claudeCalls: number;
    estimatedCost: number;
    dailyAverage: {
      inoreaderCalls: number;
      claudeCalls: number;
      estimatedCost: number;
    };
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const monthlyData = await db.apiUsage
        .where("date")
        .aboveOrEqual(thirtyDaysAgo.toISOString().split("T")[0])
        .toArray();

      const totals = monthlyData.reduce(
        (acc, usage) => ({
          inoreaderCalls: acc.inoreaderCalls + usage.inoreaderCalls,
          claudeCalls: acc.claudeCalls + usage.claudeCalls,
          estimatedCost: acc.estimatedCost + usage.estimatedCost,
        }),
        { inoreaderCalls: 0, claudeCalls: 0, estimatedCost: 0 }
      );

      const days = monthlyData.length || 1; // Avoid division by zero

      return {
        ...totals,
        dailyAverage: {
          inoreaderCalls: Math.round(totals.inoreaderCalls / days),
          claudeCalls: Math.round(totals.claudeCalls / days),
          estimatedCost: Number((totals.estimatedCost / days).toFixed(4)),
        },
      };
    } catch (error) {
      console.error("Failed to get monthly usage:", error);
      return {
        inoreaderCalls: 0,
        claudeCalls: 0,
        estimatedCost: 0,
        dailyAverage: {
          inoreaderCalls: 0,
          claudeCalls: 0,
          estimatedCost: 0,
        },
      };
    }
  }

  // Check if we're approaching API limits
  async checkLimits(): Promise<{
    inoreader: {
      used: number;
      limit: number;
      percentage: number;
      isNearLimit: boolean;
    };
    claude: {
      used: number;
      estimatedCost: number;
      monthlyBudget: number;
      isNearBudget: boolean;
    };
  }> {
    const todaysUsage = await this.getTodaysUsage();
    const monthlyUsage = await this.getMonthlyTotal();

    const INOREADER_DAILY_LIMIT = 100; // Free tier limit
    const CLAUDE_MONTHLY_BUDGET = 5.0; // $5 monthly budget

    return {
      inoreader: {
        used: todaysUsage.inoreaderCalls,
        limit: INOREADER_DAILY_LIMIT,
        percentage: (todaysUsage.inoreaderCalls / INOREADER_DAILY_LIMIT) * 100,
        isNearLimit: todaysUsage.inoreaderCalls >= INOREADER_DAILY_LIMIT * 0.8,
      },
      claude: {
        used: monthlyUsage.claudeCalls,
        estimatedCost: monthlyUsage.estimatedCost,
        monthlyBudget: CLAUDE_MONTHLY_BUDGET,
        isNearBudget: monthlyUsage.estimatedCost >= CLAUDE_MONTHLY_BUDGET * 0.8,
      },
    };
  }

  async clearOldUsage(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffString = cutoffDate.toISOString().split("T")[0];

    try {
      const deleted = await db.apiUsage
        .where("date")
        .below(cutoffString)
        .delete();

      return deleted;
    } catch (error) {
      console.error("Failed to clear old usage:", error);
      return 0;
    }
  }
}

// Global repository instance
export const apiUsageRepository = new ApiUsageRepository();
