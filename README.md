# North Star API Constellation

A modular "spine" constellation of APIs that any frontier application can snap into, providing essential building blocks for next-generation applications with a **comprehensive web-based dashboard** for monitoring, debugging, and management.

## 🌟 Vision

Build a comprehensive, modular API ecosystem that enables rapid development of frontier applications through standardized, interoperable services with full observability and control.

## 🏗️ Architecture

### Core Modules

- **Identity** → Who/what is acting (human, persona, agent, group)
- **Memory/State** → What's known, what changed, and time forks
- **Sensing** → Bio/emotion/3D/environment inputs
- **Generation/Simulation** → Worlds, media, timelines, causal maps
- **Interaction** → Multisensory comms, holo presence, group sessions
- **Autonomy** → Agent spawn, permissions, markets
- **Truth/Trust** → Provenance, bias filters, verification
- **Economy** → Payments, micro-value, incentives
- **Governance** → Consent, community rules, audits

### Technology Stack

- **Runtime**: Node.js + TypeScript
- **API Gateway**: Express with service routing
- **Database**: PostgreSQL with Redis caching
- **Message Queue**: Event-driven architecture
- **Authentication**: JWT with modular identity providers
- **Documentation**: OpenAPI/Swagger
- **Dashboard**: Next.js with real-time updates
- **Deployment**: Docker + Kubernetes ready

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository>
   cd north-star
   npm install
   ```

2. **Start with Docker**
   ```bash
   docker-compose up -d
   ```

3. **Start for development**
   ```bash
   npm run dev
   ```

### 🖥️ Dashboard Access
- **Main Dashboard**: http://localhost:4000
- **API Gateway**: http://localhost:3000/health
- **API Documentation**: http://localhost:3000/docs

### Service Endpoints
- Identity: http://localhost:3001
- Memory: http://localhost:3002
- Sensing: http://localhost:3003
- Generation: http://localhost:3004
- Interaction: http://localhost:3005
- Autonomy: http://localhost:3006
- Truth: http://localhost:3007
- Economy: http://localhost:3008
- Governance: http://localhost:3009

## 🎛️ Web Dashboard Features

### Overview Tab
- **System Status Cards** - Total services, API Gateway status, database connections
- **Service Grid** - Visual status of all 9 core services with health indicators
- **Real-time Alerts** - System alerts with severity levels and acknowledgment
- **Live Connection Status** - WebSocket connection indicator

### Services Tab
- **Real-time Metrics** - CPU, memory, response time, request count, error rate
- **Health Monitoring** - Service status with detailed performance graphs
- **Resource Usage** - Visual progress bars for system resources
- **Auto-refresh** - 30-second intervals with manual refresh option

### Logs Tab
- **Live Log Streaming** - Real-time log entries with auto-scroll
- **Advanced Filtering** - Filter by service, log level, and search terms
- **Export Functionality** - Download logs as text files
- **Color-coded Levels** - Visual distinction between info, warn, error, debug

### API Tester Tab
- **Interactive API Testing** - Full REST client with all HTTP methods
- **Service Integration** - Pre-configured endpoints for each service
- **Request History** - Save and replay previous API calls
- **Response Analysis** - Detailed response inspection with timing

### Controls Tab
- **Service Management** - Start, stop, restart individual services
- **Configuration Control** - Update and reload service configurations
- **Maintenance Operations** - Cache clearing, migrations, backups
- **Action History** - Track all management operations with status

### Real-time Features
- **WebSocket Integration** - Live updates without page refresh
- **Service Status Updates** - Real-time health and metric changes
- **Log Streaming** - Continuous log flow with filtering
- **System Alerts** - Immediate notifications for critical events
- **Connection Management** - Automatic reconnection on disconnects

## 📁 Project Structure

```
north-star/
├── packages/
│   ├── shared-types/       # Common TypeScript types
│   ├── shared-utils/       # Shared utilities
│   └── shared-config/      # Configuration
├── services/
│   ├── api-gateway/        # Central routing & auth
│   ├── identity/           # Identity management
│   ├── memory/             # Memory & state
│   ├── sensing/            # Sensor data processing
│   ├── generation/         # Content generation
│   ├── interaction/        # Communication
│   ├── autonomy/           # Agent management
│   ├── truth/              # Verification & trust
│   ├── economy/            # Payments & incentives
│   └── governance/         # Rules & compliance
├── web-dashboard/          # Next.js admin dashboard
├── docs/                   # Documentation
├── scripts/                # Deployment scripts
└── docker-compose.yml      # Development environment
```

## 🔧 Development

### Commands
```bash
npm run dev          # Start all services + dashboard
npm run build        # Build all services
npm run test         # Run all tests
npm run lint         # Lint all code
npm run type-check   # TypeScript validation
```

### Dashboard Development
```bash
cd web-dashboard
npm run dev          # Start dashboard on port 4000
npm run build        # Build dashboard for production
```

### Adding a New Service
1. Create service directory in `services/`
2. Follow the established patterns from existing services
3. Add to docker-compose.yml
4. Update API gateway routes
5. Add shared types to `packages/shared-types`
6. Update dashboard service list

## 🌐 API Patterns

### RESTful Endpoints
- `GET /api/{service}/health` - Health check
- `GET /api/{service}/{resource}` - List resources
- `GET /api/{service}/{resource}/{id}` - Get resource
- `POST /api/{service}/{resource}` - Create resource
- `PUT /api/{service}/{resource}/{id}` - Update resource
- `DELETE /api/{service}/{resource}/{id}` - Delete resource

### Event-Driven Communication
Services communicate via events for loose coupling and scalability.

### Authentication
- JWT tokens for service-to-service communication
- Modular identity providers (Auth0, custom, etc.)
- Fine-grained permissions per service

## 🔒 Security

- Helmet.js for security headers
- Rate limiting per service
- Input validation with Joi schemas
- Audit logging for all operations
- Environment-based configuration

## 📊 Monitoring & Observability

- **Real-time Dashboard** - Comprehensive web interface
- **Health Checks** - Automated service monitoring
- **Centralized Logging** - Winston with live streaming
- **Performance Metrics** - CPU, memory, response times
- **Alert System** - Configurable notifications
- **Service Registry** - Auto-discovery and health tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the established code patterns
4. Add tests for new functionality
5. Update documentation
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🎯 Roadmap

- [x] Complete foundational architecture
- [x] Implement comprehensive web dashboard
- [x] Real-time monitoring and controls
- [x] WebSocket integration for live updates
- [ ] Complete all 9 core services
- [ ] GraphQL Federation layer
- [ ] Kubernetes deployment manifests
- [ ] Advanced monitoring & observability stack
- [ ] Plugin system for extensions
- [ ] CLI tool for service management
- [ ] Mobile dashboard app