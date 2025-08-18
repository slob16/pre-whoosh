import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// --- DOM Elements ---
const preloader = document.getElementById('preloader');
const enterContainer = document.getElementById('enter-container');
const decorativeClouds = document.querySelectorAll('.decorate');
const isMobile = window.innerWidth <= 768;
// Toggle to use simple placeholder balloons before GLBs arrive
const USE_PLACEHOLDERS = false;

// --- BALLOON SCENE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
    antialias: true,
    powerPreference: 'high-performance',
});
// Lower pixel ratio on mobile to reduce GPU load and jank
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.0 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.setZ(isMobile ? 40 : 30);

// --- Sky ---
const skyGeometry = new THREE.SphereGeometry(500, 60, 40);
skyGeometry.scale(-1, 1, 1); // Invert the sphere to see the texture from the inside
const skyMaterial = new THREE.MeshBasicMaterial({
    color: 0x87ceeb // A basic sky blue color
});
const sky = new THREE.Mesh(skyGeometry, skyMaterial);

// Create a gradient background
const topColor = new THREE.Color(0x0077ff);
const bottomColor = new THREE.Color(0x87ceeb);
const vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
        vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
`;
const fragmentShader = `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;
    void main() {
        float h = normalize( vWorldPosition + offset ).y;
        gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );
    }
