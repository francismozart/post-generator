// Utility class for managing API Keys across the application
class ApiKeyUtils {
  static getApiKey() {
    return localStorage.getItem("geminiApiKey");
  }

  static setApiKey(apiKey) {
    localStorage.setItem("geminiApiKey", apiKey);
  }

  static clearApiKey() {
    localStorage.removeItem("geminiApiKey");
  }

  static hasApiKey() {
    const apiKey = this.getApiKey();
    return apiKey && apiKey.trim().length > 0;
  }

  static redirectToApiKeyPage() {
    window.location.href = "index.html";
  }

  static ensureApiKey() {
    if (!this.hasApiKey()) {
      this.redirectToApiKeyPage();
      return false;
    }
    return true;
  }
}

// Make utilities globally available
window.ApiKeyUtils = ApiKeyUtils;
