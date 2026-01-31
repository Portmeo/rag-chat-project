#!/usr/bin/env bun
/**
 * Test script to verify instruction prefixes are working correctly
 */

import { embeddings, EMBEDDINGS_CONFIG } from '../apps/backend/src/services/rag/config';

async function testInstructionPrefixes() {
  console.log('🧪 Testing Instruction Prefix Implementation\n');
  console.log('=' .repeat(60));

  // Check configuration
  console.log('\n📋 Configuration:');
  console.log(`  Feature enabled: ${EMBEDDINGS_CONFIG.enabled}`);
  console.log(`  Query prefix: "${EMBEDDINGS_CONFIG.queryPrefix}"`);
  console.log(`  Document prefix: "${EMBEDDINGS_CONFIG.documentPrefix}"`);
  console.log(`  Embeddings class: ${embeddings.constructor.name}`);

  if (!EMBEDDINGS_CONFIG.enabled) {
    console.log('\n⚠️  Instruction prefix is DISABLED');
    console.log('   Set USE_INSTRUCTION_PREFIX=true in .env to enable');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n🔬 Running embedding tests...\n');

  // Test 1: Embed a query
  console.log('Test 1: Query embedding (should have prefix)');
  const testQuery = 'What is Angular version?';
  console.log(`  Input: "${testQuery}"`);

  const queryEmbedding = await embeddings.embedQuery(testQuery);
  console.log(`  ✅ Generated embedding vector (dim: ${queryEmbedding.length})`);
  console.log(`  First 5 values: [${queryEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);

  // Test 2: Embed a document
  console.log('\nTest 2: Document embedding (should NOT have prefix)');
  const testDoc = 'Angular 15 is the version used in this project.';
  console.log(`  Input: "${testDoc}"`);

  const docEmbeddings = await embeddings.embedDocuments([testDoc]);
  console.log(`  ✅ Generated embedding vector (dim: ${docEmbeddings[0].length})`);
  console.log(`  First 5 values: [${docEmbeddings[0].slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);

  // Test 3: Verify vectors are different (because of prefix)
  console.log('\nTest 3: Comparing query vs document embeddings');
  const sameTextQuery = await embeddings.embedQuery(testDoc);
  const sameTextDoc = await embeddings.embedDocuments([testDoc]);

  const queryVec = sameTextQuery;
  const docVec = sameTextDoc[0];

  // Calculate cosine similarity
  const dotProduct = queryVec.reduce((sum, val, i) => sum + val * docVec[i], 0);
  const magQ = Math.sqrt(queryVec.reduce((sum, val) => sum + val * val, 0));
  const magD = Math.sqrt(docVec.reduce((sum, val) => sum + val * val, 0));
  const similarity = dotProduct / (magQ * magD);

  console.log(`  Same text: "${testDoc}"`);
  console.log(`  Query embedding (with prefix) vs Document embedding (no prefix)`);
  console.log(`  Cosine similarity: ${similarity.toFixed(4)}`);

  if (similarity < 0.99) {
    console.log(`  ✅ Vectors are DIFFERENT (good! prefix is working)`);
    console.log(`     Query has prefix, document doesn't`);
  } else {
    console.log(`  ❌ Vectors are TOO SIMILAR (similarity > 0.99)`);
    console.log(`     Prefix might not be applied correctly`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Test completed!');
  console.log('\n💡 Interpretation:');
  console.log('  - Query embeddings should include the instruction prefix');
  console.log('  - Document embeddings should NOT have prefix (plain text)');
  console.log('  - This asymmetric approach improves MRR from 0.844 → 0.875');
  console.log('\n' + '='.repeat(60));
}

testInstructionPrefixes().catch(console.error);
