# TechStock CRUD API

A clean architecture REST API for managing Azure resources, built with Rust and Axum.

## 🏗️ Architecture

This project follows **Clean Architecture** principles with clear separation of concerns:

```
src/
├── domain/          # Business logic and entities
│   ├── entities/    # Domain entities (Resource, Subscription, etc.)
│   ├── repositories/# Repository interfaces
│   ├── value_objects.rs
│   └── errors.rs
├── application/     # Use cases and application services
│   ├── use_cases/   # Business use cases
│   ├── services.rs  # Application services
│   └── dto.rs       # Data Transfer Objects
├── infrastructure/ # External dependencies
│   ├── database.rs  # Database connection
│   ├── repositories/# Repository implementations
│   └── config.rs    # Configuration
├── presentation/   # HTTP API layer
│   ├── handlers/    # HTTP request handlers
│   ├── routes.rs    # Route definitions
│   ├── middleware.rs# HTTP middleware
│   └── responses.rs # Response models
└── shared/         # Shared utilities
    ├── errors.rs    # Error handling
    ├── pagination.rs# Pagination utilities
    └── validation.rs# Validation helpers
```

## 🚀 Getting Started

### Prerequisites
- Rust 1.70+
- PostgreSQL 12+
- Docker (optional)

### Setup

1. **Clone and setup environment:**
```bash
git clone <repository>
cd techstock
cp .env.example .env
# Edit .env with your database credentials
```

2. **Start PostgreSQL:**
```bash
./run-postgres.sh
```

3. **Run the API server:**
```bash
cargo run
```

The API will be available at `http://localhost:3000`

## 📚 API Endpoints

### Health & Stats
- `GET /health` - Health check
- `GET /stats` - Database statistics

### Resources
- `POST /api/v1/resources` - Create resource
- `GET /api/v1/resources` - List resources (with pagination & filters)
- `GET /api/v1/resources/{id}` - Get resource by ID
- `PUT /api/v1/resources/{id}` - Update resource
- `DELETE /api/v1/resources/{id}` - Delete resource
- `GET /api/v1/resources/stats` - Resource statistics

### Subscriptions
- `POST /api/v1/subscriptions` - Create subscription
- `GET /api/v1/subscriptions` - List subscriptions
- `GET /api/v1/subscriptions/{id}` - Get subscription by ID
- `PUT /api/v1/subscriptions/{id}` - Update subscription
- `DELETE /api/v1/subscriptions/{id}` - Delete subscription
- `GET /api/v1/subscriptions/{id}/resources` - Get resources by subscription

## 📝 API Examples

### Create Resource
```bash
curl -X POST http://localhost:3000/api/v1/resources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-vm-001",
    "resource_type": "Virtual Machine",
    "location": "East US",
    "subscription_id": 1,
    "resource_group_id": 1,
    "tags": {
      "Environment": "Production",
      "Owner": "team@company.com"
    }
  }'
```

### List Resources with Filters
```bash
curl "http://localhost:3000/api/v1/resources?page=1&size=10&resource_type=Virtual%20Machine&environment=Production"
```

### Get Resource Statistics
```bash
curl http://localhost:3000/api/v1/resources/stats
```

## 🔧 Configuration

Environment variables in `.env`:

```bash
# Database
DATABASE_URL=postgresql://techstock:password1234@localhost:5432/techstock_db

# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=3000

# Logging
RUST_LOG=info

# CORS
CORS_ORIGINS=*
```

## 🏃‍♂️ Development

### Import CSV Data
```bash
cargo run --bin import
```

### Run with Debug Logging
```bash
RUST_LOG=debug cargo run
```

### Database Queries
Use the provided SQL queries in `sql/queries.sql` for data analysis.

## 🧪 Testing

### Manual Testing
```bash
# Health check
curl http://localhost:3000/health

# Get stats
curl http://localhost:3000/stats

# Create subscription
curl -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{"name": "Production Subscription"}'
```

## 🎯 Features

- **Clean Architecture** - Separation of concerns with clear boundaries
- **Type Safety** - Full Rust type safety with compile-time guarantees
- **Validation** - Request validation with detailed error messages
- **Pagination** - Efficient pagination for large datasets
- **Filtering** - Advanced filtering and sorting capabilities
- **Error Handling** - Comprehensive error handling with proper HTTP status codes
- **Logging** - Structured logging with tracing
- **CORS** - Cross-origin resource sharing support
- **Database** - PostgreSQL with connection pooling
- **Performance** - Async/await with tokio runtime

## 🔍 Query Parameters

### Resources Endpoint
- `page` - Page number (default: 1)
- `size` - Page size (default: 20, max: 100)
- `resource_type` - Filter by resource type
- `location` - Filter by location
- `environment` - Filter by environment
- `vendor` - Filter by vendor
- `subscription_id` - Filter by subscription
- `resource_group_id` - Filter by resource group
- `search` - Search in resource names
- `sort_field` - Sort field (default: created_at)
- `sort_direction` - Sort direction (asc/desc)

## 📊 Response Format

### Success Response
```json
{
  "data": { ... },
  "success": true,
  "message": "Operation completed successfully"
}
```

### Paginated Response
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "size": 20,
    "total": 150,
    "total_pages": 8
  },
  "success": true
}
```

### Error Response
```json
{
  "error": "Resource not found",
  "status": 404
}
```

## 🛠️ Technology Stack

- **Framework**: Axum (async web framework)
- **Database**: PostgreSQL with SQLx
- **Serialization**: Serde
- **Validation**: Validator
- **Logging**: Tracing
- **Error Handling**: thiserror + anyhow
- **Async Runtime**: Tokio

## 📈 Performance

- **Connection Pooling**: Efficient database connection management
- **Async Processing**: Non-blocking I/O operations
- **Pagination**: Memory-efficient data retrieval
- **Indexing**: Optimized database queries with proper indexes

This API provides a robust, scalable foundation for managing Azure resources with clean architecture principles and modern Rust best practices.
