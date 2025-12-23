import { useEffect, useRef } from 'react';
import * as CANNON from 'cannon-es';

// ===== CONFIGURATION =====
// Easily adjust these values to customize the scene
//
// QUICK TIPS:
// - Change colors below using hex codes (e.g., #ff0000 for red)
// - Adjust AMBIENT_LIGHT for overall brightness (0.4 = current setting)
// - Change BOUNCE and FRICTION for different ball behavior
// - Modify PARTICLE_COUNT to add/remove balls

// Particles
const PARTICLE_COUNT = 100;
const BALL_RADIUS = 0.1;
const SPAWN_DELAY = 30; // Milliseconds between each ball spawn (30ms = ~33 balls/sec) 

// Physics (Cannon.js units)
const GRAVITY = -9.8;     // Standard gravity (m/s²)
const FRICTION = 0.3;     // Material friction coefficient (0 = ice, 1 = sticky)
const BOUNCE = 0.2;       // Restitution/bounciness (0 = no bounce, 1 = perfect bounce)
const DAMPING = 0.1;     // Linear damping (air resistance: 0 = none, 1 = instant stop)
const SLEEP_SPEED_LIMIT = 0.1;   // Speed below which body can sleep
const SLEEP_TIME_LIMIT = 0.5;    // Time (seconds) of low speed before sleeping

// Studio Dimensions
const WALL_SIZE = 1.0;   // Size of the room (width/depth)
const WALL_HEIGHT = 2.0; // ABSOLUTE wall height (not a multiplier) - walls go from FLOOR_Y to FLOOR_Y + WALL_HEIGHT
const FLOOR_Y = -1.0;    // Floor level
// With current settings: Floor at -1.0, Ceiling at -1.0 + 2.0 = 1.0

// Camera Settings
const CAMERA_DISTANCE = 6.0;  // How far the camera is from origin
const CAMERA_HEIGHT = -1;      // Camera Y position offset (0 = center on box)
const CAMERA_ANGLE_Y = 45;     // Y-axis rotation in degrees (0 = front view, 45 = corner view)
const CAMERA_ANGLE_X = 0;   // X-axis rotation in degrees (negative = look down)
const CAMERA_ANGLE_Z = 35;     // Z-axis rotation in degrees (camera roll/tilt)
const CAMERA_FOV = Math.PI / 3.5; // Field of view

// Colors (Hex format - easy to customize!)
const COLOR_BG_HEX = '#05060a';      // Background
const COLOR_WALL_BACK_HEX = '#4f4f4fff';  // Back wall (darker grey)
const COLOR_WALL_LEFT_HEX = '#868686ff';  // Left wall (lighter grey)
const COLOR_FLOOR_HEX = '#4d4c4cff';      // Floor (red)
const COLOR_BALL_HEX = '#ffffff';       // Balls (white)

// Helper: Convert hex to RGB array (0-1 range)
const hexToRgb = (hex: string): number[] => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
};

// Auto-converted to WebGL format
const COLOR_BG = [...hexToRgb(COLOR_BG_HEX), 1.0];
const COLOR_WALL_A = hexToRgb(COLOR_WALL_BACK_HEX);
const COLOR_WALL_B = hexToRgb(COLOR_WALL_LEFT_HEX);
const COLOR_FLOOR = hexToRgb(COLOR_FLOOR_HEX);
const COLOR_BALL = hexToRgb(COLOR_BALL_HEX);

// Lighting
const LIGHT_DIRECTION = [0.5, 1.0, 0.8];  // Direction of main light (normalized in shader)
const AMBIENT_LIGHT = 0.4;                 // Ambient light intensity (0 = dark, 1 = fully lit)
const DIFFUSE_STRENGTH = 0.6;              // Directional light strength (0 = none, 1 = full)
const SPECULAR_STRENGTH = 0.3;             // Shininess/highlights on balls (0 = matte, 1 = glossy)

