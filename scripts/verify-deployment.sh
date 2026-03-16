#!/bin/bash

# BotBrain Deployment Verification Script
# This script verifies that a BotBrain cloud deployment is working correctly

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Function to print colored output
print_pass() {
    echo -e "${GREEN}✓ PASS${NC} $1"
    PASSED=$((PASSED + 1))
}

print_fail() {
    echo -e "${RED}✗ FAIL${NC} $1"
    FAILED=$((FAILED + 1))
}

print_warn() {
    echo -e "${YELLOW}⚠ WARN${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

print_info() {
    echo -e "${BLUE}ℹ INFO${NC} $1"
}

print_header() {
    echo ""
    echo "========================================"
    echo "  $1"
    echo "========================================"
    echo ""
}

# Load environment
load_environment() {
    if [ -f .env.production ]; then
        set -a
        source .env.production
        set +a
    else
        print_fail "Environment file .env.production not found"
        exit 1
    fi
}

# Check Docker containers
check_containers() {
    print_header "Docker Containers"

    local containers=("botbrain_caddy" "botbrain_frontend" "botbrain_z4rtc_bridge")

    for container in "${containers[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            local status=$(docker inspect --format='{{.State.Status}}' "$container")
            if [ "$status" = "running" ]; then
                print_pass "$container is running"
            else
                print_fail "$container exists but is not running (status: $status)"
            fi
        else
            print_fail "$container is not found"
        fi
    done
}

# Check network connectivity
check_network() {
    print_header "Network Connectivity"

    # Check localhost access
    if curl -s -o /dev/null http://localhost; then
        print_pass "Localhost HTTP access working"
    else
        print_fail "Cannot access localhost HTTP"
    fi

    # Check frontend direct access
    if curl -s -o /dev/null http://localhost:3000; then
        print_pass "Frontend direct access working (port 3000)"
    else
        print_warn "Frontend not accessible on port 3000"
    fi

    # Check public domain if not localhost
    if [ "$DOMAIN" != "localhost" ]; then
        if curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" | grep -q "^[23]"; then
            print_pass "Public HTTP access working"
        else
            print_fail "Cannot access http://$DOMAIN"
        fi

        if curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" | grep -q "^[23]"; then
            print_pass "Public HTTPS access working"
        else
            print_fail "Cannot access https://$DOMAIN"
        fi
    fi
}

# Check z4rtc bridge
check_z4rtc() {
    print_header "z4rtc Bridge"

    local health_response=$(curl -s http://localhost/z4rtc/health)

    if [ -n "$health_response" ]; then
        if echo "$health_response" | grep -q '"ok".*true'; then
            print_pass "z4rtc bridge is healthy"
            print_info "Response: $health_response"
        else
            print_fail "z4rtc bridge returned unhealthy response"
        fi
    else
        print_fail "z4rtc bridge is not responding"
    fi
}

# Check SSL certificate
check_ssl() {
    print_header "SSL Certificate"

    if [ "$DOMAIN" = "localhost" ]; then
        print_warn "Domain is localhost, skipping SSL check"
        return
    fi

    # Check if certificate exists in Caddy
    if docker exec botbrain_caddy ls /data/caddy/certificates 2>/dev/null | grep -q "$DOMAIN"; then
        print_pass "SSL certificate found for $DOMAIN"

        # Check certificate expiry
        local expiry=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
        if [ -n "$expiry" ]; then
            print_info "Certificate expires: $expiry"
        fi
    else
        print_fail "SSL certificate not found for $DOMAIN"
        print_info "Check Caddy logs: docker logs botbrain_caddy"
    fi
}

# Check DNS
check_dns() {
    print_header "DNS Configuration"

    if [ "$DOMAIN" = "localhost" ]; then
        print_warn "Domain is localhost, skipping DNS check"
        return
    fi

    if ! command -v dig >/dev/null 2>&1; then
        print_warn "dig command not found, skipping DNS check"
        return
    fi

    local public_ip=$(curl -s ifconfig.me)
    local resolved_ip=$(dig +short "$DOMAIN" A | tail -n1)

    if [ -z "$resolved_ip" ]; then
        print_fail "DNS record not found for $DOMAIN"
    elif [ "$resolved_ip" = "$public_ip" ]; then
        print_pass "DNS correctly points to $public_ip"
    else
        print_fail "DNS mismatch: $DOMAIN points to $resolved_ip but server is $public_ip"
    fi
}

# Check Tailscale
check_tailscale() {
    print_header "Tailscale Network"

    if ! command -v tailscale >/dev/null 2>&1; then
        print_warn "Tailscale not installed"
        return
    fi

    if sudo tailscale status >/dev/null 2>&1; then
        print_pass "Tailscale is running"
        local tailscale_ip=$(sudo tailscale ip -4)
        print_info "Tailscale IP: $tailscale_ip"

        # Count connected peers
        local peer_count=$(sudo tailscale status | grep -v "^#" | tail -n +2 | wc -l)
        print_info "Connected peers: $peer_count"
    else
        print_fail "Tailscale is not running or not authenticated"
        print_info "Run: sudo tailscale up"
    fi
}

# Check Supabase connectivity
check_supabase() {
    print_header "Supabase Connectivity"

    if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
        print_fail "NEXT_PUBLIC_SUPABASE_URL not set"
        return
    fi

    # Check if Supabase URL is reachable
    if curl -s -o /dev/null "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"; then
        print_pass "Supabase API is reachable"
    else
        print_fail "Cannot reach Supabase API at $NEXT_PUBLIC_SUPABASE_URL"
    fi
}

# Check container logs for errors
check_logs() {
    print_header "Container Logs (Recent Errors)"

    local has_errors=false

    # Check Caddy logs
    if docker logs botbrain_caddy --tail 50 2>&1 | grep -i error | grep -v "no error" >/dev/null; then
        print_warn "Errors found in Caddy logs"
        has_errors=true
    fi

    # Check frontend logs
    if docker logs botbrain_frontend --tail 50 2>&1 | grep -i error >/dev/null; then
        print_warn "Errors found in frontend logs"
        has_errors=true
    fi

    # Check z4rtc logs
    if docker logs botbrain_z4rtc_bridge --tail 50 2>&1 | grep -i error >/dev/null; then
        print_warn "Errors found in z4rtc bridge logs"
        has_errors=true
    fi

    if [ "$has_errors" = false ]; then
        print_pass "No recent errors in container logs"
    else
        print_info "To view detailed logs: docker compose -f docker-compose.production.yaml logs"
    fi
}

# Check disk space
check_disk_space() {
    print_header "Disk Space"

    local available=$(df -h / | awk 'NR==2 {print $4}')
    local usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

    if [ "$usage" -lt 80 ]; then
        print_pass "Disk space OK ($available available, $usage% used)"
    elif [ "$usage" -lt 90 ]; then
        print_warn "Disk space getting low ($available available, $usage% used)"
    else
        print_fail "Disk space critical ($available available, $usage% used)"
    fi
}

# Check firewall
check_firewall() {
    print_header "Firewall"

    if ! command -v ufw >/dev/null 2>&1; then
        print_warn "UFW not installed"
        return
    fi

    if sudo ufw status | grep -q "Status: active"; then
        print_pass "Firewall is active"

        # Check required ports
        local required_ports=("80/tcp" "443/tcp")
        for port in "${required_ports[@]}"; do
            if sudo ufw status | grep -q "$port.*ALLOW"; then
                print_pass "Port $port is open"
            else
                print_fail "Port $port is not open"
            fi
        done

        # Check Tailscale port
        if sudo ufw status | grep -q "41641/udp.*ALLOW"; then
            print_pass "Tailscale port 41641/udp is open"
        else
            print_warn "Tailscale port 41641/udp not explicitly allowed (may still work)"
        fi
    else
        print_warn "Firewall is not active"
    fi
}

# Test end-to-end flow
test_e2e() {
    print_header "End-to-End Test"

    local test_url
    if [ "$DOMAIN" = "localhost" ]; then
        test_url="http://localhost"
    else
        test_url="https://$DOMAIN"
    fi

    # Test homepage
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$test_url")
    if [ "$response" = "200" ]; then
        print_pass "Homepage loads successfully"
    else
        print_fail "Homepage returned status $response"
    fi

    # Test z4rtc health
    local z4rtc_health=$(curl -s "$test_url/z4rtc/health")
    if echo "$z4rtc_health" | grep -q '"ok".*true'; then
        print_pass "z4rtc health endpoint working"
    else
        print_fail "z4rtc health endpoint not working"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo "========================================"
    echo "  Verification Summary"
    echo "========================================"
    echo ""
    echo "Total Checks:"
    echo "  Passed:   $PASSED"
    echo "  Failed:   $FAILED"
    echo "  Warnings: $WARNINGS"
    echo ""

    if [ $FAILED -eq 0 ]; then
        print_pass "All critical checks passed!"
        echo ""
        echo "Your BotBrain deployment appears to be working correctly."
        echo ""
        if [ $WARNINGS -gt 0 ]; then
            echo "Note: There are $WARNINGS warnings that you may want to address."
        fi
        echo ""
        echo "Next steps:"
        echo "  1. Create an account at https://$DOMAIN"
        echo "  2. Enroll your robots (see docs/ROBOT_ENROLLMENT.md)"
        echo "  3. Start controlling robots remotely!"
        echo ""
        exit 0
    else
        print_fail "Deployment has issues that need attention"
        echo ""
        echo "Please fix the failed checks above."
        echo ""
        echo "For help:"
        echo "  - Check logs: docker compose -f docker-compose.production.yaml logs"
        echo "  - See troubleshooting: docs/TROUBLESHOOTING_CLOUD.md"
        echo ""
        exit 1
    fi
}

# Main function
main() {
    print_header "BotBrain Deployment Verification"

    load_environment

    check_containers
    check_network
    check_z4rtc
    check_ssl
    check_dns
    check_tailscale
    check_supabase
    check_logs
    check_disk_space
    check_firewall
    test_e2e

    print_summary
}

# Run main
main "$@"
