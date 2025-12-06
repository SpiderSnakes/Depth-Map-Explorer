/**
 * WebGL Utilities - Utilitaires WebGL avec gestion mémoire
 * Depth Map Explorer
 */

/**
 * Classe de gestion des ressources WebGL
 * Gère la création, le cache et la libération des textures
 */
class WebGLResourceManager {
    constructor(gl) {
        this.gl = gl;
        this.textures = new Map();
        this.programs = new Map();
        this.buffers = new Map();
        this.maxCacheSize = 20; // Maximum de textures en cache
    }

    /**
     * Crée et compile un shader
     */
    createShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compilation error: ${error}`);
        }

        return shader;
    }

    /**
     * Crée et lie un programme shader
     */
    createProgram(vertexSource, fragmentSource, name = 'default') {
        const gl = this.gl;

        // Vérifier le cache
        if (this.programs.has(name)) {
            return this.programs.get(name);
        }

        const vertexShader = this.createShader(vertexSource, gl.VERTEX_SHADER);
        const fragmentShader = this.createShader(fragmentSource, gl.FRAGMENT_SHADER);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            throw new Error(`Program linking error: ${error}`);
        }

        // Stocker les références pour le nettoyage
        const programData = {
            program,
            vertexShader,
            fragmentShader,
            uniforms: {},
            attributes: {}
        };

        this.programs.set(name, programData);
        return programData;
    }

    /**
     * Récupère ou crée une texture depuis une URL
     */
    async loadTexture(url, options = {}) {
        const {
            unit = 0,
            flipY = false,
            generateMipmaps = false,
            wrapS = this.gl.CLAMP_TO_EDGE,
            wrapT = this.gl.CLAMP_TO_EDGE,
            minFilter = this.gl.LINEAR,
            magFilter = this.gl.LINEAR
        } = options;

        const gl = this.gl;
        const cacheKey = `${url}_${unit}`;

        // Vérifier le cache
        if (this.textures.has(cacheKey)) {
            const cached = this.textures.get(cacheKey);
            // Move to end (LRU)
            this.textures.delete(cacheKey);
            this.textures.set(cacheKey, cached);
            return cached;
        }

        // Éviction LRU si cache plein
        if (this.textures.size >= this.maxCacheSize) {
            const oldest = this.textures.keys().next().value;
            this.deleteTexture(oldest);
        }

        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';

            image.onload = () => {
                const texture = gl.createTexture();
                gl.activeTexture(gl.TEXTURE0 + unit);
                gl.bindTexture(gl.TEXTURE_2D, texture);

                if (flipY) {
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                }

                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);

                if (generateMipmaps && this.isPowerOf2(image.width) && this.isPowerOf2(image.height)) {
                    gl.generateMipmap(gl.TEXTURE_2D);
                }

                if (flipY) {
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                }

                const textureData = {
                    texture,
                    width: image.width,
                    height: image.height,
                    unit
                };

                this.textures.set(cacheKey, textureData);
                resolve(textureData);
            };

            image.onerror = () => {
                reject(new Error(`Failed to load texture: ${url}`));
            };

            image.src = url;
        });
    }

    /**
     * Crée une texture depuis un élément Image déjà chargé
     */
    createTextureFromImage(image, options = {}) {
        const {
            unit = 0,
            flipY = false
        } = options;

        const gl = this.gl;
        const texture = gl.createTexture();

        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        if (flipY) {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        }

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        if (flipY) {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        }

        return {
            texture,
            width: image.width,
            height: image.height,
            unit
        };
    }

    /**
     * Crée un buffer
     */
    createBuffer(data, name, usage = this.gl.STATIC_DRAW) {
        const gl = this.gl;

        if (this.buffers.has(name)) {
            return this.buffers.get(name);
        }

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, usage);

        this.buffers.set(name, buffer);
        return buffer;
    }

    /**
     * Crée un quad fullscreen standard
     */
    createFullscreenQuad(name = 'fullscreenQuad') {
        const positions = new Float32Array([
            -1, -1, 0, 1,  // bottom-left
             1, -1, 1, 1,  // bottom-right
            -1,  1, 0, 0,  // top-left
             1,  1, 1, 0,  // top-right
        ]);
        return this.createBuffer(positions, name);
    }

    /**
     * Configure les attributs de vertex
     */
    setupVertexAttributes(program, attributes) {
        const gl = this.gl;

        for (const [name, config] of Object.entries(attributes)) {
            const location = gl.getAttribLocation(program.program, name);
            if (location !== -1) {
                gl.enableVertexAttribArray(location);
                gl.vertexAttribPointer(
                    location,
                    config.size,
                    config.type || gl.FLOAT,
                    config.normalized || false,
                    config.stride,
                    config.offset
                );
                program.attributes[name] = location;
            }
        }
    }

    /**
     * Récupère les locations des uniforms
     */
    getUniformLocations(program, uniformNames) {
        const gl = this.gl;
        const locations = {};

        for (const name of uniformNames) {
            const location = gl.getUniformLocation(program.program, name);
            program.uniforms[name] = location;
            locations[name] = location;
        }

        return locations;
    }

    /**
     * Supprime une texture du cache
     */
    deleteTexture(cacheKey) {
        if (this.textures.has(cacheKey)) {
            const textureData = this.textures.get(cacheKey);
            this.gl.deleteTexture(textureData.texture);
            this.textures.delete(cacheKey);
        }
    }

    /**
     * Supprime un programme
     */
    deleteProgram(name) {
        if (this.programs.has(name)) {
            const programData = this.programs.get(name);
            this.gl.deleteProgram(programData.program);
            this.gl.deleteShader(programData.vertexShader);
            this.gl.deleteShader(programData.fragmentShader);
            this.programs.delete(name);
        }
    }

    /**
     * Libère toutes les ressources
     */
    dispose() {
        const gl = this.gl;

        // Supprimer les textures
        for (const [, textureData] of this.textures) {
            gl.deleteTexture(textureData.texture);
        }
        this.textures.clear();

        // Supprimer les programmes
        for (const [, programData] of this.programs) {
            gl.deleteProgram(programData.program);
            gl.deleteShader(programData.vertexShader);
            gl.deleteShader(programData.fragmentShader);
        }
        this.programs.clear();

        // Supprimer les buffers
        for (const [, buffer] of this.buffers) {
            gl.deleteBuffer(buffer);
        }
        this.buffers.clear();

        console.log('WebGL resources disposed');
    }

    /**
     * Vérifie si une dimension est une puissance de 2
     */
    isPowerOf2(value) {
        return (value & (value - 1)) === 0;
    }
}

/**
 * Calcule la taille optimale du canvas
 */
function calculateCanvasSize(imageWidth, imageHeight, options = {}) {
    const {
        maxWidthRatio = 0.7,
        maxHeightRatio = 0.75,
        sidebarWidth = 240,
        infoPanelWidth = 300,
        padding = 80
    } = options;

    const availableWidth = window.innerWidth - sidebarWidth - infoPanelWidth - padding;
    const availableHeight = window.innerHeight * maxHeightRatio;

    let width = imageWidth;
    let height = imageHeight;

    // Ajuster à la largeur disponible
    if (width > availableWidth) {
        height = height * availableWidth / width;
        width = availableWidth;
    }

    // Ajuster à la hauteur disponible
    if (height > availableHeight) {
        width = width * availableHeight / height;
        height = availableHeight;
    }

    return {
        width: Math.round(width),
        height: Math.round(height)
    };
}

/**
 * Crée un contexte WebGL2 avec options optimisées
 */
function createWebGLContext(canvas, options = {}) {
    const defaultOptions = {
        alpha: false,
        antialias: true,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
    };

    const contextOptions = { ...defaultOptions, ...options };

    let gl = canvas.getContext('webgl2', contextOptions);
    
    if (!gl) {
        gl = canvas.getContext('webgl', contextOptions);
        if (!gl) {
            throw new Error('WebGL non supporté');
        }
        console.warn('WebGL 2 non disponible, utilisation de WebGL 1');
    }

    return gl;
}

/**
 * Vertex Shader standard pour effets 2D
 */
const STANDARD_VERTEX_SHADER = `#version 300 es
    in vec4 aPosition;
    in vec2 aTexCoord;
    out vec2 vTexCoord;
    
    void main() {
        gl_Position = vec4(aPosition.xy, 0.0, 1.0);
        vTexCoord = aTexCoord;
    }
`;

/**
 * Vertex Shader WebGL 1 compatible
 */
const STANDARD_VERTEX_SHADER_V1 = `
    attribute vec4 aPosition;
    attribute vec2 aTexCoord;
    varying vec2 vTexCoord;
    
    void main() {
        gl_Position = vec4(aPosition.xy, 0.0, 1.0);
        vTexCoord = aTexCoord;
    }
`;

// Export global
window.WebGLResourceManager = WebGLResourceManager;
window.calculateCanvasSize = calculateCanvasSize;
window.createWebGLContext = createWebGLContext;
window.STANDARD_VERTEX_SHADER = STANDARD_VERTEX_SHADER;
window.STANDARD_VERTEX_SHADER_V1 = STANDARD_VERTEX_SHADER_V1;

