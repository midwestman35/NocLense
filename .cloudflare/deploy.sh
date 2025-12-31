#!/bin/bash
# Deploy script for Cloudflare Pages
# This script is a workaround - ideally the deploy command should be empty in Cloudflare Pages settings

# Deploy static assets from dist directory using wrangler
npx wrangler pages deploy dist --project-name=noclense

