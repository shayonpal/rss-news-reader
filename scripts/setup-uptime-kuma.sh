#!/bin/bash

# Uptime Kuma Setup Script for RSS News Reader
# This script sets up Uptime Kuma for external monitoring of all RSS Reader services

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
KUMA_PORT=3080
KUMA_CONTAINER_NAME="uptime-kuma"
KUMA_VOLUME_NAME="uptime-kuma-data"
KUMA_IMAGE="louislam/uptime-kuma:1"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if Colima is running
check_colima() {
    echo "Checking Colima status..."
    if ! colima status &>/dev/null; then
        print_error "Colima is not running. Please start it with: colima start"
        exit 1
    fi
    print_status "Colima is running"
}

# Check if Docker is accessible
check_docker() {
    echo "Checking Docker access..."
    if ! docker info &>/dev/null; then
        print_error "Docker is not accessible. Please check your Colima setup"
        exit 1
    fi
    print_status "Docker is accessible"
}

# Check if port is available
check_port() {
    echo "Checking if port $KUMA_PORT is available..."
    if lsof -Pi :$KUMA_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_error "Port $KUMA_PORT is already in use"
        echo "Please stop the service using this port or choose a different port"
        exit 1
    fi
    print_status "Port $KUMA_PORT is available"
}

# Check if Uptime Kuma is already running
check_existing_container() {
    echo "Checking for existing Uptime Kuma container..."
    if docker ps -a --format '{{.Names}}' | grep -q "^${KUMA_CONTAINER_NAME}$"; then
        print_warning "Found existing Uptime Kuma container"
        
        # Check if it's running
        if docker ps --format '{{.Names}}' | grep -q "^${KUMA_CONTAINER_NAME}$"; then
            print_status "Uptime Kuma is already running"
            echo "Access it at: http://localhost:$KUMA_PORT"
            exit 0
        else
            # Container exists but not running
            echo "Starting existing container..."
            docker start $KUMA_CONTAINER_NAME
            print_status "Uptime Kuma started"
            echo "Access it at: http://localhost:$KUMA_PORT"
            exit 0
        fi
    fi
}

# Deploy Uptime Kuma
deploy_uptime_kuma() {
    echo "Deploying Uptime Kuma..."
    
    # Create volume if it doesn't exist
    if ! docker volume ls --format '{{.Name}}' | grep -q "^${KUMA_VOLUME_NAME}$"; then
        echo "Creating data volume..."
        docker volume create $KUMA_VOLUME_NAME
        print_status "Data volume created"
    fi
    
    # Run Uptime Kuma container
    echo "Starting Uptime Kuma container..."
    docker run -d \
        --name $KUMA_CONTAINER_NAME \
        --restart unless-stopped \
        -p $KUMA_PORT:3001 \
        -v $KUMA_VOLUME_NAME:/app/data \
        $KUMA_IMAGE
    
    print_status "Uptime Kuma container started"
}

# Wait for Uptime Kuma to be ready
wait_for_kuma() {
    echo "Waiting for Uptime Kuma to be ready..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:$KUMA_PORT | grep -q "200\|302"; then
            print_status "Uptime Kuma is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    echo ""
    print_error "Uptime Kuma failed to start after 60 seconds"
    return 1
}

