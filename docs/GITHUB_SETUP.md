# GitHub Configuration Guide

## Step 1: Configure Git Identity

Run these commands (replace with your actual email):

```bash
git config --global user.name "midwestman35"
git config --global user.email "your-email@example.com"
```

## Step 2: Choose Authentication Method

Your repository uses HTTPS, so you have two options:

### Option A: Personal Access Token (Recommended for HTTPS)

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "NocLense Development")
4. Select scopes: `repo` (full control of private repositories)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again!)

When you push, use the token as your password:
- Username: `midwestman35`
- Password: `[your-personal-access-token]`

### Option B: SSH Keys (Alternative)

If you prefer SSH:

1. Generate SSH key:
   ```bash
   ssh-keygen -t ed25519 -C "your-email@example.com"
   ```
   (Press Enter to accept default location)

2. Add SSH key to ssh-agent:
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```

3. Copy public key:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

4. Add to GitHub:
   - Go to GitHub → Settings → SSH and GPG keys
   - Click "New SSH key"
   - Paste your public key
   - Save

5. Change remote to SSH:
   ```bash
   git remote set-url origin git@github.com:midwestman35/NocLense.git
   ```

## Step 3: Verify Configuration

```bash
# Check git config
git config --global user.name
git config --global user.email

# Test connection (if using SSH)
ssh -T git@github.com
```

## Step 4: Make Your First Commit

```bash
# Stage all changes
git add .

# Commit
git commit -m "Add multi-file support and file size validation"

# Push to GitHub
git push origin main
```

## Quick Setup Script

Run this to set up git config (you'll need to provide your email):

```bash
read -p "Enter your GitHub email: " email
git config --global user.name "midwestman35"
git config --global user.email "$email"
echo "✅ Git configured!"
echo "Username: $(git config --global user.name)"
echo "Email: $(git config --global user.email)"
```

