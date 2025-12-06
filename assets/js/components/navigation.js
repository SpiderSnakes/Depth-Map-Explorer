/**
 * Navigation Component - Menu des effets optimisé
 * Depth Map Explorer
 */

const EFFECTS_LIST = [
    { id: 'parallax', name: 'Parallaxe 3D', icon: '🔮', file: 'parallax.html' },
    { id: 'depth-of-field', name: 'Profondeur de Champ', icon: '📷', file: 'depth-of-field.html' },
    { id: 'fog', name: 'Brouillard', icon: '🌫️', file: 'fog.html' },
    { id: 'displacement', name: 'Displacement 3D', icon: '🏔️', file: 'displacement.html' },
    { id: 'waves', name: 'Vagues', icon: '🌊', file: 'waves.html' },
    { id: 'lighting', name: 'Éclairage', icon: '💡', file: 'lighting.html' },
    { id: 'relief', name: 'Relief', icon: '🗿', file: 'relief.html' },
    { id: 'zoom-depth', name: 'Zoom Profondeur', icon: '🔍', file: 'zoom-depth.html' },
    { id: 'layers', name: 'Couches', icon: '📚', file: 'layers.html' },
    { id: 'rotation', name: 'Rotation 3D', icon: '🎪', file: 'rotation.html' },
    { id: 'reveal', name: 'Révélation', icon: '🎭', file: 'reveal.html' },
    { id: 'chromatic', name: 'Aberration Chromatique', icon: '🌈', file: 'chromatic.html' },
    { id: 'glitch', name: 'Glitch', icon: '⚡', file: 'glitch.html' },
];

class EffectNavigation {
    constructor() {
        this.currentEffect = this._getCurrentEffectFromUrl();
        this.isMenuOpen = false;
        this._boundHandleClick = this._handleGlobalClick.bind(this);
        
        this._render();
        this._setupEvents();
    }

