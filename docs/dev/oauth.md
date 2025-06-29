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
*   **Granular Scopes**: Defines a set of scopes for basic user information (`read`, `profile:read`) and wallet permissions (`wallet:read`, `wallet:send`, `wallet:receive`).
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
  "expires_in": 7200,
  "refresh_token": "YOUR_REFRESH_TOKEN",
  "scope": "read profile:read wallet:read"
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
  "id": 21858,
  "name": "fac7e6077a",
  "created_at": "2025-06-28T20:32:43.569Z",
  "photo_id": null
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
  "balance_msats": "9900000",
  "balance_sats": 9900,
  "stacked_msats": "70000000",
  "stacked_sats": 70000
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
  "id": 159690,
  "hash": "26301e208c90a920faa886de277233c644328a0d34191e210e18b0a3556b0492",
  "bolt11": "lnbcrt1u1p5xzchrpp5yccpugyvjz5jp74gsm0zwu3ncezr9zsdxsv3uggwrzc2x4ttqjfqdp52d8r5grxv93nwefkxqmnwcfqwfjkxetfwejhxgp3xqczqumpw3escqzzsxqzjcsp5x35r6l5e9xax486djq69rev026h5fd08ttnw605qkq3jeaqxts9q9qxpqysgqqlf7y35rsm5uzq209ma58wd7nj7zgfn33gd7hs45d6ppwf0eer2yemfdlsvfl2uduv49rt42e9g95xyduk7z9tc6xdx96tjn4pk5nscqvz77vg",
  "amount_requested_msats": "100000",
  "amount_requested_sats": 100,
  "description": "Test Invoice",
  "status": "pending",
  "expires_at": "2025-06-29T16:09:31.000Z",
  "created_at": "2025-06-29T15:59:31.236Z",
  "request_id": 16
}
```

#### Send Payments: `/api/oauth/wallet/send`

**Method**: `POST`

**Required Scope**: `wallet:send`

**Description**: Sends a payment from the user's wallet to a specified Bolt11 invoice.

**Parameters:**

*   `bolt11` (required): The Bolt11 invoice string to pay.
*   `max_fee_sats` (optional): The maximum fee in satoshis that the user is willing to pay for the transaction.

**Successful Response (Example):**

```json
{
  "status": "OK",
  "approved": true,
  "payment_request_id": 17
}
```

## 4. Scopes

Scopes define the permissions your application requests from the user. When a user authorizes your application, they are presented with a consent screen detailing these scopes. It's crucial to request only the scopes necessary for your application's functionality, adhering to the principle of least privilege.

*   `read`: Read-only access to public user data, such as username, creation date, and public profile information.
*   `wallet:read`: Provides read-only access to the user's wallet balance and invoice history. Your application cannot initiate payments with this scope.
*   `wallet:send`: Grants permission to send payments from the user's wallet. This is a highly sensitive scope and requires explicit user approval.
*   `wallet:receive`: Grants permission to create invoices for receiving payments into the user's wallet.
*   `profile:read`: Provides read-only access to the user's profile information, such as name and photo.

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
## 9. Examples

This section provides a comprehensive Python example for implementing the OAuth 2.0 Authorization Code Flow with Proof Key for Code Exchange (PKCE). This script demonstrates how to obtain an access token and use it to interact with various protected API endpoints.

### Python Example

The following Python script demonstrates the complete flow, including:
- Generating PKCE codes.
- Initiating the authorization flow.
- Handling the redirect and exchanging the authorization code for an access token.
- Making authenticated API calls to fetch user info, check wallet balance, create invoices, and send payments.

To run this example:
1.  Save the code as a Python file (e.g., `oauth_example.py`).
2.  Install the `requests` library: `pip install requests`.
3.  Replace the placeholder values in the "Configuration" section with your application's actual credentials.
4.  Run the script from your terminal: `python oauth_example.py`.

```python
import http.server
import socketserver
import urllib.parse
import webbrowser
import requests
import base64
import hashlib
import os
import json

# --- Configuration ---
# IMPORTANT: Replace with your actual client credentials and settings.
CLIENT_ID = "YOUR_CLIENT_ID"
CLIENT_SECRET = "YOUR_CLIENT_SECRET" # Keep this secret!
REDIRECT_URI = "http://localhost:5000/callback"
# Adjust the base URL to match the Stacker News instance you are targeting (e.g., https://stacker.news)
SN_BASE_URL = "http://localhost:3000"
AUTHORIZATION_URL = f"{SN_BASE_URL}/api/oauth/authorize"
TOKEN_URL = f"{SN_BASE_URL}/api/oauth/token"
# Define the scopes your application needs.
SCOPES = "profile:read wallet:read wallet:receive wallet:send"

# --- PKCE Helper Functions ---
def generate_code_verifier():
    """Generate a cryptographically random string for PKCE."""
    return base64.urlsafe_b64encode(os.urandom(32)).rstrip(b'=').decode('utf-8')

