# Product Requirements Document (PRD)
## Investor Portfolio Monitoring & Risk Management System

---

| Metadata              | Value                                                       |
|-----------------------|-------------------------------------------------------------|
| **Document ID**       | PRD-001                                                     |
| **Version**           | 1.0.0                                                       |
| **Phase**             | Phase 2 — Product Requirements (User Stories & Acceptance Criteria) |
| **Status**            | Approved — Ready for Architecture & Development             |
| **Parent Document**   | PD-001 `docs/product/PRODUCT_DISCOVERY.md`                 |
| **Author(s)**         | Product & QA Team                                           |
| **Created**           | 2026-08-12                                                  |
| **Last Updated**      | 2026-08-12                                                  |

---

## Table of Contents

1. [Document Conventions](#1-document-conventions)
2. [Epic 1 — Auth & User Preference Management](#2-epic-1--auth--user-preference-management)
3. [Epic 2 — Multi-Provider Data Ingestion & Transaction Recording](#3-epic-2--multi-provider-data-ingestion--transaction-recording)
4. [Epic 3 — Deterministic Valuation & Holding Engine](#4-epic-3--deterministic-valuation--holding-engine)
5. [Epic 4 — Performance & Risk Analytics Dashboard](#5-epic-4--performance--risk-analytics-dashboard)
6. [Epic 5 — Automated Alert Engine](#6-epic-5--automated-alert-engine)
7. [Epic 6 — Report Generation (PDF/CSV)](#7-epic-6--report-generation-pdfcsv)
8. [Cross-Epic Edge Cases Matrix](#8-cross-epic-edge-cases-matrix)
9. [Story Dependency Graph](#9-story-dependency-graph)

---

## 1. Document Conventions

### 1.1 User Story Format

Every user story is written in the following structure:

```
### US-[EPIC-CODE]-[NN]: [Title]
**As a** [persona],
**I want to** [action],
**So that** [benefit].

**Priority:** [Must Have | Should Have | Could Have | Won't Have (MoSCoW)]
**Scope:** [MVP | V1.0 | V2.0]
**References:** [FR-X, NFR-X from PD-001]

#### Acceptance Criteria

**Scenario [N]: [Scenario Name]**
Given [initial context / preconditions]
When  [event or action occurs]
Then  [expected observable outcome]
And   [additional outcome if needed]
```

### 1.2 Epic Codes

| Epic | Code | Description |
|---|---|---|
| Epic 1 | AUTH | Authentication & User Preference Management |
| Epic 2 | ING | Multi-Provider Data Ingestion & Transaction Recording |
| Epic 3 | VAL | Deterministic Valuation & Holding Engine |
| Epic 4 | RISK | Performance & Risk Analytics Dashboard |
| Epic 5 | ALT | Automated Alert Engine |
| Epic 6 | RPT | Report Generation (PDF/CSV) |

### 1.3 Personas Quick Reference

| Code | Persona | Primary Use Case |
|---|---|---|
| Alex | HNW Wealth Accumulator | Multi-asset overview, weekly review, tax reporting |
| Maya | Active Crypto/Equity Trader | Real-time P&L, alerts, daily monitoring |
| Raj | Conservative FD/Real Estate Investor | FD tracking, maturity reminders, retirement income |
| Priya | Mutual Fund SIP Accumulator | XIRR tracking, SIP progress, expense ratio visibility |
| System | Automated system actor | Background sync, alert evaluation, price ingestion |

---

## 2. Epic 1 — Auth & User Preference Management

**Epic Goal:** Provide secure, friction-minimal onboarding with personalised user preferences that drive all downstream display and calculation behaviour.

**Included User Stories:**
- US-AUTH-01: User Registration with Email Verification
- US-AUTH-02: User Login with JWT Session Management
- US-AUTH-03: Multi-Factor Authentication (TOTP)
- US-AUTH-04: Password Reset Flow
- US-AUTH-05: Investor Profile & Risk Tolerance Setup
- US-AUTH-06: Home Currency & Locale Preferences
- US-AUTH-07: Session Expiry & Token Refresh
- US-AUTH-08: Account Deletion & Data Erasure

---

### US-AUTH-01: User Registration with Email Verification

**As a** new user,
**I want to** register an account using my email address and a password,
**So that** I can securely access the portfolio management system.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-1 (AC-1.1, AC-1.2), NFR-4, NFR-5

#### Acceptance Criteria

**Scenario 1: Successful registration**
```gherkin
Given the user navigates to the registration page
  And no account exists for the email "alex.chen@example.com"
When  the user submits the registration form with:
        | field     | value                     |
        | email     | alex.chen@example.com     |
        | password  | SecureP@ss123!            |
        | full_name | Alex Chen                 |
        | phone     | +919876543210             |
Then  the system creates an unverified account in the database
  And a 6-digit OTP is generated and stored (hashed) with a 10-minute expiry
  And a verification email is sent to "alex.chen@example.com" within 30 seconds
  And the response returns HTTP 201 with body:
        { "status": "pending_verification", "email": "alex.chen@example.com" }
```

**Scenario 2: Successful email OTP verification**
```gherkin
Given an unverified account exists for "alex.chen@example.com"
  And the OTP "482915" was generated 5 minutes ago and has not expired
When  the user submits OTP "482915" for "alex.chen@example.com"
Then  the account status is updated to "active" in the database
  And the response returns HTTP 200 with a JWT access token and refresh token
  And the user is redirected to the onboarding wizard
```

**Scenario 3: OTP expired**
```gherkin
Given an unverified account exists for "alex.chen@example.com"
  And the OTP was generated 11 minutes ago (expired)
When  the user submits any OTP for "alex.chen@example.com"
Then  the system returns HTTP 400 with error code "OTP_EXPIRED"
  And the system offers a "Resend OTP" option
  And the old OTP is invalidated regardless of value
```

**Scenario 4: OTP max attempts exceeded**
```gherkin
Given an unverified account exists for "alex.chen@example.com"
  And the user has submitted 5 incorrect OTPs within the current OTP window
When  the user submits a 6th OTP attempt
Then  the system returns HTTP 429 with error code "OTP_MAX_ATTEMPTS_EXCEEDED"
  And the current OTP is invalidated
  And the account is locked from OTP submission for 15 minutes
  And a security alert email is sent to "alex.chen@example.com"
```

**Scenario 5: Duplicate email registration**
```gherkin
Given an active account already exists for "alex.chen@example.com"
When  a new user submits a registration form with email "alex.chen@example.com"
Then  the system returns HTTP 409 with error code "EMAIL_ALREADY_REGISTERED"
  And no new account is created
  And no OTP email is sent
  And the response does not confirm whether the email is registered
        (to prevent user enumeration attacks)
```

**Scenario 6: Weak password rejection**
```gherkin
Given the user is on the registration page
When  the user submits a password "password123" (no uppercase, no special char)
Then  the system returns HTTP 422 with error code "PASSWORD_POLICY_VIOLATION"
  And the response lists the violated password rules:
        - Minimum 8 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character
  And no account is created
```

---

### US-AUTH-02: User Login with JWT Session Management

**As a** registered user,
**I want to** log in with my email and password,
**So that** I can access my portfolio dashboard securely.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-1 (AC-1.4), NFR-4

#### Acceptance Criteria

**Scenario 1: Successful login**
```gherkin
Given an active verified account exists for "maya.nair@example.com"
  And MFA is not yet configured for this account
When  the user submits valid credentials:
        | field    | value                 |
        | email    | maya.nair@example.com |
        | password | TradingM@ya99!        |
Then  the system returns HTTP 200 with:
        - access_token: JWT (expires in 30 minutes)
        - refresh_token: opaque token (expires in 7 days)
        - user_id, full_name, email, home_currency, mfa_enabled
  And the refresh_token is stored as an HTTPOnly, Secure, SameSite=Strict cookie
  And the login event is recorded in the audit log with timestamp and IP
```

**Scenario 2: Invalid credentials**
```gherkin
Given an active account exists for "maya.nair@example.com"
When  the user submits an incorrect password
Then  the system returns HTTP 401 with error code "INVALID_CREDENTIALS"
  And the failed attempt counter for this account is incremented
  And the response does not indicate whether the email or password was wrong
```

**Scenario 3: Account locked after repeated failed attempts**
```gherkin
Given an active account exists for "maya.nair@example.com"
  And 4 failed login attempts have occurred in the last 15 minutes
When  the user submits a 5th incorrect password
Then  the system locks the account for 30 minutes
  And the system returns HTTP 423 with error code "ACCOUNT_TEMPORARILY_LOCKED"
  And a security notification email is sent to "maya.nair@example.com"
  And an audit log entry records the lock event
```

**Scenario 4: Login to an unverified account**
```gherkin
Given an unverified account exists for "raj.sharma@example.com"
When  the user attempts login with correct credentials
Then  the system returns HTTP 403 with error code "EMAIL_NOT_VERIFIED"
  And the response includes an option to resend the verification OTP
```

---

### US-AUTH-03: Multi-Factor Authentication (TOTP)

**As a** security-conscious user (like Maya),
**I want to** enable TOTP-based MFA on my account,
**So that** my financial data is protected even if my password is compromised.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-1 (AC-1.2), NFR-4

#### Acceptance Criteria

**Scenario 1: MFA enrollment — QR code generation**
```gherkin
Given the authenticated user "maya.nair@example.com" has MFA disabled
When  the user navigates to Security Settings and clicks "Enable Authenticator App"
Then  the system generates a TOTP secret (RFC 6238 compliant)
  And the system returns:
        - A base32-encoded TOTP secret
        - An otpauth:// URI for QR code rendering
        - A list of 8 single-use backup codes (hashed and stored)
  And the TOTP secret is stored encrypted (AES-256) but MFA is NOT yet enabled
        (enrollment is only confirmed after successful TOTP verification)
```

**Scenario 2: MFA enrollment — verified and activated**
```gherkin
Given the user has scanned the QR code into their authenticator app
  And the TOTP secret is stored but MFA is not yet activated
When  the user submits a valid 6-digit TOTP code from their authenticator app
Then  the system validates the TOTP code against the stored secret
  And MFA status is set to "enabled" on the account
  And the system returns HTTP 200 with success confirmation
  And the backup codes are displayed to the user once (never again)
```

**Scenario 3: Login with MFA enabled**
```gherkin
Given an active account for "maya.nair@example.com" with MFA enabled
When  the user submits valid email + password credentials
Then  the system returns HTTP 200 with:
        { "status": "mfa_required", "mfa_session_token": "<short-lived token>" }
  And no access_token is issued yet
When  the user submits a valid TOTP code within 90 seconds
Then  the system validates the TOTP code
  And the system returns HTTP 200 with access_token and refresh_token
  And the mfa_session_token is invalidated
```

**Scenario 4: TOTP code replay attack prevention**
```gherkin
Given the authenticated user "maya.nair@example.com" with MFA enabled
  And TOTP code "847291" was used successfully 10 seconds ago
When  the user attempts to reuse TOTP code "847291"
Then  the system returns HTTP 401 with error code "TOTP_CODE_ALREADY_USED"
  And the used code is recorded in a short-lived used-codes store (TTL: 90s)
```

**Scenario 5: MFA using backup code**
```gherkin
Given the user has lost access to their authenticator app
  And the user has a valid backup code "XKCD-7421-ABCD"
When  the user submits the backup code at the MFA prompt
Then  the system accepts the backup code and issues an access_token
  And the used backup code is permanently invalidated
  And the number of remaining backup codes is shown (N of 8 remaining)
  And an email notification is sent: "A backup code was used to access your account"
```

---

### US-AUTH-04: Password Reset Flow

**As a** user who has forgotten their password,
**I want to** reset my password via a secure email link,
**So that** I can regain access to my account without contacting support.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-1 (AC-1.3), NFR-4

#### Acceptance Criteria

**Scenario 1: Successful password reset initiation**
```gherkin
Given a user requests password reset for "raj.sharma@example.com"
  And an active account exists for this email
When  the user submits the "Forgot Password" form
Then  the system generates a cryptographically random reset token (min 32 bytes)
  And the reset token hash is stored in the database with a 15-minute expiry
  And a password reset email is sent to "raj.sharma@example.com" with a signed URL
  And the response returns HTTP 200 with a generic message:
        "If this email is registered, a reset link has been sent."
        (same response whether email exists or not — prevents enumeration)
```

**Scenario 2: Successful password reset**
```gherkin
Given the user has a valid, unexpired reset token from the email link
When  the user submits a new password "NewSecureP@ss456!" with the reset token
Then  the system validates the token (not expired, not used, matches hash)
  And the password is hashed with bcrypt (cost factor >= 12) and stored
  And the reset token is permanently invalidated
  And all active sessions for this user are invalidated (all refresh tokens revoked)
  And the user is returned HTTP 200 with "Password reset successful"
  And a confirmation email is sent to "raj.sharma@example.com"
```

**Scenario 3: Expired reset token**
```gherkin
Given the user has a reset token that was generated 16 minutes ago
When  the user attempts to use the expired token
Then  the system returns HTTP 400 with error code "RESET_TOKEN_EXPIRED"
  And the token is purged from the database
```

**Scenario 4: Reset token already used**
```gherkin
Given the user has already used a reset token to successfully reset their password
When  the user attempts to reuse the same reset token URL
Then  the system returns HTTP 400 with error code "RESET_TOKEN_ALREADY_USED"
  And no password change is made
```

---

### US-AUTH-05: Investor Profile & Risk Tolerance Setup

**As a** newly registered user (like Priya),
**I want to** complete an investor profile setup wizard,
**So that** the system can tailor risk calculations, default allocations, and content to my investment style.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-1 (AC-1.5), FR-7

#### Acceptance Criteria

**Scenario 1: Completing the investor profile**
```gherkin
Given an authenticated user who has not yet completed profile setup
When  the user submits the profile form with:
        | field                    | value         |
        | investor_type            | BALANCED      |
        | investment_horizon_years | 10            |
        | primary_goal             | WEALTH_GROWTH |
        | max_acceptable_drawdown  | 20            |
Then  the system stores the investor profile linked to the user account
  And the risk tolerance score is derived:
        - Conservative (max_drawdown <= 10): score weight = LOW
        - Balanced (max_drawdown 11-25): score weight = MEDIUM
        - Aggressive (max_drawdown > 25): score weight = HIGH
  And the response returns HTTP 200 with the calculated risk_profile summary
  And the dashboard is unlocked for the user
```

**Scenario 2: Profile not completed — dashboard gating**
```gherkin
Given an authenticated user who has not completed the investor profile
When  the user attempts to access the portfolio dashboard URL directly
Then  the system redirects the user to the profile setup wizard
  And a banner informs: "Complete your profile to access your dashboard"
```

**Scenario 3: Updating investor profile**
```gherkin
Given the authenticated user "priya.iyer@example.com" has a saved profile
  And her current investor_type is "BALANCED"
When  the user updates investor_type to "AGGRESSIVE"
Then  the system updates the stored profile
  And re-derives the risk tolerance score
  And triggers a re-computation of the portfolio Risk Score using the new parameters
  And the response returns HTTP 200 with the updated profile and new risk_score
```

---

### US-AUTH-06: Home Currency & Locale Preferences

**As a** user with multi-currency holdings,
**I want to** set my home currency and locale preferences,
**So that** all portfolio values are displayed in a consistent currency with locale-appropriate formatting.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-10, NFR-9

#### Acceptance Criteria

**Scenario 1: Setting home currency during onboarding**
```gherkin
Given the authenticated user is in the onboarding wizard
When  the user selects home_currency = "INR" and locale = "en-IN"
Then  the system stores these preferences against the user account
  And the system confirms the preference with HTTP 200
  And all subsequent API responses for this user format monetary values as:
        - Symbol: ₹
        - Number format: 1,00,000.00 (Indian numbering system)
        - Date format: DD/MM/YYYY
```

**Scenario 2: Changing home currency post-onboarding**
```gherkin
Given the authenticated user has home_currency = "INR"
  And the user has holdings valued at ₹50,00,000
When  the user changes home_currency to "USD"
  And the current INR/USD FX rate is 83.50
Then  the system updates the stored home_currency preference
  And all portfolio values are immediately recalculated using the live FX rate
  And the dashboard displays total value as $5,988.02 (50,00,000 / 83.50)
  And a banner informs: "Display currency changed to USD. Values converted at live rates."
```

**Scenario 3: FX rate unavailable during currency change**
```gherkin
Given the authenticated user is changing home_currency to "USD"
  And the FX rate service is currently unavailable
When  the user saves the currency change
Then  the system saves the new preference
  And uses the last cached FX rate for display with a staleness warning:
        "Using FX rate from [timestamp]. Live rates temporarily unavailable."
  And triggers an async FX rate refresh
```

---

### US-AUTH-07: Session Expiry & Token Refresh

**As a** logged-in user,
**I want to** have my session automatically refreshed while I am actively using the app,
**So that** I am not unexpectedly logged out during important tasks.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-1 (AC-1.4), NFR-4

#### Acceptance Criteria

**Scenario 1: Automatic token refresh before expiry**
```gherkin
Given the user has a valid access_token expiring in 2 minutes
  And the user is actively navigating the application
When  the frontend detects the access_token will expire within 5 minutes
Then  the frontend silently calls POST /auth/token/refresh with the refresh_token cookie
  And the system validates the refresh_token is not revoked and not expired
  And the system returns a new access_token (30-minute TTL)
  And the refresh_token is rotated (old one invalidated, new one issued)
  And the user experiences no interruption
```

**Scenario 2: Session expiry after 30 minutes of inactivity**
```gherkin
Given the user has a valid access_token
  And the user has been inactive for 31 minutes
When  the user performs any API action using the expired access_token
Then  the system returns HTTP 401 with error code "ACCESS_TOKEN_EXPIRED"
  And the frontend attempts to refresh using the refresh_token
  And if the refresh_token is also expired, HTTP 401 "SESSION_EXPIRED" is returned
  And the user is redirected to the login page
  And all in-memory state is cleared (no sensitive data retained in browser storage)
```

**Scenario 3: Refresh token revocation on logout**
```gherkin
Given the authenticated user "alex.chen@example.com" has an active session
When  the user clicks "Log Out"
Then  the system calls POST /auth/logout
  And the current refresh_token is added to a revocation store (Redis TTL = 7 days)
  And the HTTPOnly cookie is cleared
  And the response returns HTTP 200
  And subsequent use of the revoked refresh_token returns HTTP 401 "TOKEN_REVOKED"
```

---

### US-AUTH-08: Account Deletion & PII Erasure

**As a** user who wants to close their account,
**I want to** permanently delete my account and all associated personal data,
**So that** my financial data is not retained after I stop using the service (GDPR/DPDP compliance).

**Priority:** Must Have
**Scope:** MVP
**References:** FR-1 (AC-1.6), NFR-5

#### Acceptance Criteria

**Scenario 1: Initiating account deletion**
```gherkin
Given the authenticated user "raj.sharma@example.com" is in Account Settings
When  the user clicks "Delete Account" and confirms by typing "DELETE"
  And the user provides their current password for re-authentication
Then  the system verifies the password
  And schedules the account for deletion (status: "pending_deletion")
  And sends a confirmation email with a 24-hour cancellation link
  And the response returns HTTP 202 with:
        "Your account is scheduled for deletion in 24 hours.
         You may cancel before then by clicking the link in your email."
```

**Scenario 2: Data purge execution (after 24-hour grace period)**
```gherkin
Given the account "raj.sharma@example.com" has been in "pending_deletion" for 24 hours
  And the user has not cancelled the deletion request
When  the deletion job runs (scheduled async process)
Then  all PII fields are permanently overwritten in the database:
        - email, full_name, phone -> replaced with anonymised placeholders
        - password_hash -> deleted
        - provider OAuth tokens and API keys -> deleted and purged from KMS
        - transaction records -> deleted
        - holdings -> deleted
        - alert configurations -> deleted
  And the user_id record is retained as a tombstone (audit trail with no PII)
  And the audit log records: "Account [user_id] deleted per user request on [date]"
  And the process completes within 30 days (DPDP Act compliance)
```

**Scenario 3: Cancellation of pending deletion**
```gherkin
Given the account is in "pending_deletion" status within the 24-hour window
When  the user clicks the cancellation link from the email
Then  the account status is reverted to "active"
  And the user can log in normally
  And the system sends a "Deletion cancelled" confirmation email
```

---

## 3. Epic 2 — Multi-Provider Data Ingestion & Transaction Recording

**Epic Goal:** Enable reliable, secure ingestion of financial data from brokerages, crypto exchanges, and manual sources — with deterministic transaction recording that forms the foundation of all downstream analytics.

**Included User Stories:**
- US-ING-01: OAuth Brokerage Connection (Zerodha)
- US-ING-02: API Key Crypto Exchange Connection (Binance)
- US-ING-03: Manual Asset Entry — Fixed Deposit
- US-ING-04: Manual Asset Entry — Real Estate
- US-ING-05: Manual Transaction Recording (Buy/Sell/Dividend)
- US-ING-06: Bulk CSV Import
- US-ING-07: Background Provider Sync Lifecycle
- US-ING-08: Provider Disconnection & Re-connection
- US-ING-09: Stale Data Detection & Staleness Indicator

---

### US-ING-01: OAuth Brokerage Connection (Zerodha)

**As a** user with a Zerodha demat account (like Alex),
**I want to** connect my Zerodha account via OAuth,
**So that** my equity holdings and transactions are automatically imported without manual data entry.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-2 (AC-2.1, AC-2.3, AC-2.4, AC-2.6, AC-2.7)

#### Acceptance Criteria

**Scenario 1: Successful OAuth connection**
```gherkin
Given the authenticated user "alex.chen@example.com" is on the "Connect Providers" page
When  the user selects "Zerodha" and clicks "Connect"
Then  the system generates a state parameter (CSRF token) and stores it in the session
  And the user is redirected to the Zerodha OAuth authorisation URL with:
        - client_id, redirect_uri, scope=read, response_type=code, state
When  the user grants read-only permissions on the Zerodha consent screen
  And Zerodha redirects back to our callback URL with code and state
Then  the system validates the state parameter matches the session value
  And exchanges the authorisation code for access_token and refresh_token via Zerodha API
  And stores the refresh_token encrypted (AES-256, KMS-backed) in the database
  And stores the access_token in Redis (TTL = token expiry time)
  And records the provider connection: { provider: "ZERODHA", status: "CONNECTED", connected_at }
  And triggers an immediate initial data sync (async background job)
  And returns HTTP 200 with { "status": "CONNECTED", "provider": "ZERODHA" }
```

**Scenario 2: Initial sync — holdings import**
```gherkin
Given the Zerodha connection has just been established for "alex.chen@example.com"
When  the initial sync job runs
Then  the system calls the Zerodha Holdings API
  And for each holding returned:
        - Creates or updates a Holding record:
            { user_id, provider, ticker, exchange, quantity, avg_buy_price, isin }
        - Creates a snapshot PricePoint using the current market price
  And the provider connection is updated: { last_synced_at: now, status: "SYNCED" }
  And the dashboard reflects the newly imported holdings within 30 seconds
```

**Scenario 3: OAuth callback with invalid state (CSRF protection)**
```gherkin
Given the user is mid-way through the OAuth flow for Zerodha
When  the OAuth callback arrives with a state parameter that does not match the session
Then  the system rejects the callback with HTTP 400 "INVALID_OAUTH_STATE"
  And no provider connection is recorded
  And a security event is logged in the audit trail
```

**Scenario 4: Zerodha API returns zero holdings**
```gherkin
Given the user "alex.chen@example.com" has connected Zerodha
  And the Zerodha account has zero holdings (empty demat account)
When  the initial sync job runs
Then  the system processes the empty holdings response without error
  And the provider connection is recorded as SYNCED with last_synced_at timestamp
  And the dashboard displays: "No holdings found in your Zerodha account.
        If this is incorrect, check your Zerodha account directly."
  And the portfolio total value is not affected (no holdings to add)
```

**Scenario 5: OAuth access token expired during sync — auto-refresh**
```gherkin
Given the Zerodha connection is established
  And the Zerodha access_token has expired (TTL elapsed in Redis)
When  the background sync job runs for this provider
Then  the system detects the missing access_token in Redis
  And uses the stored encrypted refresh_token to obtain a new access_token from Zerodha
  And stores the new access_token in Redis
  And continues the sync without user interruption
  And if refresh_token is also expired, marks provider status as "REAUTH_REQUIRED"
  And sends a push notification: "Zerodha connection needs re-authentication"
```

---

### US-ING-02: API Key Crypto Exchange Connection (Binance)

**As a** crypto investor (like Maya),
**I want to** connect my Binance account using a read-only API key,
**So that** my crypto holdings and trade history are automatically synced.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-2 (AC-2.2, AC-2.3)

#### Acceptance Criteria

**Scenario 1: Successful API key connection**
```gherkin
Given the authenticated user "maya.nair@example.com" enters on the "Connect Provider" page:
        | field      | value                                         |
        | provider   | BINANCE                                       |
        | api_key    | abcdef1234567890abcdef1234567890              |
        | api_secret | zyxwvu9876543210zyxwvu9876543210              |
When  the user clicks "Verify & Connect"
Then  the system makes a test API call to Binance GET /api/v3/account
  And validates the API key is read-only (no withdraw/trade permissions)
  And if permissions are read-only, stores api_key and api_secret (both AES-256 encrypted)
  And returns HTTP 200 with { "status": "CONNECTED", "provider": "BINANCE" }
  And triggers initial data sync
```

**Scenario 2: API key has write/trade permissions (rejected)**
```gherkin
Given the user submits a Binance API key that has spot trading permissions enabled
When  the system validates the key permissions
Then  the system detects the "enableSpotAndMarginTrading" permission is true
  And rejects the connection with HTTP 400 "API_KEY_UNSAFE_PERMISSIONS"
  And the error message instructs the user:
        "This API key has trading permissions. For security, only read-only API keys
         are accepted. Please create a new Binance API key with only read permissions."
  And no API key is stored
```

**Scenario 3: Invalid or revoked API key**
```gherkin
Given the user submits an incorrect Binance API key / secret combination
When  the system validates the credentials via Binance API
  And Binance returns HTTP 401 "Invalid API-key, IP, or permissions for action"
Then  the system returns HTTP 400 "PROVIDER_AUTH_FAILED"
  And the error message: "Could not authenticate with Binance. Please check your API key and secret."
  And no credentials are stored
```

**Scenario 4: Binance sync with multiple asset pairs**
```gherkin
Given the Binance API key connection is active for "maya.nair@example.com"
  And the Binance account contains:
        - 0.5 BTC (Bitcoin)
        - 10 ETH (Ethereum)
        - 500 USDT (Tether) [stablecoin]
        - 0.0 SOL (Solana) [zero balance]
When  the background sync job fetches balances
Then  the system imports holdings for BTC, ETH, and USDT (free > 0)
  And the SOL entry with free = 0 is skipped
  And each imported holding has its USD price fetched from CoinGecko
  And the INR equivalent is calculated using live USD/INR FX rate
  And holdings are upserted (not duplicated) in the database
```

---

### US-ING-03: Manual Asset Entry — Fixed Deposit

**As a** conservative investor (like Raj),
**I want to** manually add my Fixed Deposit details,
**So that** I can track FD value, accrued interest, and maturity dates in one place.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-3 (AC-3.1, AC-3.2, AC-3.4)

#### Acceptance Criteria

**Scenario 1: Successful FD entry**
```gherkin
Given the authenticated user "raj.sharma@example.com" is on the "Add Asset" page
When  the user submits the FD form with:
        | field                  | value             |
        | bank_name              | SBI               |
        | principal              | 1000000.00        |
        | annual_interest_rate   | 7.25              |
        | compounding_frequency  | QUARTERLY         |
        | start_date             | 2025-04-01        |
        | maturity_date          | 2026-04-01        |
        | account_number_masked  | XXXX1234          |
Then  the system stores the FD record in the database
  And computes the daily accrued interest using:
        A = P * (1 + r/n)^(n*t)
        where P=principal, r=rate/100, n=compounding_periods/year, t=days/365
  And the current FD value (principal + accrued interest to today) is calculated
  And the holding appears in the dashboard under "Fixed Deposits" asset class
  And the system schedules maturity alert checks for this FD
  And the response returns HTTP 201 with the full FD record including calculated current_value
```

**Scenario 2: FD with maturity date in the past**
```gherkin
Given the user enters an FD with maturity_date = 2024-01-01 (already matured)
When  the user submits the FD form
Then  the system accepts the entry (historical FD tracking is valid)
  And marks the FD status as "MATURED"
  And the current_value is set to the final maturity value (no further interest accrual)
  And a banner on the dashboard shows: "This FD matured on 01-Jan-2024. Update to record reinvestment."
```

**Scenario 3: FD with zero principal (invalid)**
```gherkin
Given the user submits an FD form with principal = 0
Then  the system returns HTTP 422 with error code "INVALID_PRINCIPAL"
  And the error message: "Principal must be greater than zero."
```

**Scenario 4: FD interest accrual — daily computation check**
```gherkin
Given an FD exists with:
        principal = 500000, rate = 7.0%, compounding = MONTHLY
        start_date = 2025-01-01
When  the date is 2025-07-01 (181 days elapsed, approx 6 months)
Then  the system computes:
        A = 500000 * (1 + 0.07/12)^(12 * (181/365))
        Expected: approximately 518,250 INR
  And the portfolio dashboard shows current FD value = 518,250.xx INR
  And the unrealised gain for this FD = 18,250.xx INR
```

---

### US-ING-04: Manual Asset Entry — Real Estate

**As a** real estate owner (like Raj),
**I want to** manually add a property to my portfolio,
**So that** I can track its estimated value and see its contribution to my total net worth.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-3 (AC-3.2, AC-3.4)

#### Acceptance Criteria

**Scenario 1: Successful real estate entry**
```gherkin
Given the authenticated user is on the "Add Asset" page
When  the user submits the real estate form with:
        | field                   | value                         |
        | property_name           | Raj Sharma Residence          |
        | location                | Dwarka, New Delhi             |
        | property_type           | RESIDENTIAL                   |
        | purchase_price          | 8500000.00                    |
        | purchase_date           | 2015-03-15                    |
        | current_estimated_value | 15000000.00                   |
        | rental_income_monthly   | 25000.00                      |
Then  the system creates a RealEstate holding record
  And uses current_estimated_value as the current market price
  And records the valuation timestamp (valuation_updated_at = now)
  And the holding shows unrealised gain: 15,000,000 - 8,500,000 = 6,500,000 INR
  And the response returns HTTP 201 with the full property record
```

**Scenario 2: Updating property valuation**
```gherkin
Given the property "Raj Sharma Residence" exists with current_estimated_value = 15,000,000
When  the user updates current_estimated_value to 17,500,000
Then  the system stores the new valuation
  And records the previous valuation in a property_valuation_history table:
        { property_id, old_value, new_value, updated_at }
  And the unrealised gain is recalculated: 17,500,000 - 8,500,000 = 9,000,000 INR
  And a banner displays: "Valuation updated on [date]. Last updated: [date]."
```

**Scenario 3: Real estate with no current estimated value provided**
```gherkin
Given the user adds a real estate property without providing current_estimated_value
When  the form is submitted
Then  the system accepts the entry (current_estimated_value defaults to purchase_price)
  And marks the property as "VALUATION_PENDING"
  And displays a call-to-action on the dashboard:
        "Update the estimated value for 'Raj Sharma Residence' to see accurate net worth."
```

---

### US-ING-05: Manual Transaction Recording (Buy/Sell/Dividend)

**As a** user tracking a manually managed holding,
**I want to** record individual buy, sell, and dividend transactions,
**So that** my cost basis, realised gains, and XIRR are calculated accurately.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-3 (AC-3.2), FR-6

#### Acceptance Criteria

**Scenario 1: Recording a stock buy transaction**
```gherkin
Given the user "alex.chen@example.com" has a manual equity holding for "RELIANCE.NSE"
When  the user adds a Buy transaction:
        | field             | value        |
        | transaction_type  | BUY          |
        | ticker            | RELIANCE.NSE |
        | quantity          | 50           |
        | price_per_unit    | 2450.00      |
        | transaction_date  | 2025-06-15   |
        | brokerage_fee     | 20.00        |
        | transaction_currency | INR       |
Then  the system records the transaction with:
        total_cost = (50 * 2450.00) + 20.00 = 122,520.00 INR
  And updates the average cost basis for "RELIANCE.NSE":
        new_avg = (previous_quantity * previous_avg + quantity * price + fee)
                  / (previous_quantity + quantity)
  And updates the holding's total quantity
  And the response returns HTTP 201 with the transaction record
```

**Scenario 2: Recording a partial sell — FIFO cost basis**
```gherkin
Given the user has the following BUY transactions for "TCS.NSE" with FIFO cost basis:
        Lot 1: 10 shares @ 3500.00 on 2024-01-10
        Lot 2: 20 shares @ 3800.00 on 2024-06-15
When  the user records a SELL of 15 shares @ 4200.00 on 2025-07-01
Then  the system applies FIFO:
        - Exhausts Lot 1: 10 shares @ 3500.00 cost = 35,000
        - Takes 5 shares from Lot 2: 5 shares @ 3800.00 cost = 19,000
        - Total cost basis = 54,000 for 15 shares sold
        - Realised gain = (15 * 4200.00) - 54,000 = 63,000 - 54,000 = 9,000 INR
  And the remaining holding: 15 shares @ 3800.00 (Lot 2 remainder)
  And the transaction record stores:
        { realised_gain: 9000, cost_basis_method: FIFO, holding_period_days: 538 }
```

**Scenario 3: Sell more than available quantity (oversell)**
```gherkin
Given the user has 20 shares of "INFY.NSE" in their portfolio
When  the user attempts to record a SELL of 25 shares of "INFY.NSE"
Then  the system returns HTTP 422 with error code "INSUFFICIENT_HOLDING_QUANTITY"
  And the error message: "Cannot sell 25 shares. Available quantity: 20 shares."
  And no transaction is recorded
```

**Scenario 4: Recording a dividend income transaction**
```gherkin
Given the user holds "HDFC.NSE" in their portfolio
When  the user records a DIVIDEND transaction:
        | field             | value      |
        | transaction_type  | DIVIDEND   |
        | ticker            | HDFC.NSE   |
        | amount            | 5000.00    |
        | transaction_date  | 2025-08-01 |
        | tax_withheld      | 500.00     |
Then  the system records the dividend transaction
  And sets net_dividend = 5000.00 - 500.00 = 4,500.00 INR
  And the dividend does NOT affect the cost basis of the holding
  And cumulative dividend income for "HDFC.NSE" is updated
  And the "Income" section of the dashboard reflects this dividend
```

**Scenario 5: Recording a crypto buy in foreign currency**
```gherkin
Given the user "maya.nair@example.com" records a BTC buy on Binance:
        | field                  | value      |
        | transaction_type       | BUY        |
        | token                  | BTC        |
        | quantity               | 0.15       |
        | price_per_unit_usd     | 62000.00   |
        | transaction_date       | 2025-05-20 |
        | transaction_currency   | USD        |
        | usd_inr_rate_at_time   | 83.42      |
Then  the system stores both the USD price and the INR equivalent:
        cost_basis_usd = 0.15 * 62,000 = 9,300 USD
        cost_basis_inr = 9,300 * 83.42 = 775,806 INR
  And the holding record stores original_currency = "USD"
  And performance metrics show both USD and INR return
  And the FX gain/loss is tracked separately from the BTC price gain/loss
```

---

### US-ING-06: Bulk CSV Import

**As a** user migrating from a spreadsheet or another tool (like Alex),
**I want to** upload a CSV file with multiple transactions at once,
**So that** I can import my historical portfolio data without manual entry for each transaction.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-3 (AC-3.3)

#### Acceptance Criteria

**Scenario 1: Successful CSV import**
```gherkin
Given the user uploads a valid CSV file with 50 transaction rows:
        Headers: date,type,ticker,exchange,quantity,price,currency,fee,notes
        Row 1: 2024-01-15,BUY,RELIANCE,NSE,100,2300.00,INR,15.00,First purchase
        Row 2: 2024-03-20,BUY,TCS,NSE,50,3700.00,INR,10.00,
        ...
When  the user submits the CSV for import
Then  the system validates each row against the CSV schema
  And processes valid rows asynchronously (background job)
  And returns HTTP 202 with:
        { "import_id": "imp_abc123", "status": "PROCESSING", "total_rows": 50 }
When  the import job completes
Then  the user receives a notification: "CSV import complete: 48 records imported, 2 failed"
  And a detailed import report is available showing per-row success/failure
```

**Scenario 2: CSV with validation errors (partial import)**
```gherkin
Given a CSV file with 20 rows where:
        - Rows 1-18: valid transaction data
        - Row 19: missing transaction_date (required field)
        - Row 20: negative quantity (-10)
When  the import is processed
Then  rows 1-18 are imported successfully
  And rows 19 and 20 are rejected with specific error messages:
        Row 19: "MISSING_REQUIRED_FIELD: date"
        Row 20: "INVALID_VALUE: quantity must be > 0"
  And the import summary shows: "18 imported, 2 failed"
  And the user can download an "errors.csv" with the failed rows for correction
```

**Scenario 3: CSV file size exceeds limit**
```gherkin
Given the user uploads a CSV file of 15 MB (limit is 10 MB)
When  the upload request is received
Then  the system returns HTTP 413 "FILE_SIZE_EXCEEDED"
  And the error message: "File size 15 MB exceeds the 10 MB limit. Please split your file."
  And no data is imported
```

**Scenario 4: Duplicate transaction detection during import**
```gherkin
Given the user has already imported a BUY of 100 RELIANCE.NSE on 2024-01-15 @ 2300.00
When  the user uploads a CSV containing the same transaction again
Then  the system detects a potential duplicate based on:
        { ticker, date, type, quantity, price } matching within 0.01% tolerance
  And flags the duplicate row in the import report as "POSSIBLE_DUPLICATE"
  And does NOT import the duplicate by default
  And presents the user an option to "Force import anyway" if it's a legitimate separate transaction
```

---

### US-ING-07: Background Provider Sync Lifecycle

**As a** system (automated actor),
**I want to** periodically sync all connected provider accounts,
**So that** user portfolio data is fresh without requiring manual refresh.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-2 (AC-2.4, AC-2.5, AC-2.6)

#### Acceptance Criteria

**Scenario 1: Scheduled sync — successful**
```gherkin
Given a sync schedule runs every 15 minutes for real-time providers
  And the user "maya.nair@example.com" has connected Zerodha and Binance
When  the scheduler triggers a sync cycle at T+15
Then  for each connected provider, the system:
        1. Fetches fresh holdings and positions from the provider API
        2. Upserts holding records (update if changed, skip if unchanged)
        3. Updates last_synced_at timestamp on the provider connection
        4. Publishes a "PORTFOLIO_UPDATED" event to the message queue
  And the portfolio dashboard shows updated values within 60 seconds of sync trigger
  And if no data changed, the sync is recorded but no downstream events are fired
```

**Scenario 2: Provider API rate limit encountered**
```gherkin
Given the Zerodha API returns HTTP 429 "Too Many Requests" during a sync
When  the sync worker receives the 429 response
Then  the worker implements exponential backoff:
        - Retry 1: after 2 seconds
        - Retry 2: after 4 seconds
        - Retry 3: after 8 seconds
  And if all 3 retries fail, the sync job is marked as "FAILED"
  And the provider connection status is updated to "SYNC_FAILED"
  And the last successfully synced data is retained and served with a staleness indicator
  And the next scheduled sync cycle will retry
```

**Scenario 3: Provider API returns partial data (missing holdings)**
```gherkin
Given the user has 10 holdings synced from Zerodha
  And the current sync returns only 8 holdings (2 missing due to API error)
When  the sync completes
Then  the system does NOT delete the 2 missing holdings
  And instead marks them with status "SYNC_UNCONFIRMED"
  And a warning banner is shown: "Some holdings could not be refreshed in the last sync.
        Data shown may be up to [N] hours old for affected holdings."
  And the next sync cycle attempts to re-fetch the missing data
```

---

### US-ING-08: Stale Data Detection & Staleness Indicator

**As a** user reviewing my portfolio,
**I want to** see clear indicators when portfolio data has not been recently updated,
**So that** I can make decisions knowing whether the data is current or stale.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-2 (AC-2.6), FR-5 (AC-5.2)

#### Acceptance Criteria

**Scenario 1: Data fresh — no staleness indicator**
```gherkin
Given the last sync for "ZERODHA" was 8 minutes ago
  And the sync schedule is every 15 minutes
When  the user views the dashboard
Then  the Zerodha section shows: "Updated 8 minutes ago" with a green indicator
  And no warning banner is displayed
```

**Scenario 2: Data stale — 24+ hours**
```gherkin
Given the last successful sync for "BINANCE" was 26 hours ago
  And the sync has failed 3 consecutive times
When  the user views the dashboard
Then  the Binance section shows a yellow/amber warning badge:
        "Data may be outdated. Last updated: [timestamp]"
  And the portfolio total value shows an asterisk: "₹XX,XX,XXX *"
  And a tooltip on the asterisk explains: "* Some values are over 24 hours old"
  And an alert notification is queued to the user about the sync failure
```

**Scenario 3: Manual price data (real estate / FD) — no staleness for calculated fields**
```gherkin
Given a Fixed Deposit was last updated 30 days ago (manual asset)
  And the FD current_value is computed from accrual formula daily
When  the user views the dashboard
Then  the FD current_value displays the freshly computed accrued value for today
  And NO staleness indicator is shown (FD value is deterministically computed, not fetched)
  And the "Last updated" timestamp shows when the user last edited the FD record
```

---

## 4. Epic 3 — Deterministic Valuation & Holding Engine

**Epic Goal:** Ensure that all portfolio valuations are computed deterministically, consistently, and correctly across all asset types — including edge cases such as stock splits, zero balances, corporate actions, and multi-currency holdings.

**Included User Stories:**
- US-VAL-01: Aggregate Portfolio Net Worth Calculation
- US-VAL-02: Equity Holding Valuation with Stock Split Adjustment
- US-VAL-03: Mutual Fund NAV-Based Valuation
- US-VAL-04: Bond Valuation (Accrued Interest + Mark-to-Market)
- US-VAL-05: Zero Balance Holding Handling
- US-VAL-06: Multi-Currency Portfolio Aggregation
- US-VAL-07: Asset Allocation Weight Calculation

---

### US-VAL-01: Aggregate Portfolio Net Worth Calculation

**As a** user,
**I want to** see my total portfolio net worth on the dashboard,
**So that** I have a single, accurate number representing the sum of all my assets.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-4 (AC-4.1), FR-10

#### Acceptance Criteria

**Scenario 1: Standard multi-asset net worth calculation**
```gherkin
Given the user "alex.chen@example.com" has the following holdings:
        | asset_class    | asset           | quantity | current_price | currency |
        | EQUITY         | RELIANCE.NSE    | 100      | 2500.00       | INR      |
        | EQUITY         | TCS.NSE         | 50       | 4000.00       | INR      |
        | CRYPTO         | BTC             | 0.5      | 5200000.00    | INR      |
        | FIXED_DEPOSIT  | SBI FD          | 1        | 1050000.00    | INR      |
        | REAL_ESTATE    | Delhi Property  | 1        | 15000000.00   | INR      |
        | CASH           | HDFC Savings    | 1        | 200000.00     | INR      |
When  the user opens the dashboard
Then  the system calculates:
        EQUITY_VALUE = (100 * 2500) + (50 * 4000) = 250,000 + 200,000 = 450,000 INR
        CRYPTO_VALUE = 0.5 * 5,200,000 = 2,600,000 INR
        FD_VALUE = 1,050,000 INR (including accrued interest)
        RE_VALUE = 15,000,000 INR
        CASH_VALUE = 200,000 INR
        TOTAL_NET_WORTH = 19,300,000 INR
  And the dashboard displays: "Total Net Worth: ₹1,93,00,000"
  And the calculation completes and renders in < 500ms (P95)
```

**Scenario 2: Zero portfolio value (empty portfolio)**
```gherkin
Given the user "priya.iyer@example.com" has just registered and connected no providers
  And has entered no manual assets
When  the user opens the dashboard
Then  the system displays: "Total Net Worth: ₹0.00"
  And shows a prominent call-to-action: "Add your first asset to get started"
  And does NOT crash or show undefined/NaN values
  And asset allocation charts display a placeholder empty state
```

**Scenario 3: Net worth with all holdings having stale prices**
```gherkin
Given the price feed has been unavailable for all holdings for > 24 hours
When  the user opens the dashboard
Then  the system uses the last known prices from cache for all holdings
  And displays a banner: "Net worth shown using prices from [oldest_timestamp].
        Live pricing is temporarily unavailable."
  And the net worth value is still displayed (not hidden or blocked)
  And each affected holding shows a grey/amber staleness indicator
```

---

### US-VAL-02: Equity Holding Valuation with Stock Split Adjustment

**As a** user holding equities,
**I want** the system to automatically adjust my historical cost basis when a stock split occurs,
**So that** my return calculations are accurate and not inflated by split-adjusted price drops.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-6, FR-3

#### Acceptance Criteria

**Scenario 1: 2-for-1 stock split detection and adjustment**
```gherkin
Given the user holds 100 shares of "TATAMOTORS.NSE" with avg_cost_basis = 600.00 INR/share
  And Tata Motors announces a 2:1 stock split effective on 2025-09-01
When  the corporate action processor detects the split event for "TATAMOTORS.NSE"
Then  the system applies the split adjustment:
        - New quantity: 100 * 2 = 200 shares
        - New avg_cost_basis: 600.00 / 2 = 300.00 INR/share
        - Total cost basis remains unchanged: 200 * 300 = 60,000 INR (same as before)
  And all historical transaction prices for "TATAMOTORS.NSE" before the split date
        are retroactively adjusted (split_ratio = 0.5 applied)
  And a corporate_action record is stored:
        { ticker, action_type: STOCK_SPLIT, ratio: 2.0, effective_date, applied_at }
  And a notification is sent to the user:
        "TATAMOTORS.NSE stock split (2:1) applied. Your quantity updated from 100 to 200."
```

**Scenario 2: Stock split with missing historical data**
```gherkin
Given the user has "WIPRO.NSE" with avg_cost_basis derived from a Zerodha sync
  And the split historical data from the price provider is unavailable for this date
When  the corporate action processor attempts to apply the split
Then  the system applies the split to current quantity and cost basis only
  And flags the holding with "CORPORATE_ACTION_PARTIAL_ADJUSTMENT"
  And shows a warning: "Stock split adjustment applied. Historical return calculations
        may be affected. Please verify with your broker statement."
  And logs the incomplete adjustment for manual review
```

**Scenario 3: Fractional shares resulting from odd-ratio split**
```gherkin
Given the user holds 15 shares of a stock with a 3:2 split (1.5x multiplier)
When  the split is applied
Then  the system calculates: 15 * 1.5 = 22.5 shares
  And rounds down to 22 whole shares
  And creates a cash-in-lieu record for 0.5 shares at the split-date price
  And stores the rounding event in corporate_action_log
  And the cost basis is adjusted: original_total_cost / 22 = new_avg_cost
```

---

### US-VAL-03: Mutual Fund NAV-Based Valuation

**As a** mutual fund investor (like Priya),
**I want** my MF holdings to be valued using the latest NAV published by AMFI,
**So that** my portfolio reflects the most current value of my fund units.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-5, FR-6

#### Acceptance Criteria

**Scenario 1: Standard daily NAV valuation**
```gherkin
Given the user "priya.iyer@example.com" holds:
        - 500 units of "Mirae Asset Large Cap Fund - Growth" (ISIN: INF769K01010)
        - Purchase NAV: 80.00
        - Current AMFI NAV (today, published at 9 PM IST): 95.50
When  the nightly NAV fetch job runs (post 9 PM IST)
Then  the system fetches NAV = 95.50 from the AMFI data feed
  And stores it in the mf_nav table: { isin, nav_value, nav_date }
  And updates the holding current_value: 500 * 95.50 = 47,750.00 INR
  And updates unrealised_gain: (95.50 - 80.00) * 500 = 7,750.00 INR
  And XIRR is recomputed using the updated current NAV
```

**Scenario 2: NAV not yet published (during market hours)**
```gherkin
Given the current time is 2:00 PM IST (market hours, NAV not yet published)
When  the user views their mutual fund holding
Then  the system uses the previous business day's NAV for display
  And shows the label "NAV as of [previous business date]"
  And a tooltip explains: "Mutual Fund NAVs are published daily after 9 PM IST"
```

**Scenario 3: AMFI feed unavailable**
```gherkin
Given the AMFI NAV data feed is unavailable at the time of the nightly job
When  the NAV fetch job runs
Then  the job retries 3 times with 5-minute intervals
  And if all retries fail, the job is marked as "FAILED"
  And an alert is sent to the ops team (Sentry + Slack)
  And existing NAV values from the previous day are retained
  And a staleness indicator is shown on affected MF holdings
```

---

### US-VAL-04: Bond Valuation (Accrued Interest + Mark-to-Market)

**As a** bond investor (like Alex),
**I want** my bond holdings valued at their current market price plus accrued interest,
**So that** my net worth accurately reflects the total economic value of my bond portfolio.

**Priority:** Should Have
**Scope:** MVP (manual bonds) / V1.0 (market-priced bonds)
**References:** FR-3, FR-5

#### Acceptance Criteria

**Scenario 1: Manual bond — accrued interest calculation**
```gherkin
Given the user has entered a bond manually:
        | field           | value        |
        | face_value      | 100000.00    |
        | coupon_rate_pct | 8.50         |
        | coupon_frequency| SEMI_ANNUAL  |
        | purchase_date   | 2025-01-15   |
        | maturity_date   | 2027-01-15   |
        | purchase_price  | 98000.00     |
When  the date is 2025-07-15 (6 months after purchase)
Then  the system calculates accrued interest:
        accrued = face_value * (coupon_rate/100) * (days_since_last_coupon / 365)
        accrued = 100000 * 0.085 * (180/365) = 4,191.78 INR
  And current_value = purchase_price + accrued_interest + (mark-to-market adjustment if available)
  And total current_value displayed = 98,000 + 4,191.78 = 102,191.78 INR
  And the coupon payment schedule shows: "Next coupon: 15-Jul-2025 — ₹4,250.00"
```

**Scenario 2: Bond past maturity date**
```gherkin
Given a bond with maturity_date = 2025-06-01 (past date)
  And the bond has not been deleted by the user
When  the date passes the maturity date
Then  the system sets bond status = "MATURED"
  And the current_value = face_value (100% of par)
  And no further interest accrues beyond the maturity date
  And a notification is sent: "Your bond [Issuer] matured on 01-Jun-2025.
        Please update your portfolio to record reinvestment."
```

---

### US-VAL-05: Zero Balance Holding Handling

**As a** user with traded-out positions,
**I want** holdings that reach zero quantity to be moved to a "Closed Positions" view,
**So that** my active portfolio only shows positions I currently hold.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-4, FR-6

#### Acceptance Criteria

**Scenario 1: Holding reaches zero after full sale**
```gherkin
Given the user has 100 shares of "INFY.NSE" with avg_cost = 1400.00
When  the user records a SELL of all 100 shares @ 1600.00
Then  the holding quantity becomes 0
  And the holding is automatically archived to "closed_positions" status
  And it no longer appears in the "Active Holdings" view
  And it IS visible in the "Closed Positions" / "Trade History" tab
  And the realised gain/loss (100 * (1600 - 1400) = 20,000 INR) is recorded
  And the portfolio net worth immediately reflects the cash-out value
        (if cash account is linked, the cash balance increases by sale proceeds)
```

**Scenario 2: Holding with zero quantity from import (never had positive value)**
```gherkin
Given the CSV import contains a row for a holding with quantity = 0
When  the import is processed
Then  the system skips the zero-quantity row
  And logs: "Row [N]: Skipped — zero quantity holdings are not imported"
  And the import report shows this row as "SKIPPED: ZERO_QUANTITY"
```

---

### US-VAL-06: Multi-Currency Portfolio Aggregation

**As a** multi-currency investor (like Maya with USD crypto holdings),
**I want** all my foreign-currency holdings to be converted to my home currency for portfolio totals,
**So that** my net worth is expressed in a single consistent currency.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-10, NFR-9

#### Acceptance Criteria

**Scenario 1: USD crypto holding converted to INR**
```gherkin
Given the user's home_currency = "INR"
  And the user holds 0.5 BTC with current price = $62,000 USD
  And the live USD/INR FX rate = 83.60
When  the portfolio total is calculated
Then  BTC value in USD = 0.5 * 62,000 = $31,000
  And BTC value in INR = 31,000 * 83.60 = ₹25,91,600
  And the portfolio total includes ₹25,91,600 for BTC
  And the holding detail shows both:
        - Current value: $31,000.00 USD
        - Equivalent: ₹25,91,600.00 INR (at rate: 1 USD = ₹83.60)
```

**Scenario 2: FX gain/loss tracking**
```gherkin
Given BTC was purchased at $60,000 when USD/INR = 82.00
        Cost basis (INR) = 0.5 * 60,000 * 82.00 = ₹24,60,000
  And current BTC price = $62,000, USD/INR = 83.60
        Current value (INR) = 0.5 * 62,000 * 83.60 = ₹25,91,600
When  the user views the BTC holding detail
Then  the system shows:
        Total gain (INR) = 25,91,600 - 24,60,000 = +₹1,31,600
        - Price gain (USD): (62,000 - 60,000) * 0.5 = +$1,000 USD → ₹83,600 INR
        - FX gain: 0.5 * 60,000 * (83.60 - 82.00) = ₹48,000 INR
        - Total = 83,600 + 48,000 = 1,31,600 INR (validates)
```

**Scenario 3: FX rate unavailable for a minor currency**
```gherkin
Given the user holds an asset denominated in "KES" (Kenyan Shilling)
  And no KES/INR rate is available in the FX feed
When  the portfolio total is calculated
Then  the KES holding is excluded from the INR total
  And the holding is displayed with: "Value: [KES amount] KES — INR conversion unavailable"
  And a warning banner: "1 holding could not be converted to INR. FX rate unavailable for KES."
  And the excluded amount is NOT counted toward net worth
```

---

### US-VAL-07: Asset Allocation Weight Calculation

**As a** user reviewing my portfolio composition,
**I want** to see each asset class and individual holding as a percentage of my total portfolio,
**So that** I can understand my exposure and compare against my target allocation.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-4 (AC-4.2), FR-7

#### Acceptance Criteria

**Scenario 1: Asset class allocation percentages**
```gherkin
Given the user's total portfolio value = ₹20,00,000
  And asset class values:
        EQUITY = ₹10,00,000
        CRYPTO = ₹5,00,000
        FIXED_DEPOSIT = ₹3,00,000
        REAL_ESTATE = ₹0 (no real estate added)
        CASH = ₹2,00,000
When  the allocation chart is computed
Then  the weights are:
        EQUITY = 50.00%
        CRYPTO = 25.00%
        FIXED_DEPOSIT = 15.00%
        REAL_ESTATE = 0.00%
        CASH = 10.00%
  And the sum of all weights = 100.00% (no rounding drift > 0.01%)
  And the allocation chart renders these values as an interactive donut chart
```

**Scenario 2: Allocation after a partial sale (real-time recomputation)**
```gherkin
Given the current allocation: EQUITY = 50%, CRYPTO = 50%
When  the user records selling 25% of their crypto holdings
Then  the system recomputes the allocation immediately after the transaction
  And the new weights reflect the reduced crypto exposure
  And the chart animates to the new allocation within 200ms of the transaction commit
```

---

## 5. Epic 4 — Performance & Risk Analytics Dashboard

**Epic Goal:** Surface institutional-grade performance metrics (XIRR, Sharpe, drawdown) and risk analytics (VaR, concentration, correlation) to enable confident, data-driven investment decisions.

**Included User Stories:**
- US-RISK-01: XIRR Computation Across Portfolio
- US-RISK-02: Value-at-Risk (VaR) Calculation
- US-RISK-03: Portfolio Risk Score Display
- US-RISK-04: Maximum Drawdown Computation
- US-RISK-05: Sharpe & Sortino Ratio Display
- US-RISK-06: Concentration Risk Heatmap
- US-RISK-07: Portfolio Beta Calculation
- US-RISK-08: What-If Scenario Analysis

---

### US-RISK-01: XIRR Computation Across Portfolio

**As a** user (like Alex),
**I want** to see my portfolio's XIRR calculated across all transactions,
**So that** I know my true annualised rate of return accounting for the timing of all cash flows.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-6 (Metrics: XIRR)

#### Acceptance Criteria

**Scenario 1: Standard XIRR calculation with multiple investments**
```gherkin
Given the user has the following cash flows for their entire portfolio:
        | date       | amount       | type          |
        | 2023-01-01 | -100,000.00  | INVESTMENT    |
        | 2023-07-01 | -50,000.00   | INVESTMENT    |
        | 2024-01-01 | +10,000.00   | DIVIDEND      |
        | today      | +185,000.00  | CURRENT_VALUE |
When  XIRR is computed
Then  the system uses the Newton-Raphson / Brent's method to solve for r in:
        Sum[CF_i / (1+r)^(t_i)] = 0
  And the result is annualised: XIRR ≈ 19.8% per annum (indicative)
  And the computation uses DATE-BASED weighting (not day-count)
  And the result is displayed as: "XIRR: 19.8% p.a."
  And a tooltip explains: "XIRR is your annualised return accounting for the
        timing of all investments and withdrawals."
```

**Scenario 2: XIRR with a single lump-sum investment (simple case)**
```gherkin
Given a single BUY of 100 shares at ₹1,000 on 2024-01-01
  And current price on 2025-01-01 = ₹1,200 (365 days later)
When  XIRR is computed for this holding
Then  XIRR = (1200/1000)^(365/365) - 1 = 20.00%
  And the result matches the simple annual return (CAGR = XIRR for single cash flow)
```

**Scenario 3: XIRR with negative current value (unrealised loss)**
```gherkin
Given the user has invested ₹1,00,000 in total
  And the current portfolio value is ₹65,000 (35% drawdown)
When  XIRR is computed
Then  XIRR is negative, e.g. -18.5% (indicative)
  And the system displays: "XIRR: -18.5% p.a." in red with a downward arrow
  And does NOT display NaN, undefined, or throw an error
```

**Scenario 4: XIRR computation fails to converge (extreme cash flows)**
```gherkin
Given the portfolio has highly irregular cash flows that prevent XIRR convergence
        (e.g., alternating large positive and negative flows over a short period)
When  XIRR computation reaches max iterations (1000) without convergence
Then  the system falls back to displaying TWR (Time-Weighted Return) instead
  And displays: "XIRR could not be calculated — showing TWR: X.X%"
  And logs the non-convergence event for analytics review
```

---

### US-RISK-02: Value-at-Risk (VaR) Calculation

**As a** risk-conscious user (like Maya),
**I want** to see my portfolio's 1-day 95% Value-at-Risk,
**So that** I understand the maximum expected daily loss in normal market conditions.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-7 (AC-7.1, AC-7.2)

#### Acceptance Criteria

**Scenario 1: Standard historical VaR computation**
```gherkin
Given the portfolio contains equity and crypto holdings
  And at least 252 trading days of historical price data exist for all holdings
When  VaR is computed using Historical Simulation method
Then  the system:
        1. Computes daily P&L for the portfolio over the historical window (252 days)
        2. Sorts all daily P&L values in ascending order
        3. Takes the 5th percentile (worst 5% of days): the 13th worst day of 252
  And VaR is expressed as:
        - Currency: "₹45,200 (1-day, 95% confidence)"
        - Percentage: "2.3% of portfolio value"
  And the display includes: "There is a 5% chance of losing more than ₹45,200 in a single day."
  And VaR is recomputed after each full portfolio sync
```

**Scenario 2: Insufficient historical data (< 252 days)**
```gherkin
Given the user has a newly added holding with only 30 days of price history
When  VaR is computed
Then  the system uses available historical data (30 days) for that holding
  And flags the VaR estimate: "VaR is based on limited data (<252 days).
        Estimate may not be statistically reliable."
  And still computes and displays the VaR rather than showing an error
```

**Scenario 3: VaR with manual assets (Real Estate, FD) — no market price history**
```gherkin
Given the portfolio includes Real Estate and Fixed Deposits (no market price volatility)
When  VaR is computed
Then  Real Estate and FD holdings are excluded from the VaR computation
  And a note displays: "VaR calculated for market-priced assets only
        (Stocks, ETFs, Crypto). Real Estate and FDs are excluded."
  And the scope of VaR is clearly labelled: "VaR covers ₹X of ₹Y total portfolio"
```

**Scenario 4: VaR computation time exceeds threshold**
```gherkin
Given the portfolio has 500+ holdings requiring VaR computation
When  VaR computation is triggered
  And if computation time exceeds 10 seconds
Then  the system serves the last pre-computed VaR from cache
  And displays: "Risk metrics computed [N hours ago]. Refresh to update."
  And a background job recalculates and updates the cache asynchronously
```

---

### US-RISK-03: Portfolio Risk Score Display

**As a** user (especially Raj — conservative investor),
**I want** to see a single, easy-to-understand portfolio Risk Score (0–100),
**So that** I can quickly gauge my overall portfolio risk without understanding quantitative metrics.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-7 (AC-7.3, AC-7.4)

#### Acceptance Criteria

**Scenario 1: Risk score calculation and display**
```gherkin
Given the user's portfolio metrics are:
        | metric               | value | weight |
        | VaR (normalised)     | 35    | 30%    |
        | Concentration Risk   | 60    | 25%    |
        | Volatility           | 40    | 25%    |
        | Asset Class Diversity| 45    | 20%    |
When  the Risk Score is computed
Then  Risk Score = (35*0.30) + (60*0.25) + (40*0.25) + (45*0.20)
        = 10.5 + 15 + 10 + 9 = 44.5 → rounded to 45
  And the dashboard displays:
        - Score gauge: 45/100
        - Label: "MEDIUM RISK"
        - Colour: amber/orange (Low: green 0-30, Medium: amber 31-60, High: red 61-100)
  And each component shows its sub-score with plain-English tooltip:
        - "Concentration: 60 — Your top 3 holdings represent 72% of portfolio"
```

**Scenario 2: Risk score for a zero-portfolio**
```gherkin
Given the user has no holdings in their portfolio
When  the Risk Score is requested
Then  the system returns Risk Score = 0
  And displays: "No Risk Score — Add holdings to see your risk profile"
  And no gauge or chart is shown (replaced by an empty state illustration)
```

---

### US-RISK-04: Maximum Drawdown Computation

**As a** user wanting to understand worst-case scenarios,
**I want** to see the maximum historical drawdown of my portfolio,
**So that** I understand the largest loss I have experienced from a peak.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-7

#### Acceptance Criteria

**Scenario 1: Maximum drawdown identification**
```gherkin
Given the portfolio had the following historical values (daily):
        Day 1: 100,000 (peak)
        Day 2: 95,000
        Day 3: 88,000 (trough from peak 1 = -12%)
        Day 4: 105,000 (new peak)
        Day 5: 85,000 (trough from peak 2 = -19.05%)
        Day 6: 90,000
When  Max Drawdown is computed
Then  the system identifies:
        Peak 1 to trough: (100,000 - 88,000) / 100,000 = 12.0%
        Peak 2 to trough: (105,000 - 85,000) / 105,000 = 19.05%
  And Max Drawdown = 19.05% (the largest drawdown found)
  And the display shows:
        - "Max Drawdown: -19.05%"
        - Peak date, Trough date, Recovery date (if recovered)
```

**Scenario 2: Portfolio that has never declined (monotonically increasing)**
```gherkin
Given the portfolio has only ever increased in value since inception
When  Max Drawdown is computed
Then  the system returns Max Drawdown = 0.00%
  And displays: "Max Drawdown: 0.00% — Portfolio has not experienced a drawdown"
```

---

### US-RISK-05: Sharpe & Sortino Ratio Display

**As an** experienced investor (like Maya),
**I want** to see my portfolio's Sharpe and Sortino ratios,
**So that** I can evaluate whether my returns are adequately compensating for the risk I'm taking.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-7

#### Acceptance Criteria

**Scenario 1: Sharpe ratio calculation**
```gherkin
Given:
        Portfolio annualised return (Rp) = 18.5%
        Risk-free rate (Rf) = 7.0% (10-year Indian Govt Bond yield)
        Portfolio annualised standard deviation (σp) = 15.2%
When  Sharpe Ratio is computed
Then  Sharpe = (Rp - Rf) / σp = (18.5 - 7.0) / 15.2 = 0.76
  And the display shows: "Sharpe Ratio: 0.76"
  And interpretation guide:
        < 0: "Poor — negative risk-adjusted return"
        0–0.5: "Below average"
        0.5–1.0: "Good" (highlighted for this user)
        > 1.0: "Excellent"
  And a tooltip: "Sharpe Ratio measures return per unit of total risk.
        Higher is better. Calculated using 7.0% risk-free rate."
```

**Scenario 2: Sortino ratio (penalises downside only)**
```gherkin
Given:
        Portfolio annualised return (Rp) = 18.5%
        Risk-free rate (Rf) = 7.0%
        Annualised downside deviation (σd) = 9.8% (only negative return days counted)
When  Sortino Ratio is computed
Then  Sortino = (Rp - Rf) / σd = (18.5 - 7.0) / 9.8 = 1.17
  And the display shows: "Sortino Ratio: 1.17"
  And tooltip: "Sortino Ratio is like Sharpe but only penalises downward volatility.
        A higher Sortino relative to Sharpe means your losses are less frequent/severe."
```

**Scenario 3: Insufficient data for ratio calculation (< 30 days)**
```gherkin
Given the user's portfolio was created 20 days ago with insufficient return history
When  Sharpe and Sortino Ratios are computed
Then  the system displays: "N/A — Minimum 30 days of history required"
  And a progress indicator: "12 more days of history needed"
```

---

### US-RISK-06: Concentration Risk Heatmap

**As a** user managing a diversified portfolio,
**I want** to see a visual heatmap of concentration risk highlighting overweight positions,
**So that** I can quickly identify where I have excessive exposure to single holdings or sectors.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-7

#### Acceptance Criteria

**Scenario 1: Concentration risk by individual holding**
```gherkin
Given the portfolio has the following top holdings:
        | holding  | value      | weight |
        | BTC      | 8,00,000   | 40%    |
        | RELIANCE | 3,00,000   | 15%    |
        | TCS      | 2,00,000   | 10%    |
        | SBI FD   | 5,00,000   | 25%    |
        | Cash     | 2,00,000   | 10%    |
When  the Concentration Risk view is rendered
Then  holdings are colour-coded by threshold:
        - > 25%: RED (high concentration risk) → BTC at 40% shown in red
        - 15–25%: AMBER → SBI FD at 25% shown in amber
        - < 15%: GREEN → RELIANCE, TCS, Cash shown in green
  And the heatmap shows: "Top holding (BTC) represents 40% of portfolio.
        Consider diversifying. Recommended single-asset max: 20-25%"
  And a Herfindahl-Hirschman Index (HHI) score is shown as a concentration measure
```

**Scenario 2: Portfolio with perfect equal distribution**
```gherkin
Given the portfolio has 10 equal holdings at 10% each
When  the Concentration Risk heatmap is rendered
Then  all holdings are shown in GREEN
  And the concentration score is LOW
  And the banner: "Well-diversified portfolio. No single holding exceeds 10%."
```

---

### US-RISK-07: Portfolio Beta Calculation

**As a** user wanting to understand market sensitivity,
**I want** to see my portfolio's beta relative to a benchmark index,
**So that** I know how my portfolio moves relative to the market.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-7

#### Acceptance Criteria

**Scenario 1: Portfolio beta against Nifty 50**
```gherkin
Given the user's portfolio contains primarily Indian equities
  And the user selects "Nifty 50" as the benchmark
  And 252 days of historical daily returns exist for both the portfolio and Nifty 50
When  Beta is computed
Then  Beta = Covariance(Rp, Rm) / Variance(Rm)
  And the result is displayed: "Portfolio Beta: 1.23 vs Nifty 50"
  And interpretation:
        - Beta < 1: "Less volatile than the market"
        - Beta = 1: "Moves in line with the market"
        - Beta > 1: "More volatile than the market" (shown for 1.23)
  And tooltip: "A beta of 1.23 means for every 1% Nifty 50 moves,
        your portfolio is expected to move 1.23%."
```

**Scenario 2: Beta for a portfolio with no equity holdings**
```gherkin
Given the user's portfolio contains only Fixed Deposits, Cash, and Real Estate
When  Beta is computed against Nifty 50
Then  the system displays: "Beta: N/A — Portfolio contains no market-priced equity assets"
  And no beta gauge is shown
```

---

### US-RISK-08: What-If Scenario Analysis

**As a** user planning portfolio changes (like Maya),
**I want** to simulate how adding or removing a position would affect my portfolio's risk metrics,
**So that** I can make informed decisions before executing trades.

**Priority:** Should Have
**Scope:** MVP (basic) / V1.0 (full)
**References:** FR-7 (AC-7.5)

#### Acceptance Criteria

**Scenario 1: What-If — sell 50% of BTC and buy NIFTY ETF**
```gherkin
Given the current portfolio state is loaded for "maya.nair@example.com"
  And the What-If scenario builder is opened
When  the user defines a scenario:
        Action 1: Sell 50% of BTC (current value ₹8,00,000 → sell ₹4,00,000)
        Action 2: Buy ₹4,00,000 of NIFTYBEES.NSE
Then  the system computes the hypothetical portfolio:
        - New BTC weight: reduced from 40% to ~20%
        - New NIFTY ETF weight: ~20% added
        - Recalculates: VaR, Sharpe, Concentration, Beta, Volatility
  And the "Before vs After" comparison is shown side-by-side:
        | Metric      | Current | After Scenario |
        | VaR (1D)    | ₹45,200 | ₹32,100        |
        | Sharpe      | 0.76    | 0.89           |
        | Max Conc.   | 40%     | 22%            |
  And none of the proposed changes are executed — this is simulation only
  And a "Reset Scenario" button clears the simulation
```

**Scenario 2: What-If — adding a new holding not in the portfolio**
```gherkin
Given the user wants to model adding ₹2,00,000 of "GOLDBEES.NSE"
When  the user adds this hypothetical holding to the scenario
Then  the system fetches the historical price data for GOLDBEES.NSE
  And recomputes the correlation matrix including GOLDBEES
  And shows the impact on portfolio diversification:
        "Adding GOLDBEES reduces portfolio correlation by 0.12,
         potentially improving Sharpe from 0.76 to 0.82"
```

---

## 6. Epic 5 — Automated Alert Engine

**Epic Goal:** Proactively monitor portfolio conditions and deliver timely, precise alerts to users through their preferred notification channels — with configurable rules, deduplication, and a full delivery audit trail.

**Included User Stories:**
- US-ALT-01: Create & Configure Price Alert
- US-ALT-02: Portfolio Drawdown Alert
- US-ALT-03: Fixed Deposit Maturity Reminder
- US-ALT-04: Asset Allocation Drift Alert
- US-ALT-05: Alert Deduplication & Cooldown
- US-ALT-06: Alert Delivery Failure Handling
- US-ALT-07: Alert History Log

---

### US-ALT-01: Create & Configure Price Alert

**As a** trader (like Maya),
**I want** to create a price alert for any holding in my portfolio,
**So that** I'm immediately notified when an asset crosses a price threshold I care about.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-8 (AC-8.1, AC-8.2, AC-8.3)

#### Acceptance Criteria

**Scenario 1: Creating a price alert — price drops below threshold**
```gherkin
Given the authenticated user "maya.nair@example.com" is on the Alerts page
  And the current BTC price = ₹52,00,000
When  the user creates an alert:
        | field             | value           |
        | alert_name        | BTC Floor Alert |
        | asset             | BTC             |
        | condition         | PRICE_BELOW     |
        | threshold_value   | 48000000.00     |
        | channels          | PUSH, EMAIL     |
        | cooldown_minutes  | 60              |
Then  the system stores the alert configuration in the database
  And the alert evaluation engine registers the alert as ACTIVE
  And the response returns HTTP 201 with:
        { alert_id, status: "ACTIVE", next_evaluation: "<timestamp>" }
  And the alert begins evaluation within the next price update cycle (< 1 minute)
```

**Scenario 2: Price threshold breach — alert fires**
```gherkin
Given the alert "BTC Floor Alert" is ACTIVE with threshold = ₹48,000,000
  And the previous BTC price was ₹49,000,000 (above threshold)
When  the BTC price feed update sets price = ₹47,500,000 (below threshold)
Then  the alert engine evaluates: 47,500,000 < 48,000,000 = TRUE
  And a push notification is sent to maya's device within 60 seconds:
        Title: "BTC Price Alert"
        Body: "BTC has dropped to ₹47,500,000 — below your alert at ₹48,000,000"
  And an email is sent to maya.nair@example.com with the same information
  And the alert_history record is created:
        { alert_id, triggered_at, delivered_at, price_at_trigger, channel }
  And the alert cooldown of 60 minutes begins (will not re-fire until cooldown expires)
```

**Scenario 3: Price alert for a non-portfolio asset**
```gherkin
Given the user does NOT hold ETH in their portfolio
  And the user attempts to create a price alert for ETH
Then  the system allows the alert (you can monitor prices without holding the asset)
  And stores the alert with asset_type="WATCH" (not linked to a holding)
  And ETH price is monitored even though it's not in the portfolio
```

**Scenario 4: Alert threshold already breached at creation time**
```gherkin
Given the current BTC price = ₹45,000,000
  And the user creates a PRICE_BELOW alert with threshold = ₹50,000,000
        (already below at time of creation)
When  the alert is saved
Then  the system creates the alert as ACTIVE
  And immediately fires the alert (condition is already true)
  And a notification is sent: "Alert triggered immediately — BTC is currently
        ₹45,000,000 which is below your threshold of ₹50,000,000"
  And the cooldown begins after the initial fire
```

---

### US-ALT-02: Portfolio Drawdown Alert

**As a** user (like Alex) who wants to protect against large losses,
**I want** to set a portfolio-level drawdown alert,
**So that** I am notified if my total portfolio drops significantly from its recent peak.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-8

#### Acceptance Criteria

**Scenario 1: Drawdown alert configuration**
```gherkin
Given the user "alex.chen@example.com" creates a drawdown alert:
        | field             | value                |
        | alert_name        | 10% Drawdown Guard   |
        | condition         | PORTFOLIO_DRAWDOWN   |
        | threshold_pct     | 10.0                 |
        | reference_point   | ROLLING_30D_HIGH     |
        | channels          | PUSH, EMAIL          |
Then  the system records the alert with:
        { type: PORTFOLIO_DRAWDOWN, threshold_pct: 10.0, reference_type: ROLLING_30D_HIGH }
  And begins tracking the 30-day rolling high portfolio value
```

**Scenario 2: Drawdown alert fires**
```gherkin
Given the 30-day rolling high portfolio value = ₹1,00,00,000
  And the current portfolio value drops to ₹89,00,000
When  the alert engine evaluates:
        drawdown = (1,00,00,000 - 89,00,000) / 1,00,00,000 = 11.0%
        11.0% > 10.0% threshold = TRUE
Then  a push notification is sent:
        "Portfolio Drawdown Alert: Your portfolio has dropped 11.0% from its recent
         high (₹1,00,00,000 → ₹89,00,000)"
  And the alert_history is recorded with:
        { drawdown_pct: 11.0, portfolio_value_at_peak, portfolio_value_at_trigger }
```

**Scenario 3: Drawdown alert — portfolio recovers before alert fires**
```gherkin
Given the 30-day rolling high = ₹1,00,00,000
  And the portfolio value drops to ₹91,00,000 (9.0% drawdown — not yet triggered)
  And then recovers to ₹96,00,000 in the same day
When  the alert engine evaluates at the recovery time
Then  drawdown = (1,00,00,000 - 96,00,000) / 1,00,00,000 = 4.0% < 10.0%
  And the alert does NOT fire
  And the rolling high is updated if ₹96,00,000 > any previous value in the window
```

---

### US-ALT-03: Fixed Deposit Maturity Reminder

**As a** conservative investor (like Raj),
**I want** to receive an alert before each of my FDs matures,
**So that** I have enough time to plan reinvestment and avoid auto-renewal at unfavourable rates.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-8 (FD Maturity Alert)

#### Acceptance Criteria

**Scenario 1: FD maturity alert — multi-day reminders**
```gherkin
Given the user has an FD with maturity_date = 2026-04-01
  And the user has configured maturity alerts at: 90, 30, 7, and 1 day(s) before maturity
When  the date is each of: 2026-01-01, 2026-03-02, 2026-03-25, 2026-03-31
Then  on each trigger date, the system sends an email:
        Subject: "Your SBI FD matures in [N] days — Plan your reinvestment"
        Body: Includes FD details: principal, maturity amount, maturity date, bank name
  And each reminder creates an alert_history record
  And the reminders are delivered by 9:00 AM IST on the trigger date
```

**Scenario 2: FD maturity alert — same day maturity**
```gherkin
Given the date equals the FD maturity_date for "SBI FD - ₹10 Lakh"
When  the morning alert job runs
Then  an email and push notification are sent:
        "Your SBI Fixed Deposit of ₹10,00,000 matures TODAY (01-Apr-2026).
         Maturity amount: ₹10,72,500. Login to update your portfolio."
  And the FD is flagged as "MATURED" in the system
  And the FD continues to show in portfolio until the user records reinvestment or withdrawal
```

**Scenario 3: FD maturity alert — FD deleted before maturity**
```gherkin
Given a scheduled maturity alert exists for a specific FD
When  the user deletes the FD record from their portfolio
Then  all pending maturity alerts for this FD are cancelled
  And no further reminders are sent
  And alert_history records for past sent reminders are retained
```

---

### US-ALT-04: Asset Allocation Drift Alert

**As a** user with a target allocation (like Alex),
**I want** to be alerted when my actual allocation drifts too far from my targets,
**So that** I know when to rebalance before the drift significantly impacts my risk profile.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-8

#### Acceptance Criteria

**Scenario 1: Allocation drift alert configuration**
```gherkin
Given the user sets a target allocation:
        | asset_class  | target_pct |
        | EQUITY       | 50         |
        | CRYPTO       | 20         |
        | BONDS        | 15         |
        | CASH         | 15         |
  And configures a drift alert: threshold = 5% drift from any target class
When  the alert is saved
Then  the system records target allocations and the drift threshold
  And begins evaluating drift on each portfolio sync
```

**Scenario 2: Drift threshold exceeded — alert fires**
```gherkin
Given the target CRYPTO allocation = 20%
  And after a BTC price surge, the actual CRYPTO allocation = 27%
  And the drift threshold = 5%
When  the portfolio sync computes new allocations
Then  drift = |27% - 20%| = 7% > 5% threshold
  And an alert fires:
        "Allocation Drift Alert: CRYPTO allocation has grown to 27%
         (target: 20%, drift: +7%). Consider rebalancing."
  And the specific drifted asset class and direction (+/-) are included
```

**Scenario 3: Multiple classes drifting simultaneously**
```gherkin
Given EQUITY has drifted from 50% to 43% (-7%) and CRYPTO has grown from 20% to 28% (+8%)
When  the drift evaluation runs
Then  a single combined alert is sent listing all drifted classes:
        "Portfolio Drift Alert:
         - EQUITY: 43% (target 50%, drift: -7%)
         - CRYPTO: 28% (target 20%, drift: +8%)
         These changes may affect your risk profile."
  And a single alert_history record is created for this evaluation cycle
```

---

### US-ALT-05: Alert Deduplication & Cooldown

**As a** user who has configured alerts,
**I want** alerts to respect a cooldown period after firing,
**So that** I am not spammed with repeated notifications for the same sustained condition.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-8 (AC-8.5)

#### Acceptance Criteria

**Scenario 1: Alert cooldown prevents repeated firing**
```gherkin
Given the "BTC Floor Alert" fired at T=0 and has a 60-minute cooldown
  And BTC price remains below the threshold throughout the cooldown
When  the alert engine evaluates at T=30 minutes (within cooldown)
Then  the condition is still TRUE (price still below threshold)
  And the alert engine recognises the alert is in cooldown
  And NO notification is sent at T=30
  And the alert_evaluation log records: "SUPPRESSED — in cooldown until T+60"
When  the alert engine evaluates at T=61 minutes (cooldown expired)
  And price is still below threshold
Then  the alert fires again and a new notification is sent
  And a new cooldown period begins
```

**Scenario 2: Price recovers and re-breaches during cooldown**
```gherkin
Given the alert fired at T=0 and is in a 60-minute cooldown
  And the price recovered above the threshold at T=20 (condition no longer true)
  And the price drops below the threshold again at T=45 (condition true again)
When  the alert engine evaluates at T=45
Then  the alert does NOT fire (still within the 60-minute cooldown from T=0)
  And a new internal flag records "condition returned TRUE at T=45"
When  the cooldown expires at T=61 and price is still below threshold
Then  the alert fires again (new breach event after cooldown)
```

**Scenario 3: User pauses an alert**
```gherkin
Given the "BTC Floor Alert" is ACTIVE
When  the user toggles the alert to "PAUSED"
Then  the alert status is updated to "PAUSED" in the database
  And the alert engine stops evaluating this alert immediately
  And no notifications are sent regardless of price movements
  And the alert retains all its configuration for easy re-activation
```

---

### US-ALT-06: Alert Delivery Failure Handling

**As a** system actor (alert engine),
**I want** to retry failed alert deliveries,
**So that** users receive notifications even if the delivery channel has a transient failure.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-8 (AC-8.3), NFR-3

#### Acceptance Criteria

**Scenario 1: Push notification delivery fails — retry**
```gherkin
Given an alert has triggered for user "maya.nair@example.com"
  And the push notification service returns an error (503 Service Unavailable)
When  the delivery attempt fails
Then  the system retries with exponential backoff:
        Attempt 1: immediately (T+0)
        Attempt 2: T+30 seconds
        Attempt 3: T+2 minutes
  And if all push attempts fail, the system falls back to email delivery
  And the alert_history record is updated:
        { channel: EMAIL, delivery_reason: "PUSH_FALLBACK", delivered_at }
  And the failed push attempt is logged in the error tracking system (Sentry)
```

**Scenario 2: All delivery channels fail**
```gherkin
Given both push and email delivery fail for an alert
When  all retry attempts are exhausted (max 3 retries per channel)
Then  the alert is marked as "DELIVERY_FAILED" in alert_history
  And the event is raised as a P2 alert to the ops team
  And the next time the user opens the app, an in-app banner shows:
        "You have [N] undelivered alerts. Review in your Alert History."
  And the alert condition is logged with a permanent record (audit trail preserved)
```

---

### US-ALT-07: Alert History Log

**As a** user reviewing past alerts,
**I want** to see a full log of all alerts that have fired, with delivery confirmation,
**So that** I can audit what notifications I received and when, and identify any delivery gaps.

**Priority:** Should Have
**Scope:** MVP
**References:** FR-8 (AC-8.4)

#### Acceptance Criteria

**Scenario 1: Viewing alert history**
```gherkin
Given the user "maya.nair@example.com" has received 15 alerts in the past 3 months
When  the user navigates to "Alert History"
Then  the system displays a paginated list (20 per page) with:
        | field            | value example                                 |
        | alert_name       | BTC Floor Alert                               |
        | triggered_at     | 2026-07-15 14:32:11 IST                       |
        | condition        | BTC dropped to ₹47,500,000 (< ₹48,000,000)  |
        | channels         | PUSH ✓, EMAIL ✓                               |
        | delivered_at     | 2026-07-15 14:32:45 IST (34s latency)         |
        | status           | DELIVERED                                      |
  And alerts are sorted by triggered_at descending (newest first)
  And the user can filter by: alert type, date range, delivery status
```

**Scenario 2: Alert history retention period**
```gherkin
Given an alert was triggered 13 months ago
When  the system checks retention policy
Then  the 13-month-old alert_history record is archived (not immediately deleted)
  And it no longer appears in the default Alert History view
  And a "Load older alerts" option fetches archived records on demand
  And records are permanently deleted after 24 months
```

---

## 7. Epic 6 — Report Generation (PDF/CSV)

**Epic Goal:** Provide on-demand and scheduled financial reports that users can export for tax filing, CA submissions, personal records, and regulatory compliance.

**Included User Stories:**
- US-RPT-01: Portfolio Snapshot Export (CSV)
- US-RPT-02: Realised Gains Report (STCG/LTCG Classification)
- US-RPT-03: FD Interest Accrual Report
- US-RPT-04: Transaction History Export
- US-RPT-05: PDF Report Generation with Branding

---

### US-RPT-01: Portfolio Snapshot Export (CSV)

**As a** user (like Alex) sharing portfolio data with a CA,
**I want** to export my current portfolio as a CSV file,
**So that** I can provide an accurate, up-to-date holdings snapshot for tax and financial planning.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-9 (AC-9.1, AC-9.2)

#### Acceptance Criteria

**Scenario 1: Successful portfolio snapshot CSV export**
```gherkin
Given the user "alex.chen@example.com" clicks "Export Portfolio Snapshot" (CSV)
When  the export is generated
Then  the CSV is produced within 10 seconds for a portfolio of up to 500 holdings
  And the CSV file contains the following columns:
        asset_class, ticker_or_name, exchange, quantity, avg_cost_price_inr,
        current_price_inr, current_value_inr, unrealised_gain_inr,
        unrealised_gain_pct, portfolio_weight_pct, cost_basis_method,
        first_purchase_date, currency_original, current_price_original_currency
  And the first row is a metadata header:
        # Portfolio Snapshot — Alex Chen — Exported: 12-Aug-2026 23:30 IST
        # Data as of: 12-Aug-2026 22:00 IST (last sync)
  And the file is UTF-8 encoded with BOM for Excel compatibility
  And the response initiates a file download named:
        "portfolio_snapshot_YYYYMMDD_HHMMSS.csv"
```

**Scenario 2: Export with zero holdings**
```gherkin
Given the user has an empty portfolio
When  the user requests a portfolio snapshot CSV export
Then  the CSV is generated with only the header row and metadata comments
  And no error is thrown
  And the file name and metadata are still accurate
  And a notification: "Your portfolio is empty. The exported file contains no holdings."
```

**Scenario 3: Export interrupted — server timeout**
```gherkin
Given the user has 600 holdings (above the 500 optimised threshold)
When  the export is requested
  And the export job takes longer than 30 seconds
Then  the system continues processing asynchronously
  And returns HTTP 202: "Your export is being generated. You will receive an email
        when it is ready to download."
  And the export link in the email is valid for 24 hours
  And the file is stored in secure temporary storage (S3 with pre-signed URL)
```

---

### US-RPT-02: Realised Gains Report (STCG/LTCG Classification)

**As a** user preparing for tax filing (like Alex),
**I want** a realised capital gains report categorised by Short-Term and Long-Term (India tax rules),
**So that** I can accurately report capital gains in my ITR without manual calculation.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-9, FR-6 (AC-6.1)

#### Acceptance Criteria

**Scenario 1: Standard STCG/LTCG classification**
```gherkin
Given the user has the following realised gains in FY 2025-26 (Apr 2025 - Mar 2026):
        | asset       | purchase_date | sale_date  | gain_loss | holding_days |
        | TCS.NSE     | 2024-06-01    | 2025-07-15 | +15,000   | 410          |
        | BTC         | 2025-01-10    | 2025-08-05 | +8,000    | 207          |
        | HDFC.NSE    | 2025-05-01    | 2025-09-01 | -3,000    | 123          |
When  the Realised Gains Report is generated for FY 2025-26
Then  the report classifies:
        TCS: 410 days > 365 → LTCG: +₹15,000
        BTC: Crypto taxed as STCG regardless of holding period → STCG: +₹8,000
        HDFC: 123 days <= 365 → STCG: -₹3,000
  And the report shows:
        Total STCG: +₹5,000 (8,000 - 3,000)
        Total LTCG: +₹15,000
        Estimated LTCG tax (@10% above ₹1L exemption): ₹0 (below ₹1L threshold)
        Estimated STCG tax (@15%): ₹750
  And a disclaimer: "Tax estimates are indicative only. Consult your CA."
```

**Scenario 2: Gain report for a holding using AVERAGE cost basis (vs. FIFO)**
```gherkin
Given the user has set cost-basis method = AVERAGE for their portfolio
  And they have sold 50 units of a Mutual Fund with:
        Avg cost = 110.00 NAV, Sale NAV = 130.00
When  the report is generated
Then  Realised gain = (130.00 - 110.00) * 50 = ₹1,000
  And the report notes: "Cost basis method: AVERAGE"
  And a footnote: "Different cost basis methods will produce different gain figures."
```

**Scenario 3: No realised gains in the selected financial year**
```gherkin
Given the user has made no sell transactions in FY 2025-26
When  the Realised Gains Report is generated for FY 2025-26
Then  the report shows zero realised gains for all categories
  And displays: "No sales transactions recorded in FY 2025-26."
  And the export still generates a valid, downloadable file (not an error)
```

---

### US-RPT-03: FD Interest Accrual Report

**As a** conservative investor (like Raj),
**I want** an annual FD interest accrual report,
**So that** I can declare interest income accurately in my ITR (Section 80TTA / interest on savings/FDs).

**Priority:** Must Have
**Scope:** MVP
**References:** FR-9

#### Acceptance Criteria

**Scenario 1: FD interest report for a financial year**
```gherkin
Given the user "raj.sharma@example.com" has 3 active FDs:
        FD-1: SBI, Principal ₹10L, Rate 7.25%, Quarterly, Start: 2024-01-15
        FD-2: HDFC, Principal ₹5L, Rate 6.90%, Monthly, Start: 2025-04-01
        FD-3: PNB, Principal ₹8L, Rate 7.10%, Annually, Start: 2023-12-01
When  the FD Interest Report is generated for FY 2025-26 (Apr 2025 - Mar 2026)
Then  for each FD, the system calculates interest earned within the FY:
        - FD-1 SBI: accrued for all of Apr 2025 - Mar 2026 (365 days of the FY) = ₹X
        - FD-2 HDFC: accrued from Apr 2025 (start date in FY) = ₹Y
        - FD-3 PNB: interest for the FY portion only = ₹Z
  And the report shows per-FD and total interest income: ₹(X+Y+Z)
  And includes TDS deducted (if user entered it)
  And the report is exportable as CSV and PDF
  And disclaims: "Interest shown on accrual basis. Tax obligations may vary."
```

**Scenario 2: FD that matured mid-financial-year**
```gherkin
Given FD-1 matured on 2025-10-15 (mid FY 2025-26)
  And the maturity value was received on 2025-10-15
When  the FD Interest Report is generated for FY 2025-26
Then  interest is calculated only from 2025-04-01 to 2025-10-15 (maturity date)
  And the FD is shown as "MATURED" in the report
  And the partial-year interest is correctly prorated
```

---

### US-RPT-04: Transaction History Export

**As a** user auditing my trade history,
**I want** to export all my transactions for a date range as a CSV file,
**So that** I can reconcile with broker statements and share with my accountant.

**Priority:** Must Have
**Scope:** MVP
**References:** FR-9 (AC-9.1, AC-9.2)

#### Acceptance Criteria

**Scenario 1: Exporting all transactions for a date range**
```gherkin
Given the user "maya.nair@example.com" selects the date range 2025-04-01 to 2026-03-31
  And clicks "Export Transaction History"
When  the export is processed
Then  the CSV contains all transactions (BUY, SELL, DIVIDEND) in the date range:
        | column                  | description                             |
        | transaction_date        | ISO 8601 date                           |
        | transaction_type        | BUY / SELL / DIVIDEND                   |
        | asset_class             | EQUITY / CRYPTO / MUTUAL_FUND / etc.    |
        | ticker_or_name          | RELIANCE.NSE, BTC, Mirae Asset Fund     |
        | exchange_or_platform    | NSE, BINANCE, CAMS                      |
        | quantity                | Numeric (can be fractional for crypto)  |
        | price_per_unit_inr      | Price at transaction time in INR        |
        | total_amount_inr        | quantity * price_per_unit + fees        |
        | fees                    | Brokerage / exchange fees               |
        | cost_basis_method       | FIFO / LIFO / AVERAGE                   |
        | provider                | ZERODHA / BINANCE / MANUAL              |
  And the file is sorted by transaction_date ascending
  And the response is a downloadable CSV: "transactions_YYYYMMDD_YYYYMMDD.csv"
```

**Scenario 2: Transaction export with no transactions in range**
```gherkin
Given the user selects the date range 2020-01-01 to 2020-12-31 (no transactions)
When  the export is requested
Then  the CSV contains only the header row and metadata comments
  And a message is shown: "No transactions found for the selected date range."
  And the empty file is downloadable (valid CSV)
```

---

### US-RPT-05: PDF Report Generation with Branding

**As a** user sharing reports with my CA or family,
**I want** to export a professional PDF version of my portfolio and gains reports,
**So that** I can present a polished, branded document rather than a raw spreadsheet.

**Priority:** Should Have
**Scope:** MVP
**References:** FR-9 (AC-9.3)

#### Acceptance Criteria

**Scenario 1: Generating a PDF portfolio report**
```gherkin
Given the user "alex.chen@example.com" requests a PDF Portfolio Report
When  the PDF generation job runs
Then  the PDF contains:
        Page 1: Cover page
                - Application logo and name
                - Report title: "Portfolio Report — Alex Chen"
                - Report date: "As of 12-Aug-2026"
                - Confidentiality notice
        Page 2: Executive Summary
                - Total Net Worth
                - Asset allocation donut chart (rendered as static image)
                - Key metrics: XIRR, Sharpe, Max Drawdown
        Page 3+: Holdings detail table (sorted by asset class then value)
        Last Page: Disclaimer and data sources
  And the PDF is paginated with page numbers: "Page X of Y"
  And each page has a header with report name and a footer with generation timestamp
  And the PDF file size is < 5 MB for a 500-holding portfolio
  And the PDF is generated within 30 seconds
  And the file is named: "portfolio_report_[user_name]_YYYYMMDD.pdf"
```

**Scenario 2: PDF generation failure — fallback to CSV**
```gherkin
Given the PDF generation service (e.g., puppeteer/wkhtmltopdf) is temporarily unavailable
When  the user requests a PDF report
Then  the system attempts PDF generation with a 10-second timeout
  And if PDF generation fails, the system falls back to offering a CSV download
  And a banner displays: "PDF generation is temporarily unavailable.
        A CSV export has been prepared instead. Please try PDF again later."
  And the failure is logged in Sentry as a P3 issue
```

---

## 8. Cross-Epic Edge Cases Matrix

The following table consolidates critical financial edge cases and maps them to the user stories that handle them:

| Edge Case | Category | User Story | Handling |
|---|---|---|---|
| Zero portfolio balance | Valuation | US-VAL-01 | Empty state; no NaN/undefined |
| Empty provider import | Ingestion | US-ING-01 | Accept gracefully; informational message |
| Stock split with missing data | Valuation | US-VAL-02 | Partial adjustment; warning flag |
| Fractional shares from split | Valuation | US-VAL-02 | Round down; cash-in-lieu record |
| Sell exceeds available quantity | Transaction | US-ING-05 | HTTP 422 with clear error |
| Crypto fractional sell | Transaction | US-ING-05 | Support up to 8 decimal places |
| XIRR non-convergence | Analytics | US-RISK-01 | Fallback to TWR |
| Negative XIRR (loss portfolio) | Analytics | US-RISK-01 | Display negative value; no crash |
| VaR with < 252 days data | Risk | US-RISK-02 | Use available data; show warning |
| VaR timeout (large portfolio) | Risk | US-RISK-02 | Serve cached; async recompute |
| Stale FX rate | Valuation | US-VAL-06, US-AUTH-06 | Use last cached; show staleness |
| FX rate unavailable (minor currency) | Valuation | US-VAL-06 | Exclude from total; show warning |
| NAV not yet published (intraday) | Valuation | US-VAL-03 | Previous day NAV; clear label |
| Bond past maturity date | Valuation | US-VAL-04 | MATURED status; no further accrual |
| FD with maturity in the past | Ingestion | US-ING-03 | Accept; MATURED status |
| Real estate with no valuation | Ingestion | US-ING-04 | Default to purchase price; prompt |
| Duplicate CSV import | Ingestion | US-ING-06 | Flag as POSSIBLE_DUPLICATE; user choice |
| CSV file size > 10 MB | Ingestion | US-ING-06 | HTTP 413 with clear guidance |
| Provider API rate-limited | Ingestion | US-ING-07 | Exponential backoff; max 3 retries |
| Provider returns partial holdings | Ingestion | US-ING-07 | Retain existing; SYNC_UNCONFIRMED flag |
| Alert fires at creation (pre-breached) | Alerting | US-ALT-01 | Immediate fire; cooldown starts |
| Alert delivery push fails | Alerting | US-ALT-06 | Retry 3x; fallback to email |
| All delivery channels fail | Alerting | US-ALT-06 | In-app banner; ops P2 alert |
| Portfolio recovers before drawdown fires | Alerting | US-ALT-02 | No fire; rolling high updated |
| FD deleted before maturity | Alerting | US-ALT-03 | Cancel pending reminders |
| No transactions in export range | Reports | US-RPT-04 | Empty CSV with headers; no error |
| PDF generation service failure | Reports | US-RPT-05 | Fallback to CSV; P3 log |
| Export with 600+ holdings | Reports | US-RPT-01 | Async job; email with download link |
| MFA backup code used | Auth | US-AUTH-03 | Invalidate used code; notify user |
| TOTP replay attack | Auth | US-AUTH-03 | Reject; short-lived used-code store |
| Password reset token reuse | Auth | US-AUTH-04 | Reject with TOKEN_ALREADY_USED |
| User enumeration in reset/register | Auth | US-AUTH-01, US-AUTH-04 | Generic responses; no email leak |

---

## 9. Story Dependency Graph

```
Epic 1 (AUTH) — All other epics depend on a valid authenticated session
    |
    +-- US-AUTH-01 (Registration)
    +-- US-AUTH-02 (Login) ──────────────────────────────────┐
         |                                                    |
         +-- US-AUTH-03 (MFA)                                |
         +-- US-AUTH-05 (Profile Setup) ────────────────┐    |
         +-- US-AUTH-06 (Currency Prefs) ───────────────┼────┤
                                                         |    |
                                                         v    v
Epic 2 (ING) — Data Ingestion (depends on Auth + Profile Setup)
    |
    +-- US-ING-01 (Zerodha OAuth) ──────────────────────────────┐
    +-- US-ING-02 (Binance API Key) ────────────────────────────┤
    +-- US-ING-03 (Manual FD Entry) ────────────────────────────┤
    +-- US-ING-04 (Manual Real Estate) ─────────────────────────┤
    +-- US-ING-05 (Manual Transactions) ────────────────────────┤
    +-- US-ING-06 (CSV Import) ─────────────────────────────────┤
    +-- US-ING-07 (Background Sync) ───────────────────────────┤
    +-- US-ING-08 (Stale Detection) ───────────────────────────┘
                                                                 |
                                                                 v
Epic 3 (VAL) — Valuation Engine (depends on Ingestion + Price Feed)
    |
    +-- US-VAL-01 (Net Worth) ──────────────────────────────────┐
    +-- US-VAL-02 (Stock Split Adj.) ───────────────────────────┤
    +-- US-VAL-03 (MF NAV Valuation) ──────────────────────────┤
    +-- US-VAL-04 (Bond Valuation) ─────────────────────────────┤
    +-- US-VAL-05 (Zero Balance) ───────────────────────────────┤
    +-- US-VAL-06 (Multi-Currency) ─────────────────────────────┤
    +-- US-VAL-07 (Allocation Weights) ─────────────────────────┘
                                                                 |
                                              ┌──────────────────┘
                                              v
Epic 4 (RISK) — Analytics (depends on Valuation Engine)
    |
    +-- US-RISK-01 (XIRR) ──────────────────────────────────────┐
    +-- US-RISK-02 (VaR) ───────────────────────────────────────┤
    +-- US-RISK-03 (Risk Score) ────────────────────────────────┤
    +-- US-RISK-04 (Max Drawdown) ──────────────────────────────┤
    +-- US-RISK-05 (Sharpe / Sortino) ──────────────────────────┤
    +-- US-RISK-06 (Concentration) ─────────────────────────────┤
    +-- US-RISK-07 (Beta) ──────────────────────────────────────┤
    +-- US-RISK-08 (What-If) ───────────────────────────────────┘
                                                                 |
                 ┌───────────────────────────────────────────────┘
                 |
Epic 5 (ALT) — Alert Engine (depends on Valuation + Risk + Price Feed)
    |
    +-- US-ALT-01 (Price Alert) ────────────────────────────────┐
    +-- US-ALT-02 (Drawdown Alert) ─────────────────────────────┤
    +-- US-ALT-03 (FD Maturity Alert) ──────────────────────────┤
    +-- US-ALT-04 (Allocation Drift) ───────────────────────────┤
    +-- US-ALT-05 (Deduplication) ──────────────────────────────┤
    +-- US-ALT-06 (Delivery Failure) ───────────────────────────┤
    +-- US-ALT-07 (History Log) ────────────────────────────────┘

Epic 6 (RPT) — Reports (depends on Valuation + Ingestion)
    |
    +-- US-RPT-01 (Portfolio CSV) ──────────────────────────────┐
    +-- US-RPT-02 (Gains Report) ───────────────────────────────┤
    +-- US-RPT-03 (FD Interest) ────────────────────────────────┤
    +-- US-RPT-04 (Transactions) ───────────────────────────────┤
    +-- US-RPT-05 (PDF Reports) ────────────────────────────────┘
```

---

*End of Product Requirements Document — PRD-001 v1.0.0*

*Next Phase: Phase 3 — System Architecture & Technical Design*
*Parent: PD-001 `docs/product/PRODUCT_DISCOVERY.md`*
