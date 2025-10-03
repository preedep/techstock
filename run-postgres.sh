#!/bin/bash

# PostgreSQL Docker Runner Script
# This script runs PostgreSQL in Docker with data persistence

set -e

# Load environment variables from .env file
if [ -f ".env" ]; then
    echo -e "\033[0;32m[INFO]\033[0m Loading configuration from .env file..."
    export $(grep -v '^#' .env | xargs)
else
    echo -e "\033[0;31m[ERROR]\033[0m .env file not found. Please create .env file with PostgreSQL configuration."
    exit 1
fi

# Configuration
POSTGRES_VERSION="15"
CONTAINER_NAME="techstock-postgres"
POSTGRES_PORT="5432"
DATA_DIR="$PWD/data"

# Validate required environment variables
if [ -z "$POSTGRES_DB" ] || [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ]; then
    echo -e "\033[0;31m[ERROR]\033[0m Missing required environment variables in .env file:"
    echo -e "\033[0;31m[ERROR]\033[0m Required: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Create data directory if it doesn't exist
if [ ! -d "$DATA_DIR" ]; then
    print_status "Creating data directory: $DATA_DIR"
    mkdir -p "$DATA_DIR"
fi

# Check if container already exists
if docker ps -a --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    print_warning "Container '$CONTAINER_NAME' already exists."
    
    # Check if it's running
    if docker ps --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_status "Container is already running."
        print_status "PostgreSQL is available at localhost:$POSTGRES_PORT"
        print_status "Database: $POSTGRES_DB"
        print_status "Username: $POSTGRES_USER"
        exit 0
    else
        print_status "Starting existing container..."
        docker start "$CONTAINER_NAME"
        print_status "PostgreSQL started successfully!"
        print_status "PostgreSQL is available at localhost:$POSTGRES_PORT"
        exit 0
    fi
fi

# Run new PostgreSQL container
print_status "Starting new PostgreSQL container..."
print_status "Data will be persisted in: $DATA_DIR"

docker run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -p "$POSTGRES_PORT:5432" \
    -v "$DATA_DIR:/var/lib/postgresql/data" \
    --restart unless-stopped \
    postgres:"$POSTGRES_VERSION"

# Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to be ready..."
sleep 5

# Check if PostgreSQL is responding
for i in {1..30}; do
    if docker exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; then
        print_status "PostgreSQL is ready!"
        break
    fi
    
    if [ $i -eq 30 ]; then
        print_error "PostgreSQL failed to start within 30 seconds"
        print_error "Check container logs: docker logs $CONTAINER_NAME"
        exit 1
    fi
    
    sleep 1
done

print_status "PostgreSQL container started successfully!"
echo
print_status "Connection Details:"
echo "  Host: localhost"
echo "  Port: $POSTGRES_PORT"
echo "  Database: $POSTGRES_DB"
echo "  Username: $POSTGRES_USER"
echo "  Password: $POSTGRES_PASSWORD"
echo
print_status "Useful Commands:"
echo "  Stop container:    docker stop $CONTAINER_NAME"
echo "  Start container:   docker start $CONTAINER_NAME"
echo "  Remove container:  docker rm -f $CONTAINER_NAME"
echo "  View logs:         docker logs $CONTAINER_NAME"
echo "  Connect to DB:     docker exec -it $CONTAINER_NAME psql -U $POSTGRES_USER -d $POSTGRES_DB"
echo
print_status "Data is persisted in: $DATA_DIR"
