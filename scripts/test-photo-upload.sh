#!/bin/bash

# Test Photo Upload Script
# This script helps test the /api/photos/upload endpoint manually

set -e

echo "🧪 Photo Upload Test Helper"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:4321}"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

echo -e "${BLUE}Step 1: Create test user (if not exists)${NC}"
echo "Visit: ${API_URL}/auth/signup"
echo "Create account with:"
echo "  Email: test@example.com"
echo "  Password: testpass123"
echo ""
read -p "Press Enter after creating user..."

echo ""
echo -e "${BLUE}Step 2: Get auth token${NC}"
echo "1. Sign in at: ${API_URL}/auth/signin"
echo "2. Open browser DevTools (F12) → Application/Storage → Cookies"
echo "3. Find 'sb-access-token' cookie and copy its value"
echo ""
read -p "Paste your sb-access-token here: " AUTH_TOKEN

if [ -z "$AUTH_TOKEN" ]; then
  echo "Error: Auth token is required"
  exit 1
fi

echo ""
echo -e "${BLUE}Step 3: Create test data in database${NC}"
echo "Creating plant and action..."

# Get user ID from auth token (decode JWT - simple base64 decode of middle part)
USER_ID=$(echo $AUTH_TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | grep -o '"sub":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -z "$USER_ID" ]; then
  echo -e "${YELLOW}Warning: Could not extract user ID from token. Please enter manually:${NC}"
  read -p "User ID (UUID): " USER_ID
fi

echo "User ID: $USER_ID"

# Create plant and action via SQL
PLANT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
ACTION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
ACTION_TYPE_ID=$(psql $DB_URL -t -c "SELECT id FROM action_types WHERE name = 'Watered' LIMIT 1;" | xargs)

if [ -z "$ACTION_TYPE_ID" ]; then
  echo "Error: No action types found. Run migrations first."
  exit 1
fi

echo "Creating plant: $PLANT_ID"
psql $DB_URL -c "INSERT INTO plants (id, user_id, name, species) VALUES ('$PLANT_ID', '$USER_ID', 'Test Plant', 'Monstera deliciosa') ON CONFLICT DO NOTHING;" > /dev/null

echo "Creating action: $ACTION_ID"
psql $DB_URL -c "INSERT INTO actions (id, plant_id, action_type_id, notes) VALUES ('$ACTION_ID', '$PLANT_ID', '$ACTION_TYPE_ID', 'Test action for photo upload') ON CONFLICT DO NOTHING;" > /dev/null

echo -e "${GREEN}✓ Test data created${NC}"
echo ""

echo -e "${BLUE}Step 4: Create test image${NC}"
TEST_IMAGE="test-photo.jpg"
if [ ! -f "$TEST_IMAGE" ]; then
  echo "Creating a small test image..."
  # Create a 100x100 red square as test image (requires ImageMagick)
  if command -v convert &> /dev/null; then
    convert -size 100x100 xc:red $TEST_IMAGE
    echo -e "${GREEN}✓ Test image created: $TEST_IMAGE${NC}"
  else
    echo -e "${YELLOW}ImageMagick not found. Please provide a test image named '$TEST_IMAGE'${NC}"
    read -p "Press Enter after placing a test image..."
  fi
fi

if [ ! -f "$TEST_IMAGE" ]; then
  echo "Error: Test image not found"
  exit 1
fi

echo ""
echo -e "${BLUE}Step 5: Test upload${NC}"
echo ""
echo -e "${GREEN}Test 1: Valid upload${NC}"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  -H "Cookie: sb-access-token=$AUTH_TOKEN" \
  -F "action_id=$ACTION_ID" \
  -F "file=@$TEST_IMAGE" \
  "${API_URL}/api/photos/upload")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

echo "Status: $HTTP_CODE"
echo "Response: $BODY"
echo ""

if [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✓ Upload successful!${NC}"
  PHOTO_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  echo "Photo ID: $PHOTO_ID"
else
  echo -e "${YELLOW}Upload failed. Check response above.${NC}"
fi

echo ""
echo -e "${GREEN}Test 2: Invalid file type${NC}"
echo "test" > test-invalid.txt
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  -H "Cookie: sb-access-token=$AUTH_TOKEN" \
  -F "action_id=$ACTION_ID" \
  -F "file=@test-invalid.txt" \
  "${API_URL}/api/photos/upload")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

echo "Status: $HTTP_CODE (expected 400)"
echo "Response: $BODY"
rm test-invalid.txt
echo ""

echo -e "${GREEN}Test 3: Missing auth${NC}"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  -F "action_id=$ACTION_ID" \
  -F "file=@$TEST_IMAGE" \
  "${API_URL}/api/photos/upload")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "Status: $HTTP_CODE (expected 302 or 401)"
echo ""

echo ""
echo -e "${BLUE}Step 6: Verify in database${NC}"
echo "Photos for action $ACTION_ID:"
psql $DB_URL -c "SELECT id, photo_url, order_index, created_at FROM photos WHERE action_id = '$ACTION_ID';"

echo ""
echo -e "${GREEN}✓ Testing complete!${NC}"
echo ""
echo "View storage in Supabase Dashboard:"
echo "→ http://localhost:54323/project/default/storage/buckets/plant-photos"
