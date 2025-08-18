import * as THREE from 'https://esm.sh/three@0.164.1';
import { GLTFLoader } from 'https://esm.sh/three@0.164.1/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://esm.sh/three@0.164.1/examples/jsm/loaders/DRACOLoader.js';

// Scene basics
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 30);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth <= 768 ? 1.0 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // transparent to let CSS gradient show
renderer.domElement.id = 'prelaunch-bg';
renderer.domElement.style.cssText = `position:fixed;inset:0;z-index:0;pointer-events:none;`; // behind content, above clouds (clouds set to -2)

const mainContent = document.querySelector('.main-content');
if (mainContent && mainContent.firstChild) {
  mainContent.insertBefore(renderer.domElement, mainContent.firstChild);
} else if (mainContent) {
  mainContent.appendChild(renderer.domElement);
} else {
  document.body.appendChild(renderer.domElement);
}

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(10, 20, 10);
scene.add(dir);

// Loading setup
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/libs/draco/');
draco.setDecoderConfig({ type: 'wasm' });
draco.preload();
loader.setDRACOLoader(draco);

function rand(min, max) { return Math.random() * (max - min) + min; }

function setupBalloon(model, { scale = 6, x = 0, y = 0, z = 0 } = {}) {
  model.traverse(n => {
    if (n.isMesh) {
      n.castShadow = false;
      n.receiveShadow = false;
      if (n.material && n.material.transparent) {
        n.material.alphaTest = 0.5;
        n.material.depthWrite = true;
      }
    }
  });
  model.scale.set(scale, scale, scale);
  model.position.set(x, y, z);
  scene.add(model);
  return model;
}

function loadBalloon(path) {
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => { console.log('[pre-launch] Loaded balloon:', path); resolve(gltf.scene); },
      undefined,
      (err) => { console.error('[pre-launch] Failed to load balloon:', path, err); reject(err); }
    );
  });
}

function createPlaceholderBalloon({ scale = 3.0, color = 0xff6f61 } = {}) {
  const group = new THREE.Group();
  const envelopeGeo = new THREE.SphereGeometry(1.0, 20, 20);
  const envelopeMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
  const envelope = new THREE.Mesh(envelopeGeo, envelopeMat);
  envelope.position.y = 1.2;
  const basketGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.35, 12);
  const basketMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
  const basket = new THREE.Mesh(basketGeo, basketMat);
  group.add(envelope);
  group.add(basket);
  group.scale.set(scale, scale, scale);
  scene.add(group);
  return group;
}

