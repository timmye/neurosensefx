#!/usr/bin/env node

console.log('🔍 Z.AI Endpoint Analysis - Complete Mapping\n');

// Based on our testing and documentation research
const endpoints = {
  // WORKING ENDPOINTS (we confirmed these work)
  confirmed_working: [
    {
      name: 'Global Chat API',
      url: 'https://api.z.ai/api/paas/v4/chat/completions',
      status: '✅ WORKING (429 billing error)',
      use_case: 'Chat completions, text generation',
      model: 'GLM-4, GLM-4.5V (vision)'
    },
    {
      name: 'Global API v1',
      url: 'https://api.z.ai/api/v1/chat/completions',
      status: '✅ WORKING (200 but returns 404 in body)',
      use_case: 'Alternative endpoint',
      note: 'Endpoint exists but format might be different'
    }
  ],

  // PROBLEMATIC ENDPOINTS
  chinese_blocked: [
    {
      name: 'Chinese Mainland API',
      url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      status: '❌ BLOCKED/Timeout from this environment',
      note: 'CN endpoint, blocked from WSL2/WSL'
    },
    {
      name: 'Alternative CN URLs',
      urls: [
        'https://open.bigmodel.cn/v4/chat/completions',
        'https://glm.openbigmodel.cn/api/paas/v4/chat/completions',
        'https://chatglm.cn/api/paas/v4/chat/completions'
      ],
      status: '❌ BLOCKED/Timeout'
    }
  ],

  // HYPOTHETICAL ENDPOINTS (mentioned by user)
  coder_endpoints: [
    {
      name: 'Coder API (User Mentioned)',
      url: 'UNKNOWN - User said "we use the coder endpoint for coding"',
      question: 'What is the actual coder endpoint URL?'
    }
  ],

  // MCP SERVER INTERNAL ENDPOINT (unknown)
  mcp_internal: [
    {
      name: 'MCP Server Internal',
      url: 'UNKNOWN - causing "fetch failed"',
      problem: 'MCP server using wrong endpoint internally',
      evidence: 'Network error: TypeError: fetch failed'
    }
  ]
};

console.log('📋 CONFIRMED WORKING ENDPOINTS:');
endpoints.confirmed_working.forEach((ep, i) => {
  console.log(`${i + 1}. ${ep.name}`);
  console.log(`   URL: ${ep.url}`);
  console.log(`   Status: ${ep.status}`);
  console.log(`   Use Case: ${ep.use_case}`);
  if (ep.model) console.log(`   Models: ${ep.model}`);
  if (ep.note) console.log(`   Note: ${ep.note}`);
  console.log('');
});

console.log('❌ BLOCKED ENDPOINTS (from this environment):');
endpoints.chinese_blocked.forEach((group, i) => {
  console.log(`${i + 1}. ${group.name}`);
  if (group.urls) {
    group.urls.forEach((url, j) => {
      console.log(`   ${j + 1}. ${url}`);
    });
  } else {
    console.log(`   URL: ${group.url}`);
  }
  console.log(`   Status: ${group.status}`);
  console.log(`   Note: ${group.note || ''}`);
  console.log('');
});

console.log('❓ UNKNOWN ENDPOINTS:');
endpoints.coder_endpoints.forEach((ep, i) => {
  console.log(`${i + 1}. ${ep.name}`);
  console.log(`   Question: ${ep.question}`);
  console.log('');
});

console.log('🔍 MCP SERVER ISSUE:');
console.log('The MCP server starts correctly, receives requests, encodes images properly,');
console.log('but when it calls the ZAI API internally, it gets "fetch failed".');
console.log('');
console.log('🤔 POSSIBLE REASONS:');
console.log('');
console.log('1. Claude Config Issue:');
console.log('   - MCP server might be reading endpoint from Claude config');
console.log('   - Check: claude config show');
console.log('   - Look for ZAI endpoint configuration');
console.log('');
console.log('2. MCP Server Default Endpoint:');
console.log('   - @z_ai/mcp-server might have hardcoded incorrect endpoint');
console.log('   - Might be using Chinese endpoint by default');
console.log('   - Might need environment variable to override');
console.log('');
console.log('3. Coder vs Chat Endpoint:');
console.log('   - User mentioned "coder endpoint for coding"');
console.log('   - There might be separate endpoints: chat vs coder');
console.log('   - MCP might be using wrong type (chat vs coder)');
console.log('');
console.log('4. Endpoint Format Issue:');
console.log('   - Working: /api/paas/v4/chat/completions');
console.log('   - MCP might be using different format');
console.log('   - Might need different path or host');

console.log('🎯 KEY QUESTIONS FOR USER:');
console.log('');
console.log('1. What is the exact URL of the "coder endpoint" you use for coding?');
console.log('2. How do you configure the Z.AI endpoint in Claude Code normally?');
console.log('3. Are there different endpoints for "chat" vs "coder" functionality?');
console.log('4. Do you have any Z.AI configuration files that work?');

// Check Claude configuration
console.log('\n🔧 Checking Claude Configuration...');
const { spawn } = require('child_process');

const configCheck = spawn('claude', ['config', 'show'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let configOutput = '';

configCheck.stdout.on('data', (data) => {
  configOutput += data.toString();
});

configCheck.stderr.on('data', (data) => {
  configOutput += data.toString();
});

configCheck.on('close', () => {
  console.log('Claude Config Output:');
  console.log(configOutput);

  // Look for any ZAI or endpoint references
  const zaiPatterns = [
    /z\.ai/gi,
    /bigmodel/gi,
    /endpoint/gi,
    /api/gi,
    /url/gi
  ];

  console.log('\n🔍 ZAI/Endpoint References in Claude Config:');
  let found = false;
  zaiPatterns.forEach(pattern => {
    const matches = configOutput.match(pattern);
    if (matches) {
      console.log(`   Found: ${pattern.source} - ${matches.join(', ')}`);
      found = true;
    }
  });

  if (!found) {
    console.log('   ❌ No ZAI or endpoint references found in Claude config');
  }

  console.log('\n💡 NEXT STEPS:');
  console.log('1. User: What is the exact coder endpoint URL you use?');
  console.log('2. User: How do you normally configure Z.AI in Claude?');
  console.log('3. User: Are there different coder vs chat endpoints?');
  console.log('4. Once we know the working endpoint, we can fix the MCP server');
});