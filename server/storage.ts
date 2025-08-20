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
import { eq, and, desc, sql, gte, or, asc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(userId: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserCredits(userId: string, credits: number): Promise<User | undefined>;
  addCredits(userId: string, amount: number): Promise<User | undefined>;
  deductCredits(userId: string, amount: number): Promise<boolean>;
  
  // Incidents - now user-scoped
  getUserIncidents(userId: string): Promise<Incident[]>;
  getIncidentsByUserId(userId: string, options?: { limit?: number }): Promise<Incident[]>;
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
    // Check if user already exists
    const existingUser = await this.getUser(userData.id!);
    
    if (existingUser) {
      // Update existing user
      const [user] = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id!))
        .returning();
      return user;
    } else {
      // Create new user with starting credits
      const [user] = await db
        .insert(users)
        .values({
          ...userData,
          credits: "10", // Give new users 10 credits to start (4 incident analyses)
          subscriptionPlan: 'free',
        })
        .returning();
      return user;
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
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

  async addCredits(userId: string, amount: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const currentCredits = parseFloat(user.credits);
    const newCredits = currentCredits + amount;
    return this.updateUserCredits(userId, newCredits);
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

  async getIncidentsByUserId(userId: string, options?: { limit?: number }): Promise<Incident[]> {
    const query = db
      .select()
      .from(incidents)
      .where(eq(incidents.userId, userId))
      .orderBy(desc(incidents.createdAt));
    
    if (options?.limit) {
      return await query.limit(options.limit);
    }
    
    return await query;
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
        sql`${incidents.createdAt} < ${cutoffDate.toISOString()}`
      ));
    return result.rowCount || 0;
  }

  async getUserSettings(userId: string): Promise<Settings | undefined> {
    const [userSettings] = await db.select().from(settings).where(eq(settings.userId, userId));
    return userSettings;
  }

  async updateUserSettings(userId: string, settingsData: Partial<InsertSettings>): Promise<Settings> {
    // Check if settings already exist for this user
    const existingSettings = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId));
    
    if (existingSettings.length > 0) {
      // Update existing settings
      const [updatedSettings] = await db
        .update(settings)
        .set(settingsData)
        .where(eq(settings.userId, userId))
        .returning();
      return updatedSettings;
    } else {
      // Insert new settings
      const [newSettings] = await db
        .insert(settings)
        .values({ userId, ...settingsData })
        .returning();
      return newSettings;
    }
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
  
  // Advanced Query Execution Methods
  async executeRawQuery(query: string, userId: string): Promise<any[]> {
    // Security: Prevent dangerous SQL operations
    const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE'];
    const upperQuery = query.toUpperCase();
    
    for (const keyword of dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        throw new Error(`Dangerous operation '${keyword}' not allowed in queries`);
      }
    }
    
    // Require valid user ID for all queries
    if (!userId) {
      throw new Error('Authentication required to execute queries');
    }
    
    const effectiveUserId = userId;
    
    // Parse the query to understand its structure
    let safeQuery = query.trim();
    
    // Check if query already has user_id filter
    if (query.toLowerCase().includes('user_id')) {
      // Query already has user_id filter, don't modify it
      safeQuery = query;
    } else {
      // Need to add user_id filter for security
      const lowerQuery = query.toLowerCase();
      const fromMatch = lowerQuery.match(/from\s+(\w+)/i);
      
      if (!fromMatch) {
        throw new Error('Invalid query structure - must have FROM clause');
      }
      
      const tableName = fromMatch[1];
      const isIncidentsTable = tableName === 'incidents';
      
      // Find where to insert the WHERE clause
      const whereIndex = lowerQuery.indexOf('where');
      const orderByIndex = lowerQuery.indexOf('order by');
      const groupByIndex = lowerQuery.indexOf('group by');
      const limitIndex = lowerQuery.indexOf('limit');
      
      if (whereIndex > -1) {
        // Query has WHERE clause, add user_id condition
        const beforeWhere = query.substring(0, whereIndex + 5);
        const afterWhere = query.substring(whereIndex + 5);
        
        // Always filter by user_id only - no access to other users' data
        safeQuery = beforeWhere + ` user_id = '${effectiveUserId}' AND` + afterWhere;
      } else {
        // No WHERE clause, need to add one
        let insertPoint = query.length;
        
        // Find the earliest clause that comes after FROM
        if (orderByIndex > -1) insertPoint = Math.min(insertPoint, orderByIndex);
        if (groupByIndex > -1) insertPoint = Math.min(insertPoint, groupByIndex);
        if (limitIndex > -1) insertPoint = Math.min(insertPoint, limitIndex);
        
        const beforeInsert = query.substring(0, insertPoint).trim();
        const afterInsert = query.substring(insertPoint).trim();
        
        // Always filter by user_id only - no access to other users' data
        safeQuery = beforeInsert + ` WHERE user_id = '${effectiveUserId}' ` + afterInsert;
      }
    }
    
    // Clean up any double spaces
    safeQuery = safeQuery.replace(/\s+/g, ' ').trim();
    
    try {
      // Execute the safe SQL query
      const result = await db.execute(sql.raw(safeQuery));
      return result.rows || [];
    } catch (error: any) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }
  
  async executeStructuredQuery(query: string, userId: string): Promise<any[]> {
    try {
      // Parse structured query (JSON format)
      const queryObj = JSON.parse(query);
      
      // Apply filters using and() to combine conditions
      const conditions = [eq(incidents.userId, userId)];
      
      if (queryObj.severity) {
        conditions.push(eq(incidents.severity, queryObj.severity));
      }
      if (queryObj.status) {
        conditions.push(eq(incidents.status, queryObj.status));
      }
      if (queryObj.classification) {
        conditions.push(eq(incidents.classification, queryObj.classification));
      }
      
      // Execute the query with filters
      const results = await db
        .select()
        .from(incidents)
        .where(and(...conditions))
        .orderBy(queryObj.orderBy === 'updatedAt' ? 
          (queryObj.order === 'asc' ? asc(incidents.updatedAt) : desc(incidents.updatedAt)) :
          (queryObj.order === 'asc' ? asc(incidents.createdAt) : desc(incidents.createdAt))
        )
        .limit(queryObj.limit || 100);
      
      return results;

    } catch (error: any) {
      throw new Error(`Structured query failed: ${error.message}`);
    }
  }
  
  async searchIncidents(searchTerm: string, userId: string): Promise<Incident[]> {
    // Simple text search across multiple fields
    const searchPattern = `%${searchTerm}%`;
    
    return await db
      .select()
      .from(incidents)
      .where(and(
        eq(incidents.userId, userId),
        or(
          sql`${incidents.title} ILIKE ${searchPattern}`,
          sql`${incidents.logData} ILIKE ${searchPattern}`,
          sql`${incidents.aiAnalysis} ILIKE ${searchPattern}`,
          sql`${incidents.analysisExplanation} ILIKE ${searchPattern}`
        )
      ))
      .orderBy(desc(incidents.createdAt))
      .limit(100);
  }
}

export const storage = new DatabaseStorage();