/**
 * Effect Page Initializer - Initialisation commune pour les pages d'effet
 * Depth Map Explorer
 */

/**
 * Initialise une page d'effet
 * @param {Object} options - Options de configuration
 * @param {Function} options.onImageChange - Callback appelé quand l'image change
 * @param {HTMLCanvasElement} options.canvas - Élément canvas
 * @param {WebGLRenderingContext} options.gl - Contexte WebGL (optionnel)
 * @returns {Object} - Objet avec les utilitaires initialisés
 */
async function initEffectPage(options = {}) {
    const { onImageChange, canvas } = options;

    // Afficher le loader
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    }

    try {
        // Initialiser l'image manager (singleton, donc safe à appeler plusieurs fois)
        await window.imageManager.init();

        // Créer la sidebar
        const sidebar = new ImageSidebar('image-sidebar', async (currentImage) => {
            if (onImageChange) {
                await onImageChange(currentImage);
            }
        });

        // Observer les changements de collapse de la sidebar
        const setupSidebarObserver = () => {
            const sidebarInner = document.querySelector('.sidebar-inner');
            if (!sidebarInner) {
                setTimeout(setupSidebarObserver, 100);
                return;
            }

            const observer = new MutationObserver(() => {
                const isCollapsed = sidebarInner.classList.contains('collapsed');
                document.body.classList.toggle('sidebar-collapsed', isCollapsed);
                
                // Déclencher un resize pour que le canvas s'adapte
                window.dispatchEvent(new Event('resize'));
            });

            observer.observe(sidebarInner, { 
                attributes: true, 
                attributeFilter: ['class'] 
            });
        };

        setupSidebarObserver();

        // Créer le gestionnaire de ressources WebGL si un contexte est fourni
        let resourceManager = null;
        if (options.gl) {
            resourceManager = new WebGLResourceManager(options.gl);
            
            // Nettoyage automatique à la fermeture
            window.addEventListener('beforeunload', () => {
                resourceManager.dispose();
            });
        }

        // Charger l'image initiale
        if (onImageChange) {
            const currentImage = window.imageManager.getCurrentImage();
            if (currentImage) {
                await onImageChange(currentImage);
            }
        }

        // Cacher le loader
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }

        return {
            sidebar,
            resourceManager,
            imageManager: window.imageManager
        };

    } catch (error) {
        console.error('Erreur initialisation page effet:', error);
        
        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div class="loader">
                    <p style="color: var(--accent-red);">Erreur de chargement</p>
                    <p>${error.message}</p>
                    <a href="../index.html" style="color: var(--accent-cyan);">Retour à l'accueil</a>
                </div>
            `;
        }

        throw error;
    }
}

/**
 * Fonction helper pour charger les textures WebGL
 */
async function loadEffectTextures(resourceManager, currentImage, units = [0, 1]) {
    if (!currentImage) return { imageTexture: null, depthTexture: null };

    const [imageTexture, depthTexture] = await Promise.all([
        resourceManager.loadTexture(currentImage.originalUrl, { unit: units[0] }),
        resourceManager.loadTexture(currentImage.depthUrl, { unit: units[1] })
    ]);

    return { imageTexture, depthTexture };
}

/**
 * Redimensionne le canvas en fonction de l'image et de la fenêtre
 */
function resizeCanvas(canvas, gl, imageWidth, imageHeight, options = {}) {
    const size = calculateCanvasSize(imageWidth, imageHeight, options);
    
    canvas.width = size.width;
    canvas.height = size.height;
    
    if (gl) {
        gl.viewport(0, 0, size.width, size.height);
    }
    
    return size;
}

/**
 * Animation loop helper avec gestion de la performance
 */
class AnimationLoop {
    constructor(renderCallback) {
        this.renderCallback = renderCallback;
        this.isRunning = false;
        this.animationId = null;
        this.lastTime = 0;
        this.deltaTime = 0;
        
        this._boundLoop = this._loop.bind(this);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.animationId = requestAnimationFrame(this._boundLoop);
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    _loop(timestamp) {
        if (!this.isRunning) return;

        this.deltaTime = (timestamp - this.lastTime) / 1000; // En secondes
        this.lastTime = timestamp;

        this.renderCallback(this.deltaTime, timestamp);

        this.animationId = requestAnimationFrame(this._boundLoop);
    }
}

/**
 * Mouse/Touch tracker avec smoothing
 */
class InputTracker {
    constructor(options = {}) {
        this.targetX = 0.5;
        this.targetY = 0.5;
        this.currentX = 0.5;
        this.currentY = 0.5;
        this.smoothing = options.smoothing || 0.1;
        this.element = options.element || document;

        this._setupListeners();
    }

    _setupListeners() {
        this.element.addEventListener('mousemove', (e) => {
            const rect = this.element === document ? 
                { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } :
                this.element.getBoundingClientRect();
            
            this.targetX = (e.clientX - rect.left) / rect.width;
            this.targetY = (e.clientY - rect.top) / rect.height;
        });

        this.element.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.element === document ? 
                { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } :
                this.element.getBoundingClientRect();
            
            this.targetX = (touch.clientX - rect.left) / rect.width;
            this.targetY = (touch.clientY - rect.top) / rect.height;
        }, { passive: false });
    }

    update() {
        this.currentX += (this.targetX - this.currentX) * this.smoothing;
        this.currentY += (this.targetY - this.currentY) * this.smoothing;
    }

    getPosition() {
        return { x: this.currentX, y: this.currentY };
    }

    setSmoothing(value) {
        this.smoothing = Math.max(0.01, Math.min(1, value));
    }
}

// Exports globaux
window.initEffectPage = initEffectPage;
window.loadEffectTextures = loadEffectTextures;
window.resizeCanvas = resizeCanvas;
window.AnimationLoop = AnimationLoop;
window.InputTracker = InputTracker;

