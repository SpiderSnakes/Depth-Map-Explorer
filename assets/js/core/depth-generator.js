/**
 * Depth Map Generator - Génération de depth maps haute qualité
 * Utilise MiDaS via ONNX Runtime Web pour la meilleure qualité
 * Avec fallback sur méthode heuristique améliorée
 * Depth Map Explorer
 */

class DepthGenerator {
    constructor() {
        this.session = null;
        this.isModelLoading = false;
        this.isModelReady = false;
        this.modelType = 'none'; // 'midas', 'heuristic'
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Initialise le modèle MiDaS via ONNX Runtime Web
     */
    async initMiDaS(onProgress) {
        if (this.isModelReady && this.modelType === 'midas') {
            return true;
        }

        if (this.isModelLoading) {
            // Attendre que le chargement en cours se termine
            while (this.isModelLoading) {
                await new Promise(r => setTimeout(r, 100));
            }
            return this.isModelReady;
        }

        this.isModelLoading = true;

        try {
            if (onProgress) onProgress(5, 'Chargement ONNX Runtime...');

            // Charger ONNX Runtime Web si pas déjà chargé
            if (typeof ort === 'undefined') {
                await this._loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort.min.js');
            }

            if (onProgress) onProgress(15, 'Configuration ONNX...');

            // Configurer ONNX pour utiliser WebGL
            ort.env.wasm.numThreads = 1;
            ort.env.wasm.simd = true;

            if (onProgress) onProgress(25, 'Téléchargement du modèle MiDaS...');

            // Charger le modèle MiDaS small (plus léger, ~40MB)
            // Le modèle est hébergé sur un CDN public
            const modelUrl = 'https://huggingface.co/nickmuchi/midas-small-onnx/resolve/main/model.onnx';
            
            // Alternative: modèle plus petit custom
            const modelUrlSmall = 'https://cdn.jsdelivr.net/gh/nickmuchi/midas-onnx-models/midas_v21_small_256.onnx';

            try {
                this.session = await ort.InferenceSession.create(modelUrlSmall, {
                    executionProviders: ['webgl', 'wasm'],
                    graphOptimizationLevel: 'all'
                });

                if (onProgress) onProgress(90, 'Modèle chargé!');

                this.isModelReady = true;
                this.modelType = 'midas';
                this.isModelLoading = false;

                if (onProgress) onProgress(100, 'Prêt!');
                console.log('MiDaS chargé avec succès');

                return true;
            } catch (modelError) {
                console.warn('Échec chargement MiDaS, utilisation méthode heuristique:', modelError);
                this.modelType = 'heuristic';
                this.isModelReady = true;
                this.isModelLoading = false;

                if (onProgress) onProgress(100, 'Mode heuristique activé');
                return true;
            }

        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.modelType = 'heuristic';
            this.isModelReady = true;
            this.isModelLoading = false;

            if (onProgress) onProgress(100, 'Mode heuristique activé');
            return true;
        }
    }

    /**
     * Génère une depth map - utilise MiDaS si disponible, sinon méthode heuristique
     */
    async generateLocal(imageElement, onProgress) {
        // Essayer d'initialiser MiDaS
        if (!this.isModelReady) {
            await this.initMiDaS(onProgress);
        }

        if (this.modelType === 'midas' && this.session) {
            return this._generateWithMiDaS(imageElement, onProgress);
        } else {
            return this._generateHeuristic(imageElement, onProgress);
        }
    }

    /**
     * Génération avec MiDaS via ONNX
     */
    async _generateWithMiDaS(imageElement, onProgress) {
        try {
            if (onProgress) onProgress(10, 'Préparation de l\'image...');

            const width = imageElement.naturalWidth || imageElement.width;
            const height = imageElement.naturalHeight || imageElement.height;

            // Taille d'entrée du modèle MiDaS small (256x256)
            const inputSize = 256;

            // Préparer le canvas pour le preprocessing
            this.canvas.width = inputSize;
            this.canvas.height = inputSize;
            this.ctx.drawImage(imageElement, 0, 0, inputSize, inputSize);

            const imageData = this.ctx.getImageData(0, 0, inputSize, inputSize);

            if (onProgress) onProgress(30, 'Preprocessing...');

            // Normalisation pour MiDaS
            const inputTensor = this._preprocessForMiDaS(imageData, inputSize);

            if (onProgress) onProgress(50, 'Inférence MiDaS...');

            // Exécuter l'inférence
            const feeds = { input: inputTensor };
            const results = await this.session.run(feeds);

            if (onProgress) onProgress(75, 'Post-processing...');

            // Récupérer la sortie
            const output = results[Object.keys(results)[0]];
            const depthData = output.data;

            // Convertir en image
            const depthCanvas = this._postprocessMiDaS(depthData, inputSize, width, height);

            if (onProgress) onProgress(95, 'Finalisation...');

            // Appliquer un post-traitement pour améliorer la qualité
            const enhancedCanvas = this._enhanceDepthMap(depthCanvas);

            if (onProgress) onProgress(100, 'Terminé!');

            return enhancedCanvas.toDataURL('image/png');

        } catch (error) {
            console.error('Erreur MiDaS, fallback heuristique:', error);
            return this._generateHeuristic(imageElement, onProgress);
        }
    }

    /**
     * Prétraitement pour MiDaS
     */
    _preprocessForMiDaS(imageData, size) {
        const { data } = imageData;
        const floatData = new Float32Array(3 * size * size);

        // Normalisation ImageNet
        const mean = [0.485, 0.456, 0.406];
        const std = [0.229, 0.224, 0.225];

        for (let i = 0; i < size * size; i++) {
            const r = data[i * 4] / 255;
            const g = data[i * 4 + 1] / 255;
            const b = data[i * 4 + 2] / 255;

            // Format CHW (Channel, Height, Width)
            floatData[i] = (r - mean[0]) / std[0];
            floatData[size * size + i] = (g - mean[1]) / std[1];
            floatData[2 * size * size + i] = (b - mean[2]) / std[2];
        }

        return new ort.Tensor('float32', floatData, [1, 3, size, size]);
    }

    /**
     * Post-traitement de la sortie MiDaS
     */
    _postprocessMiDaS(depthData, inputSize, outputWidth, outputHeight) {
        // Normaliser les valeurs de profondeur
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < depthData.length; i++) {
            if (depthData[i] < min) min = depthData[i];
            if (depthData[i] > max) max = depthData[i];
        }

        const range = max - min || 1;

        // Créer l'image de sortie à la taille d'entrée
        const canvas = document.createElement('canvas');
        canvas.width = inputSize;
        canvas.height = inputSize;
        const ctx = canvas.getContext('2d');
        const outputImageData = ctx.createImageData(inputSize, inputSize);

        for (let i = 0; i < depthData.length; i++) {
            const normalized = ((depthData[i] - min) / range) * 255;
            const px = i * 4;
            outputImageData.data[px] = normalized;
            outputImageData.data[px + 1] = normalized;
            outputImageData.data[px + 2] = normalized;
            outputImageData.data[px + 3] = 255;
        }

        ctx.putImageData(outputImageData, 0, 0);

        // Redimensionner à la taille originale
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = outputWidth;
        outputCanvas.height = outputHeight;
        const outCtx = outputCanvas.getContext('2d');

        // Utiliser un scaling de haute qualité
        outCtx.imageSmoothingEnabled = true;
        outCtx.imageSmoothingQuality = 'high';
        outCtx.drawImage(canvas, 0, 0, outputWidth, outputHeight);

        return outputCanvas;
    }

