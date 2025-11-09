// Importing modules into the app file
import * as THREE from 'three'; // Core module
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // For desktop preview
import { ARButton } from 'three/addons/webxr/ARButton.js'; // Staring the AR session on mobile with AR support
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // Loading in proper models
import { clone } from 'three/addons/utils/SkeletonUtils.js'; // Loading in model cloning module

// Defining xrREFSpace in global scope
let xrRefSpace = null;

// Getting the text boxes from the html file.
const msg = document.getElementById('msg');
document.getElementById('hud').textContent = "LISTEN UP FUCKO!!!!! NOWS AIN'T THE TIME FOR QUITING, BUT FOR GREATNESS!!!!!!!!!";
console.log("Three.js version:", THREE.REVISION);


// ---------- Helpers ----------
function showMessage(text, lingerMs = 2200) { // Using the msg text to display a message
  msg.textContent = text;
  msg.classList.remove('hide');
  if (lingerMs > 0) {
    setTimeout(() => msg.classList.add('hide'), lingerMs);
  }
}

function isAndroidChrome() { // Checking if the device is an Android and has Chrome
  const ua = navigator.userAgent;
  // Basic filter: Android + Chrome (not Edge/OPR)
  return /Android/i.test(ua) && /Chrome\/\d+/.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
}

async function supportsImmersiveAR() { // Checks if the device supports AR
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
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 0.7);
sun.position.set(1, 2, 1);
scene.add(sun);

// ---------- GLTFloader setup ----------
const loader = new GLTFLoader();
const TEMPLATE_CACHE = new Map(); // url -> Object3D template

async function preloadModel(url) {
  if (TEMPLATE_CACHE.has(url)) return TEMPLATE_CACHE.get(url);
  const gltf = await loader.loadAsync(url);
  const template = gltf.scene;
  TEMPLATE_CACHE.set(url, template);
  return template;
}

async function spawnModel(url, {
  position     = [0, 0, 0],
  worldPos     = null,
  rotation     = [0, 0, 0],
  scale        = 1,
  queueAnchor  = false,
  scene_to_use = scene,
  onLoad       = null,
} = {}) {
  // 1) get (or build) the template once
  const template = await preloadModel(url);

  // 2) deep clone so the instance is independent (works with skins/animations)
  const model = clone(template);

  // 3) per-instance transform
  if (worldPos) model.position.copy(toLocal(worldPos));
  else          model.position.set(...position);

  model.rotation.set(...rotation);
  if (typeof scale === 'number') model.scale.set(scale, scale, scale);
  else                           model.scale.set(...scale);

  // 4) add + register (so your anchor/recenter code sees it)
  scene_to_use.add(model);
  registerWorldObject(model, { queueAnchor, worldPos });

  onLoad && onLoad(model);
  return model;
}

// ---------- Anchor and stability setup ----------
let worldOrigin = new THREE.Vector3();           // meters, keeps “big” world coords small
const worldObjects = new Set();                  // every object you manage

function toLocal(worldPos) {
  return new THREE.Vector3().copy(worldPos).sub(worldOrigin);
}

function maybeRecenter(frame) {
  const pose = frame.getViewerPose(xrRefSpace);
  if (!pose) return;
  const m = new THREE.Matrix4().fromArray(pose.views[0].transform.matrix);
  const cam = new THREE.Vector3().setFromMatrixPosition(m);

  const MAX = 20; // meters
  if (cam.distanceTo(worldOrigin) > MAX) {
    const shift = cam.clone().sub(worldOrigin);
    worldOrigin.add(shift);
    // keep visuals stable: subtract the shift from every object’s local position
    worldObjects.forEach(obj => obj.position.sub(shift));
    // shift XR reference space too (so future poses align with new local frame)
    xrRefSpace = xrRefSpace.getOffsetReferenceSpace(
      new XRRigidTransform({ x: -shift.x, y: -shift.y, z: -shift.z })
    );
  }
}

const pendingAnchors = []; // items: { obj }

function requestAnchorFor(obj) { pendingAnchors.push({ obj }); }

function processAnchorRequests(frame) {
  if (!('createAnchor' in XRFrame.prototype) || !xrRefSpace) return;
  while (pendingAnchors.length) {
    const { obj } = pendingAnchors.shift();

    // build a rigid transform from the object’s current world pose
    obj.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3(), rot = new THREE.Quaternion(), scl = new THREE.Vector3();
    obj.matrixWorld.decompose(pos, rot, scl);

    const t = new XRRigidTransform(
      { x: pos.x, y: pos.y, z: pos.z, w: 1 },
      { x: rot.x, y: rot.y, z: rot.z, w: rot.w }
    );

    frame.createAnchor(t, xrRefSpace).then(anchor => {
      obj.userData.anchor = anchor;
      obj.matrixAutoUpdate = false; // from now on we drive it from anchor pose
    }).catch(err => console.warn('Anchor failed:', err));
  }
}

function updateAnchoredObjects(frame) {
  if (!xrRefSpace) return;
  worldObjects.forEach(obj => {
    const a = obj.userData.anchor;
    if (!a) return;
    const pose = frame.getPose(a.anchorSpace, xrRefSpace);
    if (!pose) return;
    obj.matrix.fromArray(pose.transform.matrix);
    obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
  });
}

// Register an object for world-locking (drift control + optional anchor)
function registerWorldObject(obj, { worldPos = null, queueAnchor = false } = {}) {
  // If you pass a world position, convert it to local right away
  if (worldPos) obj.position.copy(toLocal(worldPos));
  worldObjects.add(obj);
  if (queueAnchor) requestAnchorFor(obj);
  return obj;
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

// Loading Models
const astronaut_modelurl = `./Models/Astronaut.glb`;

let max = 40
let inc = 0.5
for (let i = 0; i < max; i++) {
  await spawnModel(astronaut_modelurl, {
    position: [i * inc - inc*max/2, Math.cos(i*Math.PI/3), Math.sin(i*Math.PI/3)],
    scale: 0.2,
    queueAnchor: true   // turn true if you want an anchor per instance
  });
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

  const sessionInit = { requiredFeatures: ['local-floor'], optionalFeatures: ['anchors'] };
  document.body.appendChild(ARButton.createButton(renderer, sessionInit));

  // IMPORTANT: set the GLOBAL xrRefSpace (no 'let' here)
  renderer.xr.addEventListener('sessionstart', () => {
    xrRefSpace = renderer.xr.getReferenceSpace();
  });

  renderer.setAnimationLoop((_t, frame) => {
    if (frame) {
      // keep local coordinates small
      maybeRecenter(frame);
      // create anchors for newly registered objects
      processAnchorRequests(frame);
      // drive anchored objects from their poses
      updateAnchoredObjects(frame);
    }
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




