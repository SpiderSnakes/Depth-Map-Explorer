/**
 * Image Manager - Gestion centralisée des images et depth maps
 * Version optimisée avec singleton, validation et cache
 * Depth Map Explorer
 */

class ImageManager {
    static _instance = null;
    static _readyPromise = null;

    constructor() {
        if (ImageManager._instance) {
            return ImageManager._instance;
        }

        this.images = [];
        this.currentImage = null;
        this.callbacks = new Set(); // Set pour éviter les doublons
        this.imageCache = new Map();
        this._initialized = false;

        ImageManager._instance = this;
    }

    /**
     * Pattern singleton - retourne l'instance unique
     */
    static getInstance() {
        if (!ImageManager._instance) {
            ImageManager._instance = new ImageManager();
        }
        return ImageManager._instance;
    }

    /**
     * Initialisation asynchrone avec garantie d'exécution unique
     */
    async init() {
        // Si déjà initialisé, retourner immédiatement
        if (this._initialized) {
            return this;
        }

        // Si initialisation en cours, attendre
        if (ImageManager._readyPromise) {
            return ImageManager._readyPromise;
        }

        // Démarrer l'initialisation
        ImageManager._readyPromise = this._doInit();
        return ImageManager._readyPromise;
    }

    async _doInit() {
        try {
            // Charger les images de démonstration
            this.images = await this.loadDemoImages();

            // Charger les images uploadées depuis localStorage
            const uploaded = this.getUploadedImages();
            this.images = [...this.images, ...uploaded];

            // Restaurer la dernière image sélectionnée
            const lastSelectedId = this._safeGetItem('lastSelectedImageId');
            if (lastSelectedId) {
                const lastImage = this.images.find(img => img.id === lastSelectedId);
                if (lastImage) {
                    this.currentImage = lastImage;
                }
            }

            // Fallback sur la première image
            if (!this.currentImage && this.images.length > 0) {
                this.currentImage = this.images[0];
            }

            this._initialized = true;
            console.log(`ImageManager initialisé avec ${this.images.length} images`);

            return this;
        } catch (error) {
            console.error('Erreur initialisation ImageManager:', error);
            this._initialized = true; // Marquer comme initialisé même en cas d'erreur
            return this;
        }
    }

    /**
     * Liste des images de démonstration
     */
    async loadDemoImages() {
        const demoImages = [
            { name: 'Aerial View', file: 'Aerial view', ext: 'jpg' },
            { name: 'Aerial', file: 'Aerial', ext: 'jpg' },
            { name: 'Campagne', file: 'Campagne', ext: 'jpg' },
            { name: 'City', file: 'City', ext: 'jpg' },
            { name: 'Cloudly Forest', file: 'Cloudly Forest', ext: 'jpg' },
            { name: 'Forêt', file: 'Fôret', ext: 'jpg' },
            { name: 'Metro', file: 'Metro', ext: 'jpg' },
            { name: 'Montagne', file: 'Montagne', ext: 'jpg' },
            { name: 'Portrait', file: 'Portait', ext: 'jpg' },
        ];

        const basePath = this.getBasePath();

        return demoImages.map((img, index) => ({
            id: `demo-${index}`,
            name: img.name,
            type: 'demo',
            originalUrl: `${basePath}/Images/Original/${img.file}.${img.ext}`,
            depthUrl: `${basePath}/Images/Depth Map/DM_${img.file}.png`,
            thumbnail: `${basePath}/Images/Original/${img.file}.${img.ext}`
        }));
    }

