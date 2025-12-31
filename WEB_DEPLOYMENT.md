# NocLense Web Deployment Guide

NocLense is now a fully browser-based application that runs entirely in the browser. No installation or security warnings required!

## Quick Start

### Local Development
```bash
npm install
npm run dev
```
Opens at `http://localhost:5173`

### Build for Production
```bash
npm run build
```
Outputs to `dist/` directory - ready to deploy anywhere!

### Preview Production Build Locally
```bash
npm run preview
```
Opens at `http://localhost:4173`

## Deployment Options

> 💡 **Looking for paid hosting options?** See [PAID_HOSTING_OPTIONS.md](./PAID_HOSTING_OPTIONS.md) for comprehensive paid hosting guide with pricing, features, and recommendations.

### Option 1: GitHub Pages (Free)

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Update vite.config.ts base path:**
   If your repo is `https://github.com/username/noclense`, set:
   ```ts
   base: '/noclense/'
   ```
   If it's the root of your GitHub Pages site, use:
   ```ts
   base: '/'
   ```

3. **Deploy using GitHub Actions:**
   Create `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to GitHub Pages
   
   on:
     push:
       branches: [ main ]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: '18'
         - run: npm install
         - run: npm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

4. **Enable GitHub Pages:**
   - Go to Settings → Pages
   - Source: GitHub Actions

### Option 2: Cloudflare Pages (Free) ⭐ Recommended

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Configure in Cloudflare Dashboard:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
   - Click "Create a project" → "Connect to Git"
   - Select your GitHub repository
   - **Build settings:**
     - **Framework preset**: None (or Vite if available)
     - **Build command**: `npm run build`
     - **Build output directory**: `dist`
     - **Root directory**: `/` (leave empty)
     - **Deploy command**: ⚠️ **LEAVE EMPTY** (do NOT use `wrangler deploy`)
   - Click "Save and Deploy"

3. **Important Notes:**
   - ✅ **Deploy command must be EMPTY** - Cloudflare Pages automatically deploys from the build output
   - ❌ **Do NOT use `wrangler deploy`** - that's for Cloudflare Workers, not Pages
   - The build command creates the `dist` folder, and Pages automatically serves it
   - Your app will be available at `your-project.pages.dev`

4. **Custom Domain (Optional):**
   - In your Pages project settings → Custom domains
   - Add your domain and follow DNS setup instructions
   - SSL is automatically configured

**Why Cloudflare Pages?**
- ✅ Free tier with unlimited bandwidth
- ✅ Global CDN included
- ✅ Automatic SSL certificates
- ✅ Fast deployments
- ✅ Preview deployments for every PR

### Option 3: Netlify (Free)

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Deploy:**
   - Drag and drop the `dist/` folder to [Netlify Drop](https://app.netlify.com/drop)
   - Or connect your GitHub repo for automatic deployments

3. **Netlify Configuration (optional):**
   Create `netlify.toml`:
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"
   
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

### Option 4: Vercel (Free)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   npm run build
   vercel --prod
   ```

   Or connect your GitHub repo at [vercel.com](https://vercel.com)

### Option 5: Serve Locally (Any Web Server)

1. **Build:**
   ```bash
   npm run build
   ```

2. **Serve with Python:**
   ```bash
   cd dist
   python3 -m http.server 8000
   ```
   Open `http://localhost:8000`

3. **Serve with Node.js (http-server):**
   ```bash
   npx http-server dist -p 8000
   ```

4. **Serve with nginx/Apache:**
   - Point your web server to the `dist/` directory
   - Ensure SPA routing works (redirect all routes to `index.html`)

## Features

✅ **100% Browser-Based** - No installation required
✅ **No Security Warnings** - Runs in standard browser
✅ **File Upload** - Uses browser File API (works offline after load)
✅ **Fast & Responsive** - Optimized React + Vite build
✅ **Cross-Platform** - Works on Windows, Mac, Linux, mobile browsers

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

## Privacy & Security

- **All processing happens locally** in your browser
- **No data is sent to any server** (unless you deploy it)
- **Files are never uploaded** - processed entirely client-side
- **Works offline** after initial page load

## Troubleshooting

### Routes not working (404 errors)
If you see 404 errors when navigating, ensure your hosting provider is configured to serve `index.html` for all routes (SPA routing).

### Assets not loading
Check that the `base` path in `vite.config.ts` matches your deployment path.

### Build errors
Make sure all dependencies are installed:
```bash
npm install
```

## Development vs Production

- **Development**: `npm run dev` - Hot reload, source maps, dev tools
- **Production**: `npm run build` - Optimized, minified, ready for deployment

