
import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';

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
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 0.7);
sun.position.set(1, 2, 1);
scene.add(sun);

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

const cube = box(0.2, 0x00ffff);
cube.position.set(0, 0.2, -1.0);
cube.rotation.set(0, Math.PI / 4, 0);
scene.add(cube);

document.getElementById("hud").textContent = "LISTEN UP FUCKO!!!!";

const ring = torus(0.15, 0.05, 0xff0088);
ring.position.set(-1.5, 0.4, -2.0);
ring.rotation.set(Math.PI / 2, 0, 0);
scene.add(ring);

function animateCommon() {
  ring.rotation.z += 0.01;
}

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



