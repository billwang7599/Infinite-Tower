/** Entity factories: the only place that knows how a player or a boar is assembled from components. */
import {
  Color3, Mesh, MeshBuilder, PhysicsAggregate, PhysicsShapeType, StandardMaterial, TransformNode, Vector3,
} from "@babylonjs/core";
import {
  type Entity, type Vec3, Player, PlayerInput, LocalPlayer, Health, Stamina, Fighter, Boar, PLAYER, BOAR,
} from "@infinite-tower/shared";
import { Body, BoarView, SpriteView } from "./components.js";
import { Layer, type GameContext } from "./context.js";

export function spawnPlayer(ctx: GameContext, name: string, at: Vec3, local: boolean): Entity {
  const { world, scene, materials } = ctx;
  const e = world.spawn();

  // Physics capsule (invisible). Havok owns its transform.
  const capsule = MeshBuilder.CreateCapsule(`player-${e}`, { radius: PLAYER.radius, height: PLAYER.height }, scene);
  capsule.position.set(at.x, at.y + PLAYER.height / 2, at.z);
  capsule.isVisible = false;
  const aggregate = new PhysicsAggregate(capsule, PhysicsShapeType.CAPSULE, { mass: 1, friction: 0, restitution: 0 }, scene);
  aggregate.body.setMassProperties({ inertia: Vector3.Zero() }); // never tip over
  aggregate.shape.filterMembershipMask = Layer.Player;
  aggregate.shape.filterCollideMask = Layer.Ground | Layer.Wall | Layer.Enemy;
  world.add(e, Body, { aggregate, mesh: capsule });

  // 2D sprite: a Y-billboarded quad, child of the capsule so it follows the body.
  const root = new TransformNode(`sprite-root-${e}`, scene);
  root.parent = capsule;
  root.position.y = -PLAYER.height / 2; // pivot at the feet, for squash/stretch
  const plane = MeshBuilder.CreatePlane(`sprite-${e}`, { width: 1.8, height: 1.8 }, scene);
  plane.parent = root;
  plane.position.y = 0.9;
  plane.billboardMode = Mesh.BILLBOARDMODE_Y;
  plane.material = materials.player.idle;

  const shadow = MeshBuilder.CreateGround(`shadow-${e}`, { width: 1.1, height: 0.7 }, scene);
  shadow.material = materials.shadow;
  shadow.isPickable = false;

  // Sword trail: a flat crescent in front of the player (local +z), shown during the swing.
  const arc = (70 * Math.PI) / 180;
  const inner: Vector3[] = [], outer: Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24 * 2 - 1; // -1..1 along the arc
    const a = u * arc;
    const thick = Math.cos(u * Math.PI / 2); // pointed tips
    const ro = 2.1, ri = ro - 0.15 - 0.85 * thick;
    inner.push(new Vector3(Math.sin(a) * ri, 0, Math.cos(a) * ri));
    outer.push(new Vector3(Math.sin(a) * ro, 0, Math.cos(a) * ro));
  }
  const slash = MeshBuilder.CreateRibbon(`slash-${e}`, { pathArray: [inner, outer], sideOrientation: Mesh.DOUBLESIDE }, scene);
  slash.material = materials.slashFx;
  slash.isPickable = false;
  slash.setEnabled(false);

  world.add(e, SpriteView, {
    root, plane, shadow, slash, frames: materials.player, facing: 1, walkPhase: 0, stretch: 1,
  });
  world.add(e, PlayerInput, { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, jump: false, attack: false, dodge: false });
  world.add(e, Player, {
    name, grounded: false, airTime: 0, jumpBuffer: 0, jumpHeld: false,
    attackHeld: false, dodgeHeld: false, attackBuffer: 0, dodgeBuffer: 0,
    action: "none", actionTime: 0, actionDir: { x: 0, z: 1 }, combo: 0,
  });
  world.add(e, Health, { hp: PLAYER.maxHp, max: PLAYER.maxHp, invuln: 0, hitstun: 0, flash: 0 });
  world.add(e, Stamina, { value: PLAYER.maxStamina, max: PLAYER.maxStamina, regenDelay: 0 });
  world.add(e, Fighter, { team: "player", radius: PLAYER.radius });
  if (local) world.add(e, LocalPlayer, true);
  return e;
}

function mat(scene: Scene, name: string, hex: string, list: StandardMaterial[]): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.05, 0.05, 0.05);
  list.push(m);
  return m;
}
type Scene = GameContext["scene"];

