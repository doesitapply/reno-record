#!/usr/bin/env node

/**
 * Create a permanent Render web service for Reno Record via Render API.
 *
 * Required env vars:
 *   RENDER_API_KEY - Render API key from Account Settings > API Keys
 *
 * Required app env vars are read from the current process and sent to Render.
 * Secrets are never printed.
 */

const API = 'https://api.render.com/v1';
const repo = 'https://github.com/doesitapply/reno-record';
const serviceName = process.env.RENDER_SERVICE_NAME || 'reno-record';

const requiredAppVars = [
  'DATABASE_URL',
  'VITE_APP_ID',
  'OAUTH_SERVER_URL',
  'VITE_OAUTH_PORTAL_URL',
  'OWNER_OPEN_ID',
  'BUILT_IN_FORGE_API_URL',
  'BUILT_IN_FORGE_API_KEY',
  'VITE_FRONTEND_FORGE_API_URL',
  'VITE_FRONTEND_FORGE_API_KEY',
];

const optionalAppVars = [
  'VITE_ANALYTICS_ENDPOINT',
  'VITE_ANALYTICS_WEBSITE_ID',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function render(path, options = {}) {
  const key = requireEnv('RENDER_API_KEY');
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const clean = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    throw new Error(`Render API ${res.status} ${res.statusText}: ${clean}`);
  }
  return body;
}

function envVarsPayload() {
  const missing = requiredAppVars.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing app environment variables: ${missing.join(', ')}`);
  }

  const vars = [
    { key: 'NODE_ENV', value: 'production' },
    { key: 'NODE_VERSION', value: '22.13.0' },
    { key: 'JWT_SECRET', generateValue: true },
  ];

  for (const key of [...requiredAppVars, ...optionalAppVars]) {
    if (process.env[key]) vars.push({ key, value: process.env[key] });
  }
  return vars;
}

async function main() {
  const owners = await render('/owners?limit=20');
  const selectedOwner = process.env.RENDER_OWNER_ID
    ? owners.find((item) => item.owner?.id === process.env.RENDER_OWNER_ID)
    : owners[0];

  if (!selectedOwner?.owner?.id) {
    throw new Error('Could not resolve Render owner/workspace. Set RENDER_OWNER_ID explicitly.');
  }

  const ownerId = selectedOwner.owner.id;
  console.log(`Using Render workspace: ${selectedOwner.owner.name || ownerId}`);

  const payload = {
    type: 'web_service',
    name: serviceName,
    ownerId,
    repo,
    branch: 'main',
    autoDeploy: 'yes',
    envVars: envVarsPayload(),
    serviceDetails: {
      runtime: 'node',
      plan: process.env.RENDER_PLAN || 'starter',
      region: process.env.RENDER_REGION || 'oregon',
      healthCheckPath: '/',
      envSpecificDetails: {
        buildCommand: 'corepack enable && pnpm install --frozen-lockfile && pnpm build',
        startCommand: 'pnpm start',
      },
    },
  };

  const created = await render('/services', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const service = created.service || created;
  console.log('Render service created.');
  console.log(`Service ID: ${service.id || '(see Render dashboard)'}`);
  console.log(`Dashboard: ${service.dashboardUrl || 'https://dashboard.render.com/'}`);
  console.log(`URL: ${service.serviceDetails?.url || service.url || '(available after first deploy)'}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
