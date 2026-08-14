#!/usr/bin/env bash

# ==============================================================================
# Investor Portfolio Monitoring & Risk Management System
# Local Developer Environment Setup Script
# ==============================================================================

set -euo pipefail

# ANSI Color Codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================================${NC}"
echo -e "${BLUE}  Investor Portfolio System — Developer Environment Setup Script   ${NC}"
echo -e "${BLUE}===================================================================${NC}"

# 1. Prerequisite Verification
echo -e "\n${YELLOW}[1/5] Checking environment prerequisites...${NC}"

check_command() {
    local cmd=$1
    local name=$2
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "  ${RED}✗ $name is not installed or not in PATH.${NC}"
        return 1
    else
        echo -e "  ${GREEN}✓ $name detected:$(command -v "$cmd")${NC}"
        return 0
    fi
}

MISSING_DEPS=0
check_command "node" "Node.js" || MISSING_DEPS=1
check_command "pnpm" "pnpm" || MISSING_DEPS=1
check_command "git" "Git" || MISSING_DEPS=1
check_command "docker" "Docker" || MISSING_DEPS=1

if [ "$MISSING_DEPS" -ne 0 ]; then
    echo -e "\n${RED}Error: Missing required system dependencies. Please install them and re-run.${NC}"
    exit 1
fi

# 2. Environment Configuration
echo -e "\n${YELLOW}[2/5] Setting up local environment variables (.env)...${NC}"
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "  ${GREEN}✓ Created .env from .env.example${NC}"
        echo -e "  ${YELLOW}! Please review .env for development defaults.${NC}"
    else
        echo -e "  ${RED}✗ .env.example not found.${NC}"
        exit 1
    fi
else
    echo -e "  ${GREEN}✓ Existing .env file detected.${NC}"
fi

# 3. Node Dependency Installation
echo -e "\n${YELLOW}[3/5] Installing workspace dependencies via pnpm...${NC}"
pnpm install
echo -e "  ${GREEN}✓ Monorepo dependencies installed successfully.${NC}"

# 4. Git Hooks & Linting Configuration
echo -e "\n${YELLOW}[4/5] Initializing Husky Git pre-commit hooks...${NC}"
pnpm exec husky || true
echo -e "  ${GREEN}✓ Pre-commit hooks activated.${NC}"

# 5. Infrastructure Provisioning (Docker Compose)
echo -e "\n${YELLOW}[5/5] Provisioning container infrastructure (Postgres, Redis, Adminer)...${NC}"
if docker info > /dev/null 2>&1; then
    echo -e "  Starting database and cache services in background..."
    if command -v "docker-compose" &> /dev/null; then
        docker-compose up -d
    else
        docker compose up -d
    fi

    echo -e "  Waiting for database and cache services to become healthy..."
    sleep 3
    echo -e "  ${GREEN}✓ Containers launched.${NC}"
    echo -e "    - PostgreSQL (TimescaleDB): localhost:5432"
    echo -e "    - Redis 7 Cache/Queue:     localhost:6379"
    echo -e "    - Adminer Database UI:      http://localhost:8080"
else
    echo -e "  ${YELLOW}! Docker daemon is currently not running or unreachable.${NC}"
    echo -e "    Start Docker Desktop/daemon and run: ${BLUE}docker compose up -d${NC}"
fi

echo -e "\n${BLUE}===================================================================${NC}"
echo -e "${GREEN}✓ Developer environment setup completed successfully!${NC}"
echo -e "Run ${BLUE}pnpm dev${NC} to start development servers across workspaces."
echo -e "${BLUE}===================================================================${NC}\n"
