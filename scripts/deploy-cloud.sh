#!/bin/bash
set -e

# BotBrain Cloud Deployment Script
# This script automates the deployment of BotBrain to a production cloud VM

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        print_error "Please do not run this script as root"
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command_exists "docker compose"; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    if ! docker ps >/dev/null 2>&1; then
        print_error "Current user cannot access Docker. Add user to docker group:"
        print_error "  sudo usermod -aG docker \$USER"
        print_error "  newgrp docker"
        exit 1
    fi

    if ! command_exists tailscale; then
        print_warn "Tailscale is not installed. Remote robot access will not work."
        print_warn "Install Tailscale: curl -fsSL https://tailscale.com/install.sh | sh"
    fi

    print_info "Prerequisites check passed"
}

# Function to check environment file
check_env_file() {
    print_info "Checking environment configuration..."

    if [ ! -f .env.production ]; then
        print_error ".env.production file not found"
        print_error "Copy .env.production.example to .env.production and configure it:"
        print_error "  cp .env.production.example .env.production"
        print_error "  nano .env.production"
        exit 1
    fi

    # Source environment file
    set -a
    source .env.production
    set +a

    # Check required variables
    local required_vars=("DOMAIN" "NEXT_PUBLIC_SUPABASE_URL" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "NEXT_PUBLIC_APP_URL")
    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            print_error "  - $var"
        done
        print_error "Please configure .env.production"
        exit 1
    fi

    print_info "Environment configuration OK"
    print_info "Domain: $DOMAIN"
}

# Function to check DNS
check_dns() {
    print_info "Checking DNS configuration..."

    if [ "$DOMAIN" = "localhost" ]; then
        print_warn "Domain is set to localhost - skipping DNS check"
        return
    fi

    # Get public IP
    PUBLIC_IP=$(curl -s ifconfig.me)
    print_info "Public IP: $PUBLIC_IP"

    # Check DNS resolution
    RESOLVED_IP=$(dig +short "$DOMAIN" A | tail -n1)

    if [ -z "$RESOLVED_IP" ]; then
        print_warn "DNS record not found for $DOMAIN"
        print_warn "Please create an A record pointing to $PUBLIC_IP"
        print_warn "Deployment will continue, but HTTPS will not work until DNS is configured"
    elif [ "$RESOLVED_IP" != "$PUBLIC_IP" ]; then
        print_warn "DNS mismatch:"
        print_warn "  DNS points to: $RESOLVED_IP"
        print_warn "  Server IP is: $PUBLIC_IP"
        print_warn "Please update DNS to point to $PUBLIC_IP"
    else
        print_info "DNS correctly configured: $DOMAIN -> $PUBLIC_IP"
    fi
}

# Function to check Tailscale
check_tailscale() {
    if ! command_exists tailscale; then
        print_warn "Tailscale not installed - skipping Tailscale check"
        return
    fi

    print_info "Checking Tailscale..."

    if ! sudo tailscale status >/dev/null 2>&1; then
        print_warn "Tailscale is not running or not authenticated"
        print_warn "Run: sudo tailscale up"
    else
        TAILSCALE_IP=$(sudo tailscale ip -4)
        print_info "Tailscale IP: $TAILSCALE_IP"
    fi
}

# Function to setup z4rtc (if needed)
setup_z4rtc() {
    if [ ! -d "./z4rtc" ]; then
        print_warn "z4rtc directory not found"
        print_warn "If you need z4rtc support, clone it:"
        print_warn "  git clone https://github.com/z4ziggy/z4rtc.git ./z4rtc"
    else
        print_info "z4rtc found at ./z4rtc"
    fi
}

# Function to build images
build_images() {
    print_info "Building Docker images..."

    if ! docker compose -f docker-compose.production.yaml build; then
        print_error "Failed to build Docker images"
        exit 1
    fi

    print_info "Docker images built successfully"
}

# Function to start services
start_services() {
    print_info "Starting services..."

    if ! docker compose -f docker-compose.production.yaml up -d; then
        print_error "Failed to start services"
        exit 1
    fi

    print_info "Services started successfully"
}

# Function to wait for services
wait_for_services() {
    print_info "Waiting for services to be ready..."

    # Wait for frontend
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:3000 >/dev/null 2>&1; then
            print_info "Frontend is ready"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        print_warn "Frontend did not become ready in time"
    fi

    # Wait for z4rtc bridge
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost/z4rtc/health >/dev/null 2>&1; then
            print_info "z4rtc bridge is ready"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        print_warn "z4rtc bridge did not become ready in time"
    fi
}

# Function to verify deployment
verify_deployment() {
    print_info "Verifying deployment..."

    # Check containers
    local containers=("botbrain_caddy" "botbrain_frontend" "botbrain_z4rtc_bridge")
    local all_running=true

    for container in "${containers[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            print_info "✓ $container is running"
        else
            print_error "✗ $container is not running"
            all_running=false
        fi
    done

    if [ "$all_running" = false ]; then
        print_error "Some containers are not running. Check logs:"
        print_error "  docker compose -f docker-compose.production.yaml logs"
        exit 1
    fi

    # Check HTTP access
    if curl -s http://localhost >/dev/null 2>&1; then
        print_info "✓ HTTP access working"
    else
        print_error "✗ HTTP access not working"
    fi

    # Check z4rtc
    if curl -s http://localhost/z4rtc/health >/dev/null 2>&1; then
        print_info "✓ z4rtc bridge working"
    else
        print_warn "✗ z4rtc bridge not responding"
    fi

    print_info "Deployment verification complete"
}

# Function to show next steps
show_next_steps() {
    echo ""
    echo "========================================"
    echo "  BotBrain Deployment Complete!"
    echo "========================================"
    echo ""
    print_info "Next steps:"
    echo ""
    echo "1. Verify HTTPS is working:"
    echo "   https://$DOMAIN"
    echo ""
    echo "2. Create your first account:"
    echo "   Open the URL above and sign up"
    echo ""
    echo "3. Enroll robots:"
    echo "   See docs/ROBOT_ENROLLMENT.md"
    echo ""
    echo "4. Monitor services:"
    echo "   docker compose -f docker-compose.production.yaml logs -f"
    echo ""
    echo "5. Check Caddy logs for HTTPS certificate:"
    echo "   docker logs botbrain_caddy"
    echo ""

    if command_exists tailscale; then
        if sudo tailscale status >/dev/null 2>&1; then
            TAILSCALE_IP=$(sudo tailscale ip -4)
            echo "6. Your Tailscale IP: $TAILSCALE_IP"
            echo "   Robots should connect to this IP"
            echo ""
        fi
    fi

    echo "For troubleshooting, see:"
    echo "  docs/TROUBLESHOOTING_CLOUD.md"
    echo ""
}

# Main deployment flow
main() {
    echo ""
    echo "========================================"
    echo "  BotBrain Cloud Deployment"
    echo "========================================"
    echo ""

    check_root
    check_prerequisites
    check_env_file
    check_dns
    check_tailscale
    setup_z4rtc
    build_images
    start_services
    wait_for_services
    verify_deployment
    show_next_steps
}

# Run main function
main "$@"
