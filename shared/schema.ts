import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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
  comments: text("comments").array().default([]), // Array of comment strings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  analysisDepth: text("analysis_depth").default("comprehensive"),
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
}).partial();

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
