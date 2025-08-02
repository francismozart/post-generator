class BlogViewer {
    constructor() {
        this.blogPosts = [];
        this.currentIndex = 0;
        this.categoria = '';
        this.generatedAt = '';
        this.currentApiKey = '';
        
        this.initialize();
    }

    initialize() {
        // Check if API Key exists
        if (!ApiKeyUtils.ensureApiKey()) {
            return; // Will redirect to API Key page
        }
        
        this.currentApiKey = ApiKeyUtils.getApiKey();
        this.loadResults();
        this.renderSidebar();
        this.showCurrentPost();
        this.updateNavigation();
    }

    loadResults() {
        // Load all posts from localStorage
        const allPosts = this.getAllPostsFromStorage();
        
        // Filter posts by current API Key
        this.blogPosts = allPosts.filter(post => post.apiKey === this.currentApiKey);
        
        if (this.blogPosts.length === 0) {
            this.showNoContent();
            return;
        }
        
        // Hide no content message
        document.getElementById('noContent').style.display = 'none';
        document.getElementById('blogContent').style.display = 'block';
    }

    getAllPostsFromStorage() {
        const allPosts = [];
        
        // Get all keys from localStorage that start with 'blogPosts_'
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('blogPosts_')) {
                try {
                    const postsData = JSON.parse(localStorage.getItem(key));
                    if (postsData && postsData.blogPosts) {
                        // Add API Key to each post for filtering
                        const apiKey = key.replace('blogPosts_', '');
                        postsData.blogPosts.forEach(post => {
                            post.apiKey = apiKey;
                            post.categoria = postsData.categoria;
                            post.generatedAt = postsData.generatedAt;
                        });
                        allPosts.push(...postsData.blogPosts);
                    }
                } catch (error) {
                    console.error('Error parsing posts data:', error);
                }
            }
        }
        
        // Sort by creation date (newest first)
        return allPosts.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
    }

    showNoContent() {
        document.getElementById('noContent').style.display = 'block';
        document.getElementById('blogContent').style.display = 'none';
        
        // Hide navigation controls
        document.querySelector('.nav-controls').style.display = 'none';
    }

    renderSidebar() {
        // Update category info - show current post's category if available
        const categoryInfo = document.getElementById('categoryInfo');
        if (this.blogPosts.length > 0 && this.currentIndex < this.blogPosts.length) {
            const currentPost = this.blogPosts[this.currentIndex];
            categoryInfo.innerHTML = `
                <span class="category-label">Categoria:</span>
                <span class="category-value">${currentPost.categoria || 'Sem categoria'}</span>
            `;
        } else {
            categoryInfo.innerHTML = '';
        }
        
        // Update generation date - show latest post date
        if (this.blogPosts.length > 0) {
            const latestPost = this.blogPosts[0]; // Already sorted by date
            const date = new Date(latestPost.generatedAt);
            document.getElementById('generationDate').textContent = date.toLocaleString('pt-BR');
        }
        
        // Render blog list
        const blogList = document.getElementById('blogList');
        blogList.innerHTML = '';
        
        this.blogPosts.forEach((post, index) => {
            const blogItem = document.createElement('div');
            blogItem.className = `blog-item ${index === this.currentIndex ? 'active' : ''}`;
            blogItem.onclick = () => this.goToPost(index);
            
            const postDate = new Date(post.generatedAt);
            
            blogItem.innerHTML = `
                <div class="blog-item-title">${post.title}</div>
                <div class="blog-item-meta">
                    ${post.categoria} • ${post.sections.length} seções
                    ${post.error ? ' • Erro' : ''}
                    <br><small>${postDate.toLocaleDateString('pt-BR')}</small>
                </div>
            `;
            
            blogList.appendChild(blogItem);
        });
    }

    showCurrentPost() {
        if (this.blogPosts.length === 0) return;
        
        const post = this.blogPosts[this.currentIndex];
        
        // Update header
        document.getElementById('blogTitle').textContent = post.title;
        document.getElementById('blogCategory').textContent = post.categoria || 'Sem categoria';
        
        if (post.createdAt) {
            const date = new Date(post.createdAt);
            document.getElementById('blogDate').textContent = date.toLocaleString('pt-BR');
        }
        
        // Update sections
        const sectionsContainer = document.getElementById('blogSections');
        sectionsContainer.innerHTML = '';
        
        if (post.error) {
            sectionsContainer.innerHTML = `
                <div class="section">
                    <div class="section-header">
                        <h2 class="section-title">Erro no Processamento</h2>
                    </div>
                    <div class="section-content">
                        Ocorreu um erro ao processar este post: ${post.error}
                    </div>
                </div>
            `;
            return;
        }
        
        // Show outline if available
        if (post.outline) {
            const outlineSection = document.createElement('div');
            outlineSection.className = 'section';
            outlineSection.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">Estrutura do Artigo</h2>
                    <button class="copy-section-btn" onclick="BlogViewer.copySection('${this.escapeHtml(post.outline)}', this)">
                        📋 Copiar
                    </button>
                </div>
                <div class="section-content">${this.formatContent(post.outline)}</div>
            `;
            sectionsContainer.appendChild(outlineSection);
        }
        
        // Show sections
        post.sections.forEach((section, index) => {
            const sectionElement = document.createElement('div');
            sectionElement.className = 'section';
            sectionElement.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">${section.name}</h2>
                    <button class="copy-section-btn" onclick="BlogViewer.copySection('${this.escapeHtml(section.content)}', this)">
                        📋 Copiar
                    </button>
                </div>
                <div class="section-content">${this.formatContent(section.content)}</div>
            `;
            sectionsContainer.appendChild(sectionElement);
        });
    }

    formatContent(content) {
        // Simple formatting - preserve line breaks and add basic styling
        return content
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>')
            .replace(/<p><\/p>/g, '');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/'/g, '&#39;');
    }

    updateNavigation() {
        const navInfo = document.getElementById('navInfo');
        navInfo.textContent = `${this.currentIndex + 1} de ${this.blogPosts.length}`;
        
        // Update button states
        document.getElementById('firstBtn').disabled = this.currentIndex === 0;
        document.getElementById('prevBtn').disabled = this.currentIndex === 0;
        document.getElementById('nextBtn').disabled = this.currentIndex === this.blogPosts.length - 1;
        document.getElementById('lastBtn').disabled = this.currentIndex === this.blogPosts.length - 1;
        
        // Update sidebar active state
        document.querySelectorAll('.blog-item').forEach((item, index) => {
            item.classList.toggle('active', index === this.currentIndex);
        });
    }

    goToPost(index) {
        if (index >= 0 && index < this.blogPosts.length) {
            this.currentIndex = index;
            this.showCurrentPost();
            this.updateNavigation();
        }
    }

    goToFirst() {
        this.goToPost(0);
    }

    goToPrevious() {
        this.goToPost(this.currentIndex - 1);
    }

    goToNext() {
        this.goToPost(this.currentIndex + 1);
    }

    goToLast() {
        this.goToPost(this.blogPosts.length - 1);
    }

    async copyFullPost() {
        if (this.blogPosts.length === 0) return;
        
        const post = this.blogPosts[this.currentIndex];
        let fullContent = `${post.title}\n\n`;
        
        if (post.outline) {
            fullContent += `ESTRUTURA:\n${post.outline}\n\n`;
        }
        
        post.sections.forEach(section => {
            fullContent += `${section.name.toUpperCase()}\n`;
            fullContent += `${section.content}\n\n`;
        });
        
        const success = await this.copyToClipboard(fullContent);
        if (success) {
            this.showToast('Post completo copiado para a área de transferência!');
        } else {
            this.showToast('Erro ao copiar. Tente novamente.', 'error');
        }
    }

    static async copySection(content, button) {
        // Decode HTML entities
        const textarea = document.createElement('textarea');
        textarea.innerHTML = content;
        const decodedContent = textarea.value;
        
        const success = await BlogViewer.instance.copyToClipboard(decodedContent);
        if (success) {
            BlogViewer.instance.showCopyFeedback(button);
            BlogViewer.instance.showToast('Seção copiada para a área de transferência!');
        } else {
            BlogViewer.instance.showToast('Erro ao copiar. Tente novamente.', 'error');
        }
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (err) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    }

    showCopyFeedback(button) {
        const originalText = button.textContent;
        const originalBg = button.style.background;
        
        button.textContent = '✓ Copiado!';
        button.style.background = '#10b981';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = originalBg;
        }, 2000);
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        toastMessage.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    // Static methods for global access
    static goToFirst() {
        BlogViewer.instance.goToFirst();
    }

    static goToPrevious() {
        BlogViewer.instance.goToPrevious();
    }

    static goToNext() {
        BlogViewer.instance.goToNext();
    }

    static goToLast() {
        BlogViewer.instance.goToLast();
    }

    static copyFullPost() {
        BlogViewer.instance.copyFullPost();
    }

    static toggleSidebar() {
        BlogViewer.instance.toggleSidebar();
    }
}

// Results Manager for handling API Key changes
class ResultsManager {
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
    BlogViewer.instance = new BlogViewer();
});

// Handle keyboard navigation
document.addEventListener('keydown', (e) => {
    if (!BlogViewer.instance) return;
    
    switch(e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            BlogViewer.instance.goToPrevious();
            break;
        case 'ArrowRight':
            e.preventDefault();
            BlogViewer.instance.goToNext();
            break;
        case 'Home':
            e.preventDefault();
            BlogViewer.instance.goToFirst();
            break;
        case 'End':
            e.preventDefault();
            BlogViewer.instance.goToLast();
            break;
        case 'Escape':
            // Close sidebar on mobile
            if (window.innerWidth <= 1024) {
                document.getElementById('sidebar').classList.remove('open');
            }
            break;
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) {
        document.getElementById('sidebar').classList.remove('open');
    }
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('mobileMenuToggle');
        
        if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    }
});

