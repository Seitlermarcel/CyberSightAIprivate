import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, index, decimal, real, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  credits: decimal("credits", { precision: 10, scale: 2 }).default("0.00").notNull(),
  storageUsedGB: real("storage_used_gb").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  subscriptionPlan: text("subscription_plan").default("free"), // free, starter, professional, enterprise
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  severity: text("severity").notNull(), // critical, high, medium, low, informational
  status: text("status").notNull().default("open"), // open, in-progress, closed
  systemContext: text("system_context"),
  logData: text("log_data").notNull(),
  additionalLogs: text("additional_logs"),
  classification: text("classification"), // true-positive, false-positive
  confidence: integer("confidence"), // 0-100
  aiInvestigation: integer("ai_investigation"), // AI Investigation confidence score
  tacticalAnalyst: text("tactical_analyst"), // Technical evidence analysis
  strategicAnalyst: text("strategic_analyst"), // Patterns & hypotheticals analysis
  chiefAnalyst: text("chief_analyst"), // Final synthesized verdict
  mitreAttack: text("mitre_attack").array(),
  iocs: text("iocs").array(),
  aiAnalysis: text("ai_analysis"),
  analysisExplanation: text("analysis_explanation"),
  mitreDetails: text("mitre_details"), // JSON string with detailed MITRE info
  iocDetails: text("ioc_details"), // JSON string with detailed IOC enrichment
  patternAnalysis: text("pattern_analysis"), // JSON string with log patterns
  purpleTeam: text("purple_team"), // JSON string with red/blue team analysis
  entityMapping: text("entity_mapping"), // JSON string with entity relationships
  codeAnalysis: text("code_analysis"), // JSON string with code analysis
  attackVectors: text("attack_vectors"), // JSON string with AI-generated attack vectors
  complianceImpact: text("compliance_impact"), // JSON string with compliance analysis
  similarIncidents: text("similar_incidents"), // JSON string with similar incident data
  threatPrediction: text("threat_prediction"), // JSON string with AI threat prediction data
  predictionConfidence: integer("prediction_confidence"), // 0-100 threat prediction confidence
  riskTrend: text("risk_trend"), // increasing, stable, decreasing
  threatIntelligence: text("threat_intelligence"), // JSON string with AlienVault OTX threat intelligence data
  comments: text("comments").array().default([]), // Array of comment strings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).unique().notNull(),
  analysisDepth: text("analysis_depth").default("comprehensive"),
  confidenceThreshold: integer("confidence_threshold").default(80),
  enableDualAI: boolean("enable_dual_ai").default(true),
  autoSeverityAdjustment: boolean("auto_severity_adjustment").default(false),
  customInstructions: text("custom_instructions").default(""),
  theme: text("theme").default("dark"),
  sessionTimeout: integer("session_timeout").default(480),
  compactView: boolean("compact_view").default(false),
  autoRefresh: boolean("auto_refresh").default(false),
  requireComments: boolean("require_comments").default(false),
  emailNotifications: boolean("email_notifications").default(false),
  emailAddress: text("email_address"),
  highSeverityAlerts: boolean("high_severity_alerts").default(false),
});

// API Configuration for log streaming
export const apiConfigurations = pgTable("api_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  endpointType: text("endpoint_type").notNull(), // syslog, webhook, splunk, elastic, azure-sentinel
  endpointUrl: text("endpoint_url").notNull(),
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  authType: text("auth_type"), // api-key, oauth, basic, none
  headers: jsonb("headers"), // Additional headers for API calls
  queryInterval: integer("query_interval").default(60), // seconds
  isActive: boolean("is_active").default(true),
  lastSync: timestamp("last_sync"),
  errorCount: integer("error_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Billing and payment tracking
export const billingTransactions = pgTable("billing_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // credit-purchase, incident-analysis, storage-fee, refund
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  credits: decimal("credits", { precision: 10, scale: 2 }),
  description: text("description"),
  stripePaymentId: text("stripe_payment_id"),
  status: text("status").default("pending"), // pending, completed, failed, refunded
  incidentId: varchar("incident_id").references(() => incidents.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Usage tracking for billing
export const usageTracking = pgTable("usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  month: text("month").notNull(), // YYYY-MM format
  incidentsAnalyzed: integer("incidents_analyzed").default(0),
  storageGB: real("storage_gb").default(0),
  queriesRun: integer("queries_run").default(0),
  apiCalls: integer("api_calls").default(0),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdMonthUnique: unique().on(table.userId, table.month),
}));

// Advanced query history (like Microsoft Advanced Hunting)
export const queryHistory = pgTable("query_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  queryName: text("query_name"),
  query: text("query").notNull(),
  queryType: text("query_type"), // kql, sql, custom
  results: jsonb("results"),
  resultCount: integer("result_count"),
  executionTime: integer("execution_time"), // milliseconds
  isSaved: boolean("is_saved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  userId: true, // userId should be set server-side based on authentication
  createdAt: true,
  updatedAt: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  userId: true,
}).partial();

export const insertApiConfigSchema = createInsertSchema(apiConfigurations).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBillingTransactionSchema = createInsertSchema(billingTransactions).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertQueryHistorySchema = createInsertSchema(queryHistory).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
export type ApiConfiguration = typeof apiConfigurations.$inferSelect;
export type InsertApiConfiguration = z.infer<typeof insertApiConfigSchema>;
export type BillingTransaction = typeof billingTransactions.$inferSelect;
export type InsertBillingTransaction = z.infer<typeof insertBillingTransactionSchema>;
export type UsageTracking = typeof usageTracking.$inferSelect;
export type QueryHistory = typeof queryHistory.$inferSelect;
export type InsertQueryHistory = z.infer<typeof insertQueryHistorySchema>;
