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
  title: text("title").notNull(),
  severity: text("severity").notNull(), // critical, high, medium, low, informational
  status: text("status").notNull().default("open"), // open, in-progress, closed
  systemContext: text("system_context"),
  logData: text("log_data").notNull(),
  additionalLogs: text("additional_logs"),
  classification: text("classification"), // true-positive, false-positive
  confidence: integer("confidence"), // 0-100
  mitreAttack: text("mitre_attack").array(),
  iocs: text("iocs").array(),
  aiAnalysis: text("ai_analysis"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  analysisDepth: text("analysis_depth").default("comprehensive"),
  confidenceThreshold: integer("confidence_threshold").default(80),
  enableDualAI: boolean("enable_dual_ai").default(true),
  autoSeverityAdjustment: boolean("auto_severity_adjustment").default(false),
  customInstructions: text("custom_instructions"),
  theme: text("theme").default("dark"),
  sessionTimeout: integer("session_timeout").default(480),
  compactView: boolean("compact_view").default(false),
  autoRefresh: boolean("auto_refresh").default(false),
  requireComments: boolean("require_comments").default(false),
  emailNotifications: boolean("email_notifications").default(false),
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
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
