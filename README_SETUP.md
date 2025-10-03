# TechStock Setup Guide

## 🚀 Quick Start

### 1. Environment Variables

สร้างไฟล์ `.env` ในโฟลเดอร์ root:

```bash
# Database Configuration
DATABASE_URL=postgresql://techstock:password1234@localhost:5432/techstock_db

# Server Configuration  
SERVER_HOST=0.0.0.0
SERVER_PORT=8888

# Logging
RUST_LOG=info

# CORS (optional)
CORS_ORIGINS=*
```

### 2. Database Setup

```bash
# Start PostgreSQL (Docker)
docker run --name techstock-postgres \
  -e POSTGRES_DB=techstock_db \
  -e POSTGRES_USER=techstock \
  -e POSTGRES_PASSWORD=password1234 \
  -p 5432:5432 \
  -d postgres:15

# หรือใช้ run-postgres.sh script
./run-postgres.sh
```

### 3. Build & Run

```bash
# Build project
cargo build

# Run API server
cargo run --bin techstock

# Import CSV data (optional)
cargo run --bin import -- path/to/your/data.csv
```

### 4. Access Web Application

เปิดเว็บเบราว์เซอร์:
```
http://localhost:8888
```

## 🔧 Configuration Options

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `0.0.0.0` | Server bind address |
| `SERVER_PORT` | `8888` | Server port |
| `RUST_LOG` | `info` | Log level |
| `CORS_ORIGINS` | `*` | CORS allowed origins |

### Database Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |

## 🧪 Testing API Connection

### Manual Testing

```bash
# Health check
curl http://localhost:8888/health

# Get resources
curl http://localhost:8888/api/v1/resources

# Get subscriptions
curl http://localhost:8888/api/v1/subscriptions
```

### Web Console Testing

เปิด browser developer console และรัน:

```javascript
// Manual connection test
const tester = new ConnectionTest();
await tester.runAllTests();
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```
Error: DatabaseError { message: "Failed to connect to database" }
```

**Solutions:**
- ตรวจสอบว่า PostgreSQL server ทำงานอยู่
- ตรวจสอบ `DATABASE_URL` ใน `.env`
- ตรวจสอบ firewall และ network connectivity

#### 2. Port Already in Use
```
Error: Os { code: 48, kind: AddrInUse, message: "Address already in use" }
```

**Solutions:**
- เปลี่ยน `SERVER_PORT` ใน `.env`
- หยุด process ที่ใช้ port อยู่: `pkill -f techstock`
- ตรวจสอบ port ที่ใช้งาน: `lsof -i :8888`

#### 3. Static Files Not Loading
```
404 Not Found for /css/styles.css
```

**Solutions:**
- ตรวจสอบว่าไฟล์อยู่ในโฟลเดอร์ `static/`
- ตรวจสอบ file permissions
- ตรวจสอบ Actix Web static file configuration

#### 4. CORS Issues
```
Access to fetch at 'http://localhost:8888/api/v1/resources' from origin 'null' has been blocked by CORS policy
```

**Solutions:**
- ตั้งค่า `CORS_ORIGINS` ใน `.env`
- ใช้ `http://localhost:8888` แทน `file://`

## 📊 Performance Tuning

### Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_resource_type ON resource(type);
CREATE INDEX IF NOT EXISTS idx_resource_location ON resource(location);
CREATE INDEX IF NOT EXISTS idx_resource_environment ON resource(environment);
CREATE INDEX IF NOT EXISTS idx_resource_tags ON resource USING GIN(tags_json);
```

### Server Configuration

```bash
# Production environment variables
RUST_LOG=warn
SERVER_HOST=0.0.0.0
SERVER_PORT=8888

# Database connection pooling
DATABASE_MAX_CONNECTIONS=10
DATABASE_MIN_CONNECTIONS=5
```

## 🔒 Security Considerations

### Production Deployment

1. **Environment Variables**:
   - ใช้ strong password สำหรับ database
   - ตั้งค่า `CORS_ORIGINS` เฉพาะ domain ที่ต้องการ
   - ใช้ HTTPS ใน production

2. **Database Security**:
   - ใช้ SSL connection
   - จำกัด database user permissions
   - Regular backup

3. **Server Security**:
   - ใช้ reverse proxy (nginx/apache)
   - Rate limiting
   - Input validation

## 📚 API Documentation

### Resources API

```bash
# List resources with filters
GET /api/v1/resources?page=1&size=20&search=web&tags=Environment:Production

# Create resource
POST /api/v1/resources
Content-Type: application/json
{
  "name": "my-resource",
  "resource_type": "vm",
  "location": "eastus",
  "subscription_id": 1,
  "tags": {"Environment": "Production"}
}

# Update resource
PUT /api/v1/resources/1
Content-Type: application/json
{
  "name": "updated-resource"
}

# Delete resource
DELETE /api/v1/resources/1
```

### Subscriptions API

```bash
# List subscriptions
GET /api/v1/subscriptions

# Create subscription
POST /api/v1/subscriptions
Content-Type: application/json
{
  "name": "My Subscription",
  "tenant_id": "tenant-123"
}
```

## 🚀 Development

### Adding New Features

1. **Backend (Rust)**:
   - Add new endpoints in `src/presentation/handlers/`
   - Update routes in `src/presentation/routes.rs`
   - Add business logic in `src/application/use_cases/`

2. **Frontend (JavaScript)**:
   - Add new API methods in `api-client.js`
   - Update UI in `app.js`
   - Add new styles in `styles.css`

### Testing

```bash
# Run tests
cargo test

# Check code
cargo check

# Format code
cargo fmt

# Lint code
cargo clippy
```

---

**Happy coding! 🎉**
