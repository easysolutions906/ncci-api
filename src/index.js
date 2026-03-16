#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import {
  buildIndexes,
  validatePair,
  validateClaim,
  getEditsForCode,
  getMue,
  searchEdits,
  buildStats,
} from './validate.js';

import {
  PLANS,
  authMiddleware,
  incrementUsage,
  createKey,
  revokeKey,
} from './keys.js';

import { createCheckoutSession, handleWebhook } from './stripe.js';

// --- Load data ---

const DATA_DIR = new URL('./data/', import.meta.url).pathname;

const loadData = async () => {
  const [ptpRaw, mueRaw, metaRaw] = await Promise.all([
    readFile(`${DATA_DIR}ptp-edits.json`, 'utf-8'),
    readFile(`${DATA_DIR}mue.json`, 'utf-8'),
    readFile(`${DATA_DIR}meta.json`, 'utf-8'),
  ]);
  return {
    ptpEdits: JSON.parse(ptpRaw),
    mueData: JSON.parse(mueRaw),
    meta: JSON.parse(metaRaw),
  };
};

const { ptpEdits, mueData, meta } = await loadData();
const indexes = buildIndexes(ptpEdits, mueData);
console.log(`Loaded ${ptpEdits.length} PTP edits and ${mueData.length} MUE entries (CMS ${meta.cmsQuarter})`);

// --- Shared response envelope ---

const auditFields = () => ({
  dataVersion: meta.cmsQuarter,
  buildDate: meta.buildDate,
  validatedAt: new Date().toISOString(),
});

// --- Express API ---

