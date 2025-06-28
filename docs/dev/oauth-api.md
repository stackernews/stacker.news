# Stacker News OAuth 2.0 API

This document provides a high-level overview of the Stacker News OAuth 2.0 API, enabling third-party applications to securely interact with user accounts and wallets.

## 1. Introduction

OAuth 2.0 is an industry-standard protocol for authorization. It allows a third-party application to obtain limited access to a user's resources on an HTTP service, without exposing the user's credentials. Stacker News leverages OAuth 2.0 to provide a secure and standardized way for developers to build applications that interact with the Stacker News platform on behalf of users.

### Why Stacker News OAuth?

Stacker News OAuth offers several benefits:

*   **For Developers**: It simplifies the process of integrating with Stacker News, allowing you to build innovative applications that can, for example, post content, manage user wallets, or interact with user profiles, all while respecting user privacy and security.
*   **For Users**: Users maintain full control over their data and permissions. They can grant or revoke access to third-party applications at any time, and they are always informed about what permissions an application is requesting.

### Key Features

The Stacker News OAuth implementation includes:

*   **Authorization Code Grant with PKCE**: A secure and widely recommended OAuth 2.0 flow that prevents authorization code interception attacks.
*   **Application Management UI**: Developers can register and manage their OAuth applications directly within the Stacker News platform via `/settings/oauth-applications`.
*   **User Consent Screen**: Users are presented with a clear and concise consent screen, detailing the permissions an application is requesting before they grant access.
*   **Granular Scopes**: A comprehensive set of scopes allows applications to request only the necessary permissions, adhering to the principle of least privilege.
*   **Secure Wallet API**: A dedicated set of API endpoints for secure interaction with user wallets, enabling payments and invoice management.
*   **Token Management**: Robust mechanisms for issuing, refreshing, and revoking access and refresh tokens.
*   **Rate Limiting**: Implemented to ensure fair usage and protect the API from abuse.

## 2. Getting Started

### Registering Your Application

To begin using the Stacker News OAuth 2.0 API, you must first register your application. This is done through the dedicated UI at `/settings/oauth-applications`.

When registering, you will need to provide the following information:

*   **Application Name**: A user-friendly name for your application that will be displayed to users during the consent process.
*   **Description**: A brief explanation of what your application does.
*   **Homepage URL**: The main website or landing page for your application.
*   **Privacy Policy URL**: A link to your application's privacy policy, informing users how their data will be handled.
*   **Terms of Service URL**: A link to your application's terms of service.
*   **Redirect URIs**: A comma-separated list of valid URIs to which Stacker News can redirect users after they authorize your application. These URIs must exactly match the ones used in your authorization requests.
*   **Logo URL**: An optional URL to an image that will be used as your application's logo.

Upon successful registration, Stacker News will generate a unique **Client ID** and **Client Secret** for your application. The Client ID is a public identifier for your application, while the Client Secret is a confidential key that should be kept secure and never exposed in client-side code. These credentials will be used in the OAuth flow to identify and authenticate your application.
### Authorization Flow Overview

Stacker News utilizes the Authorization Code Grant with Proof Key for Code Exchange (PKCE) for its OAuth 2.0 flow. This flow is designed to be secure, especially for public clients (like mobile apps or single-page applications) that cannot securely store a client secret. Here's a step-by-step guide:

1.  **User Initiates Authorization**: The user begins the authorization process from your client application. This typically involves clicking a "Connect with Stacker News" or similar button.

2.  **Client Redirects to Stacker News**: Your application constructs an authorization URL and redirects the user's browser to the Stacker News authorization endpoint (`/oauth/authorize`). This URL includes parameters such as `client_id`, `redirect_uri`, `response_type` (always `code`), `scope` (the permissions your app is requesting), `state` (a CSRF token), `code_challenge`, and `code_challenge_method` (S256).