`;
const uniforms = {
    topColor: { value: topColor },
    bottomColor: { value: bottomColor },
    offset: { value: 33 },
    exponent: { value: 0.6 }
};
skyMaterial.onBeforeCompile = shader => {
    shader.uniforms.topColor = uniforms.topColor;
    shader.uniforms.bottomColor = uniforms.bottomColor;
    shader.uniforms.offset = uniforms.offset;
    shader.uniforms.exponent = uniforms.exponent;
    shader.vertexShader = vertexShader;
    shader.fragmentShader = fragmentShader;
};
scene.add(sky);


// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(50, 50, 50);
scene.add(directionalLight);


// --- Engine Model ---
let engineModel, flameEffect1, flameEffect2;
const engineBasePosition = new THREE.Vector3(isMobile ? 0 : -2.5, 0, 0); // Center on mobile, adjust for new smaller scale

const loader = new GLTFLoader();
// Enable Draco decoding (WASM) from the Three.js CDN for compressed GLBs
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/libs/draco/');
dracoLoader.setDecoderConfig({ type: 'wasm' });
dracoLoader.preload();
loader.setDRACOLoader(dracoLoader);
loader.load(
    '../assets/burner/hab-engine.glb', // Correct path to engine model
    function (gltf) {
        engineModel = gltf.scene;
        const engineScale = isMobile ? 4.5 : 7; // Made the model even smaller
        engineModel.scale.set(engineScale, engineScale, engineScale);
        engineModel.position.copy(engineBasePosition); // Set position from base
        engineModel.rotation.y = 0; // Rotated to face forward
        engineModel.visible = false; // Hide it initially
        scene.add(engineModel);
    if (burnerRevealed) engineModel.visible = true;
    },
    undefined, // onProgress callback (optional)
    function (error) { console.error('An error happened while loading the model:', error); }
);

// --- Hot Air Balloon Creation from GLBs ---
const balloons = [];

const balloonModelPaths = [
    '../assets/balloons/hab.glb',
    '../assets/balloons/hab3.glb',
    // New balloon set
    '../assets/new-balloons/new-balloon-1.glb',
    '../assets/new-balloons/new-balloon-2.glb',
    '../assets/new-balloons/new-balloon-3.glb',
    '../assets/new-balloons/new-balloon-4.glb',
    '../assets/new-balloons/new-balloon-5.glb',
    '../assets/new-balloons/new-balloon-6.glb',
    '../assets/new-balloons/new-balloon-7.glb',
    '../assets/new-balloons/new-balloon-8.glb',
    '../assets/new-balloons/new-balloon-9.glb',
    '../assets/new-balloons/new-balloon-10.glb',
    '../assets/new-balloons/new-balloon-11.glb',
    '../assets/new-balloons/new-balloon-12.glb',
    '../assets/new-balloons/new-balloon-13.glb',
    '../assets/new-balloons/new-balloon-14.glb',
    '../assets/new-balloons/new-balloon-15.glb',
    '../assets/new-balloons/new-balloon-16.glb',
    '../assets/new-balloons/new-balloon-17.glb',
    '../assets/new-balloons/new-balloon-18.glb',
    '../assets/new-balloons/new-balloon-19.glb',
    '../assets/new-balloons/new-balloon-20.glb'
];
const safeZoneX = isMobile ? 5 : 7; // Adjusted safe zone for even smaller engine model

// Create a simple placeholder balloon so something is visible immediately
function createPlaceholderBalloon() {
    const group = new THREE.Group();
    // Envelope
    const envelopeGeo = new THREE.SphereGeometry(1.6, 16, 16);
    const envelopeMat = new THREE.MeshStandardMaterial({ color: 0xff6f61, roughness: 0.8, metalness: 0.1 });
    const envelope = new THREE.Mesh(envelopeGeo, envelopeMat);
    envelope.position.y = 1.6;
    group.add(envelope);
    // Basket
    const basketGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.35, 8);
    const basketMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
    const basket = new THREE.Mesh(basketGeo, basketMat);
    group.add(basket);
    return group;
}

function setupBalloon(balloonModel) {
    // Randomize position
    const xRange = isMobile ? 30 : 50;
    let xPos = (Math.random() - 0.5) * xRange; // Range: -25 to 25
    if (Math.abs(xPos) < safeZoneX) {
        xPos = (xPos >= 0 ? 1 : -1) * (safeZoneX + Math.random() * (xRange / 2 - safeZoneX));
    }
    balloonModel.position.x = xPos;
    balloonModel.position.y = -10 - Math.random() * 4; // Start near the bottom so they show almost immediately
    balloonModel.position.z = (Math.random() - 0.5) * 20;
    balloonModel.rotation.y = Math.random() * Math.PI * 2;

    // Randomize scale - you may need to adjust this based on your model's original size
    const scale = Math.random() * 1.2 + 2.2; // slightly smaller range for placeholders and GLBs
    balloonModel.scale.set(scale, scale, scale);

    // Add animation data
    balloonModel.userData.speed = Math.random() * 0.3 + 0.4; // Faster so they are visible quicker
    balloonModel.userData.sway = Math.random() * 5;
    balloonModel.userData.swaySpeed = Math.random() * 0.01;

    balloons.push(balloonModel);
    scene.add(balloonModel);
}

// Replace a placeholder with a loaded GLB, preserving motion
function swapPlaceholderWithModel(placeholder, model) {
    if (!placeholder || !model) return setupBalloon(model);
    model.position.copy(placeholder.position);
    model.rotation.copy(placeholder.rotation);
    model.scale.copy(placeholder.scale);
    model.userData = { ...placeholder.userData };
    scene.add(model);
    // Replace in balloons array
    const idx = balloons.indexOf(placeholder);
    if (idx !== -1) balloons[idx] = model;
    scene.remove(placeholder);
}

// Create immediate placeholders
const placeholdersQueue = [];
if (USE_PLACEHOLDERS) {
    const initialBalloonCount = isMobile ? 6 : 10;
    for (let i = 0; i < initialBalloonCount; i++) {
        const ph = createPlaceholderBalloon();
        setupBalloon(ph);
        placeholdersQueue.push(ph);
    }
}

// Utility to select N unique random items while honoring priority
function selectRandomUnique(arr, n, priority = []) {
    const set = new Set(priority.filter(p => arr.includes(p)));
    const remaining = arr.filter(p => !set.has(p));
    for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    const need = Math.max(0, n - set.size);
    const chosen = [...set, ...remaining.slice(0, need)];
    return chosen.slice(0, n);
}

const TARGET_BALLOON_COUNT = 10;
const priorityFirst = [
    '../assets/balloons/hab.glb',
    '../assets/balloons/hab3.glb',
];
const selectedBalloonPaths = selectRandomUnique(balloonModelPaths, TARGET_BALLOON_COUNT, priorityFirst);

// Concurrency-limited progressive loader for faster first paint
function loadBalloon(path) {
    return new Promise((resolve) => {
        loader.load(
            path,
            gltf => {
                const model = gltf.scene;
                model.traverse(node => {
                    if (node.isMesh && node.material && node.material.transparent) {
                        node.material.alphaTest = 0.5;
                        node.material.depthWrite = true;
                    }
                });
                if (USE_PLACEHOLDERS) {
                    const placeholder = placeholdersQueue.shift();
                    if (placeholder) swapPlaceholderWithModel(placeholder, model);
                    else setupBalloon(model);
                } else {
                    setupBalloon(model);
                }
                resolve();
            },
            undefined,
            (error) => {
                console.error(`Failed to load balloon model from: ${path}`, error);
                resolve();
            }
        );
    });
}

async function loadWithConcurrency(paths, maxConcurrent = 3, staggerMs = 60) {
    const queue = paths.slice();
    const running = new Set();
    async function next() {
        if (queue.length === 0) return;
        const path = queue.shift();
        const p = loadBalloon(path).then(() => running.delete(p));
        running.add(p);
        if (staggerMs) await new Promise(r => setTimeout(r, staggerMs));
        if (running.size < maxConcurrent) return next();
    }
    // Prime initial batch
    const starters = Math.min(maxConcurrent, queue.length);
    for (let i = 0; i < starters; i++) await next();
    while (running.size > 0 || queue.length > 0) {
        if (queue.length > 0 && running.size < maxConcurrent) await next();
        await Promise.race(running);
    }
}

// Start loading selected balloons
loadWithConcurrency(selectedBalloonPaths, 3, 80);

// --- Particle Flame Effect (inspired by fire-study) ---
const PARTICLE_COUNT = 250;
const flameTexture = new THREE.TextureLoader().load('https://ksenia-k.com/img/threejs/smoke.png');

class FlameParticleSystem {
    constructor(parent, offset) {
        this.parent = parent;
        this.offset = offset;
        this.particles = [];
        this.dummy = new THREE.Object3D();

        // Increased the base size of each flame particle to make the effect larger.
        const particleGeometry = new THREE.PlaneGeometry(0.8, 0.8);
        const particleMaterial = new THREE.MeshBasicMaterial({
            map: flameTexture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: true
        });

        const colors = new Float32Array(PARTICLE_COUNT * 3);
        particleGeometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));

        this.mesh = new THREE.InstancedMesh(particleGeometry, particleMaterial, PARTICLE_COUNT);
        this.mesh.position.copy(offset);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        
        // Counteract the parent's scale so particles and their physics behave predictably
        if (this.parent && this.parent.scale) {
            this.mesh.scale.set(1 / this.parent.scale.x, 1 / this.parent.scale.y, 1 / this.parent.scale.z);
        }

        this.parent.add(this.mesh);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            this.particles.push({
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                age: Infinity,
                lifespan: 1,
                scale: 1,
                color: new THREE.Color(),
            });
            colors[i * 3] = 0;
            colors[i * 3 + 1] = 0;
            colors[i * 3 + 2] = 0;
        }
    }

    spawnParticle(p) {
        p.age = 0;
        p.lifespan = Math.random() * 0.8 + 0.4;
        // Widened the spawn area for a fuller flame base.
        p.position.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3);

        // Increased the upward velocity to make the flames taller and more powerful.
        const angle = (Math.random() - 0.5) * 0.5;
        const speed = Math.random() * 2.0 + 1.5;
        p.velocity.set(Math.sin(angle) * 0.5, speed, Math.cos(angle) * 0.5);

        // Increased the scale of individual particles.
        p.scale = Math.random() * 1.0 + 0.5;
    }

    update(delta) {
        const spawnRate = 5;
        let spawned = 0;

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            if (p.age >= p.lifespan) {
                if (spawned < spawnRate) {
                    this.spawnParticle(p);
                    spawned++;
                } else {
                    this.dummy.scale.set(0, 0, 0);
                    this.mesh.setMatrixAt(i, this.dummy.matrix);
                    continue;
                }
            }

            p.age += delta;
            p.position.addScaledVector(p.velocity, delta);
            p.velocity.y -= 2.0 * delta;

            const life = Math.min(p.age / p.lifespan, 1.0);
            p.color.setHSL(0.15 - life * 0.2, 1.0, 0.6);
            this.mesh.geometry.attributes.color.setXYZ(i, p.color.r, p.color.g, p.color.b);

            const scale = p.scale * Math.sin(Math.PI * life);
            this.dummy.position.copy(p.position);
            this.dummy.scale.set(scale, scale, scale);
            this.dummy.rotation.z = Math.random() * Math.PI;
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.geometry.attributes.color.needsUpdate = true;
    }
}

function createFlame(parent, offset) {
    return new FlameParticleSystem(parent, offset);
}

// --- State Flags ---
let buttonRevealed = false;
let animationStopped = false;
let textDissipating = false;
let balloonsCanRise = true; // Launch balloons immediately
const clock = new THREE.Clock(); // Clock for delta time
let burnerRevealed = false; // Reveal engine only after balloons reach 3/4 screen height

// --- Animation Loop ---
function animate() {
    if (animationStopped) return;

    const delta = clock.getDelta();
    if (flameEffect1) flameEffect1.update(delta);
    if (flameEffect2) flameEffect2.update(delta);

    requestAnimationFrame(animate);

    if (balloonsCanRise) {
        // Animate balloons
        let highestY = -Infinity;
        balloons.forEach(balloon => {
            // Move balloon up
            balloon.position.y += balloon.userData.speed;
            // Add gentle sway
            balloon.position.x += Math.sin(Date.now() * balloon.userData.swaySpeed) * 0.02;

            if (balloon.position.y > highestY) {
                highestY = balloon.position.y;
            }
        });

        // Bobbing animation for the engine model
        if (buttonRevealed && engineModel) {
            const time = Date.now() * 0.0015; // Controls speed of the bob
            engineModel.position.y = engineBasePosition.y + Math.sin(time) * 0.25; // Bob around the base y-position
        }

    // Timeline-based text handling now; no height triggers
    }

    // Reveal burner and enter button when any balloon reaches the top 25% of the viewport
    if (!burnerRevealed && balloons.length > 0) {
        const wp = new THREE.Vector3();
        for (let i = 0; i < balloons.length; i++) {
            balloons[i].getWorldPosition(wp);
            const ndc = wp.clone().project(camera); // y: -1 bottom, +1 top
            const screenY = (1 - ndc.y) / 2; // 0 = top, 1 = bottom
            if (screenY <= 0.25) { // reached 3/4 up the page
                burnerRevealed = true;
                if (engineModel) engineModel.visible = true;
                if (!buttonRevealed) {
                    enterContainer.classList.add('visible');
                    buttonRevealed = true;
                }
                break;
            }
        }
    }

    renderer.render(scene, camera);
}

// --- Handle Window Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Handle Enter Click ---
enterContainer.addEventListener('click', () => {
    // Prevent multiple clicks
    if (enterContainer.style.pointerEvents === 'none') return;
    enterContainer.style.pointerEvents = 'none';

    // Create the flames on click
    if (engineModel && !flameEffect1) {
        // The model's origin is likely on one burner, not centered between them.
        // The 'x' value in new THREE.Vector3(x, y, z) controls the left-right position.
        // We set one flame at the origin (x:0) and offset the other one.
        // You can adjust the '0.4' value to change the distance between flames.
        const burnerOffset1 = new THREE.Vector3(0.7, -0.35, 0); // Right burner
        const burnerOffset2 = new THREE.Vector3(0, -0.35, 0);   // Left burner (at model origin)
        flameEffect1 = createFlame(engineModel, burnerOffset1);
        flameEffect2 = createFlame(engineModel, burnerOffset2);
    }

    // Fade out the preloader
    setTimeout(() => {
        preloader.style.opacity = '0';
    }, 3000); // Increased delay to let flames burn longer before fading

    // After fade out, remove preloader and show main content
    setTimeout(() => {
        preloader.style.display = 'none';
        // Example: Show main site content
        // document.getElementById('main-content').style.display = 'block';
    // Or redirect:
    window.location.href = 'pre-launch.html';
    }, 4500); // 3s delay + 1.5s fade duration
});

// --- Start Animation ---
animate();


// ==================================================================
// --- CLOUD TEXT ANIMATION ---
// ==================================================================

// This function is called from the main balloon animation to trigger the fade out
function dissipateText() {
    if (particles && particles.length > 0) {
        particles.forEach(p => {
            p.toDelete = true;
        });
        // Make decorative clouds opaque again
        decorativeClouds.forEach(cloud => cloud.style.opacity = '1');
    }
}

// --- DOM selectors ---
const cloudContainerEl = document.querySelector('#cloud-text-container');
const textInputEl = document.querySelector('#text-input');

// --- Settings ---
const textureFontSize = 80;
const fontScaleFactor = isMobile ? 0.12 : .08;

// Style the hidden measurement div
textInputEl.style.fontSize = textureFontSize + 'px';
textInputEl.style.font = '800 ' + textureFontSize + 'px ' + 'Poppins';
textInputEl.style.lineHeight = 1.1 * textureFontSize + 'px';

// --- 3D scene related globals for text ---
let textScene, textCamera, textRenderer, textCanvas, textCtx, particleGeometry, particleMaterial, instancedMesh, dummy, textClock;

// --- String to show ---
let cloudString = 'We are\nWhoosh!!';

// --- Data for particles ---
let textureCoordinates = [];
let particles = [];
let stringBox = { wTexture: 0, wScene: 0, hTexture: 0, hScene: 0 };

// --- Start cloud text after fonts are ready (non-blocking) to avoid wrong font flash ---
async function waitForFonts(timeoutMs = 1200) {
    if (!('fonts' in document)) return; // Fallback for very old browsers
    try {
        const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
        await Promise.race([
            (async () => {
                // Request the exact weight used and wait for the whole set to be ready
                await Promise.all([
                    document.fonts.load('800 80px Poppins'),
                    document.fonts.load('600 80px Poppins'),
                    document.fonts.ready,
                ]);
            })(),
            timeout,
        ]);
    } catch (e) {
        // Non-fatal; continue
    }
}

async function startCloudText() {
    // Hide the cloud text layer until fonts are ready to prevent FOUT
    cloudContainerEl.style.opacity = '0';

    // Begin font load and wait before first paint (with a small timeout fallback)
    const fontsReady = waitForFonts(1800);

    // Style the hidden measurement div (will be corrected when fonts ready)
    textInputEl.style.fontSize = textureFontSize + 'px';
    textInputEl.style.font = '800 ' + textureFontSize + 'px ' + 'Poppins';
    textInputEl.style.lineHeight = 1.1 * textureFontSize + 'px';

    textInputEl.innerHTML = cloudString;
    initText();
    createTextEvents();
    handleTextInput();

    // Wait for the font before the initial sampling to avoid metric switch
    try { await fontsReady; } catch (e) { /* non-fatal; proceed with whatever is available */ }

    refreshText();
    renderText();

    // Make decorative clouds more transparent and then fade in the text
    decorativeClouds.forEach(cloud => cloud.style.opacity = '0.3');
    requestAnimationFrame(() => {
        cloudContainerEl.style.transition = 'opacity 300ms ease';
        cloudContainerEl.style.opacity = '1';
    });

    // If the initial wait timed out, re-sample once fonts eventually finish loading
    waitForFonts(5000).then(() => {
        handleTextInput();
        refreshText();
    });

    // Schedule dissipation 4s after text appears; enter button now reveals with burner
    setTimeout(() => {
        textDissipating = true;
        dissipateText();
    }, 4000);
}

// Show cloud text at 1.5s
setTimeout(() => startCloudText(), 1500);

function initText() {
    textCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .1, 1000);
    textCamera.position.z = 18;

    textScene = new THREE.Scene();

    textRenderer = new THREE.WebGLRenderer({
        alpha: true, // Transparent background
        antialias: true
    });
    textRenderer.setPixelRatio(window.devicePixelRatio);
    textRenderer.setSize(window.innerWidth, window.innerHeight);
    cloudContainerEl.appendChild(textRenderer.domElement);

    // Controls are not needed for a preloader, but kept for potential debugging
    const orbit = new OrbitControls(textCamera, textRenderer.domElement);
    orbit.enabled = false;

    textCanvas = document.createElement('canvas');
    textCanvas.width = textCanvas.height = 0;
    textCtx = textCanvas.getContext('2d');
    particleGeometry = new THREE.PlaneGeometry(1, 1);
    const texture = new THREE.TextureLoader().load('https://ksenia-k.com/img/threejs/smoke.png');
    particleMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        alphaMap: texture,
        depthTest: false,
        opacity: .4,
        transparent: true,
    });

    dummy = new THREE.Object3D();
    textClock = new THREE.Clock();
}

function createTextEvents() {
    window.addEventListener('resize', () => {
        textCamera.aspect = window.innerWidth / window.innerHeight;
        textCamera.updateProjectionMatrix();
        textRenderer.setSize(window.innerWidth, window.innerHeight);
        handleTextInput();
        refreshText();
    });
}

function handleTextInput() {
    stringBox.wTexture = textInputEl.clientWidth;
    stringBox.wScene = stringBox.wTexture * fontScaleFactor;
    stringBox.hTexture = textInputEl.clientHeight;
    stringBox.hScene = stringBox.hTexture * fontScaleFactor;
}

function renderText() {
    requestAnimationFrame(renderText);
    updateParticlesMatrices();
    textRenderer.render(textScene, textCamera);
}

function refreshText() {
    sampleCoordinates();

    particles = textureCoordinates.map((c, cIdx) => {
        const x = c.x * fontScaleFactor;
        const y = c.y * fontScaleFactor;
        let p = (c.old && particles[cIdx]) ? particles[cIdx] : new Particle([x, y]);
        if (c.toDelete) {
            p.toDelete = true;
            p.scale = p.maxScale;
        }
        return p;
    });

    recreateInstancedMesh();
    makeTextFitScreen();
}

function sampleCoordinates() {
    const lines = cloudString.split(`\n`);
    const linesNumber = lines.length;
    textCanvas.width = stringBox.wTexture;
    textCanvas.height = stringBox.hTexture;
    textCtx.font = '800 ' + textureFontSize + 'px ' + 'Poppins';
    textCtx.fillStyle = '#ffffff';
    textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    for (let i = 0; i < linesNumber; i++) {
        textCtx.fillText(lines[i], 0, (i + .8) * stringBox.hTexture / linesNumber);
    }

    if (stringBox.wTexture > 0) {
        const imageData = textCtx.getImageData(0, 0, textCanvas.width, textCanvas.height);
        const imageMask = Array.from(Array(textCanvas.height), () => new Array(textCanvas.width));
        for (let i = 0; i < textCanvas.height; i++) {
            for (let j = 0; j < textCanvas.width; j++) {
                imageMask[i][j] = imageData.data[(j + i * textCanvas.width) * 4] > 0;
            }
        }

        if (textureCoordinates.length !== 0) {
            textureCoordinates = textureCoordinates.filter(c => !c.toDelete);
            particles = particles.filter(c => !c.toDelete);
            textureCoordinates.forEach(c => {
                if (imageMask[c.y] && imageMask[c.y][c.x]) {
                    c.old = true;
                    if (!c.toDelete) imageMask[c.y][c.x] = false;
                } else {
                    c.toDelete = true;
                }
            });
        }

        for (let i = 0; i < textCanvas.height; i++) {
            for (let j = 0; j < textCanvas.width; j++) {
                if (imageMask[i][j]) {
                    textureCoordinates.push({
                        x: j,
                        y: i,
                        old: false,
                        toDelete: false
                    });
                }
            }
        }

    } else {
        textureCoordinates = [];
    }
}

function Particle([x, y]) {
    this.x = x + .15 * (Math.random() - .5);
    this.y = y + .15 * (Math.random() - .5);
    this.z = 0;

    this.isGrowing = true;
    this.toDelete = false;

    this.scale = 0;
    this.maxScale = .1 + 1.5 * Math.pow(Math.random(), 10);
    this.deltaScale = .03 + .03 * Math.random();
    this.age = Math.PI * Math.random();
    this.ageDelta = .01 + .02 * Math.random();
    this.rotationZ = .5 * Math.random() * Math.PI;
    this.deltaRotation = .01 * (Math.random() - .5);

    this.grow = function () {
        this.age += this.ageDelta;
        this.rotationZ += this.deltaRotation;
        if (this.isGrowing) {
            this.scale += this.deltaScale;
            if (this.scale >= this.maxScale) {
                this.isGrowing = false;
            }
        } else if (this.toDelete) {
            this.scale -= this.deltaScale;
            if (this.scale <= 0) {
                this.scale = 0;
                this.deltaScale = 0;
            }
        } else {
            this.scale = this.maxScale + .2 * Math.sin(this.age);
        }
    }
}

function recreateInstancedMesh() {
    if (instancedMesh) textScene.remove(instancedMesh);
    instancedMesh = new THREE.InstancedMesh(particleGeometry, particleMaterial, particles.length);
    textScene.add(instancedMesh);

    instancedMesh.position.x = -.5 * stringBox.wScene;
    instancedMesh.position.y = -.5 * stringBox.hScene;
}

function updateParticlesMatrices() {
    if (!instancedMesh) return;
    particles.forEach((p, i) => {
        p.grow();
        dummy.quaternion.copy(textCamera.quaternion);
        dummy.rotation.z += p.rotationZ;
        dummy.scale.set(p.scale, p.scale, p.scale);
        dummy.position.set(p.x, stringBox.hScene - p.y, p.z);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
    });
    instancedMesh.instanceMatrix.needsUpdate = true;
}

function makeTextFitScreen() {
    const fov = textCamera.fov * (Math.PI / 180);
    const fovH = 2 * Math.atan(Math.tan(fov / 2) * textCamera.aspect);
    const dx = Math.abs(.7 * stringBox.wScene / Math.tan(.5 * fovH));
    const dy = Math.abs(.6 * stringBox.hScene / Math.tan(.5 * fov));
    const factor = Math.max(dx, dy) / textCamera.position.length();
    if (factor > 1) {
        textCamera.position.x *= factor;
        textCamera.position.y *= factor;
        textCamera.position.z *= factor;
    }
}
