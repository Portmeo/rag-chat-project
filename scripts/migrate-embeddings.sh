#!/bin/bash
echo "🔄 Migrating to instruction-prefixed embeddings..."
echo ""
echo "⚠️  WARNING: This will clear all existing documents and require re-indexing"
echo "    Reason: Changing embedding prefixes invalidates existing vectors"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Migration cancelled"
  exit 1
fi

# Get Qdrant URL from .env or use default
QDRANT_URL=${QDRANT_URL:-"http://localhost:6333"}
QDRANT_COLLECTION=${QDRANT_COLLECTION_NAME:-"documents"}

# Clear Qdrant collection
echo ""
echo "🗑️  Clearing Qdrant collection '$QDRANT_COLLECTION'..."
RESPONSE=$(curl -s -X DELETE "$QDRANT_URL/collections/$QDRANT_COLLECTION" -w "\n%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 404 ]; then
  echo "✅ Collection cleared successfully"
else
  echo "⚠️  Warning: HTTP $HTTP_CODE - Collection may not exist or already cleared"
fi

echo ""
echo "✅ Migration preparation complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Ensure USE_INSTRUCTION_PREFIX=true in apps/backend/.env"
echo "   2. Restart the backend server"
echo "   3. Re-upload your documents via the UI"
echo "   4. Run benchmark to verify MRR improvement (0.844 → 0.875)"
echo ""
