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