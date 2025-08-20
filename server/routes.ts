import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertIncidentSchema, insertSettingsSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Basic incidents routes
  app.get("/api/incidents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const incidents = await storage.getUserIncidents(userId);
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  app.get("/api/incidents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const incident = await storage.getIncident(req.params.id, userId);
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      res.json(incident);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incident" });
    }
  });

  app.post("/api/incidents", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertIncidentSchema.parse(req.body);
      const userId = req.user.claims.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Basic analysis for now
      const incidentData = {
        ...validatedData,
        userId: userId,
        analysis: "Basic analysis completed",
        confidence: 70,
        classification: "needs-review",
        severity: "medium"
      };
      
      const incident = await storage.createIncident(incidentData, userId);
      res.status(201).json(incident);
    } catch (error: any) {
      console.error("Incident creation error:", error);
      res.status(400).json({ error: "Invalid incident data", details: error?.message || 'Unknown error' });
    }
  });

  // Settings routes
  app.get("/api/settings/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getUserSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const authenticatedUserId = req.user.claims.sub;
      const targetUserId = req.params.userId;
      
      if (authenticatedUserId !== targetUserId) {
        return res.status(403).json({ error: "Cannot update other user's settings" });
      }
      
      const validatedData = insertSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateUserSettings(targetUserId, validatedData);
      res.json(settings);
    } catch (error) {
      console.error('Settings update error:', error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const incidents = await storage.getUserIncidents(userId);
      
      const activeThreats = incidents.filter(i => 
        i.status === "open" && (i.severity === "critical" || i.severity === "high")
      ).length;
      
      const todayIncidents = incidents.filter(i => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(i.createdAt!).getTime() >= today.getTime();
      }).length;
      
      const truePositives = incidents.filter(i => 
        i.classification === "true-positive"
      ).length;
      
      const totalConfidence = incidents.reduce((acc, i) => acc + (i.confidence || 0), 0);
      const avgConfidence = incidents.length > 0 ? Math.round(totalConfidence / incidents.length) : 0;
      
      res.json({
        activeThreats,
        todayIncidents,
        truePositives,
        avgConfidence,
        totalIncidents: incidents.length,
        userId: userId
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // User routes
  app.get("/api/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user data" });
    }
  });

  // Basic health check
  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Return the HTTP server instance for WebSocket upgrade
  return createServer(app);
}