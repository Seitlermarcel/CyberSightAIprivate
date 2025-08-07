import {
  users,
  incidents,
  settings,
  type User,
  type UpsertUser,
  type Incident,
  type InsertIncident,
  type Settings,
  type InsertSettings
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  getIncidents(): Promise<Incident[]>;
  getUserIncidents(userId: string): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident | undefined>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: string, incident: Partial<Incident>): Promise<Incident | undefined>;
  deleteIncident(id: string): Promise<boolean>;
  
  getUserSettings(userId: string): Promise<Settings | undefined>;
  updateUserSettings(userId: string, settings: Partial<InsertSettings>): Promise<Settings>;
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

  async getIncidents(): Promise<Incident[]> {
    return await db.select().from(incidents);
  }

  async getUserIncidents(userId: string): Promise<Incident[]> {
    return await db.select().from(incidents).where(eq(incidents.userId, userId));
  }

  async getIncident(id: string): Promise<Incident | undefined> {
    const [incident] = await db.select().from(incidents).where(eq(incidents.id, id));
    return incident;
  }

  async createIncident(incident: InsertIncident): Promise<Incident> {
    const [newIncident] = await db
      .insert(incidents)
      .values(incident)
      .returning();
    return newIncident;
  }

  async updateIncident(id: string, incident: Partial<Incident>): Promise<Incident | undefined> {
    const [updatedIncident] = await db
      .update(incidents)
      .set({ ...incident, updatedAt: new Date() })
      .where(eq(incidents.id, id))
      .returning();
    return updatedIncident;
  }

  async deleteIncident(id: string): Promise<boolean> {
    const result = await db.delete(incidents).where(eq(incidents.id, id));
    return result.rowCount !== null && result.rowCount > 0;
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
}

export const storage = new DatabaseStorage();