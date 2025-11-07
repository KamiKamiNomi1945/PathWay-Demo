
import * as THREE from 'three';
import { OrbitControls } from './OrbitControls.js';
import { ARButton } from './ARButton.js';
import { GLTFLoader } from './GLTFLoader.js';

const msg = document.getElementById('msg');
document.getElementById('hud').textContent = "LISTEN UP FUCKO!!!!! NOWS AIN'T THE TIME FOR QUITING, BUT FOR GREATNESS!!!!!!!!!";

console.log("Three.js version:", THREE.REVISION);


// ---------- Helpers ----------
function showMessage(text, lingerMs = 2200) {
  msg.textContent = text;
  msg.classList.remove('hide');
  if (lingerMs > 0) {
    setTimeout(() => msg.classList.add('hide'), lingerMs);
  }
}

function isAndroidChrome() {
  const ua = navigator.userAgent;
  // Basic filter: Android + Chrome (not Edge/OPR)
  return /Android/i.test(ua) && /Chrome\/\d+/.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
}

async function supportsImmersiveAR() {
  if (!('xr' in navigator)) return false;
  try {
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

// ---------- Common Three.js setup ----------
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);            // ✅ transparent for camera feed
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 0.7);
sun.position.set(1, 2, 1);
scene.add(sun);

// ---------- GLTFloader setup ----------
const loader = new GLTFLoader();

function loadModel(url, position = [0,0,0], scale = 1, rotation = [0,0,0], onLoad = null, scene_to_use=scene) {
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      const model = gltf.scene;
      model.position.set(...position);
      model.rotation.set(...rotation);
      typeof scale === 'number' ? model.scale.set(scale, scale, scale) : model.scale.set(...scale);
      scene_to_use.add(model);
      onLoad && onLoad(model);
      resolve(model);
    }, undefined, reject);
  });
}

// Content (same transforms in both modes)
function box(size, color) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color })
  );
}
function torus(R, r, color) {
  return new THREE.Mesh(
    new THREE.TorusGeometry(R, r, 16, 64),
    new THREE.MeshStandardMaterial({ color })
  );
}

// Creating Content
const cube_1 = box(0.2, 0x00ffff);
cube_1.position.set(0, 0.2, -1.0);
cube_1.rotation.set(0, Math.PI / 4, 0);
scene.add(cube_1);

const cube_2 = box(0.2, 0x00ffff);
cube_2.position.set(0, 0.2, -2.0);
cube_2.rotation.set(0, Math.PI / 4, 0);
scene.add(cube_2);

const cube_3 = box(0.2, 0x00ffff);
cube_3.position.set(0, 0.2, -3.0);
cube_3.rotation.set(0, Math.PI / 4, 0);
scene.add(cube_3);

const cube_4 = box(0.2, 0x00ffff);
cube_4.position.set(0, 0.2, -4.0);
cube_4.rotation.set(0, Math.PI / 4, 0);
scene.add(cube_4);

const cube_5 = box(0.2, 0x00ffff);
cube_5.position.set(0, 0.2, -5.0);
cube_5.rotation.set(0, Math.PI / 4, 0);
scene.add(cube_5);

const cube_6 = box(0.2, 0x00ffff);
cube_6.position.set(0, 0.2, -6.0);
cube_6.rotation.set(0, Math.PI / 4, 0);
scene.add(cube_6);

const cube_7 = box(0.5, 0x00ffff);
cube_7.position.set(0, 0.5, -12.0);
cube_7.rotation.set(0, Math.PI / 4, 0);
scene.add(cube_7);

function animateCommon() {
}

// Loading Models

const astronaut_modelurl = `./Astronaut.glb`;

loadModel(astronaut_modelurl, [12,12,0], 5, [0.785,0,1.57])

// ---------- Desktop fallback ----------
let controls = null;
function startDesktopPreview() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Nice starting view
  camera.position.set(0, 1.2, 2.5);
  controls.target.set(0, 0.4, -1.5);
  controls.update();

  showMessage('AR not supported here. Running desktop preview (orbit).');

  const loop = () => {
    animateCommon();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();
}

// ---------- Mobile AR ----------
function startAR() {
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');

  const sessionInit = { requiredFeatures: ['local-floor'] };
  document.body.appendChild(ARButton.createButton(renderer, sessionInit));

  renderer.setAnimationLoop((_t, _frame) => {
    animateCommon();
    renderer.render(scene, camera);
  });
}

// ---------- Boot ----------
(async () => {
  const arAvailable = await supportsImmersiveAR();

  // We only start real AR on Android Chrome where it’s actually usable.
  if (arAvailable && isAndroidChrome()) {
    startAR();
  } else {
    startDesktopPreview();
  }
})();

// ---------- Resize ----------
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});








