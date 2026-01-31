#!/bin/bash

echo "📚 Reindexing documents with instruction-prefixed embeddings..."
echo ""

BACKEND_URL="http://localhost:3001"
DOCS_DIR="/Users/alejandro.exposito/Projects/rag-chat-project/apps/backend/uploads/documents"

# Check if backend is running
if ! curl -s "$BACKEND_URL/health" > /dev/null; then
  echo "❌ Backend is not running on $BACKEND_URL"
  exit 1
fi

echo "✅ Backend is running"
echo ""

# Find all document files
FILES=$(find "$DOCS_DIR" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" \))
TOTAL=$(echo "$FILES" | wc -l | tr -d ' ')

echo "Found $TOTAL documents to reindex"
echo ""

COUNT=0
SUCCESS=0
FAILED=0

for FILE in $FILES; do
  COUNT=$((COUNT + 1))
  FILENAME=$(basename "$FILE")

  echo "[$COUNT/$TOTAL] Uploading: $FILENAME"

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/documents/upload" \
    -F "file=@$FILE")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)

  if [ "$HTTP_CODE" -eq 200 ]; then
    SUCCESS=$((SUCCESS + 1))
    CHUNKS=$(echo "$BODY" | grep -o '"chunksCount":[0-9]*' | cut -d':' -f2)
    echo "  ✅ Success - $CHUNKS chunks created"
  else
    FAILED=$((FAILED + 1))
    echo "  ❌ Failed (HTTP $HTTP_CODE)"
    echo "  Response: $BODY"
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Reindexing Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total documents: $TOTAL"
echo "✅ Successful: $SUCCESS"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 All documents reindexed successfully!"
  echo ""
  echo "📋 Next steps:"
  echo "   1. Test queries via the UI or API"
  echo "   2. Run benchmark to verify MRR improvement:"
  echo "      cd benchmark && python round2_optimized_benchmark.py"
else
  echo "⚠️  Some documents failed to reindex"
  echo "   Check the error messages above"
fi
