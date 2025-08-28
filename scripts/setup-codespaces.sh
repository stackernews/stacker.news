#!/bin/bash

if [ -z "$CODESPACE_NAME" ]; then
  echo "Not in a Codespaces environment, skipping setup"
  exit 0
fi

echo "Setting up Codespaces environment variables..."

[ ! -f .env.local ] && touch .env.local && echo "Created .env.local" || echo ".env.local already exists, will preserve existing content"

declare -A env_vars=(
  ["NEXTAUTH_URL"]="https://${CODESPACE_NAME}-3000.app.github.dev/api/auth"
  ["NEXT_PUBLIC_MEDIA_URL"]="https://${CODESPACE_NAME}-4566.app.github.dev/uploads"
  ["LNAUTH_URL"]="https://${CODESPACE_NAME}-3000.app.github.dev/api/lnauth"
  ["LNWITH_URL"]="https://${CODESPACE_NAME}-3000.app.github.dev/api/lnwith"
  ["PUBLIC_URL"]="https://${CODESPACE_NAME}-3000.app.github.dev"
  ["NEXT_PUBLIC_URL"]="https://${CODESPACE_NAME}-3000.app.github.dev"
  ["NEXT_PUBLIC_IMGPROXY_URL"]="https://${CODESPACE_NAME}-3001.app.github.dev"
  ["IMGPROXY_ALLOW_ORIGIN"]="https://${CODESPACE_NAME}-3000.app.github.dev"
  ["NEXT_PUBLIC_MEDIA_DOMAIN"]="${CODESPACE_NAME}-4566.app.github.dev"
)

# Remove existing Codespaces-related entries to avoid duplicates
for var in "${!env_vars[@]}"; do
  sed -i.bak "/^${var}=/d" .env.local 2>/dev/null || true
done

# Add Codespaces environment variables
echo "# Codespaces environment variables" >> .env.local
for var in "${!env_vars[@]}"; do
  echo "${var}=${env_vars[$var]}" >> .env.local
  export "$var"="${env_vars[$var]}"
done

rm -f .env.local.bak 2>/dev/null || true