# TechStock - Azure Resource Import Tool

A Rust application for importing Azure Resource Graph CSV data into a PostgreSQL database with proper normalization and tagging support.

## Features

- **CSV Import**: Reads Azure Resource Graph formatted CSV files
- **Database Normalization**: Properly structures data across multiple tables
- **Tag Processing**: Parses JSON tags and stores them both as JSONB and normalized key-value pairs
- **Application Mapping**: Links resources to applications based on AppID tags
- **Caching**: Uses in-memory caching for efficient bulk imports
- **Error Handling**: Robust error handling with detailed logging

## Database Schema

The application creates and populates the following tables:
- `subscription` - Azure subscriptions
- `resource_group` - Resource groups within subscriptions
- `application` - Applications identified by AppID tags
- `resource` - Main resource table with metadata
- `resource_tag` - Normalized tag key-value pairs
- `resource_application_map` - Many-to-many mapping between resources and applications

## Prerequisites

- Rust 1.70+ 
- PostgreSQL 12+
- CSV file in Azure Resource Graph format

## Setup

1. **Clone and build**:
   ```bash
   git clone <repository>
   cd techstock
   cargo build --release
   ```

2. **Database setup**:
   ```bash
   # Create database
   createdb techstock
   
   # The application will automatically create tables from sql/create_tables.sql
   ```

3. **Environment configuration**:
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit .env with your database connection
   DATABASE_URL=postgresql://username:password@localhost:5432/techstock
   ```

## Usage

### Import CSV Data

```bash
# Run the import tool
cargo run --bin import

# Or run the compiled binary
./target/release/import
```

The import tool will:
1. Connect to the PostgreSQL database
2. Create tables if they don't exist
3. Read the CSV file from `datasets/AzureResourceGraphFormattedResults-Query.csv`
4. Parse and import all records with progress logging
5. Create relationships between resources, applications, and tags

### CSV Format Expected

The CSV should have these columns:
- `Name` - Resource name
- `Type` - Resource type (e.g., "Virtual machine", "Disk")
- `kind` - Resource kind (optional)
- `Location` - Azure region
- `Subscription` - Subscription name
- `Resource group` - Resource group name
- `Tags` - JSON string with tags
- `extendedLocation` - Extended location (optional)

### Example Tags JSON

```json
{
  "AppID": "AP2411",
  "AppName": "UDP", 
  "Vendor": "Databricks",
  "Environment": "PRD",
  "Provisioner": "Terraform",
  "AdminName": "admin@company.com"
}
```

## Key Features

### Smart Data Processing

- **Duplicate Prevention**: Uses caching to avoid duplicate subscriptions, resource groups, and applications
- **Tag Parsing**: Extracts key tags (AppID, Environment, Vendor, etc.) for easy querying
- **JSON Storage**: Preserves complete tag information as JSONB for flexible queries
- **Null Handling**: Properly handles null/empty values in CSV data

### Performance Optimizations

- **Batch Processing**: Processes records in batches with progress logging
- **Connection Pooling**: Uses SQLx connection pooling for database efficiency
- **Prepared Statements**: All queries use prepared statements for security and performance
- **Indexes**: Creates appropriate indexes for common query patterns

### Error Handling

- **Graceful Failures**: Continues processing even if individual records fail
- **Detailed Logging**: Comprehensive logging for debugging and monitoring
- **Transaction Safety**: Uses proper error handling to maintain data consistency

## Querying the Data

After import, you can query the data using standard SQL:

```sql
-- Find all resources for a specific application
SELECT r.name, r.type, r.location 
FROM resource r
JOIN resource_application_map ram ON r.id = ram.resource_id
JOIN application a ON ram.application_id = a.id
WHERE a.code = 'AP2411';

-- Find resources by tag
SELECT r.name, rt.key, rt.value
FROM resource r
JOIN resource_tag rt ON r.id = rt.resource_id
WHERE rt.key = 'Environment' AND rt.value = 'PRD';

-- Use JSONB queries for complex tag searches
SELECT name, tags_json->'ClusterName' as cluster_name
FROM resource 
WHERE tags_json->>'Vendor' = 'Databricks';
```

## Logging

Set the `RUST_LOG` environment variable to control logging levels:
```bash
export RUST_LOG=info  # info, debug, warn, error
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL in .env file
   - Ensure PostgreSQL is running
   - Verify database exists

2. **CSV File Not Found**
   - Ensure CSV file is at `datasets/AzureResourceGraphFormattedResults-Query.csv`
   - Check file permissions

3. **Import Errors**
   - Check CSV format matches expected columns
   - Review logs for specific error messages
   - Ensure JSON tags are properly formatted

### Performance Tips

- For large CSV files (>100k records), consider increasing PostgreSQL's `shared_buffers`
- Monitor memory usage during import
- Use `RUST_LOG=warn` for faster imports with less logging

## Development

### Building
```bash
cargo build --bin import
```

### Testing
```bash
cargo test
```

### Code Structure
- `src/bin/import.rs` - Main import logic
- `sql/create_tables.sql` - Database schema
- `datasets/` - CSV data files