    /**
     * Détermine le chemin de base selon la page courante
     */
    getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/pages/')) {
            return '..';
        }
        return '.';
    }

    /**
     * Récupère les images uploadées avec validation
     */
    getUploadedImages() {
        try {
            const stored = this._safeGetItem('uploadedImages');
            if (!stored) return [];

            const data = JSON.parse(stored);

            // Validation du schéma
            if (!Array.isArray(data)) {
                console.warn('Données uploadedImages invalides, reset');
                this._safeRemoveItem('uploadedImages');
                return [];
            }

            // Filtrer et valider chaque image
            return data.filter(img => this._validateImageData(img));
        } catch (e) {
            console.error('Erreur chargement images uploadées:', e);
            this._safeRemoveItem('uploadedImages');
            return [];
        }
    }

    /**
     * Valide les données d'une image
     */
    _validateImageData(img) {
        if (!img || typeof img !== 'object') return false;
        if (!img.id || typeof img.id !== 'string') return false;
        if (!img.originalUrl || typeof img.originalUrl !== 'string') return false;
        if (!img.depthUrl || typeof img.depthUrl !== 'string') return false;

        // Vérifier que les URLs sont valides (data: ou http/https)
        const validUrlPattern = /^(data:|https?:\/\/|\.\.?\/)/;
        if (!validUrlPattern.test(img.originalUrl)) return false;
        if (!validUrlPattern.test(img.depthUrl)) return false;

        return true;
    }

    /**
     * Sauvegarde les images uploadées avec gestion des erreurs
     */
    saveUploadedImages() {
        try {
            const uploaded = this.images.filter(img => img.type === 'uploaded');
            const jsonStr = JSON.stringify(uploaded);

            // Vérifier la taille (localStorage limite ~5MB)
            const sizeInMB = new Blob([jsonStr]).size / (1024 * 1024);

            if (sizeInMB > 4.5) {
                console.warn(`Stockage presque plein: ${sizeInMB.toFixed(2)} MB`);
            }

            this._safeSetItem('uploadedImages', jsonStr);
            console.log(`${uploaded.length} image(s) sauvegardée(s) (${sizeInMB.toFixed(2)} MB)`);
            return true;
        } catch (e) {
            console.error('Erreur sauvegarde images:', e);

            if (e.name === 'QuotaExceededError') {
                // Tenter de libérer de l'espace en supprimant les plus anciennes
                this._cleanupOldImages();
            }
            return false;
        }
    }

    /**
     * Supprime les images les plus anciennes pour libérer de l'espace
     */
    _cleanupOldImages() {
        const uploaded = this.images.filter(img => img.type === 'uploaded');
        if (uploaded.length <= 1) return;

        // Supprimer la moitié des images les plus anciennes
        const toRemove = Math.ceil(uploaded.length / 2);
        for (let i = 0; i < toRemove; i++) {
            const img = uploaded[i];
            this.images = this.images.filter(x => x.id !== img.id);
        }

        console.warn(`${toRemove} images supprimées pour libérer de l'espace`);
        this.saveUploadedImages();
    }

    /**
     * Ajoute une image uploadée
     */
    addUploadedImage(imageData) {
        if (!imageData.originalUrl || !imageData.depthUrl) {
            throw new Error('URLs manquantes');
        }

        const id = `uploaded-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newImage = {
            id,
            name: this._sanitizeName(imageData.name) || 'Image personnalisée',
            type: 'uploaded',
            originalUrl: imageData.originalUrl,
            depthUrl: imageData.depthUrl,
            thumbnail: imageData.originalUrl,
            createdAt: Date.now()
        };

        // Validation avant ajout
        if (!this._validateImageData(newImage)) {
            throw new Error('Données image invalides');
        }

        this.images.push(newImage);

        const saved = this.saveUploadedImages();
        if (!saved) {
            // Rollback si échec
            this.images.pop();
            throw new Error('Impossible de sauvegarder l\'image (stockage plein)');
        }

        this.notifyChange();
        console.log('Image ajoutée:', id);

        return newImage;
    }

    /**
     * Supprime une image uploadée
     */
    removeUploadedImage(id) {
        const index = this.images.findIndex(img => img.id === id);
        if (index === -1) return false;

        const [removed] = this.images.splice(index, 1);

        // Si c'était l'image courante, sélectionner la première
        if (this.currentImage && this.currentImage.id === id) {
            this.currentImage = this.images[0] || null;
            this._safeSetItem('lastSelectedImageId', this.currentImage?.id || '');
        }

        this.saveUploadedImages();
        this.notifyChange();

        console.log('Image supprimée:', id);
        return true;
    }

    /**
     * Sélectionne une image
     */
    selectImage(id) {
        const image = this.images.find(img => img.id === id);
        if (image) {
            this.currentImage = image;
            this._safeSetItem('lastSelectedImageId', id);
            this.notifyChange();
            return true;
        }
        return false;
    }

    /**
     * Getters
     */
    getCurrentImage() {
        return this.currentImage;
    }

    getAllImages() {
        return [...this.images]; // Copie pour éviter mutation externe
    }

    getDemoImages() {
        return this.images.filter(img => img.type === 'demo');
    }

    getCustomImages() {
        return this.images.filter(img => img.type === 'uploaded');
    }

    /**
     * Abonnement aux changements
     */
    onChange(callback) {
        if (typeof callback === 'function') {
            this.callbacks.add(callback);
        }
        return () => this.callbacks.delete(callback); // Retourne fonction de désabonnement
    }

    /**
     * Notifie les abonnés d'un changement
     */
    notifyChange() {
        const current = this.currentImage;
        const all = this.getAllImages();

        this.callbacks.forEach(cb => {
            try {
                cb(current, all);
            } catch (e) {
                console.error('Erreur callback onChange:', e);
            }
        });
    }

    /**
     * Préchargement des images pour performance
     */
    async preloadImage(url) {
        if (this.imageCache.has(url)) {
            return this.imageCache.get(url);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                this.imageCache.set(url, img);
                resolve(img);
            };

            img.onerror = () => reject(new Error(`Échec chargement: ${url}`));
            img.src = url;
        });
    }

    /**
     * Précharge l'image courante et sa depth map
     */
    async preloadCurrentImage() {
        if (!this.currentImage) return null;

        try {
            await Promise.all([
                this.preloadImage(this.currentImage.originalUrl),
                this.preloadImage(this.currentImage.depthUrl)
            ]);
            return this.currentImage;
        } catch (e) {
            console.error('Erreur préchargement:', e);
            return this.currentImage;
        }
    }

    /**
     * Utilitaires localStorage sécurisés
     */
    _safeGetItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('localStorage.getItem failed:', e);
            return null;
        }
    }

    _safeSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn('localStorage.setItem failed:', e);
            return false;
        }
    }

    _safeRemoveItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn('localStorage.removeItem failed:', e);
            return false;
        }
    }

    /**
     * Sanitize le nom d'une image
     */
    _sanitizeName(name) {
        if (!name || typeof name !== 'string') return '';
        return name.trim().slice(0, 100).replace(/[<>]/g, '');
    }

    /**
     * Convertir une image en Data URL avec redimensionnement
     */
    static imageToDataURL(img, maxSize = 1024, quality = 0.85) {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Redimensionner si nécessaire
        if (width > maxSize || height > maxSize) {
            if (width > height) {
                height = Math.round(height * maxSize / width);
                width = maxSize;
            } else {
                width = Math.round(width * maxSize / height);
                height = maxSize;
            }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        return canvas.toDataURL('image/jpeg', quality);
    }
}

// Instance globale singleton
window.imageManager = ImageManager.getInstance();

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageManager;
}

