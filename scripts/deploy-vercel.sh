#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Sign in on your own computer, where your passkey/browser session is available.
npx --yes vercel@latest login
# On first deployment, choose/create the project named arte and keep root ./.
npx --yes vercel@latest deploy --prod --scope thereal-baitjets-projects
