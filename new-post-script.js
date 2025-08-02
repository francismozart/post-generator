class NewPostManager {
    constructor() {
        this.apiKey = '';
        this.categoria = '';
        this.titulos = [];
        this.blogPosts = [];
        this.currentProgress = 0;
        this.totalSteps = 0;
        
        this.initialize();
    }

    initialize() {
        // Check if API Key exists
        if (!ApiKeyUtils.ensureApiKey()) {
            return; // Will redirect to API Key page
        }
        
        this.apiKey = ApiKeyUtils.getApiKey();
        this.displayApiKey();
        this.initializeEventListeners();
    }

    displayApiKey() {
        // Show masked API Key
        const maskedKey = this.apiKey.substring(0, 8) + '••••••••••••••••';
        document.getElementById('apiKeyDisplay').textContent = maskedKey;
    }

    initializeEventListeners() {
        const form = document.getElementById('blogForm');
        form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        // Get form data
        this.categoria = document.getElementById('categoria').value.trim();
        const titulosText = document.getElementById('titulos').value.trim();
        
        // Validate inputs
        if (!this.categoria || !titulosText) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        // Parse titles
        this.titulos = titulosText.split('\n')
            .map(title => title.trim())
            .filter(title => title.length > 0);

        if (this.titulos.length === 0) {
            alert('Por favor, insira pelo menos um título.');
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
                this.updateProgress(`Processando: ${title}`, (i / this.titulos.length) * 100);
                
                const blogPost = await this.processSingleTitle(title, i + 1);
                this.blogPosts.push(blogPost);
            }

            this.updateProgress('Finalizando...', 100);
            
            // Save results and redirect
            this.saveResultsAndRedirect();
            
        } catch (error) {
            console.error('Erro durante o processamento:', error);
            alert('Erro durante o processamento: ' + error.message);
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
            createdAt: new Date().toISOString()
        };

        try {
            // Step 1: Generate outline
            this.updateCurrentTask(`Gerando estrutura para: ${title}`);
            const outlinePrompt = `Gere uma outline (estrutura de artigo para blog) com a palavra-chave ${title}`;
            const outlineResponse = await this.callGeminiAPIWithContext([], outlinePrompt);
            blogPost.outline = outlineResponse;

            // Parse sections from outline
            const sections = this.parseSectionsFromOutline(outlineResponse);
            
            // Initialize conversation context with the outline
            const conversationContext = [
                {
                    role: "user",
                    parts: [{
                        text: `Vou criar um artigo de blog com o título "${title}" na categoria "${this.categoria}". A estrutura do artigo é:\n\n${outlineResponse}\n\nVou pedir para você gerar o conteúdo de cada seção, mantendo coerência e continuidade entre elas.`
                    }]
                },
                {
                    role: "model",
                    parts: [{
                        text: `Entendido! Vou ajudar você a criar um artigo completo sobre "${title}" seguindo a estrutura fornecida. Manterei a coerência e continuidade entre todas as seções para criar um conteúdo fluido e bem conectado. Pode começar solicitando o conteúdo de qualquer seção.`
                    }]
                }
            ];
            
            // Step 2: Generate content for each section with context
            for (let i = 0; i < sections.length; i++) {
                const sectionName = sections[i];
                this.updateCurrentTask(`Gerando conteúdo para seção: ${sectionName}`);
                
                // Create context-aware prompt for this section
                let sectionPrompt = `Agora gere o texto completo para a seção "${sectionName}".`;
                
                // Add context about previous sections if this isn't the first section
                if (i > 0) {
                    sectionPrompt += ` Lembre-se de manter a continuidade com as seções anteriores já escritas.`;
                }
                
                sectionPrompt += ` O texto deve ser detalhado, informativo e bem estruturado.`;
                
                const sectionContent = await this.callGeminiAPIWithContext(conversationContext, sectionPrompt);
                
                blogPost.sections.push({
                    name: sectionName,
                    content: sectionContent
                });

                // Add this section to the conversation context for future sections
                conversationContext.push({
                    role: "user",
                    parts: [{
                        text: sectionPrompt
                    }]
                });
                
                conversationContext.push({
                    role: "model",
                    parts: [{
                        text: sectionContent
                    }]
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

    async callGeminiAPIWithContext(conversationHistory, newPrompt) {
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
        
        // Build the contents array with conversation history + new prompt
        const contents = [...conversationHistory];
        
        // Add the new prompt
        contents.push({
            role: "user",
            parts: [{
                text: newPrompt
            }]
        });

        const requestBody = {
            contents: contents
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-goog-api-key': this.apiKey
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Resposta inválida da API');
        }

        return data.candidates[0].content.parts[0].text;
    }

    async callGeminiAPI(prompt) {
        // Use the context-aware method with empty history for backward compatibility
        return await this.callGeminiAPIWithContext([], prompt);
    }

    parseSectionsFromOutline(outline) {
        // Simple parsing - look for lines that start with numbers or bullets
        const lines = outline.split('\n');
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
            else if (trimmed.length > 0 && trimmed.length < 100 && !trimmed.endsWith('.') && !trimmed.endsWith(',')) {
                sections.push(trimmed);
            }
        }
        
        // If no sections found, create default ones
        if (sections.length === 0) {
            sections.push('Introdução', 'Desenvolvimento', 'Conclusão');
        }
        
        return sections.slice(0, 8); // Limit to 8 sections max
    }

    saveResultsAndRedirect() {
        // Create storage key based on API Key hash
        const apiKeyHash = this.hashApiKey(this.apiKey);
        const storageKey = `blogPosts_${apiKeyHash}`;
        
        // Get existing posts for this API Key
        const existingData = localStorage.getItem(storageKey);
        let allPosts = [];
        
        if (existingData) {
            try {
                const parsed = JSON.parse(existingData);
                allPosts = parsed.blogPosts || [];
            } catch (error) {
                console.error('Error parsing existing posts:', error);
            }
        }
        
        // Add new posts to existing ones
        allPosts.push(...this.blogPosts);
        
        // Save updated results to localStorage
        const results = {
            categoria: this.categoria,
            blogPosts: allPosts,
            generatedAt: new Date().toISOString()
        };
        
        localStorage.setItem(storageKey, JSON.stringify(results));
        
        // Redirect to results page
        window.location.href = 'results.html';
    }

    hashApiKey(apiKey) {
        // Simple hash function for API Key (for storage key)
        let hash = 0;
        for (let i = 0; i < apiKey.length; i++) {
            const char = apiKey.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    showProgress() {
        document.getElementById('progressContainer').style.display = 'block';
    }

    hideProgress() {
        document.getElementById('progressContainer').style.display = 'none';
    }

    disableForm() {
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        document.querySelector('.btn-text').style.display = 'none';
        document.querySelector('.btn-loader').style.display = 'flex';
    }

    enableForm() {
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = false;
        document.querySelector('.btn-text').style.display = 'block';
        document.querySelector('.btn-loader').style.display = 'none';
    }

    updateProgress(text, percentage) {
        document.getElementById('progressText').textContent = text;
        document.getElementById('progressFill').style.width = percentage + '%';
    }

    updateCurrentTask(task) {
        document.getElementById('currentTask').textContent = task;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Static methods for global access
    static changeApiKey() {
        const confirmChange = confirm('Tem certeza que deseja trocar a API Key? Você será redirecionado para a página inicial.');
        if (confirmChange) {
            ApiKeyUtils.clearApiKey();
            window.location.href = 'index.html';
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NewPostManager();
});

