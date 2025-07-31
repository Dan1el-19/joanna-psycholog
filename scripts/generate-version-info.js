#!/usr/bin/env node
// scripts/generate-version-info.js - Generuje informacje o wersji z Git

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseVersionFromCommitMessage(commitMessage) {
  // Parsuje wersję z różnych formatów:
  // "2.7 Release", "3.0.1 Hotfix", "PreRelease 2.6", "Release 2.7", "v2.6 Update"
  const patterns = [
    /^(\d+\.\d+(?:\.\d+)?)\s+/,           // "2.7 Release"
    /\s(\d+\.\d+(?:\.\d+)?)(?:\s|$)/,     // "PreRelease 2.6" lub "Release 2.6"
    /^v?(\d+\.\d+(?:\.\d+)?)/,            // "v2.6" lub "2.6" na początku
    /(\d+\.\d+(?:\.\d+)?)/                // dowolna wersja w tekście
  ];
  
  for (const pattern of patterns) {
    const match = commitMessage.match(pattern);
    if (match) {
      console.log(`✅ Version pattern matched: "${pattern}" -> "${match[1]}"`);
      return match[1];
    }
  }
  
  console.log(`❌ No version pattern matched in: "${commitMessage}"`);
  return null;
}

function getGitInfo() {
  let version = '2.5.1';
  let commitHash = 'unknown';
  let commitDate = new Date().toISOString().split('T')[0];
  let commitMessage = 'unknown';
  let branch = 'unknown';
  let hasChanges = false;
  
  try {
    // Pobierz wersję z package.json jako fallback
    const packageJsonPath = resolve(__dirname, '../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    version = packageJson.version;
    console.log('✅ Package.json version (fallback):', version);
  } catch (error) {
    console.warn('❌ Could not read package.json:', error.message);
  }

  try {
    // Pobierz hash ostatniego commita
    commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: 'pipe' }).trim();
    console.log('✅ Git commit hash:', commitHash.substring(0, 7));
  } catch (error) {
    console.warn('❌ Could not get commit hash:', error.message);
  }
  
  try {
    // Pobierz datę ostatniego commita
    commitDate = execSync('git log -1 --format=%cd --date=short', { encoding: 'utf8', stdio: 'pipe' }).trim();
    console.log('✅ Git commit date:', commitDate);
  } catch (error) {
    console.warn('❌ Could not get commit date:', error.message);
  }
  
  try {
    // Pobierz wiadomość ostatniego commita
    commitMessage = execSync('git log -1 --format=%s', { encoding: 'utf8', stdio: 'pipe' }).trim();
    console.log('✅ Git commit message:', commitMessage);
    
    // Spróbuj wyciągnąć wersję z commit message
    const versionFromCommit = parseVersionFromCommitMessage(commitMessage);
    if (versionFromCommit) {
      version = versionFromCommit;
      console.log('✅ Version extracted from commit message:', version);
    } else {
      console.log('ℹ️ No version found in commit message, using fallback version');
    }
  } catch (error) {
    console.warn('❌ Could not get commit message:', error.message);
  }
  
  try {
    // Pobierz nazwę brancha
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: 'pipe' }).trim();
    console.log('✅ Git branch:', branch);
  } catch (error) {
    console.warn('❌ Could not get branch:', error.message);
  }
  
  try {
    // Sprawdź czy są uncommitted changes
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf8', stdio: 'pipe' }).trim();
    hasChanges = statusOutput.length > 0;
    console.log('✅ Git status check:', hasChanges ? 'Has changes' : 'Clean');
  } catch (error) {
    console.warn('❌ Could not check git status:', error.message);
  }
  
  return {
    version,
    commitHash,
    commitDate,
    commitMessage,
    branch,
    hasChanges,
    buildDate: new Date().toISOString().split('T')[0]
  };
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