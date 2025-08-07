import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./init-db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log('Starting server initialization...');
    
    // Validate startup environment
    console.log(`Node.js version: ${process.version}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Port: ${process.env.PORT || '5000'}`);
    
    // Validate critical environment variables
    const requiredEnvVars = ['DATABASE_URL'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    // Initialize database with comprehensive error handling
    await initializeDatabase();
    console.log('Database initialization successful');
    
    // Enhanced health check endpoint for deployment validation - must be before Vite setup
    app.get('/health', async (_req, res) => {
      try {
        const health = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          database: 'connected',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          uptime: process.uptime()
        };
        
        // Test database connectivity
        const { db } = await import('./db');
        await db.select().from((await import('@shared/schema')).users).limit(1);
        
        res.status(200).json(health);
      } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({
          status: 'error',
          timestamp: new Date().toISOString(),
          database: 'disconnected',
          error: error instanceof Error ? error.message : 'Unknown error',
          version: '1.0.0'
        });
      }
    });

    const server = await registerRoutes(app);
    console.log('Routes registration successful');

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Enhanced error logging for production debugging
    console.error('Request error:', {
      method: req.method,
      path: req.path,
      status,
      message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });

    const errorResponse = {
      message,
      timestamp: new Date().toISOString(),
      path: req.path
    };
    
    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
      (errorResponse as any).stack = err.stack;
    }

    res.status(status).json(errorResponse);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Final startup validation
  const port = parseInt(process.env.PORT || '5000', 10);
  
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port number: ${process.env.PORT}`);
  }
  
  // Start the server with enhanced startup logging
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    console.log(`✓ Server successfully started`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ Port: ${port}`);
    console.log(`✓ Host: 0.0.0.0`);
    console.log(`✓ Database: Connected and initialized`);
    console.log(`✓ Health check: Available at /health`);
    log(`serving on port ${port}`);
    log('Server initialization complete - all systems operational');
  });
  
  // Setup graceful shutdown handlers
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, starting graceful shutdown...');
    server.close(() => {
      console.log('Server closed, exiting process');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('SIGINT received, starting graceful shutdown...');
    server.close(() => {
      console.log('Server closed, exiting process');
      process.exit(0);
    });
  });
  
  } catch (error) {
    console.error('Failed to start server:', error);
    console.error('Error details:', error instanceof Error ? error.stack : error);
    console.error('Startup environment:', {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'missing'
    });
    process.exit(1);
  }
})();
