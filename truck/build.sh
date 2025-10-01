#!/usr/bin/env bash
# Build script for Render deployment

set -o errexit  # Exit on error

echo "🔧 Installing dependencies..."
pip install -r requirements.txt

echo "🧹 Clearing old static files..."
rm -rf staticfiles/*

echo "📦 Collecting static files (with force clear)..."
python manage.py collectstatic --noinput --clear

echo "🗄️ Running migrations..."
python manage.py migrate --noinput

echo "👤 Creating default user..."
python manage.py create_default_user || echo "User already exists"

echo "✅ Build completed successfully!"
echo "📋 Static files collected at: staticfiles/"
