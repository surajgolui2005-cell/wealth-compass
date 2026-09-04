# API Contract — Wealth Compass REST API v1

Live documentation: `http://localhost:3000/api/docs`

## Response Envelopes

### Success
```json
{
  "success": true,
  "data": <T>,
  "meta": {
    "timestamp": "2026-09-04T12:00:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": ["name must be a string", "amount must be positive"]
  },
  "timestamp": "2026-09-04T12:00:00.000Z",
  "path": "/api/v1/portfolios"
}
```

### Error Codes

| HTTP Status | code |
|---|---|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 422 | `UNPROCESSABLE_ENTITY` |
| 429 | `TOO_MANY_REQUESTS` |
| 500 | `INTERNAL_SERVER_ERROR` |

---

## Authentication

All protected endpoints require a JWT Bearer token in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

Refresh tokens are exchanged via HTTP-only cookie (`refresh_token`).

---

## Endpoints

### Auth `/api/v1/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | None | Register new user |
| `POST` | `/api/v1/auth/login` | None | Authenticate and receive JWT + refresh cookie |
| `POST` | `/api/v1/auth/refresh` | Cookie | Exchange refresh token for new access token |
| `POST` | `/api/v1/auth/logout` | JWT | Revoke refresh token |
| `GET` | `/api/v1/auth/me` | JWT | Get authenticated user profile |

#### POST /api/v1/auth/register
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```
**Success (201):** `data: { id, email, name, createdAt }`

#### POST /api/v1/auth/login
**Request Body:**
```json
{ "email": "user@example.com", "password": "SecurePass123!" }
```
**Success (200):** `data: { accessToken, user: { id, email, name } }` + `Set-Cookie: refresh_token`

---

### Portfolios `/api/v1/portfolios`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/portfolios` | JWT | List all portfolios for user |
| `POST` | `/api/v1/portfolios` | JWT | Create a portfolio |
| `GET` | `/api/v1/portfolios/:id` | JWT | Get portfolio by ID |
| `PUT` | `/api/v1/portfolios/:id` | JWT | Update portfolio |
| `DELETE` | `/api/v1/portfolios/:id` | JWT | Soft-delete portfolio |
| `GET` | `/api/v1/portfolios/:id/summary` | JWT | Portfolio value + allocation summary |
| `POST` | `/api/v1/portfolios/:id/recalculate` | JWT | Trigger portfolio valuation refresh |

#### POST /api/v1/portfolios
**Request Body:**
```json
{
  "name": "My Growth Portfolio",
  "currency": "INR",
  "description": "Long-term equity portfolio"
}
```
**Success (201):** `data: { id, name, currency, totalValue, createdAt }`

---

### Holdings `/api/v1/portfolios/:portfolioId/holdings`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/portfolios/:portfolioId/holdings` | JWT | List holdings with pagination |
| `GET` | `/api/v1/portfolios/:portfolioId/holdings/:id` | JWT | Get single holding |
| `DELETE` | `/api/v1/portfolios/:portfolioId/holdings/:id` | JWT | Remove holding |

**Query Parameters (GET list):**
```
page=1&limit=20&sortBy=currentValue&sortOrder=desc
```

**Success (200):**
```json
{
  "success": true,
  "data": [{ "id", "symbol", "quantity", "avgCost", "currentValue", "pnl", "pnlPct" }],
  "meta": { "timestamp": "...", "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 } }
}
```

---

### Transactions `/api/v1/portfolios/:portfolioId/transactions`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/portfolios/:portfolioId/transactions` | JWT | List transactions with pagination |
| `POST` | `/api/v1/portfolios/:portfolioId/transactions` | JWT | Record a transaction |
| `GET` | `/api/v1/portfolios/:portfolioId/transactions/:id` | JWT | Get transaction detail |
| `DELETE` | `/api/v1/portfolios/:portfolioId/transactions/:id` | JWT | Soft-delete transaction |

