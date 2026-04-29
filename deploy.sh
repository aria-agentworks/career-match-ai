#!/bin/bash
# ========================================
# ARIA MARKETING HUB — VERCEL DEPLOYMENT
# ========================================
# Run this script to deploy with all env vars set
# Usage: chmod +x deploy.sh && ./deploy.sh

set -e

echo "========================================="
echo " ARIA MARKETING HUB — Deploying to Vercel"
echo "========================================="

# ===== 1. Install Vercel CLI if needed =====
if ! command -v vercel &> /dev/null; then
    echo "[1/5] Installing Vercel CLI..."
    npm install -g vercel
else
    echo "[1/5] Vercel CLI already installed"
fi

# ===== 2. Set Environment Variables =====
echo "[2/5] Setting environment variables..."

# Razorpay
vercel env add RAZORPAY_KEY_ID production <<< "rzp_live_SX5V4dUW00R0V2"
vercel env add RAZORPAY_KEY_SECRET production <<< "o3lKj26tx2e2ySMNlJe0DLc3"

# NVIDIA
vercel env add NVIDIA_API_KEY production <<< "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"

# ===== 3. Deploy =====
echo "[3/5] Deploying to Vercel..."
vercel deploy --prod

# ===== 4. Setup Razorpay Webhook =====
echo "[4/5] IMPORTANT: Configure Razorpay Webhook"
echo "============================================="
echo "Go to https://dashboard.razorpay.com/webhooks"
echo "Add endpoint: https://career-match-aa-aa-apps.vercel.app/api/payments/webhook"
echo "Events to subscribe: payment.captured, payment.failed"
echo "Secret: (copy from Razorpay dashboard, then add as RAZORPAY_WEBHOOK_SECRET env var)"
echo ""
echo "To add webhook secret:"
echo "  vercel env add RAZORPAY_WEBHOOK_SECRET production"
echo "  vercel deploy --prod"

echo ""
echo "========================================="
echo " DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "API Endpoints (Revenue):"
echo "  POST /api/payments/create-order     — Create Razorpay order"
echo "  POST /api/payments/verify           — Verify payment signature"
echo "  POST /api/payments/link             — Create hosted payment link"
echo "  POST /api/payments/product-link     — Payment link by product ID"
echo "  POST /api/payments/webhook          — Razorpay webhook handler"
echo ""
echo "Product Pricing:"
echo "  AriaAgent          — Free"
echo "  SalesIntelligenceMCP — ₹2,499 ($29/mo)"
echo "  SaaSAuditScanner   — ₹4,999 ($49/audit)"
echo "  ShipProof          — ₹999 ($9.99/mo) ⭐ POPULAR"
echo "  SparkBill          — ₹1,499 ($19/mo)"
echo "  NaiveVoiceAgent    — ₹4,999 ($99/mo)"
echo "  NaiveLandingPage   — ₹2,499 ($29/mo)"
echo ""
echo "Per-Product Lead Agents (7 active):"
echo "  POST /api/automations/smart-brain?product=ShipProof"
echo "  POST /api/automations/outreach-run?productId=shipproof"
echo ""
echo "Cron Jobs:"
echo "  Revenue Commander — Daily at 6:00 AM UTC"
echo "  Follow-up Processor — Daily at 6:00 PM UTC"
