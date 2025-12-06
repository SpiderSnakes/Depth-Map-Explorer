/**
 * Sidebar Component - Sélecteur d'images optimisé
 * Utilise la délégation d'événements pour de meilleures performances
 * Depth Map Explorer
 */

class ImageSidebar {
    constructor(containerId, onImageSelect) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.onImageSelect = onImageSelect;
        this.isCollapsed = false;
        this._unsubscribe = null;
        this._boundHandleClick = this._handleClick.bind(this);

        if (!this.container) {
            this._createContainer();
        }

        this._render();
        this._setupEvents();
    }

    /**
     * Crée le conteneur s'il n'existe pas
     */
    _createContainer() {
        this.container = document.createElement('div');
        this.container.id = this.containerId;
        this.container.setAttribute('role', 'navigation');
        this.container.setAttribute('aria-label', 'Sélection d\'images');
        document.body.appendChild(this.container);
    }

    /**
     * Rendu du composant
     */
    _render() {
        const images = window.imageManager.getAllImages();
        const current = window.imageManager.getCurrentImage();
        const demoImages = images.filter(img => img.type === 'demo');
        const customImages = images.filter(img => img.type === 'uploaded');

        this.container.innerHTML = `
            <div class="sidebar-inner ${this.isCollapsed ? 'collapsed' : ''}" role="region" aria-label="Galerie d'images">
                <button class="sidebar-toggle" 
                        id="sidebarToggle" 
                        aria-label="${this.isCollapsed ? 'Ouvrir' : 'Fermer'} le panneau d'images"
                        aria-expanded="${!this.isCollapsed}">
                    <span class="toggle-icon" aria-hidden="true">${this.isCollapsed ? '▶' : '◀'}</span>
                </button>
                
                <div class="sidebar-content">
                    <div class="sidebar-header">
                        <h3 id="sidebar-title">📷 Images</h3>
                        <a href="../pages/upload.html" 
                           class="upload-link" 
                           title="Uploader une image"
                           aria-label="Uploader une nouvelle image">
                            <span aria-hidden="true">+</span>
                        </a>
                    </div>
                    
                    <a href="../index.html" class="sidebar-home-btn" aria-label="Retourner à l'accueil">
                        🏠 Retour à l'accueil
                    </a>
                    
                    ${customImages.length > 0 ? `
                        <section class="sidebar-section" aria-labelledby="custom-images-title">
                            <h4 id="custom-images-title">Mes Images</h4>
                            <div class="image-grid" role="listbox" aria-label="Images personnalisées">
                                ${customImages.map(img => this._renderImageCard(img, current, true)).join('')}
                            </div>
                        </section>
                    ` : ''}
                    
                    <section class="sidebar-section" aria-labelledby="demo-images-title">
                        <h4 id="demo-images-title">Démonstration</h4>
                        <div class="image-grid" role="listbox" aria-label="Images de démonstration">
                            ${demoImages.map(img => this._renderImageCard(img, current)).join('')}
                        </div>
                    </section>
                    
                    <div class="sidebar-footer">
                        <a href="../pages/upload.html" class="btn-upload" aria-label="Uploader vos images">
                            ⬆️ Uploader
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Rendu d'une carte image
     */
    _renderImageCard(img, current, canDelete = false) {
        const isSelected = current && current.id === img.id;
        return `
            <div class="image-card ${isSelected ? 'selected' : ''}" 
                 data-id="${img.id}" 
                 title="${img.name}"
                 role="option"
                 aria-selected="${isSelected}"
                 tabindex="0">
                <div class="image-thumb" 
                     style="background-image: url('${img.thumbnail}')"
                     aria-hidden="true">
                    ${isSelected ? '<div class="selected-badge" aria-hidden="true">✓</div>' : ''}
                </div>
                <span class="image-name">${this._escapeHtml(img.name)}</span>
                ${canDelete ? `
                    <button class="delete-btn" 
                            data-delete="${img.id}" 
                            aria-label="Supprimer ${img.name}"
                            title="Supprimer">×</button>
                ` : ''}
            </div>
        `;
    }

    /**
     * Configuration des événements avec délégation
     */
    _setupEvents() {
        // Délégation - un seul listener sur le conteneur
        this.container.addEventListener('click', this._boundHandleClick);

        // Support clavier pour l'accessibilité
        this.container.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const card = e.target.closest('.image-card');
                if (card) {
                    e.preventDefault();
                    this._selectImage(card.dataset.id);
                }
            }
        });

        // S'abonner aux changements d'images
        this._unsubscribe = window.imageManager.onChange((current, all) => {
            this._updateSelection(current);
            
            // Re-render complet seulement si le nombre d'images a changé
            const currentCount = this.container.querySelectorAll('.image-card').length;
            if (currentCount !== all.length) {
                this._render();
            }

            if (this.onImageSelect) {
                this.onImageSelect(current);
            }
        });
    }

    /**
     * Gestionnaire de clic délégué
     */
    _handleClick(e) {
        // Toggle sidebar
        if (e.target.closest('#sidebarToggle')) {
            this._toggleSidebar();
            return;
        }

        // Suppression d'image
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const id = deleteBtn.dataset.delete;
            this._confirmDelete(id);
            return;
        }

        // Sélection d'image
        const card = e.target.closest('.image-card');
        if (card) {
            this._selectImage(card.dataset.id);
        }
    }

    /**
     * Toggle sidebar collapsed/expanded
     */
    _toggleSidebar() {
        this.isCollapsed = !this.isCollapsed;

        const inner = this.container.querySelector('.sidebar-inner');
        const toggle = this.container.querySelector('#sidebarToggle');
        const icon = this.container.querySelector('.toggle-icon');

        if (inner) {
            inner.classList.toggle('collapsed', this.isCollapsed);
        }

        if (toggle) {
            toggle.setAttribute('aria-expanded', !this.isCollapsed);
            toggle.setAttribute('aria-label', 
                `${this.isCollapsed ? 'Ouvrir' : 'Fermer'} le panneau d'images`);
        }

        if (icon) {
            icon.textContent = this.isCollapsed ? '▶' : '◀';
        }

        // Notifier le body pour les ajustements CSS
        document.body.classList.toggle('sidebar-collapsed', this.isCollapsed);
    }

    /**
     * Sélectionne une image
     */
    _selectImage(id) {
        window.imageManager.selectImage(id);
    }

    /**
     * Met à jour uniquement la sélection visuelle
     */
    _updateSelection(currentImage) {
        const cards = this.container.querySelectorAll('.image-card');
        
        cards.forEach(card => {
            const isSelected = currentImage && card.dataset.id === currentImage.id;
            card.classList.toggle('selected', isSelected);
            card.setAttribute('aria-selected', isSelected);

            // Gérer le badge de sélection
            const thumb = card.querySelector('.image-thumb');
            const existingBadge = thumb.querySelector('.selected-badge');

            if (isSelected && !existingBadge) {
                const badge = document.createElement('div');
                badge.className = 'selected-badge';
                badge.setAttribute('aria-hidden', 'true');
                badge.textContent = '✓';
                thumb.appendChild(badge);
            } else if (!isSelected && existingBadge) {
                existingBadge.remove();
            }
        });
    }

    /**
     * Confirmation de suppression
     */
    _confirmDelete(id) {
        const image = window.imageManager.getAllImages().find(img => img.id === id);
        const name = image ? image.name : 'cette image';

        if (confirm(`Supprimer "${name}" ?`)) {
            window.imageManager.removeUploadedImage(id);
            this._render(); // Re-render après suppression
        }
    }

    /**
     * Échappe les caractères HTML
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Nettoyage
     */
    destroy() {
        if (this._unsubscribe) {
            this._unsubscribe();
        }
        this.container.removeEventListener('click', this._boundHandleClick);
    }
}

// Export global
window.ImageSidebar = ImageSidebar;

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageSidebar;
}