#### POST /api/v1/portfolios/:portfolioId/transactions
**Request Body:**
```json
{
  "assetId": "uuid",
  "type": "BUY",
  "quantity": 10,
  "price": 1500.00,
  "currency": "INR",
  "transactedAt": "2026-09-01T10:00:00Z",
  "notes": "Monthly SIP"
}
```

**Transaction Types:** `BUY` | `SELL` | `DIVIDEND` | `INTEREST` | `DEPOSIT` | `WITHDRAWAL` | `FEE` | `SPLIT` | `BONUS`

---

### Providers `/api/v1/providers`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/providers/supported` | JWT | List supported provider codes |
| `POST` | `/api/v1/providers/csv/import` | JWT | Upload CSV file and ingest transactions |
| `POST` | `/api/v1/providers/sync/:portfolioId` | JWT | Trigger broker sync for portfolio |

#### POST /api/v1/providers/csv/import
**Content-Type:** `multipart/form-data`
**Fields:** `file` (CSV), `portfolioId` (string), `provider` (`ZERODHA` | `GROWW` | `CSV`)

---

### Market Data `/api/v1/market-data`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/market-data/quote/:symbol` | JWT | Real-time quote for symbol |
| `GET` | `/api/v1/market-data/historical/:symbol` | JWT | Historical OHLCV data |
| `GET` | `/api/v1/market-data/search` | JWT | Search assets by name/symbol |

**Query Parameters (historical):**
```
from=2026-01-01&to=2026-09-01&interval=1d
```

---

### Analytics `/api/v1/analytics`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/analytics/portfolios/:portfolioId/performance` | JWT | TWR, MWR, Sharpe ratio |
| `GET` | `/api/v1/analytics/portfolios/:portfolioId/risk` | JWT | VaR, volatility, max drawdown |
| `GET` | `/api/v1/analytics/portfolios/:portfolioId/diversification` | JWT | Sector/asset allocation breakdown |
| `GET` | `/api/v1/analytics/portfolios/:portfolioId/snapshots` | JWT | Historical portfolio value snapshots |

---

### Alerts `/api/v1/alerts`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/alerts/rules` | JWT | List all alert rules for user |
| `POST` | `/api/v1/alerts/rules` | JWT | Create a new alert rule |
| `GET` | `/api/v1/alerts/rules/:id` | JWT | Get a single alert rule |
| `PUT` | `/api/v1/alerts/rules/:id` | JWT | Update alert rule |
| `DELETE` | `/api/v1/alerts/rules/:id` | JWT | Soft-delete alert rule |
| `GET` | `/api/v1/alerts/rules/:id/cooldown` | JWT | Check cooldown status for a rule |
| `GET` | `/api/v1/alerts/logs` | JWT | Alert history (all rules) |
| `GET` | `/api/v1/alerts/logs/rules/:id` | JWT | Alert history for a specific rule |
| `POST` | `/api/v1/alerts/evaluate` | JWT | Manual on-demand evaluation trigger |

#### POST /api/v1/alerts/rules
**Request Body:**
```json
{
  "name": "Large Drawdown Alert",
  "alertType": "DRAWDOWN_LIMIT",
  "condition": { "thresholdPct": 15 },
  "channels": ["IN_APP", "EMAIL"],
  "cooldownDurationMinutes": 1440,
  "isActive": true
}
```

**Alert Types:** `DRAWDOWN_LIMIT` | `PORTFOLIO_REBALANCE` | `RISK_SCORE_SPIKE` | `PRICE_THRESHOLD` | `FD_MATURITY` | `SYNC_FAILURE`

---

## Pagination

All list endpoints accept these query parameters:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer ≥ 1 | 1 | Page number |
| `limit` | integer 1–200 | 20 | Items per page |
| `sortBy` | string | endpoint-specific | Field to sort by |
| `sortOrder` | `asc` \| `desc` | `desc` | Sort direction |

---

## Rate Limiting

Default global rate limit: **100 requests per 60 seconds** per IP.
Exceeded requests return `429 TOO_MANY_REQUESTS`.

---

## API Versioning

All endpoints are prefixed with `/api/v1/`. Breaking changes will be introduced under `/api/v2/` with a deprecation notice period.