// Convert screen position to world point on a Z plane
function screenToWorld(x, y, zPlane = 0) {
  const ndc = new THREE.Vector2(
    (x / window.innerWidth) * 2 - 1,
    -(y / window.innerHeight) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const t = (zPlane - ray.ray.origin.z) / ray.ray.direction.z;
  return ray.ray.at(t, new THREE.Vector3());
}

// State
const balloons = {
  left: null,
  right: null,
  follower: null,
};

const follower = {
  target: new THREE.Vector3(0, 0, 0),
  minDist: 1.2, // small standoff distance from cursor
  lerp: 0.06,   // (unused now) kept for potential tuning
  z: 0,         // plane z for follower
};

// Compute horizontal/vertical half-extent of the view at a given world z
function viewExtentsAtZ(z) {
  const dist = Math.abs(camera.position.z - z);
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * dist;
  const halfW = halfH * camera.aspect;
  return { halfW, halfH };
}

// Offscreen check using camera extents
function isOffscreen(obj, margin = 1.0) {
  const { halfW, halfH } = viewExtentsAtZ(obj.position.z);
  return (
    obj.position.x < -halfW - margin ||
    obj.position.x > halfW + margin ||
    obj.position.y < -halfH - margin ||
    obj.position.y > halfH + margin
  );
}

function resetDrifter(model, side = 'left') {
  // Pick a pleasant depth and compute view extents to start just off-screen
  const z = rand(-5, 5);
  const { halfW, halfH } = viewExtentsAtZ(z);
  const margin = 1.5; // world-units margin beyond edge
  const y = rand(-halfH * 0.6, halfH * 0.6);
  const x = side === 'left' ? -halfW - margin : halfW + margin;
  model.position.set(x, y, z);
  model.userData = {
    vx: side === 'left' ? rand(0.015, 0.03) : rand(-0.03, -0.015),
    swayAmp: rand(0.2, 0.6),
    swaySpeed: rand(0.2, 0.5),
    bobAmp: rand(0.15, 0.35),
    bobSpeed: rand(0.3, 0.6),
  rotSpeed: 0,
    t0: performance.now() * 0.001 + rand(0, 10),
    side,
  };
}

function updateDrifter(model, t) {
  const ud = model.userData;
  model.position.x += ud.vx;
  model.position.y += Math.sin(t * ud.swaySpeed + ud.t0) * 0.002; // subtle lateral drift
  const bob = Math.sin(t * ud.bobSpeed + ud.t0) * ud.bobAmp;
  model.position.y += 0.01 * bob;
  // No rotation for a calmer, more realistic drift

  // If it has exited on the opposite side, reset from its original side
  const { halfW } = viewExtentsAtZ(model.position.z);
  const margin = 1.5;
  if (ud.side === 'left' && model.position.x > halfW + margin) {
    resetDrifter(model, 'left');
  } else if (ud.side === 'right' && model.position.x < -halfW - margin) {
    resetDrifter(model, 'right');
  }
}

function updateFollower(model, t) {
  const pos = model.position;
  const desired = follower.target;
  // Vector from current balloon pos to cursor target
  let dir = desired.clone().sub(pos);
  const dist = Math.max(dir.length(), 1e-5);
  dir.multiplyScalar(1 / dist);
  // Place the balloon at a fixed standoff behind the cursor along the movement direction
  const basePos = desired.clone().addScaledVector(dir, -follower.minDist);
  pos.copy(basePos);

  // Subtle bobbing only (no rotation)
  pos.y += Math.sin(t * 1.2) * 0.05;
}

// Mouse / touch target update
function handlePointer(x, y) {
  const p = screenToWorld(x, y, follower.z);
  // Directly set target to cursor world point (no smoothing) so the balloon moves with the cursor
  follower.target.copy(p);
}

window.addEventListener('mousemove', (e) => handlePointer(e.clientX, e.clientY), { passive: true });
window.addEventListener('touchmove', (e) => {
  const t = e.touches[0]; if (t) handlePointer(t.clientX, t.clientY);
}, { passive: true });

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

async function init() {
  console.log('[pre-launch] Balloons init start');
  // Preload three balloons
  const paths = [
    'assets/new-balloons/new-balloon-1.glb',
    'assets/new-balloons/new-balloon-2.glb',
    'assets/new-balloons/new-balloon-9.glb',
  ];

  const [b1, b2, b3] = await Promise.all(paths.map(p => loadBalloon(p).catch(() => null)));

  if (b1) {
    balloons.left = setupBalloon(b1, { scale: 2.2 });
    resetDrifter(balloons.left, 'left');
  } else {
    balloons.left = createPlaceholderBalloon({ scale: 1.8, color: 0xff7a6b });
    resetDrifter(balloons.left, 'left');
  }
  if (b2) {
    balloons.right = setupBalloon(b2, { scale: 2.2 });
    resetDrifter(balloons.right, 'right');
  } else {
    balloons.right = createPlaceholderBalloon({ scale: 1.8, color: 0x6bb7ff });
    resetDrifter(balloons.right, 'right');
  }
  if (b3) {
    balloons.follower = setupBalloon(b3, { scale: 2.0, z: follower.z });
    // Start follower near center-left so it eases toward cursor nicely
    balloons.follower.position.set(-4, -1, follower.z);
  } else {
    balloons.follower = createPlaceholderBalloon({ scale: 1.8, color: 0xffe16b });
    balloons.follower.position.set(-4, -1, follower.z);
  }

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const t = performance.now() * 0.001;

  if (balloons.left) updateDrifter(balloons.left, t);
  if (balloons.right) updateDrifter(balloons.right, t);
  if (balloons.follower) updateFollower(balloons.follower, t);

  renderer.render(scene, camera);
}

init();
