#!/usr/bin/env node
// scripts/generate-version-info.js - Generuje informacje o wersji z Git

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getGitInfo() {
  try {
    // Pobierz hash ostatniego commita
    const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    
    // Pobierz datę ostatniego commita
    const commitDate = execSync('git log -1 --format=%cd --date=short', { encoding: 'utf8' }).trim();
    
    // Pobierz wiadomość ostatniego commita
    const commitMessage = execSync('git log -1 --format=%s', { encoding: 'utf8' }).trim();
    
    // Pobierz nazwę brancha
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    
    // Pobierz wersję z package.json
    const packageJson = JSON.parse(execSync('cat package.json', { encoding: 'utf8' }));
    const version = packageJson.version;
    
    // Sprawdź czy są uncommitted changes
    const hasChanges = execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0;
    
    return {
      version,
      commitHash,
      commitDate,
      commitMessage,
      branch,
      hasChanges,
      buildDate: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    };
  } catch (error) {
    console.warn('Could not get Git info:', error.message);
    return {
      version: '2.5.1',
      commitHash: 'unknown',
      commitDate: new Date().toISOString().split('T')[0],
      commitMessage: 'unknown',
      branch: 'unknown',
      hasChanges: false,
      buildDate: new Date().toISOString().split('T')[0]
    };
  }
}

function generateVersionInfo() {
  const gitInfo = getGitInfo();
  
  console.log('📦 Generating version info...');
  console.log(`   Version: ${gitInfo.version}`);
  console.log(`   Commit: ${gitInfo.commitHash.substring(0, 7)}`);
  console.log(`   Date: ${gitInfo.commitDate}`);
  console.log(`   Branch: ${gitInfo.branch}`);
  console.log(`   Message: ${gitInfo.commitMessage}`);
  
  // Generuj plik JavaScript z informacjami o wersji
  const versionInfoContent = `// Auto-generated version info - DO NOT EDIT MANUALLY
// Generated at: ${new Date().toISOString()}

export const VERSION_INFO = ${JSON.stringify(gitInfo, null, 2)};

// Make it available globally for runtime access
if (typeof window !== 'undefined') {
  window.__BUILD_INFO__ = VERSION_INFO;
}
`;

  // Zapisz do src/generated-version-info.js
  const outputPath = resolve(__dirname, '../src/generated-version-info.js');
  writeFileSync(outputPath, versionInfoContent, 'utf8');
  
  console.log(`✅ Version info generated: ${outputPath}`);
  
  // Generuj również plik HTML z informacjami (opcjonalnie)
  const htmlContent = `<!-- Auto-generated version info -->
<script>
  window.__BUILD_INFO__ = ${JSON.stringify(gitInfo, null, 2)};
</script>`;
  
  const htmlOutputPath = resolve(__dirname, '../public/version-info.html');
  writeFileSync(htmlOutputPath, htmlContent, 'utf8');
  
  console.log(`✅ Version HTML generated: ${htmlOutputPath}`);
}

// Uruchom generowanie
generateVersionInfo();