// Mouse Interaction
const MOUSE_INFLUENCE_RADIUS = 0.6; // How far mouse affects balls (reduced)
const MOUSE_FORCE = 0.01;           // Strength of mouse interaction (reduced from 0.02)
const MOUSE_LIFT = 4.0;             // How much balls pop up when struck (reduced from 8.0)

// --- Geometry Generators ---

// Sphere (Lat/Long bands)
function generateSphereGeometry(radius: number, latBands: number, longBands: number) {
  const vertices = [];
  const normals = [];
  const indices = [];

  for (let latNumber = 0; latNumber <= latBands; latNumber++) {
    const theta = (latNumber * Math.PI) / latBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let longNumber = 0; longNumber <= longBands; longNumber++) {
      const phi = (longNumber * 2 * Math.PI) / longBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;

      normals.push(x, y, z);
      vertices.push(radius * x, radius * y, radius * z);
    }
  }

  for (let latNumber = 0; latNumber < latBands; latNumber++) {
    for (let longNumber = 0; longNumber < longBands; longNumber++) {
      const first = latNumber * (longBands + 1) + longNumber;
      const second = first + longBands + 1;
      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

// Studio (Corner Room: Floor, Back Wall, Left Wall, Ceiling)
function generateStudioGeometry() {
  const s = WALL_SIZE;
  const f = FLOOR_Y;
  const h = f + WALL_HEIGHT; // Ceiling height = floor + absolute wall height

  // Vertices for Floor, Back Wall, Left Wall, Ceiling
  const vertices = [
    // Floor (y=f)
    -s, f, s,   s, f, s,   -s, f, -s,   s, f, -s,
    // Back Wall (z=-s)
    -s, f, -s,  s, f, -s,  -s, h, -s,   s, h, -s,
    // Left Wall (x=-s)
    -s, f, s,   -s, f, -s, -s, h, s,    -s, h, -s,
    // Ceiling (y=h) - semi-transparent
    -s, h, s,   s, h, s,   -s, h, -s,   s, h, -s,
  ];

  // Normals
  const normals = [
    // Floor (Up)
    0,1,0, 0,1,0, 0,1,0, 0,1,0,
    // Back Wall (Forward)
    0,0,1, 0,0,1, 0,0,1, 0,0,1,
    // Left Wall (Right)
    1,0,0, 1,0,0, 1,0,0, 1,0,0,
    // Ceiling (Down)
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0
  ];

  // Colors
  const colors = [
    // Floor (Red)
    ...COLOR_FLOOR, ...COLOR_FLOOR, ...COLOR_FLOOR, ...COLOR_FLOOR,
    // Back Wall (Grey A)
    ...COLOR_WALL_A, ...COLOR_WALL_A, ...COLOR_WALL_A, ...COLOR_WALL_A,
    // Left Wall (Grey B)
    ...COLOR_WALL_B, ...COLOR_WALL_B, ...COLOR_WALL_B, ...COLOR_WALL_B,
    // Ceiling (Dark grey - subtle)
    0.2, 0.2, 0.2,  0.2, 0.2, 0.2,  0.2, 0.2, 0.2,  0.2, 0.2, 0.2,
  ];

  // Indices
  const indices = [
    0, 1, 2,   2, 1, 3,   // Floor
    4, 5, 6,   6, 5, 7,   // Back Wall
    8, 9, 10,  10, 9, 11, // Left Wall
    12, 14, 13, 13, 14, 15 // Ceiling (reverse winding for correct normal)
  ];

  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint16Array(indices)
  };
}

export default function StudioBalls() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ 
    x: 0, y: 0, 
    vx: 0, vy: 0, 
    lastX: 0, lastY: 0,
    active: false,
    timestamp: 0 
  });
  
  // State: x,y,z (positions only - Cannon.js handles velocity)
  const particlesRef = useRef(new Float32Array(PARTICLE_COUNT * 3)); 
  const animationRef = useRef<number | undefined>(undefined);
  
  // Physics world and bodies
  const worldRef = useRef<CANNON.World | null>(null);
  const ballBodiesRef = useRef<CANNON.Body[]>([]);
  
  // Spawn tracking: how many balls are active
  const spawnRef = useRef({
    count: 0,           // Number of balls currently spawned
    lastSpawnTime: 0,   // Timestamp of last spawn
    spawnPositions: new Float32Array(PARTICLE_COUNT * 3) // Pre-computed spawn positions
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) return;

    // --- 1. Init Cannon.js Physics World ---
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, GRAVITY, 0)
    });
    world.broadphase = new CANNON.NaiveBroadphase(); // Simple for small number of bodies
    world.allowSleep = true; // Enable sleeping for performance
    
    // Configure solver for stability
    const solver = world.solver as CANNON.GSSolver;
    if ('iterations' in solver) {
      solver.iterations = 10; // Higher = more accurate but slower
    }
    
    worldRef.current = world;
    
    // Material for balls and walls
    const ballMaterial = new CANNON.Material('ball');
    const wallMaterial = new CANNON.Material('wall');
    
    // Contact material (friction/bounce between ball and wall)
    const ballWallContact = new CANNON.ContactMaterial(ballMaterial, wallMaterial, {
      friction: FRICTION,
      restitution: BOUNCE
    });
    world.addContactMaterial(ballWallContact);
    
    // Self-collision (ball-to-ball)
    const ballBallContact = new CANNON.ContactMaterial(ballMaterial, ballMaterial, {
      friction: FRICTION * 0.5,
      restitution: BOUNCE * 0.5 // Less bouncy between balls
    });
    world.addContactMaterial(ballBallContact);
    
    // --- 2. Create Static Room (Floor, Walls, Ceiling) ---
    const ceilingHeight = FLOOR_Y + WALL_HEIGHT;
    const wallLimit = WALL_SIZE;
    
    // Floor (plane at y = FLOOR_Y)
    const floorBody = new CANNON.Body({
      mass: 0, // Static
      shape: new CANNON.Plane(),
      material: wallMaterial
    });
    floorBody.position.set(0, FLOOR_Y, 0);
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to face up
    world.addBody(floorBody);
    
    // Ceiling (plane at y = ceilingHeight)
    const ceilingBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: wallMaterial
    });
    ceilingBody.position.set(0, ceilingHeight, 0);
    ceilingBody.quaternion.setFromEuler(Math.PI / 2, 0, 0); // Rotate to face down
    world.addBody(ceilingBody);
    
    // Left wall (x = -wallLimit)
    const leftWallBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: wallMaterial
    });
    leftWallBody.position.set(-wallLimit, 0, 0);
    leftWallBody.quaternion.setFromEuler(0, Math.PI / 2, 0); // Face right
    world.addBody(leftWallBody);
    
    // Right wall (x = wallLimit)
    const rightWallBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: wallMaterial
    });
    rightWallBody.position.set(wallLimit, 0, 0);
    rightWallBody.quaternion.setFromEuler(0, -Math.PI / 2, 0); // Face left
    world.addBody(rightWallBody);
    
    // Back wall (z = -wallLimit)
    const backWallBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: wallMaterial
    });
    backWallBody.position.set(0, 0, -wallLimit);
    backWallBody.quaternion.setFromEuler(0, 0, 0); // Face forward
    world.addBody(backWallBody);
    
    // Front wall (z = wallLimit)
    const frontWallBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: wallMaterial
    });
    frontWallBody.position.set(0, 0, wallLimit);
    frontWallBody.quaternion.setFromEuler(0, Math.PI, 0); // Face backward
    world.addBody(frontWallBody);
    
    // --- 3. Create Ball Bodies ---
    const particles = particlesRef.current;
    const spawn = spawnRef.current;
    const ballBodies: CANNON.Body[] = [];
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;
      
      // Pre-compute spawn positions
      const x = (Math.random() - 0.5) * 1.2;
      const y = 3.0; // Spawn height
      const z = (Math.random() - 0.5) * 1.2;
      
      spawn.spawnPositions[idx] = x;
      spawn.spawnPositions[idx + 1] = y;
      spawn.spawnPositions[idx + 2] = z;
      
      // Create ball body (start inactive/asleep far away)
      const ballBody = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Sphere(BALL_RADIUS),
        material: ballMaterial,
        linearDamping: DAMPING,
        angularDamping: DAMPING * 2,
        sleepSpeedLimit: SLEEP_SPEED_LIMIT,
        sleepTimeLimit: SLEEP_TIME_LIMIT
      });
      
      // Start far away (inactive)
      ballBody.position.set(x, 100, z);
      ballBody.sleep(); // Start sleeping
      
      world.addBody(ballBody);
      ballBodies.push(ballBody);
      
      // Initialize particle render positions
      particles[idx] = x;
      particles[idx + 1] = 100; // Inactive
      particles[idx + 2] = z;
    }
    
    ballBodiesRef.current = ballBodies;
    spawn.count = 0;
    spawn.lastSpawnTime = 0;

    const sphereGeom = generateSphereGeometry(BALL_RADIUS, 12, 12);
    const studioGeom = generateStudioGeometry();

    // --- 2. Shaders ---
    const ballVs = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec3 aOffset;
      uniform mat4 uMatrix;
      varying vec3 vNormal;
      void main() {
        vec3 worldPos = aPosition + aOffset;
        gl_Position = uMatrix * vec4(worldPos, 1.0);
        vNormal = aNormal;
      }
    `;
    const ballFs = `
      precision mediump float;
      uniform vec3 uLightDir;
      uniform float uAmbient;
      uniform float uDiffuse;
      uniform float uSpecular;
      uniform vec3 uBallColor;
      varying vec3 vNormal;
      void main() {
        vec3 lightDir = normalize(uLightDir);
        
        // Diffuse lighting
        float diffuse = max(dot(vNormal, lightDir), 0.0) * uDiffuse;
        
        // Ambient + Diffuse
        vec3 color = uBallColor * (uAmbient + diffuse);
        
        // Specular highlight
        vec3 viewDir = vec3(0.0, 0.0, 1.0);
        vec3 reflectDir = reflect(-lightDir, vNormal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0) * uSpecular;
        
        gl_FragColor = vec4(color + vec3(spec), 1.0);
      }
    `;

    const studioVs = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec3 aColor; // RGB
      uniform mat4 uMatrix;
      varying vec3 vNormal;
      varying vec3 vColor;
      void main() {
        gl_Position = uMatrix * vec4(aPosition, 1.0);
        vNormal = aNormal;
        vColor = aColor;
      }
    `;
    const studioFs = `
      precision mediump float;
      uniform vec3 uLightDir;
      uniform float uAmbient;
      uniform float uDiffuse;
      varying vec3 vNormal;
      varying vec3 vColor;
      void main() {
        vec3 lightDir = normalize(uLightDir);
        
        // Diffuse lighting
        float diffuse = max(dot(vNormal, lightDir), 0.0) * uDiffuse;
        
        // Combined lighting
        float lighting = uAmbient + diffuse;
        
        // Make ceiling semi-transparent (dark colors are ceiling)
        float alpha = 1.0;
        if (vColor.r < 0.3 && vColor.g < 0.3 && vColor.b < 0.3) {
          alpha = 0.15; // Very transparent ceiling
        }
        
        gl_FragColor = vec4(vColor * lighting, alpha);
      }
    `;

    const createProgram = (vsSource: string, fsSource: string) => {
      const vs = gl.createShader(gl.VERTEX_SHADER)!;
      gl.shaderSource(vs, vsSource);
      gl.compileShader(vs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(vs));
      const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
      gl.shaderSource(fs, fsSource);
      gl.compileShader(fs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(fs));
      const prog = gl.createProgram()!;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      return prog;
    };

    const ballProgram = createProgram(ballVs, ballFs);
    const studioProgram = createProgram(studioVs, studioFs);

    // --- 3. Buffers ---
    // Ball
    const ballPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ballPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphereGeom.vertices, gl.STATIC_DRAW);
    const ballNormBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ballNormBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sphereGeom.normals, gl.STATIC_DRAW);
    const ballIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ballIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphereGeom.indices, gl.STATIC_DRAW);
    const ballInstanceBuffer = gl.createBuffer();

    // Studio
    const studioPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, studioPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, studioGeom.vertices, gl.STATIC_DRAW);
    const studioNormBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, studioNormBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, studioGeom.normals, gl.STATIC_DRAW);
    const studioColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, studioColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, studioGeom.colors, gl.STATIC_DRAW);
    const studioIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, studioIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, studioGeom.indices, gl.STATIC_DRAW);

    const ext = gl.getExtension('ANGLE_instanced_arrays');
    if (!ext) return;

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE); // Ensure double-sided rendering
    gl.enable(gl.BLEND); // Enable transparency
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(COLOR_BG[0], COLOR_BG[1], COLOR_BG[2], COLOR_BG[3]);

    console.log('StudioBalls: Cannon.js initialized, balls:', PARTICLE_COUNT);

    // --- 4. Render Loop ---
    const animate = (time: number) => {
      // Resize
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      // Physics (Cannon.js)
      const world = worldRef.current;
      const ballBodies = ballBodiesRef.current;
      if (!world) return;
      
      const mouse = mouseRef.current;
      const dt = Math.min(100, time - mouse.timestamp) / 1000; // Convert to seconds
      mouse.timestamp = time;
      const isMouseMoving = (Math.abs(mouse.vx) + Math.abs(mouse.vy)) > 0.001;

      // Precompute camera angle for mouse projection
      const angleY = CAMERA_ANGLE_Y * Math.PI / 180;
      const cy = Math.cos(angleY), sy = Math.sin(angleY);
      
      // Spawn balls one by one
      const spawn = spawnRef.current;
      if (spawn.count < PARTICLE_COUNT && time - spawn.lastSpawnTime >= SPAWN_DELAY) {
        const ballBody = ballBodies[spawn.count];
        const spawnIdx = spawn.count * 3;
        
        // Activate this ball by setting it to spawn position and waking it
        ballBody.position.set(
          spawn.spawnPositions[spawnIdx],
          spawn.spawnPositions[spawnIdx + 1],
          spawn.spawnPositions[spawnIdx + 2]
        );
        ballBody.velocity.set(
          (Math.random() - 0.5) * 0.5,
          0,
          (Math.random() - 0.5) * 0.5
        );
        ballBody.wakeUp();
        
        spawn.count++;
        spawn.lastSpawnTime = time;
      }
      
      // Mouse interaction: Apply forces to nearby balls
      if (mouse.active && isMouseMoving) {
        // Mouse screen coords -> world floor coords (rough approximation)
        const mx = mouse.x * 3.0 * cy - mouse.y * 1.5 * sy;
        const mz = mouse.x * 3.0 * sy + mouse.y * 1.5 * cy;
        
        for (let i = 0; i < spawn.count; i++) {
          const ball = ballBodies[i];
          const dx = ball.position.x - mx;
          const dz = ball.position.z - mz;
          const dist = Math.sqrt(dx*dx + dz*dz);
          
          if (dist < MOUSE_INFLUENCE_RADIUS) {
            const dirX = dx / (dist + 0.001);
            const dirZ = dz / (dist + 0.001);
            
            // Apply impulse away from mouse
            const forceMag = (Math.abs(mouse.vx) + Math.abs(mouse.vy)) * MOUSE_FORCE * 100;
            ball.applyImpulse(
              new CANNON.Vec3(
                dirX * forceMag,
                forceMag * MOUSE_LIFT * 0.5,
                dirZ * forceMag
              ),
              ball.position
            );
            ball.wakeUp(); // Ensure ball is awake after interaction
          }
        }
      }
      
      // Step physics simulation
      world.step(1 / 60, dt, 3); // Fixed timestep: 60 FPS, with max 3 substeps
      
      // Sync Cannon.js body positions to particle array for rendering
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ball = ballBodies[i];
        const idx = i * 3;
        particles[idx] = ball.position.x;
        particles[idx + 1] = ball.position.y;
        particles[idx + 2] = ball.position.z;
      }
      
      mouse.vx *= 0.9;
      mouse.vy *= 0.9;

      // Rendering
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Camera setup: Use configuration constants
      const aspect = canvas.width / canvas.height;
      const fov = CAMERA_FOV;
      const near = 0.1;
      const far = 100.0;
      const f = 1.0 / Math.tan(fov / 2);
      
      // Camera distance & angles (from config) - angleY already declared above
      const camDist = CAMERA_DISTANCE;
      const angleX = CAMERA_ANGLE_X * Math.PI / 180;
      const angleZ = CAMERA_ANGLE_Z * Math.PI / 180;
      
      // cy, sy already computed above for mouse interaction
      const cx = Math.cos(angleX), sx = Math.sin(angleX);
      const cz = Math.cos(angleZ), sz = Math.sin(angleZ);
      
      // Build MVP using helper functions for clarity
      // Projection Matrix
      const projection = new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) / (near - far), -1,
        0, 0, (2 * far * near) / (near - far), 0
      ]);
      
      // View Matrix: Translate then Rotate
      // Camera at (0, CAMERA_HEIGHT, camDist) looking at (0, 0, 0)
      // Rotation: Y first, then X, then Z
      // Combined: Ry * Rx * Rz
      const rotY = new Float32Array([
        cy, 0, sy, 0,
        0, 1, 0, 0,
        -sy, 0, cy, 0,
        0, 0, 0, 1
      ]);
      
      const rotX = new Float32Array([
        1, 0, 0, 0,
        0, cx, -sx, 0,
        0, sx, cx, 0,
        0, 0, 0, 1
      ]);
      
      const rotZ = new Float32Array([
        cz, -sz, 0, 0,
        sz, cz, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
      
      const trans = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, CAMERA_HEIGHT, -camDist, 1
      ]);
      
      // Multiply: Proj * Trans * RotY * RotX
      // Helper: Multiply two 4x4 matrices (column-major)
      const mult = (a: Float32Array, b: Float32Array) => {
        const result = new Float32Array(16);
        for (let col = 0; col < 4; col++) {
          for (let row = 0; row < 4; row++) {
            result[col * 4 + row] = 
              a[0 * 4 + row] * b[col * 4 + 0] +
              a[1 * 4 + row] * b[col * 4 + 1] +
              a[2 * 4 + row] * b[col * 4 + 2] +
              a[3 * 4 + row] * b[col * 4 + 3];
          }
        }
        return result;
      };
      
      const view = mult(mult(trans, rotY), rotX);
      const mvp = mult(projection, view);

      // Draw Studio
      gl.useProgram(studioProgram);
      gl.uniformMatrix4fv(gl.getUniformLocation(studioProgram, 'uMatrix'), false, mvp);
      gl.uniform3f(gl.getUniformLocation(studioProgram, 'uLightDir'), LIGHT_DIRECTION[0], LIGHT_DIRECTION[1], LIGHT_DIRECTION[2]);
      gl.uniform1f(gl.getUniformLocation(studioProgram, 'uAmbient'), AMBIENT_LIGHT);
      gl.uniform1f(gl.getUniformLocation(studioProgram, 'uDiffuse'), DIFFUSE_STRENGTH);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, studioPosBuffer);
      gl.vertexAttribPointer(gl.getAttribLocation(studioProgram, 'aPosition'), 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(gl.getAttribLocation(studioProgram, 'aPosition'));
      
      gl.bindBuffer(gl.ARRAY_BUFFER, studioNormBuffer);
      gl.vertexAttribPointer(gl.getAttribLocation(studioProgram, 'aNormal'), 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(gl.getAttribLocation(studioProgram, 'aNormal'));
      
      gl.bindBuffer(gl.ARRAY_BUFFER, studioColorBuffer);
      gl.vertexAttribPointer(gl.getAttribLocation(studioProgram, 'aColor'), 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(gl.getAttribLocation(studioProgram, 'aColor'));
      
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, studioIndexBuffer);
      gl.drawElements(gl.TRIANGLES, studioGeom.indices.length, gl.UNSIGNED_SHORT, 0);
      
      const err = gl.getError();
      if (err !== gl.NO_ERROR && time < 1000) console.error('GL Error:', err);

      // Draw Balls
      gl.useProgram(ballProgram);
      gl.uniformMatrix4fv(gl.getUniformLocation(ballProgram, 'uMatrix'), false, mvp);
      gl.uniform3f(gl.getUniformLocation(ballProgram, 'uLightDir'), LIGHT_DIRECTION[0], LIGHT_DIRECTION[1], LIGHT_DIRECTION[2]);
      gl.uniform1f(gl.getUniformLocation(ballProgram, 'uAmbient'), AMBIENT_LIGHT);
      gl.uniform1f(gl.getUniformLocation(ballProgram, 'uDiffuse'), DIFFUSE_STRENGTH);
      gl.uniform1f(gl.getUniformLocation(ballProgram, 'uSpecular'), SPECULAR_STRENGTH);
      gl.uniform3f(gl.getUniformLocation(ballProgram, 'uBallColor'), COLOR_BALL[0], COLOR_BALL[1], COLOR_BALL[2]);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, ballPosBuffer);
      gl.vertexAttribPointer(gl.getAttribLocation(ballProgram, 'aPosition'), 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(gl.getAttribLocation(ballProgram, 'aPosition'));
      
      gl.bindBuffer(gl.ARRAY_BUFFER, ballNormBuffer);
      gl.vertexAttribPointer(gl.getAttribLocation(ballProgram, 'aNormal'), 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(gl.getAttribLocation(ballProgram, 'aNormal'));

      const offsets = new Float32Array(PARTICLE_COUNT * 3);
      for(let i=0; i<PARTICLE_COUNT; i++) {
        offsets[i*3] = particles[i*3];
        offsets[i*3+1] = particles[i*3+1];
        offsets[i*3+2] = particles[i*3+2];
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, ballInstanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.DYNAMIC_DRAW);
      const bOff = gl.getAttribLocation(ballProgram, 'aOffset');
      gl.vertexAttribPointer(bOff, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(bOff);
      ext.vertexAttribDivisorANGLE(bOff, 1);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ballIndexBuffer);
      ext.drawElementsInstancedANGLE(gl.TRIANGLES, sphereGeom.indices.length, gl.UNSIGNED_SHORT, 0, PARTICLE_COUNT);
      ext.vertexAttribDivisorANGLE(bOff, 0);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      
      const m = mouseRef.current;
      m.active = true;
      m.vx = x - m.lastX;
      m.vy = -(y - m.lastY);
      m.x = x;
      m.y = y;
      m.lastX = x;
      m.lastY = y;
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="relative w-[60vh] h-[60vh] max-w-[90vw] max-h-[90vw] flex items-center justify-center">
      <canvas 
        ref={canvasRef} 
        className="block w-full h-full cursor-crosshair rounded-lg"
      />
      <div className="absolute -bottom-8 left-0 right-0 text-center text-gray-500 font-mono text-xs pointer-events-none select-none">
        Move mouse to interact
      </div>
    </div>
  );
}