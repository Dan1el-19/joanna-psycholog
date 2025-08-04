// src/version-info.js - Automatyczne pobieranie informacji o wersji z Git

export class VersionInfo {
  static async getVersionInfo() {
    try {
      // Najpierw próbujemy załadować wygenerowany plik
      try {
        const { VERSION_INFO } = await import('./generated-version-info.js');
        console.log('✅ Loaded version info from generated file:', VERSION_INFO);
        return VERSION_INFO;
      } catch (importError) {
        console.warn('❌ Could not import generated version info:', importError.message);
      }

      // Próbujemy pobrać informacje z build-time (jeśli zostały wygenerowane)
      if (window.__BUILD_INFO__) {
        console.log('✅ Using build-time version info');
        return window.__BUILD_INFO__;
      }

      // Fallback - statyczne informacje
      console.warn('⚠️ Using fallback version info');
      return {
        version: '2.5.1',
        commitHash: 'unknown',
        commitDate: new Date().toLocaleDateString('pl-PL'),
        buildDate: new Date().toLocaleDateString('pl-PL'),
        commitMessage: 'unknown',
        branch: 'unknown',
        hasChanges: false
      };
    } catch (error) {
      console.warn('Could not get version info:', error);
      return {
        version: '2.5.1',
        commitHash: 'unknown',
        commitDate: new Date().toLocaleDateString('pl-PL'),
        buildDate: new Date().toLocaleDateString('pl-PL'),
        commitMessage: 'unknown',
        branch: 'unknown',
        hasChanges: false
      };
    }
  }

  static formatVersionString(versionInfo) {
    const { version, commitHash, commitDate } = versionInfo;
    const shortHash = commitHash !== 'unknown' ? commitHash.substring(0, 7) : '';
    
    if (shortHash) {
      return `${version} (${shortHash})`;
    }
    return version;
  }

  static formatDateString(versionInfo) {
    return versionInfo.commitDate || versionInfo.buildDate;
  }
}