    /**
     * Détermine l'effet courant depuis l'URL
     */
    _getCurrentEffectFromUrl() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        return EFFECTS_LIST.find(e => e.file === filename) || null;
    }

    /**
     * Index de l'effet courant
     */
    _getCurrentIndex() {
        if (!this.currentEffect) return -1;
        return EFFECTS_LIST.findIndex(e => e.id === this.currentEffect.id);
    }

    /**
     * Rendu de la navigation
     */
    _render() {
        // Supprimer l'ancienne nav si existante
        const oldNav = document.querySelector('.effect-nav');
        if (oldNav) oldNav.remove();

        const nav = document.createElement('nav');
        nav.className = 'effect-nav';
        nav.setAttribute('role', 'navigation');
        nav.setAttribute('aria-label', 'Navigation des effets');

        const currentIndex = this._getCurrentIndex();
        const prevEffect = currentIndex > 0 ? EFFECTS_LIST[currentIndex - 1] : null;
        const nextEffect = currentIndex < EFFECTS_LIST.length - 1 ? EFFECTS_LIST[currentIndex + 1] : null;

        nav.innerHTML = `
            <div class="nav-left">
                <a href="../index.html" class="nav-home" aria-label="Retour à l'accueil">
                    <span aria-hidden="true">🏠</span>
                    <span>Accueil</span>
                </a>
            </div>

            <div class="nav-center">
                <button class="effect-selector" 
                        id="effectSelector"
                        aria-haspopup="listbox"
                        aria-expanded="false"
                        aria-label="Sélectionner un effet">
                    <div class="effect-selector-current">
                        <span class="effect-selector-icon" aria-hidden="true">${this.currentEffect?.icon || '✨'}</span>
                        <span>${this.currentEffect?.name || 'Sélectionner un effet'}</span>
                    </div>
                    <span class="effect-selector-arrow" aria-hidden="true">▼</span>
                </button>
                <div class="effect-dropdown" 
                     id="effectDropdown"
                     role="listbox"
                     aria-label="Liste des effets">
                    ${EFFECTS_LIST.map((effect, index) => `
                        <a href="${effect.file}" 
                           class="effect-dropdown-item ${effect.id === this.currentEffect?.id ? 'active' : ''}"
                           role="option"
                           aria-selected="${effect.id === this.currentEffect?.id}"
                           data-index="${index}">
                            <span class="effect-dropdown-item-icon" aria-hidden="true">${effect.icon}</span>
                            <span class="effect-dropdown-item-name">${effect.name}</span>
                        </a>
                    `).join('')}
                </div>
            </div>

            <div class="nav-right">
                <a href="${prevEffect ? prevEffect.file : '#'}" 
                   class="nav-arrow ${!prevEffect ? 'disabled' : ''}" 
                   aria-label="${prevEffect ? `Effet précédent: ${prevEffect.name}` : 'Pas d\'effet précédent'}"
                   ${!prevEffect ? 'aria-disabled="true"' : ''}>
                    <span aria-hidden="true">←</span>
                </a>
                <a href="${nextEffect ? nextEffect.file : '#'}" 
                   class="nav-arrow ${!nextEffect ? 'disabled' : ''}" 
                   aria-label="${nextEffect ? `Effet suivant: ${nextEffect.name}` : 'Pas d\'effet suivant'}"
                   ${!nextEffect ? 'aria-disabled="true"' : ''}>
                    <span aria-hidden="true">→</span>
                </a>
            </div>
        `;

        document.body.insertBefore(nav, document.body.firstChild);
    }

    /**
     * Configuration des événements
     */
    _setupEvents() {
        const selector = document.getElementById('effectSelector');
        const dropdown = document.getElementById('effectDropdown');

        if (selector) {
            // Toggle dropdown
            selector.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleDropdown();
            });

            // Support clavier
            selector.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._toggleDropdown();
                } else if (e.key === 'Escape' && this.isMenuOpen) {
                    this._closeDropdown();
                } else if (e.key === 'ArrowDown' && this.isMenuOpen) {
                    e.preventDefault();
                    this._focusFirstItem();
                }
            });
        }

        if (dropdown) {
            // Navigation clavier dans le dropdown
            dropdown.addEventListener('keydown', (e) => {
                const items = dropdown.querySelectorAll('.effect-dropdown-item');
                const currentFocus = document.activeElement;
                const currentIndex = Array.from(items).indexOf(currentFocus);

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextIndex = Math.min(currentIndex + 1, items.length - 1);
                    items[nextIndex].focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prevIndex = Math.max(currentIndex - 1, 0);
                    items[prevIndex].focus();
                } else if (e.key === 'Escape') {
                    this._closeDropdown();
                    selector.focus();
                }
            });
        }

        // Fermer sur clic extérieur
        document.addEventListener('click', this._boundHandleClick);

        // Raccourcis clavier globaux
        document.addEventListener('keydown', (e) => {
            // Alt + Flèches pour naviguer entre les effets
            if (e.altKey) {
                const currentIndex = this._getCurrentIndex();
                if (e.key === 'ArrowLeft' && currentIndex > 0) {
                    window.location.href = EFFECTS_LIST[currentIndex - 1].file;
                } else if (e.key === 'ArrowRight' && currentIndex < EFFECTS_LIST.length - 1) {
                    window.location.href = EFFECTS_LIST[currentIndex + 1].file;
                }
            }
        });
    }

    /**
     * Gestionnaire clic global
     */
    _handleGlobalClick() {
        if (this.isMenuOpen) {
            this._closeDropdown();
        }
    }

    /**
     * Toggle dropdown
     */
    _toggleDropdown() {
        this.isMenuOpen = !this.isMenuOpen;
        
        const selector = document.getElementById('effectSelector');
        const dropdown = document.getElementById('effectDropdown');

        if (selector) {
            selector.classList.toggle('open', this.isMenuOpen);
            selector.setAttribute('aria-expanded', this.isMenuOpen);
        }

        if (dropdown) {
            dropdown.classList.toggle('open', this.isMenuOpen);
        }

        if (this.isMenuOpen) {
            this._focusFirstItem();
        }
    }

    /**
     * Ferme le dropdown
     */
    _closeDropdown() {
        this.isMenuOpen = false;
        
        const selector = document.getElementById('effectSelector');
        const dropdown = document.getElementById('effectDropdown');

        if (selector) {
            selector.classList.remove('open');
            selector.setAttribute('aria-expanded', 'false');
        }

        if (dropdown) {
            dropdown.classList.remove('open');
        }
    }

    /**
     * Focus sur le premier item ou l'item actif
     */
    _focusFirstItem() {
        const dropdown = document.getElementById('effectDropdown');
        if (!dropdown) return;

        const activeItem = dropdown.querySelector('.effect-dropdown-item.active');
        const firstItem = dropdown.querySelector('.effect-dropdown-item');

        if (activeItem) {
            activeItem.focus();
        } else if (firstItem) {
            firstItem.focus();
        }
    }

    /**
     * Nettoyage
     */
    destroy() {
        document.removeEventListener('click', this._boundHandleClick);
    }
}

// Export global
window.EffectNavigation = EffectNavigation;
window.EFFECTS_LIST = EFFECTS_LIST;

// Auto-initialisation
document.addEventListener('DOMContentLoaded', () => {
    new EffectNavigation();
});

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EffectNavigation, EFFECTS_LIST };
}

