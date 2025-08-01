class BlogGenerator {
  constructor() {
    this.apiKey = "";
    this.categoria = "";
    this.titulos = [];
    this.blogPosts = [];
    this.currentProgress = 0;
    this.totalSteps = 0;

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    const form = document.getElementById("blogForm");
    form.addEventListener("submit", (e) => this.handleFormSubmit(e));
  }

  async handleFormSubmit(e) {
    e.preventDefault();

    // Get form data
    this.apiKey = document.getElementById("apiKey").value.trim();
    this.categoria = document.getElementById("categoria").value.trim();
    const titulosText = document.getElementById("titulos").value.trim();

    // Validate inputs
    if (!this.apiKey || !this.categoria || !titulosText) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    // Parse titles
    this.titulos = titulosText
      .split("\n")
      .map((title) => title.trim())
      .filter((title) => title.length > 0);

    if (this.titulos.length === 0) {
      alert("Por favor, insira pelo menos um título.");
      return;
    }

    // Start processing
    await this.processAllTitles();
  }

  async processAllTitles() {
    // Show progress container and hide form
    this.showProgress();
    this.disableForm();

    // Calculate total steps (outline + sections for each title)
    this.totalSteps = this.titulos.length * 2; // Rough estimate
    this.currentProgress = 0;
    this.blogPosts = [];

    try {
      for (let i = 0; i < this.titulos.length; i++) {
        const title = this.titulos[i];
        this.updateProgress(
          `Processando: ${title}`,
          (i / this.titulos.length) * 100
        );

        const blogPost = await this.processSingleTitle(title, i + 1);
        this.blogPosts.push(blogPost);
      }

      this.updateProgress("Finalizando...", 100);

      // Save results and redirect
      this.saveResultsAndRedirect();
    } catch (error) {
      console.error("Erro durante o processamento:", error);
      alert("Erro durante o processamento: " + error.message);
      this.enableForm();
      this.hideProgress();
    }
  }

  async processSingleTitle(title, index) {
    const blogPost = {
      id: index,
      title: title,
      categoria: this.categoria,
      outline: null,
      sections: [],
      createdAt: new Date().toISOString(),
    };

    try {
      // Step 1: Generate outline
      this.updateCurrentTask(`Gerando estrutura para: ${title}`);
      const outlinePrompt = `Gere uma outline (estrutura de artigo para blog) com a palavra-chave ${title}`;
      const outlineResponse = await this.callGeminiAPI(outlinePrompt);
      blogPost.outline = outlineResponse;

      // Parse sections from outline
      const sections = this.parseSectionsFromOutline(outlineResponse);

      // Step 2: Generate content for each section
      for (let i = 0; i < sections.length; i++) {
        const sectionName = sections[i];
        this.updateCurrentTask(`Gerando conteúdo para seção: ${sectionName}`);

        const sectionPrompt = `Gere o texto completo (sem lacunas a serem preenchidas) para a seção do blog ${sectionName}`;
        const sectionContent = await this.callGeminiAPI(sectionPrompt);

        blogPost.sections.push({
          name: sectionName,
          content: sectionContent,
        });

        // Small delay to avoid rate limiting
        await this.delay(500);
      }
    } catch (error) {
      console.error(`Erro ao processar título "${title}":`, error);
      blogPost.error = error.message;
    }

    return blogPost;
  }

  async callGeminiAPI(prompt) {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API Error: ${response.status} - ${
          errorData.error?.message || "Unknown error"
        }`
      );
    }

    const data = await response.json();

    if (
      !data.candidates ||
      !data.candidates[0] ||
      !data.candidates[0].content
    ) {
      throw new Error("Resposta inválida da API");
    }

    return data.candidates[0].content.parts[0].text;
  }

  parseSectionsFromOutline(outline) {
    // Simple parsing - look for lines that start with numbers or bullets
    const lines = outline.split("\n");
    const sections = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Look for numbered sections (1., 2., etc.) or bullet points (-, *, •)
      if (trimmed.match(/^(\d+\.|\-|\*|•)\s+(.+)$/)) {
        const match = trimmed.match(/^(\d+\.|\-|\*|•)\s+(.+)$/);
        if (match && match[2]) {
          sections.push(match[2].trim());
        }
      }
      // Also look for headers (lines that are short and don't end with punctuation)
      else if (
        trimmed.length > 0 &&
        trimmed.length < 100 &&
        !trimmed.endsWith(".") &&
        !trimmed.endsWith(",")
      ) {
        sections.push(trimmed);
      }
    }

    // If no sections found, create default ones
    if (sections.length === 0) {
      sections.push("Introdução", "Desenvolvimento", "Conclusão");
    }

    return sections.slice(0, 8); // Limit to 8 sections max
  }

  saveResultsAndRedirect() {
    // Save results to localStorage
    const results = {
      categoria: this.categoria,
      blogPosts: this.blogPosts,
      generatedAt: new Date().toISOString(),
    };

    localStorage.setItem("blogGeneratorResults", JSON.stringify(results));

    // Redirect to results page
    window.location.href = "results.html";
  }

  showProgress() {
    document.getElementById("progressContainer").style.display = "block";
  }

  hideProgress() {
    document.getElementById("progressContainer").style.display = "none";
  }

  disableForm() {
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    document.querySelector(".btn-text").style.display = "none";
    document.querySelector(".btn-loader").style.display = "flex";
  }

  enableForm() {
    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = false;
    document.querySelector(".btn-text").style.display = "block";
    document.querySelector(".btn-loader").style.display = "none";
  }

  updateProgress(text, percentage) {
    document.getElementById("progressText").textContent = text;
    document.getElementById("progressFill").style.width = percentage + "%";
  }

  updateCurrentTask(task) {
    document.getElementById("currentTask").textContent = task;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new BlogGenerator();
});

// Utility functions for the results page
window.BlogUtils = {
  copyToClipboard: async function (text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand("copy");
        document.body.removeChild(textArea);
        return true;
      } catch (err) {
        document.body.removeChild(textArea);
        return false;
      }
    }
  },

  showCopyFeedback: function (button) {
    const originalText = button.textContent;
    button.textContent = "Copiado!";
    button.style.background = "#10b981";

    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = "";
    }, 2000);
  },
};
