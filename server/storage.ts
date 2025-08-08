import {
  users,
  incidents,
  settings,
  apiConfigurations,
  billingTransactions,
  usageTracking,
  queryHistory,
  type User,
  type UpsertUser,
  type Incident,
  type InsertIncident,
  type Settings,
  type InsertSettings,
  type ApiConfiguration,
  type InsertApiConfiguration,
  type BillingTransaction,
  type InsertBillingTransaction,
  type UsageTracking,
  type QueryHistory,
  type InsertQueryHistory
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserCredits(userId: string, credits: number): Promise<User | undefined>;
  deductCredits(userId: string, amount: number): Promise<boolean>;
  
  // Incidents - now user-scoped
  getUserIncidents(userId: string): Promise<Incident[]>;
  getIncident(id: string, userId: string): Promise<Incident | undefined>;
  createIncident(incident: InsertIncident, userId: string): Promise<Incident>;
  updateIncident(id: string, userId: string, incident: Partial<Incident>): Promise<Incident | undefined>;
  deleteIncident(id: string, userId: string): Promise<boolean>;
  deleteOldIncidents(userId: string, daysOld: number): Promise<number>;
  
  // Settings
  getUserSettings(userId: string): Promise<Settings | undefined>;
  updateUserSettings(userId: string, settings: Partial<InsertSettings>): Promise<Settings>;
  
  // API Configurations
  getUserApiConfigs(userId: string): Promise<ApiConfiguration[]>;
  getApiConfig(id: string, userId: string): Promise<ApiConfiguration | undefined>;
  createApiConfig(config: InsertApiConfiguration, userId: string): Promise<ApiConfiguration>;
  updateApiConfig(id: string, userId: string, config: Partial<ApiConfiguration>): Promise<ApiConfiguration | undefined>;
  deleteApiConfig(id: string, userId: string): Promise<boolean>;
  
  // Billing & Transactions
  createBillingTransaction(transaction: InsertBillingTransaction, userId: string): Promise<BillingTransaction>;
  getUserTransactions(userId: string, limit?: number): Promise<BillingTransaction[]>;
  updateTransactionStatus(id: string, status: string): Promise<BillingTransaction | undefined>;
  
  // Usage Tracking
  updateUsageTracking(userId: string, month: string, updates: Partial<UsageTracking>): Promise<UsageTracking>;
  getUserUsage(userId: string, month: string): Promise<UsageTracking | undefined>;
  calculateStorageUsage(userId: string): Promise<number>;
  
  // Query History
  saveQuery(query: InsertQueryHistory, userId: string): Promise<QueryHistory>;
  getUserQueries(userId: string, limit?: number): Promise<QueryHistory[]>;
  getSavedQueries(userId: string): Promise<QueryHistory[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserCredits(userId: string, credits: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ credits: credits.toString(), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deductCredits(userId: string, amount: number): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user || parseFloat(user.credits) < amount) return false;
    
    const newCredits = parseFloat(user.credits) - amount;
    await this.updateUserCredits(userId, newCredits);
    return true;
  }

  async getUserIncidents(userId: string): Promise<Incident[]> {
    return await db
      .select()
      .from(incidents)
      .where(eq(incidents.userId, userId))
      .orderBy(desc(incidents.createdAt));
  }

  async getIncident(id: string, userId: string): Promise<Incident | undefined> {
    const [incident] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, id), eq(incidents.userId, userId)));
    return incident;
  }

  async createIncident(incident: InsertIncident, userId: string): Promise<Incident> {
    const [newIncident] = await db
      .insert(incidents)
      .values({ ...incident, userId })
      .returning();
    return newIncident;
  }

  async updateIncident(id: string, userId: string, incident: Partial<Incident>): Promise<Incident | undefined> {
    const [updatedIncident] = await db
      .update(incidents)
      .set({ ...incident, updatedAt: new Date() })
      .where(and(eq(incidents.id, id), eq(incidents.userId, userId)))
      .returning();
    return updatedIncident;
  }

  async deleteIncident(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(incidents)
      .where(and(eq(incidents.id, id), eq(incidents.userId, userId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteOldIncidents(userId: string, daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await db
      .delete(incidents)
      .where(and(
        eq(incidents.userId, userId),
        gte(cutoffDate, incidents.createdAt!)
      ));
    return result.rowCount || 0;
  }

  async getUserSettings(userId: string): Promise<Settings | undefined> {
    const [userSettings] = await db.select().from(settings).where(eq(settings.userId, userId));
    return userSettings;
  }

  async updateUserSettings(userId: string, settingsData: Partial<InsertSettings>): Promise<Settings> {
    const [updatedSettings] = await db
      .insert(settings)
      .values({ userId, ...settingsData })
      .onConflictDoUpdate({
        target: settings.userId,
        set: settingsData,
      })
      .returning();
    return updatedSettings;
  }

  // API Configurations
  async getUserApiConfigs(userId: string): Promise<ApiConfiguration[]> {
    return await db
      .select()
      .from(apiConfigurations)
      .where(eq(apiConfigurations.userId, userId))
      .orderBy(desc(apiConfigurations.createdAt));
  }

  async getApiConfig(id: string, userId: string): Promise<ApiConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(apiConfigurations)
      .where(and(eq(apiConfigurations.id, id), eq(apiConfigurations.userId, userId)));
    return config;
  }

  async createApiConfig(config: InsertApiConfiguration, userId: string): Promise<ApiConfiguration> {
    const [newConfig] = await db
      .insert(apiConfigurations)
      .values({ ...config, userId })
      .returning();
    return newConfig;
  }

  async updateApiConfig(id: string, userId: string, config: Partial<ApiConfiguration>): Promise<ApiConfiguration | undefined> {
    const [updatedConfig] = await db
      .update(apiConfigurations)
      .set({ ...config, updatedAt: new Date() })
      .where(and(eq(apiConfigurations.id, id), eq(apiConfigurations.userId, userId)))
      .returning();
    return updatedConfig;
  }

  async deleteApiConfig(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(apiConfigurations)
      .where(and(eq(apiConfigurations.id, id), eq(apiConfigurations.userId, userId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Billing & Transactions
  async createBillingTransaction(transaction: InsertBillingTransaction, userId: string): Promise<BillingTransaction> {
    const [newTransaction] = await db
      .insert(billingTransactions)
      .values({ ...transaction, userId })
      .returning();
    return newTransaction;
  }

  async getUserTransactions(userId: string, limit: number = 50): Promise<BillingTransaction[]> {
    return await db
      .select()
      .from(billingTransactions)
      .where(eq(billingTransactions.userId, userId))
      .orderBy(desc(billingTransactions.createdAt))
      .limit(limit);
  }

  async updateTransactionStatus(id: string, status: string): Promise<BillingTransaction | undefined> {
    const [updated] = await db
      .update(billingTransactions)
      .set({ status })
      .where(eq(billingTransactions.id, id))
      .returning();
    return updated;
  }

  // Usage Tracking
  async updateUsageTracking(userId: string, month: string, updates: Partial<UsageTracking>): Promise<UsageTracking> {
    const [usage] = await db
      .insert(usageTracking)
      .values({ userId, month, ...updates })
      .onConflictDoUpdate({
        target: [usageTracking.userId, usageTracking.month],
        set: { ...updates, updatedAt: new Date() },
      })
      .returning();
    return usage;
  }

  async getUserUsage(userId: string, month: string): Promise<UsageTracking | undefined> {
    const [usage] = await db
      .select()
      .from(usageTracking)
      .where(and(eq(usageTracking.userId, userId), eq(usageTracking.month, month)));
    return usage;
  }

  async calculateStorageUsage(userId: string): Promise<number> {
    const result = await db
      .select({ 
        totalSize: sql<number>`SUM(LENGTH(log_data) + COALESCE(LENGTH(additional_logs), 0))` 
      })
      .from(incidents)
      .where(eq(incidents.userId, userId));
    
    const totalBytes = result[0]?.totalSize || 0;
    return totalBytes / (1024 * 1024 * 1024); // Convert to GB
  }

  // Query History
  async saveQuery(query: InsertQueryHistory, userId: string): Promise<QueryHistory> {
    const [savedQuery] = await db
      .insert(queryHistory)
      .values({ ...query, userId })
      .returning();
    return savedQuery;
  }

  async getUserQueries(userId: string, limit: number = 100): Promise<QueryHistory[]> {
    return await db
      .select()
      .from(queryHistory)
      .where(eq(queryHistory.userId, userId))
      .orderBy(desc(queryHistory.createdAt))
      .limit(limit);
  }

  async getSavedQueries(userId: string): Promise<QueryHistory[]> {
    return await db
      .select()
      .from(queryHistory)
      .where(and(eq(queryHistory.userId, userId), eq(queryHistory.isSaved, true)))
      .orderBy(desc(queryHistory.createdAt));
  }
}

export const storage = new DatabaseStorage();