const buildExpressApp = () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use((_req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-admin-secret',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    });
    if (_req.method === 'OPTIONS') { return res.sendStatus(204); }
    next();
  });

  // GET / — API info
  app.get('/', (_req, res) => {
    res.json({
      name: 'NCCI Claims Validation API',
      version: '1.0.0',
      description: 'Validate CPT/HCPCS code pairs against CMS NCCI PTP edits and MUE limits for medical billing compliance',
      dataVersion: meta.cmsQuarter,
      ptpEdits: meta.ptpEditCount,
      mueEntries: meta.mueCount,
      endpoints: {
        'GET /': 'API info and endpoint list',
        'GET /health': 'Health check',
        'GET /data-info': 'Data build date, record counts, CMS quarter',
        'POST /validate': 'Validate a code pair { code1, code2, modifiers? }',
        'POST /validate/claim': 'Validate a full claim { codes[], modifiers? }',
        'POST /validate/batch': 'Batch validate multiple claims',
        'GET /edits?code=99213': 'Get all NCCI edits for a code',
        'GET /mue?code=99213': 'Get MUE limit for a code',
        'GET /search?q=arthroscopy': 'Search edits by code or description',
        'GET /stats': 'Edit counts by category',
      },
    });
  });

  // GET /health
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      ptpEdits: ptpEdits.length,
      mueEntries: mueData.length,
    });
  });

  // GET /data-info
  app.get('/data-info', (_req, res) => {
    res.json({
      dataSource: meta.dataSource,
      cmsQuarter: meta.cmsQuarter,
      buildDate: meta.buildDate,
      ptpEditCount: meta.ptpEditCount,
      mueCount: meta.mueCount,
      categories: meta.categories,
    });
  });

  // POST /validate — single pair (key-gated)
  app.post('/validate', authMiddleware, (req, res) => {
    const { code1, code2, modifiers } = req.body || {};

    if (!code1 || !code2) {
      return res.status(400).json({ error: 'Request body must include "code1" and "code2" strings' });
    }

    const result = validatePair(indexes, code1.toUpperCase(), code2.toUpperCase(), modifiers || {});
    incrementUsage(req.identifier, 1);

    res.json({
      ...result,
      plan: req.planName,
      ...auditFields(),
    });
  });

  // POST /validate/claim — full claim (key-gated)
  app.post('/validate/claim', authMiddleware, (req, res) => {
    const { codes, modifiers } = req.body || {};

    if (!codes || !Array.isArray(codes) || codes.length < 2) {
      return res.status(400).json({ error: 'Request body must include a "codes" array with at least 2 CPT/HCPCS codes' });
    }

    if (codes.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 codes per claim validation' });
    }

    const upperCodes = codes.map((c) => c.toUpperCase());
    const result = validateClaim(indexes, upperCodes, modifiers || {});
    incrementUsage(req.identifier, 1);

    res.json({
      ...result,
      plan: req.planName,
      ...auditFields(),
    });
  });

  // POST /validate/batch — batch claims (key-gated)
  app.post('/validate/batch', authMiddleware, (req, res) => {
    const { claims } = req.body || {};

    if (!claims || !Array.isArray(claims) || claims.length === 0) {
      return res.status(400).json({ error: 'Request body must include a "claims" array' });
    }

    if (claims.length > req.plan.batchLimit) {
      return res.status(400).json({
        error: `Maximum ${req.plan.batchLimit} claims per batch on ${req.planName} plan`,
        limit: req.plan.batchLimit,
      });
    }

    const results = claims.map((claim, idx) => {
      const { codes, modifiers } = claim;
      if (!codes || !Array.isArray(codes) || codes.length < 2) {
        return { claimIndex: idx, error: 'Each claim must have a "codes" array with at least 2 codes' };
      }
      const upperCodes = codes.map((c) => c.toUpperCase());
      return { claimIndex: idx, ...validateClaim(indexes, upperCodes, modifiers || {}) };
    });

    incrementUsage(req.identifier, claims.length);

    res.json({
      total: results.length,
      results,
      plan: req.planName,
      ...auditFields(),
    });
  });

  // GET /edits
  app.get('/edits', (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Query parameter "code" is required' });
    }

    const edits = getEditsForCode(indexes, code.toUpperCase());

    res.json({
      code: code.toUpperCase(),
      editCount: edits.length,
      edits,
      ...auditFields(),
    });
  });

  // GET /mue
  app.get('/mue', (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Query parameter "code" is required' });
    }

    const result = getMue(indexes, code.toUpperCase());

    res.json({
      ...result,
      ...auditFields(),
    });
  });

  // GET /search
  app.get('/search', (req, res) => {
    const { q } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const result = searchEdits(ptpEdits, mueData, q, limit, offset);

    res.json({ ...result, ...auditFields() });
  });

  // GET /stats
  app.get('/stats', (_req, res) => {
    res.json({ ...buildStats(ptpEdits, mueData, meta), ...auditFields() });
  });

  // --- Admin endpoints ---

  const adminAuth = (req, res, next) => {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) { return res.status(503).json({ error: 'Admin not configured' }); }
    if (req.headers['x-admin-secret'] !== secret) {
      return res.status(401).json({ error: 'Invalid admin secret' });
    }
    next();
  };

  app.post('/admin/keys', adminAuth, (req, res) => {
    const { plan = 'pro', email = null } = req.body || {};
    if (!PLANS[plan]) {
      return res.status(400).json({ error: `Invalid plan. Options: ${Object.keys(PLANS).join(', ')}` });
    }
    const result = createKey(plan, email);
    res.json(result);
  });

  app.delete('/admin/keys/:key', adminAuth, (req, res) => {
    const revoked = revokeKey(req.params.key);
    res.json({ revoked });
  });

  app.get('/admin/plans', adminAuth, (_req, res) => {
    res.json(PLANS);
  });

  // --- Checkout endpoint ---

  app.post('/checkout', async (req, res) => {
    const { plan, successUrl, cancelUrl } = req.body || {};
    if (!plan || !PLANS[plan] || plan === 'free') {
      return res.status(400).json({
        error: `Invalid plan. Options: ${Object.keys(PLANS).filter((p) => p !== 'free').join(', ')}`,
      });
    }
    try {
      const session = await createCheckoutSession(plan, successUrl, cancelUrl);
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Stripe webhook ---

  app.post('/webhook/stripe', express.raw({ type: 'application/json' }), (req, res) => {
    try {
      const result = handleWebhook(req.body.toString(), req.headers['stripe-signature']);
      res.json({ received: true, result: result || null });
    } catch (err) {
      console.error('Stripe webhook error:', err.message);
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  });

  return app;
};

// --- MCP Server ---

const buildMcpServer = () => {
  const server = new McpServer({
    name: 'ncci-claims-validation',
    version: '1.0.0',
  });

  server.tool(
    'ncci_validate_pair',
    'Check if two CPT/HCPCS codes can be billed together on the same claim. Returns NCCI PTP edit status, modifier requirements, and rationale. Essential for medical billing compliance.',
    {
      code1: z.string().describe('First CPT/HCPCS code (e.g., "99213")'),
      code2: z.string().describe('Second CPT/HCPCS code (e.g., "36415")'),
      modifiers: z.record(z.union([z.string(), z.array(z.string())])).optional()
        .describe('Modifiers applied to codes, keyed by code (e.g., {"36415": "59"})'),
    },
    async ({ code1, code2, modifiers }) => {
      const result = validatePair(indexes, code1.toUpperCase(), code2.toUpperCase(), modifiers || {});
      return { content: [{ type: 'text', text: JSON.stringify({ ...result, ...auditFields() }, null, 2) }] };
    },
  );

  server.tool(
    'ncci_validate_claim',
    'Validate a full medical claim by checking all CPT/HCPCS code pair combinations for NCCI PTP edits and MUE (Medically Unlikely Edits) violations. Returns all issues found with actionable guidance.',
    {
      codes: z.array(z.string()).describe('Array of CPT/HCPCS codes on the claim (e.g., ["99213", "36415", "80053"])'),
      modifiers: z.record(z.union([z.string(), z.array(z.string())])).optional()
        .describe('Modifiers applied to codes, keyed by code (e.g., {"36415": "59"})'),
    },
    async ({ codes, modifiers }) => {
      const upperCodes = codes.map((c) => c.toUpperCase());
      const result = validateClaim(indexes, upperCodes, modifiers || {});
      return { content: [{ type: 'text', text: JSON.stringify({ ...result, ...auditFields() }, null, 2) }] };
    },
  );

  server.tool(
    'ncci_edits',
    'Get all NCCI PTP edits for a specific CPT/HCPCS code. Shows every code it bundles with, whether the code is the comprehensive or component code, and modifier requirements.',
    {
      code: z.string().describe('CPT/HCPCS code to look up (e.g., "99213")'),
    },
    async ({ code }) => {
      const edits = getEditsForCode(indexes, code.toUpperCase());
      const result = { code: code.toUpperCase(), editCount: edits.length, edits, ...auditFields() };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'ncci_mue',
    'Get the Medically Unlikely Edit (MUE) limit for a CPT/HCPCS code. Returns the maximum number of units that can be reported per line/day/encounter.',
    {
      code: z.string().describe('CPT/HCPCS code to look up (e.g., "99213")'),
    },
    async ({ code }) => {
      const result = getMue(indexes, code.toUpperCase());
      return { content: [{ type: 'text', text: JSON.stringify({ ...result, ...auditFields() }, null, 2) }] };
    },
  );

  server.tool(
    'ncci_search',
    'Search NCCI edits by CPT/HCPCS code, description keyword, or category. Returns matching PTP edits and MUE entries.',
    {
      query: z.string().describe('Search term — code number, procedure name, or category (e.g., "arthroscopy", "99213", "gi-bundling")'),
      limit: z.number().optional().describe('Maximum results (default 50, max 200)'),
      offset: z.number().optional().describe('Number of results to skip for pagination'),
    },
    async ({ query, limit, offset }) => {
      const result = searchEdits(ptpEdits, mueData, query, limit ?? 50, offset ?? 0);
      return { content: [{ type: 'text', text: JSON.stringify({ ...result, ...auditFields() }, null, 2) }] };
    },
  );

  return server;
};

// --- Start ---

const main = async () => {
  const port = process.env.PORT;

  if (port) {
    // HTTP mode: Express REST API + MCP streamable HTTP
    const app = buildExpressApp();
    const mcpServer = buildMcpServer();
    const transports = {};

    app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];
      let transport = transports[sessionId];

      if (!transport) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };
        await mcpServer.connect(transport);
        transports[transport.sessionId] = transport;
      }

      await transport.handleRequest(req, res, req.body);
    });

    app.get('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];
      const transport = transports[sessionId];
      if (!transport) {
        res.status(400).json({ error: 'No active session. Send a POST to /mcp first.' });
        return;
      }
      await transport.handleRequest(req, res);
    });

    app.delete('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];
      const transport = transports[sessionId];
      if (!transport) {
        res.status(400).json({ error: 'No active session.' });
        return;
      }
      await transport.handleRequest(req, res);
    });

    app.listen(parseInt(port, 10), () => {
      console.log(`NCCI Claims Validation API running on port ${port}`);
      console.log(`REST endpoints: http://localhost:${port}/`);
      console.log(`MCP endpoint: http://localhost:${port}/mcp`);
    });
  } else {
    // Stdio mode: MCP only
    const mcpServer = buildMcpServer();
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
  }
};

main().catch((err) => {
  console.error('Failed to start NCCI server:', err);
  process.exit(1);
});
