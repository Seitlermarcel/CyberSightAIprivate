import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertIncidentSchema, insertSettingsSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Incidents routes
  app.get("/api/incidents", async (req, res) => {
    try {
      const incidents = await storage.getIncidents();
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  app.get("/api/incidents/:id", async (req, res) => {
    try {
      const incident = await storage.getIncident(req.params.id);
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      res.json(incident);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incident" });
    }
  });

  app.post("/api/incidents", async (req, res) => {
    try {
      const validatedData = insertIncidentSchema.parse(req.body);
      
      // Mock AI analysis
      const mockAnalysis = generateMockAnalysis(validatedData);
      const incidentData = {
        ...validatedData,
        ...mockAnalysis
      };
      
      const incident = await storage.createIncident(incidentData);
      res.status(201).json(incident);
    } catch (error) {
      res.status(400).json({ error: "Invalid incident data" });
    }
  });

  app.patch("/api/incidents/:id", async (req, res) => {
    try {
      const incident = await storage.updateIncident(req.params.id, req.body);
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      res.json(incident);
    } catch (error) {
      res.status(500).json({ error: "Failed to update incident" });
    }
  });

  // Settings routes
  app.get("/api/settings/:userId", async (req, res) => {
    try {
      const settings = await storage.getUserSettings(req.params.userId);
      if (!settings) {
        return res.status(404).json({ error: "Settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings/:userId", async (req, res) => {
    try {
      const validatedData = insertSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateUserSettings(req.params.userId, validatedData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ error: "Invalid settings data" });
    }
  });

  // Mock user route
  app.get("/api/user", async (req, res) => {
    const user = await storage.getUser("default-user");
    res.json(user);
  });

  // Mock dashboard stats
  app.get("/api/dashboard-stats", async (req, res) => {
    try {
      const incidents = await storage.getIncidents();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const activeThreats = incidents.filter(i => i.status === "open" && (i.severity === "critical" || i.severity === "high")).length;
      const todayIncidents = incidents.filter(i => new Date(i.createdAt!).getTime() >= today.getTime()).length;
      const truePositives = incidents.filter(i => i.classification === "true-positive").length;
      const totalConfidence = incidents.reduce((acc, i) => acc + (i.confidence || 0), 0);
      const avgConfidence = incidents.length > 0 ? Math.round(totalConfidence / incidents.length) : 0;
      
      res.json({
        activeThreats,
        todayIncidents,
        truePositives,
        avgConfidence
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Mock AI analysis generator
function generateMockAnalysis(incident: any) {
  const severityMap: Record<string, number> = {
    critical: 95,
    high: 90,
    medium: 75,
    low: 60,
    informational: 40
  };

  const confidence = severityMap[incident.severity] || 75;
  
  // Mock MITRE ATT&CK mapping based on keywords
  const mitreAttack = [];
  if (incident.logData?.toLowerCase().includes("powershell")) {
    mitreAttack.push("T1059.001");
  }
  if (incident.logData?.toLowerCase().includes("injection")) {
    mitreAttack.push("T1055");
  }
  if (incident.logData?.toLowerCase().includes("credential") || incident.logData?.toLowerCase().includes("lsass")) {
    mitreAttack.push("T1003.001");
  }
  if (incident.logData?.toLowerCase().includes("dll")) {
    mitreAttack.push("T1574.002");
  }

  // Mock IOCs
  const iocs = [];
  const ipRegex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g;
  const ips = incident.logData?.match(ipRegex) || [];
  iocs.push(...ips);

  // Mock classification
  const classification = confidence > 80 ? "true-positive" : "false-positive";
  
  // Mock AI analysis text
  const aiAnalysis = `AI analysis completed with ${confidence}% confidence. ${mitreAttack.length > 0 ? `MITRE ATT&CK techniques identified: ${mitreAttack.join(", ")}. ` : ""}${classification === "true-positive" ? "This appears to be a legitimate security threat requiring immediate attention." : "This appears to be a false positive, but should be verified."}`;

  return {
    classification,
    confidence,
    mitreAttack,
    iocs,
    aiAnalysis
  };
}