    /**
     * Améliore la depth map avec des filtres de post-traitement
     */
    _enhanceDepthMap(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const w = canvas.width;
        const h = canvas.height;

        // Amélioration du contraste (CLAHE simplifié)
        const enhanced = this._enhanceContrast(data, w, h);

        // Filtre bilatéral pour lisser tout en préservant les bords
        const smoothed = this._bilateralFilter(enhanced, w, h, 5, 50, 50);

        // Appliquer le résultat
        for (let i = 0; i < smoothed.length; i++) {
            const px = i * 4;
            const value = Math.max(0, Math.min(255, smoothed[i]));
            data[px] = value;
            data[px + 1] = value;
            data[px + 2] = value;
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * Génération heuristique améliorée (fallback)
     */
    async _generateHeuristic(imageElement, onProgress) {
        return new Promise((resolve, reject) => {
            try {
                if (onProgress) onProgress(5, 'Analyse de l\'image...');

                const width = imageElement.naturalWidth || imageElement.width;
                const height = imageElement.naturalHeight || imageElement.height;

                if (!width || !height) {
                    reject(new Error('Image invalide'));
                    return;
                }

                // Limiter la taille pour les performances
                const maxSize = 800;
                let w = width, h = height;
                if (w > maxSize || h > maxSize) {
                    if (w > h) {
                        h = Math.round(h * maxSize / w);
                        w = maxSize;
                    } else {
                        w = Math.round(w * maxSize / h);
                        h = maxSize;
                    }
                }

                this.canvas.width = w;
                this.canvas.height = h;
                this.ctx.drawImage(imageElement, 0, 0, w, h);

                const imageData = this.ctx.getImageData(0, 0, w, h);
                const data = imageData.data;

                if (onProgress) onProgress(15, 'Conversion niveaux de gris...');

                // Convertir en niveaux de gris
                const gray = new Float32Array(w * h);
                for (let i = 0; i < data.length; i += 4) {
                    const idx = i / 4;
                    gray[idx] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
                }

                if (onProgress) onProgress(25, 'Calcul des gradients (Sobel)...');

                // Calcul des gradients avec Sobel
                const gradients = this._computeSobel(gray, w, h);

                if (onProgress) onProgress(40, 'Détection des textures...');

                // Calcul de la variance locale (texture)
                const texture = this._computeLocalVariance(gray, w, h, 5);

                if (onProgress) onProgress(55, 'Analyse de la saturation...');

                // Saturation pour aider à détecter les zones focalisées
                const saturation = this._computeSaturation(data, w, h);

                if (onProgress) onProgress(65, 'Estimation de la profondeur...');

                // Estimation combinée de la profondeur
                const depth = new Float32Array(w * h);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const idx = y * w + x;

                        // Facteur vertical (haut = loin, bas = proche)
                        const verticalFactor = 1.0 - (y / h) * 0.5;

                        // Facteur de luminosité
                        const lumFactor = 1.0 - gray[idx] * 0.25;

                        // Facteur de gradient (plus de détails = plus proche)
                        const gradFactor = Math.min(1.0, gradients[idx] * 1.5);

                        // Facteur de texture (plus de texture = plus proche)
                        const texFactor = Math.min(1.0, texture[idx] * 10);

                        // Facteur de saturation (plus saturé = potentiellement sujet principal)
                        const satFactor = saturation[idx] * 0.3;

                        // Facteur de position centrale (le centre a tendance à être le sujet)
                        const cx = x / w - 0.5;
                        const cy = y / h - 0.5;
                        const centerDist = Math.sqrt(cx * cx + cy * cy);
                        const centerFactor = 1.0 - centerDist * 0.3;

                        // Combinaison pondérée
                        depth[idx] = 
                            verticalFactor * 0.25 +
                            lumFactor * 0.15 +
                            gradFactor * 0.2 +
                            texFactor * 0.2 +
                            satFactor * 0.1 +
                            centerFactor * 0.1;
                    }
                }

                if (onProgress) onProgress(75, 'Lissage bilatéral...');

                // Filtre bilatéral pour préserver les bords
                const smoothed = this._bilateralFilter(depth, w, h, 7, 30, 30);

                if (onProgress) onProgress(85, 'Amélioration du contraste...');

                // Améliorer le contraste
                const enhanced = this._enhanceContrast(smoothed, w, h);

                if (onProgress) onProgress(92, 'Normalisation...');

                // Normalisation finale
                let min = Infinity, max = -Infinity;
                for (let i = 0; i < enhanced.length; i++) {
                    if (enhanced[i] < min) min = enhanced[i];
                    if (enhanced[i] > max) max = enhanced[i];
                }
                const range = max - min || 1;

                // Créer l'image de sortie
                const outputData = this.ctx.createImageData(w, h);
                for (let i = 0; i < enhanced.length; i++) {
                    const normalized = ((enhanced[i] - min) / range) * 255;
                    const px = i * 4;
                    outputData.data[px] = normalized;
                    outputData.data[px + 1] = normalized;
                    outputData.data[px + 2] = normalized;
                    outputData.data[px + 3] = 255;
                }

                this.ctx.putImageData(outputData, 0, 0);

                if (onProgress) onProgress(100, 'Terminé!');

                setTimeout(() => {
                    resolve(this.canvas.toDataURL('image/png'));
                }, 50);

            } catch (error) {
                console.error('Erreur génération depth map:', error);
                reject(error);
            }
        });
    }