/** A boar built from primitives: 3D, so its wind-ups read clearly from any angle. Faces +z locally. */
export function spawnBoar(ctx: GameContext, at: Vec3, yaw: number): Entity {
  const { world, scene, shadows } = ctx;
  const e = world.spawn();

  const collider = MeshBuilder.CreateSphere(`boar-${e}`, { diameter: BOAR.radius * 2, segments: 8 }, scene);
  collider.position.set(at.x, at.y + BOAR.radius, at.z);
  collider.isVisible = false;
  const aggregate = new PhysicsAggregate(collider, PhysicsShapeType.SPHERE, { mass: BOAR.mass, friction: 0, restitution: 0 }, scene);
  aggregate.body.setMassProperties({ mass: BOAR.mass, inertia: Vector3.Zero() });
  aggregate.shape.filterMembershipMask = Layer.Enemy;
  aggregate.shape.filterCollideMask = Layer.Ground | Layer.Wall | Layer.Player;
  world.add(e, Body, { aggregate, mesh: collider });

  const materials: StandardMaterial[] = [];
  const hide = mat(scene, "boar-hide", "#5e4030", materials);
  const dark = mat(scene, "boar-dark", "#2e211a", materials);
  const snoutM = mat(scene, "boar-snout", "#8a5a4a", materials);
  const nose = mat(scene, "boar-nose", "#b77a6a", materials);
  const ivory = mat(scene, "boar-tusk", "#efe6cf", materials);
  const eyes = mat(scene, "boar-eyes", "#1a0a08", materials);
  for (const m of materials) m.metadata = { baseEmissive: m.emissiveColor.clone() };

  const parts: Mesh[] = [];
  const part = (m: Mesh, parent: TransformNode, material: StandardMaterial): Mesh => {
    m.parent = parent;
    m.material = material;
    m.isPickable = false;
    parts.push(m);
    return m;
  };

  const root = new TransformNode(`boar-root-${e}`, scene);
  root.parent = collider;
  root.position.y = -BOAR.radius; // feet on the ground
  const model = new TransformNode(`boar-model-${e}`, scene);
  model.parent = root;

  const body = part(MeshBuilder.CreateSphere("b-body", { diameter: 1, segments: 12 }, scene), model, hide);
  body.scaling.set(1.15, 1.0, 1.9);
  body.position.set(0, 0.95, -0.05);
  const mane = part(MeshBuilder.CreateBox("b-mane", { width: 0.28, height: 0.3, depth: 1.5 }, scene), model, dark);
  mane.position.set(0, 1.42, 0.1);
  mane.rotation.x = 0.12;
  const tail = part(MeshBuilder.CreateCylinder("b-tail", { height: 0.4, diameter: 0.07 }, scene), model, dark);
  tail.position.set(0, 1.05, -1.0);
  tail.rotation.x = -0.6;

  // Head pivots at the neck so it can be raised / lowered for the attack tells.
  const head = new TransformNode("b-head", scene);
  head.parent = model;
  head.position.set(0, 1.05, 0.8);
  const skull = part(MeshBuilder.CreateSphere("b-skull", { diameter: 1, segments: 10 }, scene), head, hide);
  skull.scaling.set(0.75, 0.7, 0.85);
  skull.position.set(0, -0.05, 0.3);
  const snout = part(MeshBuilder.CreateCylinder("b-snout", { height: 0.5, diameterTop: 0.36, diameterBottom: 0.46 }, scene), head, snoutM);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.15, 0.75);
  const disc = part(MeshBuilder.CreateCylinder("b-nose", { height: 0.05, diameter: 0.38 }, scene), head, nose);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, -0.15, 1.0);
  for (const s of [-1, 1]) {
    const tusk = part(MeshBuilder.CreateCylinder("b-tusk", { height: 0.4, diameterTop: 0, diameterBottom: 0.1, tessellation: 8 }, scene), head, ivory);
    tusk.position.set(s * 0.2, -0.18, 0.8);
    tusk.rotation.set(0.5, 0, -s * 0.35); // up, forward and outward
    const ear = part(MeshBuilder.CreateBox("b-ear", { width: 0.12, height: 0.28, depth: 0.2 }, scene), head, dark);
    ear.position.set(s * 0.27, 0.3, 0.12);
    ear.rotation.set(-0.3, 0, -s * 0.45);
    const eye = part(MeshBuilder.CreateSphere("b-eye", { diameter: 0.1, segments: 6 }, scene), head, eyes);
    eye.position.set(s * 0.24, 0.07, 0.55);
  }

  const legs: TransformNode[] = [];
  for (const [x, z] of [[-0.38, 0.55], [0.38, 0.55], [-0.38, -0.6], [0.38, -0.6]] as const) {
    const hip = new TransformNode("b-hip", scene);
    hip.parent = model;
    hip.position.set(x, 0.75, z);
    const leg = part(MeshBuilder.CreateBox("b-leg", { width: 0.22, height: 0.7, depth: 0.24 }, scene), hip, hide);
    leg.position.y = -0.35;
    const hoof = part(MeshBuilder.CreateBox("b-hoof", { width: 0.24, height: 0.1, depth: 0.28 }, scene), hip, dark);
    hoof.position.set(0, -0.7, 0.02);
    legs.push(hip);
  }

  // Dizzy stars, shown while stunned.
  const stars = new TransformNode("b-stars", scene);
  stars.parent = model;
  stars.position.set(0, 2.05, 0.7);
  const starMat = mat(scene, "boar-star", "#ffd84a", materials);
  starMat.emissiveColor = new Color3(1.2, 1.0, 0.3);
  starMat.metadata = { baseEmissive: starMat.emissiveColor.clone() };
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const star = MeshBuilder.CreatePolyhedron("b-star", { type: 0, size: 0.09 }, scene);
    star.parent = stars;
    star.material = starMat;
    star.position.set(Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4);
  }
  stars.setEnabled(false);

  const telegraph = MeshBuilder.CreateGround(`boar-telegraph-${e}`, { width: 1.7, height: 14 }, scene);
  telegraph.parent = root;
  telegraph.position.set(0, 0.04, 7.0 + 1.2);
  telegraph.material = ctx.materials.telegraph;
  telegraph.isPickable = false;
  telegraph.setEnabled(false);

  for (const p of parts) shadows.addShadowCaster(p);

  root.rotation.y = yaw;
  world.add(e, BoarView, {
    root, model, head, legs, stars, telegraph, materials, eyes, gait: 0, visualYaw: yaw,
  });
  world.add(e, Boar, {
    state: "approach", t: 0, yaw, chargeCooldown: 2.0, goreCooldown: 0, chargeDir: { x: 0, z: 1 }, poise: BOAR.poise,
  });
  world.add(e, Health, { hp: BOAR.maxHp, max: BOAR.maxHp, invuln: 0, hitstun: 0, flash: 0 });
  world.add(e, Fighter, { team: "enemy", radius: BOAR.radius });
  return e;
}
