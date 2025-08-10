#!/usr/bin/env node
/**
 * Simple sitemap generator based on known static routes.
 * Run after build (outputs to dist/sitemap.xml for Firebase hosting).
 */
/* global process */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://www.myreflection.pl';
const NOW = new Date().toISOString();

// Add or adjust when new public pages are added
const routes = [
  '/',
  '/o-mnie',
  '/kwalifikacje',
  '/oferta',
  '/umow-wizyte',
  '/kontakt',
  '/polityka-prywatnosci'
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
routes.map(p => `  <url>\n    <loc>${BASE_URL}${p}</loc>\n    <lastmod>${NOW}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${p === '/' ? '1.0' : '0.7'}</priority>\n  </url>`).join('\n') +
`\n</urlset>\n`;

const outDir = join(process.cwd(), 'dist');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'sitemap.xml'), xml, 'utf8');
console.log('Generated sitemap.xml with', routes.length, 'routes');