def generate_code_challenge(code_verifier):
    """Generate a SHA256 code challenge from the verifier for PKCE."""
    s256 = hashlib.sha256(code_verifier.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(s256).rstrip(b'=').decode('utf-8')

# --- Global variables to hold OAuth data during the flow ---
authorization_code = None
oauth_error = None

class OAuthCallbackHandler(http.server.SimpleHTTPRequestHandler):
    """A simple HTTP server to catch the OAuth redirect."""
    def do_GET(self):
        global authorization_code, oauth_error
        parsed_url = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if "code" in query_params:
            authorization_code = query_params["code"][0]
            message = "<html><body><h1>Authorization successful!</h1><p>You can close this tab.</p></body></html>"
            print(f"Received authorization code: {authorization_code}")
        elif "error" in query_params:
            error_details = {
                "error": query_params.get("error", ["unknown"])[0],
                "description": query_params.get("error_description", [""])[0]
            }
            oauth_error = json.dumps(error_details)
            message = f"<html><body><h1>Authorization failed!</h1><p>Error: {error_details['error']}</p><p>Description: {error_details['description']}</p></body></html>"
            print(f"Received OAuth error: {oauth_error}")
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")
            return

        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        self.wfile.write(message.encode('utf-8'))

def start_local_server():
    """Starts a local server to handle the OAuth redirect and returns when the request is handled."""
    PORT = 5000
    # Use a server that allows address reuse to avoid issues on quick restarts
    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    with ReusableTCPServer(("", PORT), OAuthCallbackHandler) as httpd:
        print(f"Serving at port {PORT} to catch OAuth redirect...")
        httpd.handle_request() # This will block until one request is handled
        print(f"Local server on port {PORT} shut down.")

def exchange_code_for_token(code, verifier):
    """Exchanges the authorization code for an access token."""
    print("
Exchanging authorization code for access token...")
    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code_verifier": verifier
    }
    try:
        response = requests.post(TOKEN_URL, data=token_data)
        response.raise_for_status()
        token_info = response.json()
        print("
--- Access Token Response ---")
        print(json.dumps(token_info, indent=2))
        return token_info.get('access_token')
    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error during token exchange: {e}")
        print(f"Response content: {e.response.text}")
        return None

def make_api_call(access_token, endpoint, method='GET', json_data=None):
    """Makes an authenticated API call to a Stacker News OAuth endpoint."""
    print(f"
--- Making API Call to {endpoint} ---")
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    url = f"{SN_BASE_URL}/api/oauth/{endpoint}"

    try:
        if method == 'GET':
            response = requests.get(url, headers=headers)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=json_data)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

        response.raise_for_status()
        api_response = response.json()
        print(f"Status Code: {response.status_code}")
        print("Response:")
        print(json.dumps(api_response, indent=2))
        return api_response
    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error during API call to {endpoint}: {e}")
        print(f"Response content: {e.response.text}")
        return None

def main():
    """Main function to run the OAuth flow and demonstrate API calls."""
    print("====== Starting Stacker News OAuth 2.0 Example Flow ======")

    # 1. Generate PKCE codes
    code_verifier = generate_code_verifier()
    code_challenge = generate_code_challenge(code_verifier)
    print(f"Generated PKCE Code Verifier (secret): {code_verifier}")
    print(f"Generated PKCE Code Challenge: {code_challenge}")

    # 2. Construct the authorization URL and open it in the browser
    auth_params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256"
    }
    full_authorization_url = f"{AUTHORIZATION_URL}?{urllib.parse.urlencode(auth_params)}"
    print(f"
Opening authorization URL in your browser. Please approve the request:")
    print(full_authorization_url)
    webbrowser.open(full_authorization_url)

    # 3. Start the local server to catch the redirect with the authorization code
    start_local_server()

    if oauth_error:
        print("
OAuth flow failed. Exiting.")
        return
    if not authorization_code:
        print("
Did not receive an authorization code. Exiting.")
        return

    # 4. Exchange the authorization code for an access token
    access_token = exchange_code_for_token(authorization_code, code_verifier)
    if not access_token:
        print("
Failed to obtain access token. Exiting.")
        return

    # 5. Use the access token to make various API calls
    print("
====== Demonstrating API Calls with Access Token ======")

    # Get user profile info (requires 'profile:read' scope)
    make_api_call(access_token, "userinfo")

    # Get wallet balance (requires 'wallet:read' scope)
    make_api_call(access_token, "wallet/balance")

    # Create an invoice to receive sats (requires 'wallet:receive' scope)
    invoice_details = {
        "amount_sats": 100,
        "description": "Test invoice from my awesome app"
    }
    created_invoice = make_api_call(access_token, "wallet/invoices", method='POST', json_data=invoice_details)

    # Send sats (requires 'wallet:send' scope)
    # NOTE: You need a valid BOLT11 invoice from a different wallet to pay.
    # The invoice below is a placeholder and will not work.
    invoice_to_pay = "lnbc..." # <-- REPLACE WITH A REAL INVOICE
    payment_details = {
        "bolt11": invoice_to_pay,
        "max_fee_sats": 10 # Optional: set a max fee in sats
    }
    # Uncomment the line below to attempt a payment
    # make_api_call(access_token, "wallet/send", method='POST', json_data=payment_details)
    print("
--- Skipping wallet:send call ---")
    print("To test sending, replace the placeholder invoice in the script and uncomment the API call.")


if __name__ == "__main__":
    # Ensure you have the 'requests' library installed: pip install requests
    main()
```

