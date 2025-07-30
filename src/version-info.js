// src/version-info.js - Automatyczne pobieranie informacji o wersji z Git

export class VersionInfo {
  static async getVersionInfo() {
    try {
      // Próbujemy pobrać informacje z build-time (jeśli zostały wygenerowane)
      if (window.__BUILD_INFO__) {
        return window.__BUILD_INFO__;
      }

      // Fallback - statyczne informacje
      return {
        version: '2.5.1',
        commitHash: 'unknown',
        commitDate: new Date().toLocaleDateString('pl-PL'),
        buildDate: new Date().toLocaleDateString('pl-PL')
      };
    } catch (error) {
      console.warn('Could not get version info:', error);
      return {
        version: '2.5.1',
        commitHash: 'unknown',
        commitDate: new Date().toLocaleDateString('pl-PL'),
        buildDate: new Date().toLocaleDateString('pl-PL')
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