3.  **User Grants/Denies Consent**: The user is presented with a consent screen on Stacker News (`/oauth/consent`), where they can review the permissions your application is requesting. The user can then choose to grant or deny access.

4.  **Stacker News Redirects Back to Client**: If the user grants access, Stacker News redirects the user's browser back to the `redirect_uri` you provided in step 2. This redirect includes an `authorization code` and the `state` parameter.

5.  **Client Exchanges Authorization Code for Tokens**: Your application, upon receiving the authorization code, makes a direct back-channel request to the Stacker News token endpoint (`/oauth/token`). This request includes the `authorization code`, `client_id`, `redirect_uri`, and crucially, the `code_verifier` (which corresponds to the `code_challenge` sent in step 2). Stacker News verifies these parameters and, if valid, issues an `Access Token` and a `Refresh Token` to your application.

## 3. API Endpoints

### Authorization Endpoint: `/oauth/authorize`

This endpoint is used to initiate the OAuth 2.0 authorization flow. Your application will redirect the user's browser to this URL.

**Parameters:**

*   `client_id` (required): The public identifier for your application, obtained during registration.
*   `redirect_uri` (required): The URI to which Stacker News will redirect the user after they grant or deny authorization. This must be one of the registered redirect URIs for your application.
*   `response_type` (required): Must be `code` for the Authorization Code Grant flow.
*   `scope` (required): A space-separated list of scopes your application is requesting (e.g., `read wallet:read`).
*   `state` (recommended): A unique, non-guessable string generated by your application to prevent Cross-Site Request Forgery (CSRF) attacks. This value will be returned to your `redirect_uri`.
*   `code_challenge` (required): A URL-safe, base64-encoded SHA256 hash of the `code_verifier`. This is part of the PKCE flow.
*   `code_challenge_method` (required): Must be `S256`, indicating the SHA256 hash method was used for the `code_challenge`.

### Token Endpoint: `/oauth/token`

This endpoint is used by your application to exchange the authorization code for an Access Token and Refresh Token. This is a back-channel request and should not involve the user's browser.

**Parameters:**

*   `grant_type` (required): Must be `authorization_code` when exchanging an authorization code, or `refresh_token` when refreshing an access token.
*   `client_id` (required): Your application's public identifier.
*   `client_secret` (required): Your application's confidential secret. This parameter is only required for confidential clients. For public clients using PKCE, this is not typically sent.
*   `redirect_uri` (required): The same `redirect_uri` that was used in the authorization request.
*   `code` (required, for `authorization_code` grant type): The authorization code received from the authorization endpoint.
*   `code_verifier` (required, for `authorization_code` grant type): The original cryptographically random string that was used to generate the `code_challenge`.
*   `refresh_token` (required, for `refresh_token` grant type): The refresh token obtained during a previous token exchange.

**Successful Response (Example):**

```json
{
  "access_token": "YOUR_ACCESS_TOKEN",
  "token_type": "Bearer",
  "expires_in": 3600, // seconds
  "refresh_token": "YOUR_REFRESH_TOKEN",
  "scope": "read wallet:read"
}
```

### User Info Endpoint: `/api/oauth/userinfo`

This endpoint provides basic information about the authenticated user. It requires a valid Access Token.

**Method**: `GET`

**Authentication**: Bearer Token (in `Authorization` header)

**Example Request:**