# Create monitoring configuration script
create_monitor_config() {
    cat > scripts/configure-uptime-kuma-monitors.js << 'EOF'
// Uptime Kuma Monitor Configuration for RSS News Reader
// This script should be run after initial setup to configure monitors

const monitors = [
    {
        name: "RSS Reader - Production App",
        type: "http",
        url: "http://100.96.166.53:3147/reader/api/health/app?ping=true",
        interval: 60,
        retryInterval: 20,
        maxretries: 3,
        accepted_statuscodes: ["200"],
        description: "Main production RSS Reader application"
    },
    {
        name: "RSS Reader - Sync Server",
        type: "http",
        url: "http://localhost:3001/server/health",
        interval: 60,
        retryInterval: 20,
        maxretries: 3,
        accepted_statuscodes: ["200"],
        description: "Bi-directional sync server"
    },
    {
        name: "RSS Reader - Dev App",
        type: "http",
        url: "http://100.96.166.53:3000/reader/api/health/app?ping=true",
        interval: 300,  // Check dev less frequently
        retryInterval: 60,
        maxretries: 2,
        accepted_statuscodes: ["200"],
        description: "Development RSS Reader application"
    },
    {
        name: "RSS Reader - Database",
        type: "http",
        url: "http://100.96.166.53:3147/reader/api/health/db",
        interval: 300,
        retryInterval: 60,
        maxretries: 3,
        accepted_statuscodes: ["200"],
        description: "Supabase database connection"
    },
    {
        name: "RSS Reader - Production Port",
        type: "port",
        hostname: "100.96.166.53",
        port: 3147,
        interval: 300,
        retryInterval: 60,
        maxretries: 3,
        description: "Production application port"
    },
    {
        name: "RSS Reader - Sync Port",
        type: "port",
        hostname: "localhost",
        port: 3001,
        interval: 300,
        retryInterval: 60,
        maxretries: 3,
        description: "Sync server port"
    }
];

console.log("Monitor Configuration for Uptime Kuma");
console.log("=====================================");
console.log("");
console.log("Please add these monitors manually in Uptime Kuma:");
console.log("");

monitors.forEach((monitor, index) => {
    console.log(`${index + 1}. ${monitor.name}`);
    console.log(`   Type: ${monitor.type}`);
    console.log(`   URL/Host: ${monitor.url || monitor.hostname}`);
    if (monitor.port) console.log(`   Port: ${monitor.port}`);
    console.log(`   Interval: ${monitor.interval}s`);
    console.log(`   Description: ${monitor.description}`);
    console.log("");
});

console.log("Discord Webhook Configuration:");
console.log("==============================");
console.log("URL: https://discord.com/api/webhooks/1398487627765649498/n6mIouChkYqBCL67vj5Jbn0X0XP3uU_rFXhSRcRmQdE2yiJBcvPL7sF9VphClpie5ObE");
console.log("Bot Display Name: Uptime Kuma - RSS Reader");
console.log("");

console.log("For Cron Monitoring (Push Monitor):");
console.log("===================================");
console.log("Create a 'Push' type monitor and add this to your cron job:");
console.log("curl -s http://localhost:3080/api/push/[PUSH_KEY]");
EOF
    
    chmod +x scripts/configure-uptime-kuma-monitors.js
    print_status "Monitor configuration script created"
}

# Print success message and next steps
print_success() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}Uptime Kuma has been successfully deployed!${NC}"
    echo "=========================================="
    echo ""
    echo "Access Uptime Kuma at: http://localhost:$KUMA_PORT"
    echo ""
    echo "First-time setup:"
    echo "1. Open http://localhost:$KUMA_PORT in your browser"
    echo "2. Create an admin account"
    echo "3. Run 'node scripts/configure-uptime-kuma-monitors.js' to see monitor configs"
    echo "4. Add the monitors manually through the UI"
    echo "5. Configure Discord notifications in Settings > Notifications"
    echo ""
    echo "Useful commands:"
    echo "- View logs: docker logs $KUMA_CONTAINER_NAME"
    echo "- Stop: docker stop $KUMA_CONTAINER_NAME"
    echo "- Start: docker start $KUMA_CONTAINER_NAME"
    echo "- Remove: docker rm -f $KUMA_CONTAINER_NAME"
    echo ""
}

# Main execution
main() {
    echo "🚀 Setting up Uptime Kuma for RSS News Reader"
    echo ""
    
    # Run checks
    check_colima
    check_docker
    check_port
    check_existing_container
    
    # Deploy
    deploy_uptime_kuma
    
    # Wait for it to be ready
    if wait_for_kuma; then
        create_monitor_config
        print_success
    else
        print_error "Failed to deploy Uptime Kuma"
        echo "Check logs with: docker logs $KUMA_CONTAINER_NAME"
        exit 1
    fi
}

# Run main function
main