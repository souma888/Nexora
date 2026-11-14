import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Optional explanatory geometry; numerical results remain in the 2D plots and tables. */
export function threeView(host, model, data) {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x101318, 1);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    'aria-label',
    'Interactive 3D model. Use the view buttons for keyboard camera control.',
  );
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  camera.position.set(5, 4, 7);
  controls.target.set(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x173429, 3));
  const light = new THREE.DirectionalLight(0xffffff, 4);
  light.position.set(3, 6, 4);
  scene.add(light);
  const grid = new THREE.GridHelper(8, 16, 0x34464b, 0x242b32);
  grid.position.y = -1.5;
  scene.add(grid);
  const group = new THREE.Group();
  scene.add(group);
  const slider = document.createElement('input'),
    caption = document.createElement('p'),
    canvasHost = document.createElement('div'),
    buttons = document.createElement('div');
  canvasHost.className = 'three-canvas';
  canvasHost.append(renderer.domElement);
  slider.type = 'range';
  slider.min = '0';
  slider.max = model === 'beam' || model === 'trussfem' ? '100' : '240';
  slider.value = model === 'beam' || model === 'trussfem' ? '30' : '240';
  slider.setAttribute(
    'aria-label',
    model === 'beam' || model === 'trussfem'
      ? 'Deformation exaggeration'
      : 'Mechanism or flow preview position',
  );
  const draw = () => renderer.render(scene, camera);
  for (const [name, position] of [
    ['Isometric view', [5, 4, 7]],
    ['Front view', [0, 0, 8]],
    ['Top view', [0, 8, 0.01]],
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'quiet';
    b.textContent = name;
    b.onclick = () => {
      camera.position.set(...position);
      controls.update();
      draw();
    };
    buttons.append(b);
  }
  function clear() {
    while (group.children.length) {
      const object = group.children[0];
      group.remove(object);
      object.traverse((node) => {
        node.geometry?.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.filter(Boolean).forEach((m) => m.dispose());
      });
    }
  }
  function rod(a, b, color = 0xc82d4e, radius = 0.06) {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      delta = to.clone().sub(from);
    if (delta.length() < 1e-9) return;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, delta.length(), 12),
      new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.4 }),
    );
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    group.add(mesh);
  }
  function ball(p, color = 0x3ecf8e, radius = 0.12) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 12),
      new THREE.MeshStandardMaterial({ color }),
    );
    mesh.position.set(...p);
    group.add(mesh);
  }
  function update() {
    clear();
    const fraction = Number(slider.value) / 240;
    if (model === 'beam') {
      const series = data.series,
        maxX = Math.max(...series.map((p) => p.x)),
        max = Math.max(...series.map((p) => Math.abs(p.deflection)), 1e-9),
        scale = ((Number(slider.value) / 100) * 1.5) / max;
      const pts = series
        .filter((_, i) => i % 4 === 0 || i === series.length - 1)
        .map((p) => [-2.5 + (5 * p.x) / maxX, p.deflection * scale, 0]);
      for (let i = 1; i < pts.length; i++) rod(pts[i - 1], pts[i], 0x3ecf8e, 0.05);
      rod([-2.5, 0, 0], [2.5, 0, 0], 0x7d8795, 0.018);
      caption.textContent = `Deformation visualization scale: ${((scale * 1000 * maxX) / 5).toFixed(0)}× geometry. Plot values are unchanged. Drag to orbit; scroll to zoom.`;
    } else if (model === 'trussfem') {
      const nodes = data.nodes,
        span = Math.max(1, ...nodes.flat().map(Math.abs)),
        s = 4 / span;
      const points = nodes.map((p, i) => [
        (p[0] - span / 2) * s + data.displacement[2 * i] * Number(slider.value) * s,
        p[1] * s - 1 + data.displacement[2 * i + 1] * Number(slider.value) * s,
        0,
      ]);
      data.bars.forEach(([a, b]) => rod(points[a], points[b]));
      points.forEach((p) => ball(p));
      caption.textContent = `Truss displacement exaggerated ${slider.value}×; tension/compression and numerical values are in the member table.`;
    } else if (data.visualization?.type === 'arm' || data.visualization?.type === 'fourbar') {
      const v = data.visualization,
        frame = v.frames?.[Math.round(fraction * (v.frames.length - 1))] ?? v.pose;
      if (!frame?.points) {
        caption.textContent =
          'This mechanism pose cannot close. Choose a feasible geometry in Setup.';
        draw();
        return;
      }
      const points = frame.points,
        span = Math.max(1, ...points.flat().map(Math.abs)),
        pts = points.map((p) => [(p[0] * 2) / span - 1, (p[1] * 2) / span, 0]);
      pts.forEach((p) => ball(p));
      for (let i = 1; i < pts.length; i++) rod(pts[i - 1], pts[i], i % 2 ? 0xc82d4e : 0x3ecf8e);
      caption.textContent =
        'Planar mechanism shown in 3D for spatial inspection; use the slider to inspect solved poses.';
    } else {
      const v = data.visualization;
      if (v?.type !== 'flow') throw new Error('This model has no supported 3D geometry.');
      const r1 = (v.inlet / Math.max(v.inlet, v.outlet)) * 0.8,
        r2 = (v.outlet / Math.max(v.inlet, v.outlet)) * 0.8,
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(r2, r1, 5, 32, 1, true),
          new THREE.MeshStandardMaterial({
            color: 0x3ecf8e,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            wireframe: true,
          }),
        );
      mesh.rotation.z = -Math.PI / 2;
      group.add(mesh);
      for (let i = 0; i < 20; i++) {
        const t = (i / 20 + fraction) % 1,
          r = r1 + (r2 - r1) * t;
        ball(
          [-2.5 + 5 * t, Math.sin(i * 2.4) * r * 0.5, Math.cos(i * 2.4) * r * 0.5],
          0x4da3ff,
          0.045,
        );
      }
      caption.textContent =
        'Illustrative stream markers through the supplied diameter profile. Positions are a preview, not CFD trajectories or a velocity solution.';
    }
    draw();
  }
  slider.oninput = update;
  controls.addEventListener('change', draw);
  host.replaceChildren(buttons, canvasHost, slider, caption);
  const observer = new ResizeObserver(() => {
    const w = Math.max(200, canvasHost.clientWidth);
    renderer.setSize(w, 340);
    camera.aspect = w / 340;
    camera.updateProjectionMatrix();
    draw();
  });
  observer.observe(canvasHost);
  controls.update();
  update();
  return () => {
    observer.disconnect();
    controls.dispose();
    clear();
    grid.geometry.dispose();
    grid.material.dispose();
    renderer.dispose();
    host.replaceChildren();
  };
}
