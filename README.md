# Wealth Compass: Investor Portfolio Monitoring & Risk Management System

An enterprise-grade, multi-tenant financial aggregation, quantitative risk analytics, and portfolio monitoring platform tailored for the **Indian Financial Ecosystem**.

## 🚀 Overview

Wealth Compass solves the problem of financial data fragmentation for retail and high-net-worth investors holding assets across multiple platforms (brokerages, mutual fund portals, banks, crypto exchanges, and real estate). It acts as a central command center providing a unified net worth view, asset allocation analysis, and deep quantitative risk metrics.

## ✨ Key Features

- **Multi-Platform Ingestion**: Aggregates data from NSE/BSE brokers (Zerodha, Upstox), CAMS/KFintech Mutual Fund CAS statements, and the RBI Account Aggregator framework.
- **Deterministic Valuation Engine**: Fixed-precision `Decimal(18,8)` math to eliminate floating-point inaccuracies. Calculates FIFO and Weighted Average cost basis.
- **Quantitative Risk Analytics**: High-performance Python engine calculating Time-Weighted Return (TWR), XIRR, Volatility, Sharpe Ratio, Sortino Ratio, Beta, and Value at Risk (VaR).
- **Concentration & Diversification**: Herfindahl-Hirschman Index (HHI) concentration tracking and correlation-weighted diversification scoring.
- **Indian Financial Year Engine**: Automated 31st March midnight portfolio snapshots and generation of ITR-ready Capital Gains (STCG/LTCG) tax reports.
- **Automated Alerting**: Configurable rules for portfolio drawdown, volatility spikes, and pre-March 31st tax-loss harvesting opportunities.

## 🛠️ Technology Stack

- **Architecture**: Modular Monolith (NestJS) + Python Microservice (FastAPI) in a Turborepo Workspace.
- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Shadcn UI, Recharts.
- **Mobile**: React Native, Expo.
- **Backend**: NestJS, TypeScript, PostgreSQL 16, Prisma ORM, Redis 7, BullMQ.
- **Quant Service**: Python 3.11, FastAPI, NumPy, pandas, SciPy.
- **DevOps**: Docker, GitHub Actions, AWS (ECS Fargate, RDS, ElastiCache).

## 📦 Project Structure

This project uses a [Turborepo](https://turbo.build/) monorepo structure:

- `apps/api`: NestJS REST Backend
- `apps/web`: Next.js 14 Web Frontend
- `apps/mobile`: React Native Expo Mobile App
- `services/analytics`: Python FastAPI Quantitative Service
- `packages/*`: Shared configurations, UI components, and TypeScript DTOs.

## 🚀 Quick Start

Ensure you have [Docker](https://www.docker.com/), [Node.js](https://nodejs.org/) (v20+), and [pnpm](https://pnpm.io/) installed.

1. **Install dependencies:**
   ```bash
   pnpm install
   ```
2. **Start Infrastructure (PostgreSQL & Redis):**
   ```bash
   docker-compose up -d
   ```
3. **Run Database Migrations:**
   ```bash
   pnpm --filter api run db:migrate
   ```
4. **Start Development Servers:**
   ```bash
   pnpm dev
   ```

## 📄 License

This project is licensed under the MIT License.
