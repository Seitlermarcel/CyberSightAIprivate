# CyberSight AI - Security Incident Analysis Platform

## Overview

CyberSight AI is a cybersecurity incident analysis platform that uses artificial intelligence to analyze security logs, detect threats, and map incidents to the MITRE ATT&CK framework. The platform provides professional security analysts with automated incident classification, confidence scoring, and comprehensive analysis capabilities. It features a dark cyber-themed interface with real-time incident processing, historical tracking, and configurable AI analysis settings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom cyber-themed color palette and dark mode support
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation schemas

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API with structured error handling
- **Development**: Hot module replacement with Vite integration
- **Build**: ESBuild for production bundling

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Schema Management**: Drizzle Kit for migrations and schema evolution
- **Development Storage**: In-memory storage implementation for development/testing

### Authentication and Authorization
- **Session Management**: PostgreSQL-backed session storage using connect-pg-simple
- **User Model**: Simple username/password authentication with default user setup
- **Authorization**: Basic user identification system (expandable for role-based access)

### External Dependencies
- **Database**: Neon Database (PostgreSQL serverless)
- **AI Analysis**: Mock AI implementation (designed for future integration with real AI services)
- **UI Components**: Extensive Radix UI ecosystem for accessible, unstyled components
- **Validation**: Zod schemas shared between frontend and backend
- **Date Handling**: date-fns for consistent date manipulation
- **Development Tools**: Replit-specific plugins for development environment integration

### Core Features
- **Multi-AI Analysis System**: 8 specialized AI agents providing comprehensive cybersecurity analysis
- **Dual-AI Workflow**: Tactical, Strategic, and Chief Analyst roles for enhanced decision-making
- **Investigation Metrics**: AI Investigation percentage and Confidence scoring with detailed explanations
- **Multi-user Architecture**: User-specific incident isolation with secure database separation
- **Enhanced Classification**: True/false positive detection with detailed cybersecurity reasoning
- **Clickable Similar Incidents**: Real incident navigation with match percentage calculations
- **Functional Settings**: All configuration options impact application behavior and analysis
- **Severity Color System**: Critical (Dark Red), High (Vivid Red), Medium (Orange), Low (Yellow), Informational (Grey)
- **Real-time Processing**: Immediate incident analysis with settings-aware AI behavior
- **Sorted Incident Display**: Recent Analysis Results and Incident History display newest incidents first

### Design Patterns
- **Monorepo Structure**: Shared TypeScript schemas between client and server
- **Type Safety**: End-to-end TypeScript with strict configuration
- **Component Architecture**: Modular UI components with consistent styling patterns
- **Error Handling**: Centralized error handling with user-friendly messages
- **Development Experience**: Hot reload, runtime error overlays, and development banners

### Deployment Configuration
- **Database Initialization**: Comprehensive error handling with environment validation and connection testing
- **Health Check Endpoint**: `/health` endpoint for deployment validation and monitoring
- **Startup Validation**: Critical dependency verification before server launch
- **Error Recovery**: Graceful failure handling with detailed error logging and process termination
- **Environment Variables**: Mandatory DATABASE_URL validation with clear error messages

### Recent Changes (January 7, 2025)
- Fixed deployment failure by uncommenting database initialization in server/index.ts
- Added comprehensive error handling around database startup with connection testing
- Implemented health check endpoint for deployment validation
- Fixed user creation schema to match PostgreSQL table structure (email/firstName/lastName instead of username/password)
- Added environment variable validation and startup dependency checks
- Enhanced error logging with stack traces and graceful failure handling
- **Enhanced Production Deployment (Latest)**:
  - Added robust health check endpoint with live database connectivity testing
  - Implemented database connection retry logic with progressive delays (3 attempts)
  - Enhanced startup environment validation and logging
  - Added graceful shutdown handlers for SIGTERM and SIGINT signals
  - Improved error handling with detailed production debugging information
  - Added port validation and comprehensive startup status logging
  - Enhanced database URL format validation and credential masking in logs
- **Fixed Display Issues (January 7, 2025 - Latest)**:
  - Fixed MITRE ATT&CK display showing "[object Object]" by storing technique IDs instead of full objects
  - Updated backend to return technique IDs (like "T1055", "T1059") instead of complex objects
  - Fixed all frontend components (compact-incident-card, incident-history, incident-analysis) to handle both string and object formats
  - Updated entity extraction to parse real IPs, users, processes, and domains from logs
  - Enhanced entity relationships display to show descriptions
  - Fixed network topology display to show correct risk levels and node types
  - Resolved TypeScript compilation errors that were preventing proper display