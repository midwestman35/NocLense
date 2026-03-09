#!/bin/bash
echo "=== GitHub Configuration Setup ==="
echo ""
echo "Your repository: https://github.com/midwestman35/NocLense"
echo ""
read -p "Enter your GitHub email address: " email

if [ -z "$email" ]; then
    echo "❌ Email is required. Exiting."
    exit 1
fi

# Set git config
git config --global user.name "midwestman35"
git config --global user.email "$email"

echo ""
echo "✅ Git configuration set!"
echo "   Username: $(git config --global user.name)"
echo "   Email: $(git config --global user.email)"
echo ""
echo "📝 Next steps:"
echo "   1. If using HTTPS, you'll need a Personal Access Token"
echo "   2. See GITHUB_SETUP.md for detailed instructions"
echo ""
