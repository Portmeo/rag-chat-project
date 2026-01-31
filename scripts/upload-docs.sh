#!/bin/bash

# Script para subir todos los documentos .md al backend
# ======================================================

API_URL="http://localhost:3001/api/documents/upload"
DOCS_DIR="/Users/alejandro.exposito/Projects/rag-chat-project/files"

echo "📤 Uploading documents to RAG system..."
echo "========================================="
echo ""

count=0
total=$(ls "$DOCS_DIR"/*.md | wc -l | tr -d ' ')

for file in "$DOCS_DIR"/*.md; do
    count=$((count + 1))
    filename=$(basename "$file")

    echo "[$count/$total] Uploading: $filename"

    response=$(curl -s -X POST "$API_URL" \
        -F "file=@$file")

    # Check if success
    if echo "$response" | grep -q '"success":true'; then
        chunks=$(echo "$response" | grep -o '"chunksCount":[0-9]*' | cut -d':' -f2)
        echo "   ✅ Success - $chunks chunks indexed"
    else
        echo "   ❌ Failed"
        echo "   Response: $response"
    fi

    echo ""
done

echo "========================================="
echo "✅ Upload completed: $count/$total files"
echo ""