```
GET /api/oauth/userinfo
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Successful Response (Example):**

```json
{
  "id": 123,
  "name": "satoshi",
  "created_at": "2023-01-01T12:00:00.000Z",
  "sats": 100000,
  "free_posts": 5,
  "free_comments": 10,
  "streak": 7,
  "photoId": 456,
  "hideCowboy": false,
  "lastPost": "2023-06-20T10:00:00.000Z",
  "lastComment": "2023-06-20T11:00:00.000Z",
  "lastMute": null,
  "bio": "A brief bio of the user."
}
```

### Wallet API Endpoints

These endpoints allow your application to interact with the user's Stacker News wallet. All wallet API calls require a valid Access Token with the appropriate `wallet` scopes.

#### Get Wallet Balance: `/api/oauth/wallet/balance`

**Method**: `GET`

**Required Scope**: `wallet:read`

**Description**: Retrieves the current balance of the user's wallet.

**Successful Response (Example):**

```json
{
  "balance": 100000 // in sats
}
```

#### Manage Invoices: `/api/oauth/wallet/invoices`

**Method**: `GET` (list invoices), `POST` (create new invoice)

**Required Scopes**: `wallet:read` (for GET), `wallet:receive` (for POST)

**Description**: Lists existing invoices or creates a new invoice for receiving payments.

**Parameters for POST Request:**

*   `amount_msats` (required): The amount to receive in millisatoshis. Either `amount_msats` or `amount_sats` must be provided.
*   `amount_sats` (required): The amount to receive in satoshis. Either `amount_msats` or `amount_sats` must be provided.
*   `description` (optional): A brief description for the invoice.
*   `expiry_seconds` (optional): The invoice expiry time in seconds (default: 3600 seconds).

**Successful POST Response (Example):**

```json
{
  "bolt11": "lnbc...",
  "hash": "...",
  "expires_at": "..."
}
```

#### Send Payments: `/api/oauth/wallet/send`

**Method**: `POST`

**Required Scope**: `wallet:send`

**Description**: Sends a payment from the user's wallet to a specified Bolt11 invoice.

**Parameters:**

*   `bolt11` (required): The Bolt11 invoice string to pay.
*   `max_fee_msats` (optional): The maximum fee in millisatoshis that the user is willing to pay for the transaction.

**Successful Response (Example):**

```json
{
  "success": true,
  "preimage": "..."
}
```

## 4. Scopes

Scopes define the permissions your application requests from the user. When a user authorizes your application, they are presented with a consent screen detailing these scopes. It's crucial to request only the scopes necessary for your application's functionality, adhering to the principle of least privilege.

*   `read`: Read-only access to public user data, such as username, creation date, and public profile information.
*   `write:posts`: Allows your application to create new posts and edit existing posts on behalf of the user.
*   `write:comments`: Allows your application to create new comments and edit existing comments on behalf of the user.
*   `wallet:read`: Provides read-only access to the user's wallet balance and invoice history. Your application cannot initiate payments with this scope.
*   `wallet:send`: Grants permission to send payments from the user's wallet. This is a highly sensitive scope and requires explicit user approval.
*   `wallet:receive`: Grants permission to create invoices for receiving payments into the user's wallet.
*   `profile:read`: Provides read-only access to the user's private profile information, such as email address (if available and consented).
*   `profile:write`: Allows your application to modify the user's profile information.
*   `notifications:read`: Provides read-only access to the user's notifications.
*   `notifications:write`: Allows your application to manage the user's notification settings.

## 5. Token Management

OAuth 2.0 relies on tokens for secure access to protected resources. Stacker News issues two primary types of tokens: Access Tokens and Refresh Tokens.

### Access Tokens

*   **Purpose**: Access Tokens are short-lived credentials that grant your application access to specific API endpoints on behalf of the user. They are included in the `Authorization` header of API requests as a Bearer token.
*   **Lifespan**: Access Tokens have a limited lifespan (e.g., 1 hour) for security reasons. Once expired, they can no longer be used to access protected resources.

### Refresh Tokens

*   **Purpose**: Refresh Tokens are long-lived credentials used to obtain new Access Tokens after the current one expires, without requiring the user to re-authorize your application.
*   **Lifespan**: Refresh Tokens have a longer lifespan than Access Tokens and are typically stored securely by your application.
*   **Renewal**: When an Access Token expires, your application can use the Refresh Token to make a request to the Token Endpoint (`/oauth/token`) with `grant_type=refresh_token` to obtain a new Access Token and potentially a new Refresh Token.

### Token Expiration and Renewal

It is crucial for your application to handle Access Token expiration gracefully. When an API request returns an authentication error due to an expired Access Token, your application should:

1.  Attempt to use the Refresh Token to obtain a new Access Token.
2.  If successful, retry the original API request with the new Access Token.
3.  If the Refresh Token is also expired or revoked, the user will need to re-initiate the authorization flow.

## 6. Security Considerations

Security is paramount when dealing with user data and financial transactions. Stacker News OAuth 2.0 implementation incorporates several security measures:

*   **PKCE (Proof Key for Code Exchange)**: PKCE is a security extension to the Authorization Code Grant flow that prevents authorization code interception attacks. It ensures that only the legitimate client application that initiated the authorization request can exchange the authorization code for an Access Token. Always implement PKCE in your OAuth clients.
*   **Rate Limiting**: All API endpoints are subject to rate limiting to prevent abuse and ensure fair usage. Exceeding rate limits will result in HTTP 429 Too Many Requests responses. Implement proper error handling and back-off strategies in your application.
*   **User Consent**: The user is always in control. They must explicitly grant consent for your application to access their data and perform actions on their behalf. The consent screen clearly outlines the permissions being requested.
*   **Sensitive Scopes**: Scopes like `wallet:send` are considered highly sensitive due to their potential impact. Applications requesting such scopes will undergo additional scrutiny during the approval process and users will be prompted with more prominent warnings during consent. Handle sensitive scopes with extreme care and only request them if absolutely necessary for your application's core functionality.
*   **Client Secret Security**: If your application is a confidential client (e.g., a web application with a backend), ensure your `client_secret` is stored securely and never exposed in client-side code or public repositories.

## 7. Service Worker for Notifications

The `oauth-service-worker.js` is a crucial component for enabling real-time, asynchronous notifications related to payments and other events within the Stacker News ecosystem. This service worker operates in the background, allowing your application to receive updates even when the user is not actively browsing your site.

### Purpose

The service worker facilitates:

*   **Asynchronous Payment Notifications**: It allows Stacker News to push notifications to your application when a payment is approved, an invoice is paid, or a payment completes, without requiring your application to constantly poll the API.
*   **Improved User Experience**: Users receive timely updates on their transactions, enhancing the overall experience of applications integrated with the Stacker News wallet.

### Event Types

The service worker can dispatch various event types to your application:

*   `oauth_payment_approval_required`: Dispatched when a payment initiated by your application requires user approval (e.g., for large amounts or sensitive transactions).
*   `oauth_invoice_paid`: Dispatched when an invoice created by your application has been successfully paid by another user.
*   `oauth_payment_completed`: Dispatched when a payment initiated by your application has been successfully completed.

Your application should register the service worker and implement event listeners to handle these notifications appropriately.

## 8. Admin Approval (for Stacker News Admins)

For Stacker News administrators, there is a dedicated process for reviewing and approving new OAuth applications. This ensures that applications integrating with the platform adhere to security best practices and provide a positive user experience.

### Process

New OAuth applications submitted by developers are typically reviewed by Stacker News administrators. This review process may involve:

*   Verifying the provided application information (name, description, URLs).
*   Assessing the requested scopes and their necessity for the application's stated functionality.
*   Checking for adherence to security guidelines.

### UI Location

Stacker News administrators can manage and approve OAuth applications via the admin interface at `/admin/oauth-applications`. This interface provides tools to:

*   View pending and approved applications.
*   Review application details and requested scopes.
*   Approve or reject applications.
*   Revoke access for existing applications.

## 9. Examples (Coming Soon)

This section will provide practical code examples demonstrating how to implement various aspects of the Stacker News OAuth 2.0 API, including:

*   Initiating the authorization flow.
*   Exchanging the authorization code for tokens.
*   Making authenticated API requests.
*   Handling token expiration and renewal.
*   Interacting with the Wallet API (e.g., creating invoices, sending payments).
*   Implementing service worker notifications.

Stay tuned for updates to this section!
