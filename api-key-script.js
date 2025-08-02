class ApiKeyManager {
  constructor() {
    this.initializeEventListeners();
    this.checkExistingApiKey();
  }

  initializeEventListeners() {
    const form = document.getElementById("apiKeyForm");
    form.addEventListener("submit", (e) => this.handleFormSubmit(e));
  }

  checkExistingApiKey() {
    const existingApiKey = localStorage.getItem("geminiApiKey");

    if (existingApiKey && existingApiKey.trim().length > 0) {
      this.showExistingKeySection();
    }
  }

  showExistingKeySection() {
    document.getElementById("existingKeySection").style.display = "block";

    // Hide the form initially
    document.getElementById("apiKeyForm").style.display = "none";
  }

  hideExistingKeySection() {
    document.getElementById("existingKeySection").style.display = "none";
    document.getElementById("apiKeyForm").style.display = "block";
  }

  async handleFormSubmit(e) {
    e.preventDefault();

    const apiKeyInput = document.getElementById("apiKey");
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      alert("Por favor, insira sua API Key do Gemini.");
      return;
    }

    // Validate API Key format (basic validation)
    if (apiKey.length < 20) {
      alert(
        "A API Key parece ser muito curta. Verifique se você copiou corretamente."
      );
      return;
    }

    // Show loading state
    this.showLoadingState();

    try {
      // Test the API Key with a simple request
      const isValid = await this.validateApiKey(apiKey);

      if (isValid) {
        // Save API Key to localStorage
        localStorage.setItem("geminiApiKey", apiKey);

        // Redirect to results page
        window.location.href = "results.html";
      } else {
        alert(
          "API Key inválida. Verifique se você copiou corretamente e tente novamente."
        );
        this.hideLoadingState();
      }
    } catch (error) {
      console.error("Erro ao validar API Key:", error);
      alert(
        "Erro ao validar API Key. Verifique sua conexão e tente novamente."
      );
      this.hideLoadingState();
    }
  }

  async validateApiKey(apiKey) {
    try {
      const url =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: "Hello",
              },
            ],
          },
        ],
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      return response.ok;
    } catch (error) {
      console.error("Validation error:", error);
      return false;
    }
  }

  showLoadingState() {
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    document.querySelector(".btn-text").style.display = "none";
    document.querySelector(".btn-loader").style.display = "flex";
  }

  hideLoadingState() {
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = false;
    document.querySelector(".btn-text").style.display = "block";
    document.querySelector(".btn-loader").style.display = "none";
  }

  // Static methods for global access
  static continueWithExisting() {
    window.location.href = "results.html";
  }

  static clearAndUseNew() {
    localStorage.removeItem("geminiApiKey");
    ApiKeyManager.instance.hideExistingKeySection();
    document.getElementById("apiKey").focus();
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  ApiKeyManager.instance = new ApiKeyManager();
});
