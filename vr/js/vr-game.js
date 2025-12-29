// Sky Defender VR - WebXR Game for Meta Quest & Apple Vision Pro
class SkyDefenderVR {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.xrSession = null;
        this.controllers = [];
        this.hands = [];
        
        // Game state
        this.state = 'menu';
        this.score = 0;
        this.lives = 5;
        this.combo = 1;
        this.gameTime = 0;
        
        // Game objects
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];
        
        // Timing
        this.lastTime = 0;
        this.lastShot = 0;
        this.shootCooldown = 100;
        this.lastSpawn = 0;
        
        // Aim position (in 3D space)
        this.aimPosition = new THREE.Vector3(0, 1.6, -5);
        this.targetAimPosition = new THREE.Vector3(0, 1.6, -5);
        
        // Crosshair
        this.crosshair = null;
        this.aimLine = null;
        
        this.checkVRSupport();
    }
    
    async checkVRSupport() {
        const compatDiv = document.getElementById('compatibility');
        const startBtn = document.getElementById('startBtn');
        
        // Apply WebXR polyfill
        if (window.WebXRPolyfill) {
            new WebXRPolyfill();
        }
        
        if (navigator.xr) {
            try {
                // Check for immersive-vr (Meta Quest)
                const vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
                // Check for immersive-ar (Apple Vision Pro uses AR mode)
                const arSupported = await navigator.xr.isSessionSupported('immersive-ar');
                
                if (vrSupported || arSupported) {
                    compatDiv.textContent = '✅ VR/AR Headset Detected! Click "Enter VR" below';
                    compatDiv.className = '';
                    this.init(vrSupported ? 'immersive-vr' : 'immersive-ar');
                } else {
                    compatDiv.textContent = '⚠️ WebXR available but no headset connected';
                    compatDiv.className = 'warning';
                    startBtn.style.display = 'block';
                    this.init('inline');
                }
            } catch (e) {
                compatDiv.textContent = '⚠️ WebXR check failed - starting in 2D mode';
                compatDiv.className = 'warning';
                startBtn.style.display = 'block';
                this.init('inline');
            }
        } else {
            compatDiv.textContent = '❌ WebXR not supported - playing in 2D mode';
            compatDiv.className = 'error';
            startBtn.style.display = 'block';
            this.init('inline');
        }
        
        startBtn.addEventListener('click', () => this.startGame());
    }
    
    init(xrMode) {
        // Create Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050510);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 1.6, 0);
        
        // Renderer with WebXR
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.xr.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        
        // Add VR button if supported
        if (xrMode === 'immersive-vr' || xrMode === 'immersive-ar') {
            const vrButton = this.createVRButton(xrMode);
            document.body.appendChild(vrButton);
        }
        
        // Create environment
        this.createEnvironment();
        this.createCrosshair();
        
        // Setup controllers and hand tracking
        this.setupControllers();
        this.setupHandTracking();
        
        // Mouse/touch fallback for non-VR
        this.setupFallbackControls();
        
        // Window resize
        window.addEventListener('resize', () => this.onResize());
        
        // Start render loop
        this.renderer.setAnimationLoop((time, frame) => this.gameLoop(time, frame));
    }
    
    createVRButton(mode) {
        const button = document.createElement('button');
        button.className = 'vr-button';
        button.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 30px;
            font-size: 18px;
            background: linear-gradient(45deg, #4CAF50, #2E7D32);
            border: none;
            border-radius: 10px;
            color: white;
            cursor: pointer;
            z-index: 1000;
        `;
        button.textContent = mode === 'immersive-ar' ? '🥽 Enter AR (Vision Pro)' : '🥽 Enter VR (Quest)';
        
        button.addEventListener('click', async () => {
            try {
                const sessionInit = {
                    optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers']
                };
                
                this.xrSession = await navigator.xr.requestSession(mode, sessionInit);
                await this.renderer.xr.setSession(this.xrSession);
                
                this.xrSession.addEventListener('end', () => {
                    this.xrSession = null;
                    button.textContent = mode === 'immersive-ar' ? '🥽 Enter AR' : '🥽 Enter VR';
                });
                
                button.textContent = '❌ Exit VR';
                this.startGame();
                
            } catch (e) {
                console.error('Failed to start XR session:', e);
                alert('Failed to start VR/AR session: ' + e.message);
            }
        });
        
        return button;
    }
    
    createEnvironment() {
        // Starfield
        const starGeometry = new THREE.BufferGeometry();
        const starPositions = [];
        for (let i = 0; i < 2000; i++) {
            starPositions.push(
                (Math.random() - 0.5) * 1000,
                (Math.random() - 0.5) * 500 + 100,
                (Math.random() - 0.5) * 1000 - 200
            );
        }
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5 });
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);
        
        // Ambient light
        const ambient = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambient);
        
        // Directional light
        const directional = new THREE.DirectionalLight(0xffffff, 1);
        directional.position.set(5, 10, 5);
        this.scene.add(directional);
        
        // Ground reference plane (subtle grid)
        const gridHelper = new THREE.GridHelper(100, 50, 0x004444, 0x002222);
        gridHelper.position.y = -2;
        this.scene.add(gridHelper);
    }
    
    createCrosshair() {
        // Crosshair group
        this.crosshair = new THREE.Group();
        
        // Outer ring
        const ringGeometry = new THREE.RingGeometry(0.08, 0.1, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        this.crosshair.add(ring);
        
        // Center dot
        const dotGeometry = new THREE.CircleGeometry(0.02, 16);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        this.crosshair.add(dot);
        
        // Cross lines
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff });
        const linePoints = [
            [new THREE.Vector3(-0.15, 0, 0), new THREE.Vector3(-0.12, 0, 0)],
            [new THREE.Vector3(0.12, 0, 0), new THREE.Vector3(0.15, 0, 0)],
            [new THREE.Vector3(0, -0.15, 0), new THREE.Vector3(0, -0.12, 0)],
            [new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0, 0.15, 0)]
        ];
        
        linePoints.forEach(points => {
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            this.crosshair.add(line);
        });
        
        this.crosshair.position.set(0, 1.6, -5);
        this.scene.add(this.crosshair);
        
        // Aim line from player to crosshair
        const aimLineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
        const aimLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 1.2, 0),
            new THREE.Vector3(0, 1.6, -5)
        ]);
        this.aimLine = new THREE.Line(aimLineGeometry, aimLineMaterial);
        this.scene.add(this.aimLine);
    }
    
    setupControllers() {
        // Controller 0 (left) and Controller 1 (right)
        for (let i = 0; i < 2; i++) {
            const controller = this.renderer.xr.getController(i);
            controller.addEventListener('selectstart', () => this.onTriggerStart(i));
            controller.addEventListener('selectend', () => this.onTriggerEnd(i));
            controller.addEventListener('connected', (e) => this.onControllerConnected(e, i));
            this.scene.add(controller);
            this.controllers.push({ controller, isSelecting: false });
            
            // Controller visual (ray)
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -10)
            ]);
            const material = new THREE.LineBasicMaterial({ color: i === 0 ? 0x00ff00 : 0x0088ff });
            const line = new THREE.Line(geometry, material);
            controller.add(line);
        }
    }
    
    setupHandTracking() {
        // Hand tracking for Quest and Vision Pro
        for (let i = 0; i < 2; i++) {
            const hand = this.renderer.xr.getHand(i);
            hand.addEventListener('pinchstart', () => this.onPinchStart(i));
            hand.addEventListener('pinchend', () => this.onPinchEnd(i));
            this.scene.add(hand);
            this.hands.push({ hand, isPinching: false });
        }
    }

    
    setupFallbackControls() {
        // Mouse movement for non-VR mode
        document.addEventListener('mousemove', (e) => {
            if (!this.xrSession && this.state === 'playing') {
                const x = (e.clientX / window.innerWidth - 0.5) * 10;
                const y = -(e.clientY / window.innerHeight - 0.5) * 6 + 1.6;
                this.targetAimPosition.set(x, y, -5);
            }
        });
        
        // Mouse click to shoot
        document.addEventListener('mousedown', () => {
            if (!this.xrSession && this.state === 'playing') {
                this.shoot(this.aimPosition);
            }
        });
        
        // Touch controls for mobile
        document.addEventListener('touchmove', (e) => {
            if (!this.xrSession && this.state === 'playing') {
                const touch = e.touches[0];
                const x = (touch.clientX / window.innerWidth - 0.5) * 10;
                const y = -(touch.clientY / window.innerHeight - 0.5) * 6 + 1.6;
                this.targetAimPosition.set(x, y, -5);
            }
        });
        
        document.addEventListener('touchstart', () => {
            if (!this.xrSession && this.state === 'playing') {
                this.shoot(this.aimPosition);
            }
        });
    }
    
    onControllerConnected(event, index) {
        console.log(`Controller ${index} connected:`, event.data.handedness);
    }
    
    onTriggerStart(index) {
        this.controllers[index].isSelecting = true;
    }
    
    onTriggerEnd(index) {
        this.controllers[index].isSelecting = false;
    }
    
    onPinchStart(index) {
        this.hands[index].isPinching = true;
    }
    
    onPinchEnd(index) {
        this.hands[index].isPinching = false;
    }
    
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // Difficulty system
    getDifficulty() {
        return Math.min(1, this.gameTime / 300000);
    }
    
    getSpeedMultiplier() {
        return 0.2 + this.getDifficulty() * 1.4;
    }
    
    getSpawnInterval() {
        return 4000 - (4000 - 700) * this.getDifficulty();
    }
    
    spawnEnemy() {
        const types = ['fighter', 'bomber', 'rocket', 'missile', 'drone', 'ufo'];
        const type = types[Math.floor(Math.random() * types.length)];
        const spreadMult = 0.4 + this.getDifficulty() * 1.0;
        
        // Create enemy mesh
        const enemy = this.createEnemyMesh(type);
        enemy.userData = {
            type,
            speed: this.getBaseSpeed(type) * this.getSpeedMultiplier(),
            hp: this.getHP(type),
            maxHp: this.getHP(type),
            points: this.getPoints(type),
            phase: Math.random() * Math.PI * 2
        };
        
        // Position far away
        enemy.position.set(
            (Math.random() - 0.5) * 20 * spreadMult,
            (Math.random() - 0.5) * 10 * spreadMult + 2,
            -80
        );
        
        this.scene.add(enemy);
        this.enemies.push(enemy);
    }
    
    createEnemyMesh(type) {
        let geometry, material, mesh;
        
        switch(type) {
            case 'fighter':
                geometry = new THREE.ConeGeometry(0.5, 2, 4);
                material = new THREE.MeshPhongMaterial({ color: 0x3d4852 });
                mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.x = Math.PI / 2;
                break;
                
            case 'bomber':
                geometry = new THREE.BoxGeometry(2, 0.5, 1);
                material = new THREE.MeshPhongMaterial({ color: 0x4a5568 });
                mesh = new THREE.Mesh(geometry, material);
                break;
                
            case 'rocket':
                geometry = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8);
                material = new THREE.MeshPhongMaterial({ color: 0xe53e3e });
                mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.x = Math.PI / 2;
                break;
                
            case 'missile':
                geometry = new THREE.ConeGeometry(0.15, 1, 6);
                material = new THREE.MeshPhongMaterial({ color: 0x1a202c });
                mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.x = Math.PI / 2;
                break;
                
            case 'drone':
                geometry = new THREE.SphereGeometry(0.4, 8, 8);
                material = new THREE.MeshPhongMaterial({ color: 0x37474f });
                mesh = new THREE.Mesh(geometry, material);
                // Add propellers
                for (let i = 0; i < 4; i++) {
                    const propGeo = new THREE.BoxGeometry(0.8, 0.05, 0.1);
                    const propMat = new THREE.MeshPhongMaterial({ color: 0x263238 });
                    const prop = new THREE.Mesh(propGeo, propMat);
                    prop.position.set(
                        Math.cos(i * Math.PI / 2) * 0.5,
                        0.2,
                        Math.sin(i * Math.PI / 2) * 0.5
                    );
                    mesh.add(prop);
                }
                break;
                
            case 'ufo':
                geometry = new THREE.TorusGeometry(0.6, 0.2, 8, 16);
                material = new THREE.MeshPhongMaterial({ color: 0x546e7a });
                mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.x = Math.PI / 2;
                // Add dome
                const domeGeo = new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
                const domeMat = new THREE.MeshPhongMaterial({ color: 0x64c8ff, transparent: true, opacity: 0.5 });
                const dome = new THREE.Mesh(domeGeo, domeMat);
                dome.position.y = 0.1;
                mesh.add(dome);
                break;
                
            default:
                geometry = new THREE.SphereGeometry(0.5, 8, 8);
                material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
                mesh = new THREE.Mesh(geometry, material);
        }
        
        return mesh;
    }
    
    getBaseSpeed(t) { 
        return { fighter: 7, bomber: 4, rocket: 9, missile: 11, drone: 4, ufo: 8 }[t] || 5; 
    }
    getHP(t) { return { fighter: 2, bomber: 3, rocket: 1, missile: 1, drone: 2, ufo: 4 }[t] || 1; }
    getPoints(t) { return { fighter: 100, bomber: 150, rocket: 120, missile: 140, drone: 130, ufo: 200 }[t] || 100; }

    
    shoot(origin) {
        const now = performance.now();
        if (now - this.lastShot < this.shootCooldown) return;
        if (this.state !== 'playing') return;
        
        this.lastShot = now;
        
        // Create bullet
        const bulletGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        // Start from camera/controller position
        bullet.position.copy(origin || this.camera.position);
        
        // Direction toward crosshair
        const direction = new THREE.Vector3();
        direction.subVectors(this.crosshair.position, bullet.position).normalize();
        
        bullet.userData = {
            velocity: direction.multiplyScalar(1.5),
            life: 100
        };
        
        // Add glow
        const glowGeometry = new THREE.SphereGeometry(0.12, 8, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        bullet.add(glow);
        
        this.scene.add(bullet);
        this.bullets.push(bullet);
    }
    
    createExplosion(position, color, count) {
        const particles = [];
        
        for (let i = 0; i < count; i++) {
            const geometry = new THREE.SphereGeometry(0.05, 4, 4);
            const material = new THREE.MeshBasicMaterial({ color });
            const particle = new THREE.Mesh(geometry, material);
            
            particle.position.copy(position);
            particle.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3
                ),
                life: 1
            };
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        this.explosions.push({ particles, life: 1 });
    }
    
    updateHUD() {
        document.getElementById('scoreVal').textContent = this.score;
        document.getElementById('livesVal').textContent = this.lives;
        document.getElementById('comboVal').textContent = 'x' + this.combo;
    }
    
    startGame() {
        document.getElementById('info').style.display = 'none';
        document.getElementById('compatibility').style.display = 'none';
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('hud').style.display = 'block';
        
        this.state = 'playing';
        this.score = 0;
        this.lives = 5;
        this.combo = 1;
        this.gameTime = 0;
        this.enemies.forEach(e => this.scene.remove(e));
        this.enemies = [];
        this.bullets.forEach(b => this.scene.remove(b));
        this.bullets = [];
        this.lastSpawn = performance.now();
        this.updateHUD();
    }
    
    gameOver() {
        this.state = 'gameover';
        document.getElementById('info').style.display = 'block';
        document.getElementById('info').innerHTML = `
            <h1 style="color:#ff4444;">💥 GAME OVER</h1>
            <p style="font-size:24px;color:#0ff;">Score: ${this.score}</p>
            <p style="color:#aaa;">Click or press trigger to restart</p>
        `;
        
        // Allow restart
        setTimeout(() => {
            const restart = () => {
                this.startGame();
                document.removeEventListener('click', restart);
            };
            document.addEventListener('click', restart);
        }, 1000);
    }
    
    update(dt, frame) {
        if (this.state !== 'playing') return;
        
        this.gameTime += dt;
        
        // Update aim position (smooth interpolation)
        const smoothing = 0.03;
        this.aimPosition.lerp(this.targetAimPosition, smoothing);
        this.crosshair.position.copy(this.aimPosition);
        this.crosshair.lookAt(this.camera.position);
        
        // Update aim line
        const positions = this.aimLine.geometry.attributes.position.array;
        positions[3] = this.aimPosition.x;
        positions[4] = this.aimPosition.y;
        positions[5] = this.aimPosition.z;
        this.aimLine.geometry.attributes.position.needsUpdate = true;
        
        // Handle VR controller input
        if (this.xrSession && frame) {
            this.updateVRInput(frame);
        }
        
        // Spawn enemies
        const now = performance.now();
        if (now - this.lastSpawn > this.getSpawnInterval()) {
            this.spawnEnemy();
            this.lastSpawn = now;
        }
        
        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const data = enemy.userData;
            
            // Move toward player
            enemy.position.z += data.speed * dt * 0.001;
            data.phase += dt * 0.003;
            enemy.position.x += Math.sin(data.phase) * 0.02;
            
            // Rotate for visual effect
            enemy.rotation.z += dt * 0.001;
            
            // Check if reached player
            if (enemy.position.z > 2) {
                this.lives--;
                this.combo = 1;
                this.createExplosion(enemy.position, 0xff0000, 15);
                this.scene.remove(enemy);
                this.enemies.splice(i, 1);
                this.updateHUD();
                
                if (this.lives <= 0) {
                    this.gameOver();
                }
            }
        }
        
        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            const data = bullet.userData;
            
            bullet.position.add(data.velocity);
            data.life -= dt * 0.06;
            
            // Check collision with enemies
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                const dist = bullet.position.distanceTo(enemy.position);
                
                if (dist < 1.5) {
                    enemy.userData.hp--;
                    this.createExplosion(bullet.position, 0xffff00, 5);
                    this.scene.remove(bullet);
                    this.bullets.splice(i, 1);
                    
                    if (enemy.userData.hp <= 0) {
                        this.score += enemy.userData.points * this.combo;
                        this.combo = Math.min(10, this.combo + 1);
                        this.createExplosion(enemy.position, 0xff6600, 12);
                        this.scene.remove(enemy);
                        this.enemies.splice(j, 1);
                        this.updateHUD();
                    }
                    break;
                }
            }
            
            // Remove if too far or expired
            if (bullet.position.z < -100 || data.life <= 0) {
                this.scene.remove(bullet);
                this.bullets.splice(i, 1);
            }
        }
        
        // Update explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.life -= dt * 0.003;
            
            for (let p of exp.particles) {
                p.position.add(p.userData.velocity);
                p.material.opacity = exp.life;
            }
            
            if (exp.life <= 0) {
                exp.particles.forEach(p => this.scene.remove(p));
                this.explosions.splice(i, 1);
            }
        }
    }

    
    updateVRInput(frame) {
        const session = this.renderer.xr.getSession();
        if (!session) return;
        
        // Get reference space
        const referenceSpace = this.renderer.xr.getReferenceSpace();
        
        // Process controllers
        for (let i = 0; i < this.controllers.length; i++) {
            const { controller, isSelecting } = this.controllers[i];
            
            if (controller.visible) {
                // Get controller position and direction
                const controllerPos = new THREE.Vector3();
                const controllerDir = new THREE.Vector3(0, 0, -1);
                
                controller.getWorldPosition(controllerPos);
                controller.getWorldDirection(controllerDir);
                
                // Update aim based on controller pointing direction
                const aimDistance = 10;
                this.targetAimPosition.copy(controllerPos).add(controllerDir.multiplyScalar(aimDistance));
                
                // Auto-fire when trigger held
                if (isSelecting) {
                    this.shoot(controllerPos);
                }
            }
        }
        
        // Process hand tracking
        for (let i = 0; i < this.hands.length; i++) {
            const { hand, isPinching } = this.hands[i];
            
            if (hand.joints && hand.joints['index-finger-tip']) {
                const indexTip = hand.joints['index-finger-tip'];
                const wrist = hand.joints['wrist'];
                
                if (indexTip && wrist) {
                    // Get hand position
                    const handPos = new THREE.Vector3();
                    indexTip.getWorldPosition(handPos);
                    
                    // Calculate pointing direction from wrist to index tip
                    const wristPos = new THREE.Vector3();
                    wrist.getWorldPosition(wristPos);
                    
                    const pointDir = new THREE.Vector3();
                    pointDir.subVectors(handPos, wristPos).normalize();
                    
                    // Update aim
                    const aimDistance = 10;
                    this.targetAimPosition.copy(handPos).add(pointDir.multiplyScalar(aimDistance));
                    
                    // Fire when pinching
                    if (isPinching) {
                        this.shoot(handPos);
                    }
                }
            }
        }
    }
    
    gameLoop(time, frame) {
        const dt = Math.min(time - this.lastTime, 50);
        this.lastTime = time;
        
        this.update(dt, frame);
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize game
let game;
window.addEventListener('load', () => {
    game = new SkyDefenderVR();
});