    /**
     * Calcul des gradients avec Sobel
     */
    _computeSobel(gray, w, h) {
        const gradients = new Float32Array(w * h);

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = y * w + x;

                // Sobel X
                const gx =
                    -gray[(y - 1) * w + (x - 1)] - 2 * gray[y * w + (x - 1)] - gray[(y + 1) * w + (x - 1)] +
                    gray[(y - 1) * w + (x + 1)] + 2 * gray[y * w + (x + 1)] + gray[(y + 1) * w + (x + 1)];

                // Sobel Y
                const gy =
                    -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)] +
                    gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];

                gradients[idx] = Math.sqrt(gx * gx + gy * gy);
            }
        }

        return gradients;
    }

    /**
     * Calcul de la variance locale (mesure de texture)
     */
    _computeLocalVariance(gray, w, h, radius) {
        const variance = new Float32Array(w * h);

        for (let y = radius; y < h - radius; y++) {
            for (let x = radius; x < w - radius; x++) {
                const idx = y * w + x;
                let sum = 0, sumSq = 0, count = 0;

                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const val = gray[(y + ky) * w + (x + kx)];
                        sum += val;
                        sumSq += val * val;
                        count++;
                    }
                }

                const mean = sum / count;
                variance[idx] = (sumSq / count) - (mean * mean);
            }
        }

        return variance;
    }

    /**
     * Calcul de la saturation
     */
    _computeSaturation(data, w, h) {
        const saturation = new Float32Array(w * h);

        for (let i = 0; i < w * h; i++) {
            const px = i * 4;
            const r = data[px] / 255;
            const g = data[px + 1] / 255;
            const b = data[px + 2] / 255;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);

            saturation[i] = max === 0 ? 0 : (max - min) / max;
        }

        return saturation;
    }

    /**
     * Filtre bilatéral - lisse tout en préservant les bords
     */
    _bilateralFilter(data, w, h, radius, sigmaSpace, sigmaRange) {
        const result = new Float32Array(data.length);
        const spatialWeights = this._createGaussianKernel(radius, sigmaSpace);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                const centerValue = data[idx];
                let sum = 0, weightSum = 0;

                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const nx = Math.min(w - 1, Math.max(0, x + kx));
                        const ny = Math.min(h - 1, Math.max(0, y + ky));
                        const nidx = ny * w + nx;
                        const neighborValue = data[nidx];

                        // Poids spatial
                        const spatialWeight = spatialWeights[(ky + radius) * (2 * radius + 1) + (kx + radius)];

                        // Poids de range (similitude de valeur)
                        const rangeDiff = Math.abs(neighborValue - centerValue);
                        const rangeWeight = Math.exp(-(rangeDiff * rangeDiff) / (2 * sigmaRange * sigmaRange));

                        const weight = spatialWeight * rangeWeight;
                        sum += neighborValue * weight;
                        weightSum += weight;
                    }
                }

                result[idx] = weightSum > 0 ? sum / weightSum : centerValue;
            }
        }

        return result;
    }

    /**
     * Amélioration du contraste
     */
    _enhanceContrast(data, w, h) {
        const result = new Float32Array(data.length);

        // Calculer l'histogramme
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < data.length; i++) {
            const value = Math.floor(data[i] * 255);
            const bin = Math.max(0, Math.min(255, value));
            histogram[bin]++;
        }

        // Calculer les percentiles pour le stretching
        const totalPixels = w * h;
        let cumSum = 0;
        let lowPercent = 0, highPercent = 255;

        for (let i = 0; i < 256; i++) {
            cumSum += histogram[i];
            if (cumSum < totalPixels * 0.01) lowPercent = i;
            if (cumSum < totalPixels * 0.99) highPercent = i;
        }

        const range = highPercent - lowPercent || 1;

        // Appliquer le stretching
        for (let i = 0; i < data.length; i++) {
            const value = data[i] * 255;
            const stretched = (value - lowPercent) / range;
            result[i] = Math.max(0, Math.min(1, stretched));
        }

        return result;
    }

    /**
     * Crée un kernel gaussien
     */
    _createGaussianKernel(radius, sigma) {
        const size = radius * 2 + 1;
        const kernel = new Float32Array(size * size);

        for (let y = -radius; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++) {
                const val = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
                kernel[(y + radius) * size + (x + radius)] = val;
            }
        }

        return kernel;
    }

    /**
     * Charge un script dynamiquement
     */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            // Vérifier si déjà chargé
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Retourne le type de modèle utilisé
     */
    getModelType() {
        return this.modelType;
    }

    /**
     * Vérifie si MiDaS est disponible
     */
    isMiDaSAvailable() {
        return this.modelType === 'midas' && this.session !== null;
    }
}

// Instance globale
window.depthGenerator = new DepthGenerator();

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DepthGenerator;
}

