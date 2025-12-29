// 3D Sky Defender - Optimized Game Engine with Progressive Difficulty
class SkyDefender3D {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('videoFeed');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Game state
        this.state = 'menu';
        this.score = 0;
        this.lives = 5;
        this.combo = 1;
        this.playerName = '';
        this.highScores = this.loadScores();
        
        // SMOOTH aiming - much slower interpolation
        this.aimX = this.canvas.width / 2;
        this.aimY = this.canvas.height / 2;
        this.targetAimX = this.aimX;
        this.targetAimY = this.aimY;
        this.prevTargetX = this.aimX;
        this.prevTargetY = this.aimY;
        
        // Hand tracking
        this.handDetected = false;
        this.isPointing = false;
        this.indexOpen = false;
        this.lastClickTime = 0;
        this.cameraAllowed = false;
        this.currentFacingMode = 'user';
        this.availableCameras = [];
        
        // Game objects
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];
        this.stars = [];
        this.clouds = [];
        
        // Timing
        this.lastTime = performance.now();
        this.lastShot = 0;
        this.shootCooldown = 80;
        this.lastSpawn = 0;
        this.gameTime = 0;
        
        // Difficulty settings
        this.baseSpawnInterval = 3000;
        this.minSpawnInterval = 600;
        
        this.init();
    }
    
    // Secure score loading with validation
    loadScores() {
        try {
            const data = localStorage.getItem('skyDefenderScores');
            if (!data) return [];
            const scores = JSON.parse(data);
            // Validate score data
            if (!Array.isArray(scores)) return [];
            return scores.filter(s => 
                typeof s.name === 'string' && 
                typeof s.score === 'number' &&
                s.name.length <= 20 &&
                s.score >= 0 && s.score <= 9999999
            ).slice(0, 50);
        } catch (e) {
            return [];
        }
    }
    
    // Sanitize player name input
    sanitizeName(name) {
        return String(name || 'Player')
            .replace(/[<>\"\'&]/g, '') // Remove dangerous chars
            .trim()
            .slice(0, 15) || 'Player';
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    init() {
        this.createStars();
        this.createClouds();
        this.initHandTracking();
        this.setupControls();
        this.showStartScreen();
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    createStars() {
        this.stars = [];
        for (let i = 0; i < 150; i++) {
            this.stars.push({
                x: (Math.random() - 0.5) * 2,
                y: (Math.random() - 0.5) * 2,
                z: Math.random() * 1500 + 200,
                size: Math.random() * 2 + 0.5
            });
        }
    }
    
    createClouds() {
        this.clouds = [];
        for (let i = 0; i < 8; i++) {
            this.clouds.push({
                x: (Math.random() - 0.5) * 600,
                y: (Math.random() - 0.5) * 300,
                z: Math.random() * 1200 + 400,
                size: Math.random() * 80 + 40
            });
        }
    }
    
    async initHandTracking() {
        // Always request camera - don't skip based on cached permission
        await this.requestCameraAccess();
    }
    
    async requestCameraAccess(facingMode = 'user') {
        try {
            // Stop existing camera if any
            if (this.video.srcObject) {
                this.video.srcObject.getTracks().forEach(track => track.stop());
            }
            if (this.camera) {
                this.camera.stop();
            }
            
            // Check if MediaPipe is loaded
            if (typeof Hands === 'undefined') {
                throw new Error('MediaPipe not loaded');
            }
            
            // Initialize hands if not already done
            if (!this.hands) {
                this.hands = new Hands({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
                });
                
                this.hands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 0,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
                
                this.hands.onResults((r) => this.processHand(r));
            }
            
            // Get available cameras
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableCameras = devices.filter(d => d.kind === 'videoinput');
            
            // Store current facing mode
            this.currentFacingMode = facingMode;
            
            // Request camera access - ALWAYS prompt user
            document.getElementById('handInfo').textContent = '📷 Requesting camera...';
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 }, 
                    height: { ideal: 480 }, 
                    facingMode: facingMode
                } 
            });
            
            this.cameraAllowed = true;
            this.video.srcObject = stream;
            this.video.style.display = 'block';
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });
            
            // Check if Camera utility is available
            if (typeof Camera === 'undefined') {
                throw new Error('Camera utility not loaded');
            }
            
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    if (this.hands && this.video.readyState >= 2) {
                        await this.hands.send({ image: this.video });
                    }
                },
                width: 640, 
                height: 480
            });
            
            this.camera.start();
            document.getElementById('handInfo').textContent = '🖐️ Camera Ready';
            
            // Show camera toggle button if multiple cameras
            this.showCameraToggle();
            
            console.log('✓ Camera initialized:', facingMode);
            
        } catch (e) {
            console.log('Camera error:', e.message);
            document.getElementById('handInfo').textContent = '🖱️ Mouse Mode (Camera denied)';
            this.video.style.display = 'none';
            this.cameraAllowed = false;
            this.showCameraRetryButton();
        }
    }
    
    showCameraToggle() {
        // Remove existing toggle if any
        const existing = document.getElementById('cameraToggle');
        if (existing) existing.remove();
        
        // Create camera ON/OFF toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'cameraToggle';
        toggleBtn.innerHTML = '📷 Camera ON';
        toggleBtn.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 20px;
            padding: 10px 15px;
            font-size: 14px;
            background: rgba(76, 175, 80, 0.9);
            border: none;
            border-radius: 8px;
            color: white;
            cursor: pointer;
            z-index: 1000;
            backdrop-filter: blur(5px);
        `;
        toggleBtn.onclick = () => this.toggleCameraOnOff();
        document.body.appendChild(toggleBtn);
    }
    
    showCameraRetryButton() {
        // Remove existing button if any
        const existing = document.getElementById('cameraRetry');
        if (existing) existing.remove();
        
        const retryBtn = document.createElement('button');
        retryBtn.id = 'cameraRetry';
        retryBtn.innerHTML = '📷 Enable Camera';
        retryBtn.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 20px;
            padding: 12px 20px;
            font-size: 14px;
            background: linear-gradient(45deg, #4CAF50, #2E7D32);
            border: none;
            border-radius: 8px;
            color: white;
            cursor: pointer;
            z-index: 1000;
            animation: pulse 2s infinite;
        `;
        retryBtn.onclick = () => {
            retryBtn.remove();
            this.requestCameraAccess();
        };
        document.body.appendChild(retryBtn);
        
        // Add pulse animation
        if (!document.getElementById('pulseStyle')) {
            const style = document.createElement('style');
            style.id = 'pulseStyle';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    toggleCameraOnOff() {
        const toggleBtn = document.getElementById('cameraToggle');
        
        if (this.cameraAllowed && this.video.srcObject) {
            // Turn camera OFF
            this.video.srcObject.getTracks().forEach(track => track.stop());
            if (this.camera) this.camera.stop();
            this.video.srcObject = null;
            this.video.style.display = 'none';
            this.cameraAllowed = false;
            this.handDetected = false;
            
            toggleBtn.innerHTML = '📷 Camera OFF';
            toggleBtn.style.background = 'rgba(244, 67, 54, 0.9)';
            document.getElementById('handInfo').textContent = '🖱️ Mouse Mode';
        } else {
            // Turn camera ON
            toggleBtn.innerHTML = '📷 Starting...';
            this.requestCameraAccess();
        }
    }
    
    async toggleCamera() {
        // Switch between front and back camera
        const newMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
        document.getElementById('handInfo').textContent = '🔄 Switching camera...';
        await this.requestCameraAccess(newMode);
    }
    
    processHand(results) {
        if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
            this.handDetected = false;
            this.indexOpen = false;
            return;
        }
        
        this.handDetected = true;
        const lm = results.multiHandLandmarks[0];
        
        const indexMcp = lm[5];
        const indexPip = lm[6];
        const indexTip = lm[8];
        
        // Calculate pointing direction
        const fingerDirX = indexTip.x - indexMcp.x;
        const fingerDirY = indexTip.y - indexMcp.y;
        
        // BALANCED sensitivity - responsive but controlled
        const sensitivity = 0.8;
        let newTargetX = this.canvas.width * (0.5 - fingerDirX * sensitivity);
        let newTargetY = this.canvas.height * (0.5 + fingerDirY * sensitivity);
        
        // Clamp to screen
        const padding = 50;
        newTargetX = Math.max(padding, Math.min(this.canvas.width - padding, newTargetX));
        newTargetY = Math.max(padding, Math.min(this.canvas.height - padding, newTargetY));
        
        // MODERATE smoothing - 8% movement per frame for responsive feel
        const inputSmoothing = 0.08;
        this.targetAimX = this.prevTargetX + (newTargetX - this.prevTargetX) * inputSmoothing;
        this.targetAimY = this.prevTargetY + (newTargetY - this.prevTargetY) * inputSmoothing;
        this.prevTargetX = this.targetAimX;
        this.prevTargetY = this.targetAimY;
        
        // Index finger open = firing
        this.indexOpen = indexTip.y < indexPip.y;
        this.isPointing = this.indexOpen;
        
        this.checkButtonHover();
        document.getElementById('handInfo').textContent = this.indexOpen ? '👆 FIRING!' : '✊ Aim to fire';
    }
    
    setupControls() {
        // Mouse movement - SLOWER response
        document.addEventListener('mousemove', (e) => {
            if (!this.handDetected) {
                // Slower mouse - move target, let smoothing handle it
                this.targetAimX = e.clientX;
                this.targetAimY = e.clientY;
            }
        });
        
        // Mouse click
        this.canvas.addEventListener('mousedown', () => {
            if (this.state === 'playing') this.shoot();
        });
        
        this.canvas.addEventListener('click', () => {
            if (this.state === 'menu') this.askPlayerName();
            else if (this.state === 'gameover') this.showStartScreen();
        });
        
        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') { e.preventDefault(); this.shoot(); }
            if (e.code === 'Escape' || e.code === 'KeyP') this.togglePause();
            if (e.code === 'KeyR') this.restart();
        });
        
        // Hold to shoot continuously
        let shooting = false;
        document.addEventListener('mousedown', () => { shooting = true; });
        document.addEventListener('mouseup', () => { shooting = false; });
        
        setInterval(() => {
            if (shooting && this.state === 'playing' && !this.handDetected) {
                this.shoot();
            }
        }, this.shootCooldown);
    }
    
    shoot() {
        const now = performance.now();
        if (now - this.lastShot < this.shootCooldown) return;
        if (this.state !== 'playing') return;
        
        this.lastShot = now;
        
        const screenCenterX = this.canvas.width / 2;
        const screenCenterY = this.canvas.height / 2;
        const targetZ = 1500;
        const fov = 350;
        
        const targetX = (this.aimX - screenCenterX) * targetZ / fov;
        const targetY = (this.aimY - screenCenterY) * targetZ / fov;
        
        const dist = Math.sqrt(targetX * targetX + targetY * targetY + targetZ * targetZ);
        const speed = 60;
        
        this.bullets.push({
            x: 0, y: 0, z: 10,
            vx: (targetX / dist) * speed,
            vy: (targetY / dist) * speed,
            vz: (targetZ / dist) * speed,
            life: 120
        });
    }
    
    checkButtonHover() {
        const buttons = document.querySelectorAll('.menu-btn, .pause-btn-large');
        
        buttons.forEach(btn => {
            const rect = btn.getBoundingClientRect();
            const isHover = this.aimX >= rect.left && this.aimX <= rect.right &&
                           this.aimY >= rect.top && this.aimY <= rect.bottom;
            
            btn.style.transform = isHover ? 'scale(1.15)' : '';
            btn.style.filter = isHover ? 'brightness(1.3)' : '';
            
            if (isHover && this.isPointing && performance.now() - this.lastClickTime > 400) {
                this.lastClickTime = performance.now();
                btn.click();
            }
        });
    }

    // Get difficulty multiplier based on game time
    getDifficulty() {
        // Returns value from 0 (start) to 1 (max difficulty) over ~5 minutes (300 seconds)
        return Math.min(1, this.gameTime / 300000);
    }
    
    getSpeedMultiplier() {
        // Speed: 0.2x at start, up to 1.6x at max difficulty (slower progression)
        return 0.2 + this.getDifficulty() * 1.4;
    }
    
    getSpawnInterval() {
        // Spawn interval: 4000ms at start, down to 700ms at max
        const diff = this.getDifficulty();
        return 4000 - (4000 - 700) * diff;
    }
    
    getSpreadMultiplier() {
        // Spread: 0.4x at start (enemies very close together), up to 1.4x at max
        return 0.4 + this.getDifficulty() * 1.0;
    }
    
    spawnEnemy() {
        const types = ['fighter', 'bomber', 'rocket', 'missile', 'eagle', 'hawk', 'drone', 'ufo'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        const speedMult = this.getSpeedMultiplier();
        const spreadMult = this.getSpreadMultiplier();
        
        this.enemies.push({
            type,
            x: (Math.random() - 0.5) * 300 * spreadMult,
            y: (Math.random() - 0.5) * 200 * spreadMult,
            z: 1800, // Spawn further away
            speed: this.getBaseSpeed(type) * speedMult,
            size: this.getSize(type),
            hp: this.getHP(type),
            maxHp: this.getHP(type),
            points: this.getPoints(type),
            phase: Math.random() * Math.PI * 2
        });
    }
    
    getBaseSpeed(t) { 
        return { fighter:7, bomber:4, rocket:9, missile:11, eagle:5, hawk:6, drone:4, ufo:8 }[t] || 5; 
    }
    getSize(t) { return { fighter:40, bomber:60, rocket:30, missile:25, eagle:45, hawk:35, drone:38, ufo:50 }[t] || 35; }
    getHP(t) { return { fighter:2, bomber:3, rocket:1, missile:1, eagle:2, hawk:1, drone:2, ufo:4 }[t] || 1; }
    getPoints(t) { return { fighter:100, bomber:150, rocket:120, missile:140, eagle:110, hawk:90, drone:130, ufo:200 }[t] || 100; }
    
    update(dt) {
        if (this.state !== 'playing') return;
        
        this.gameTime += dt;
        
        // Update HUD periodically
        if (Math.floor(this.gameTime / 300) !== Math.floor((this.gameTime - dt) / 300)) {
            this.updateDifficultyDisplay();
        }
        
        // BALANCED smooth aim - responsive yet smooth
        // 0.06 = good balance between speed and smoothness
        const smoothing = this.handDetected ? 0.06 : 0.08;
        this.aimX += (this.targetAimX - this.aimX) * smoothing;
        this.aimY += (this.targetAimY - this.aimY) * smoothing;
        
        // Continuous firing when index finger is open
        if (this.indexOpen && this.handDetected) {
            this.shoot();
        }
        
        // Spawn enemies based on current difficulty
        const now = performance.now();
        if (now - this.lastSpawn > this.getSpawnInterval()) {
            this.spawnEnemy();
            this.lastSpawn = now;
        }
        
        // Update stars
        for (let s of this.stars) {
            s.z -= dt * 0.3;
            if (s.z < 10) s.z = 1500;
        }
        
        // Update clouds
        for (let c of this.clouds) {
            c.z -= dt * 0.15;
            if (c.z < 10) {
                c.z = 1500;
                c.x = (Math.random() - 0.5) * 600;
            }
        }
        
        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.z -= e.speed * dt * 0.06;
            e.phase += dt * 0.003;
            e.x += Math.sin(e.phase) * 0.3;
            
            if (e.z < 20) {
                this.lives--;
                this.combo = 1;
                this.addExplosion(e.x, e.y, e.z, '#ff0000', 15);
                this.enemies.splice(i, 1);
                this.updateHUD();
                if (this.lives <= 0) this.gameOver();
            }
        }
        
        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx * dt * 0.06;
            b.y += b.vy * dt * 0.06;
            b.z += b.vz * dt * 0.06;
            b.life -= dt * 0.06;
            
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const e = this.enemies[j];
                const dist = Math.hypot(b.x - e.x, b.y - e.y, b.z - e.z);
                
                if (dist < e.size * 1.2) {
                    e.hp--;
                    this.addExplosion(b.x, b.y, b.z, '#ffff00', 5);
                    this.bullets.splice(i, 1);
                    
                    if (e.hp <= 0) {
                        this.score += e.points * this.combo;
                        this.combo = Math.min(10, this.combo + 1);
                        this.addExplosion(e.x, e.y, e.z, '#ff6600', 12);
                        this.enemies.splice(j, 1);
                        this.updateHUD();
                    }
                    break;
                }
            }
            
            if (b.z > 1900 || b.life <= 0) this.bullets.splice(i, 1);
        }
        
        // Update explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.life -= dt * 0.05;
            for (let p of exp.particles) {
                p.x += p.vx * dt * 0.03;
                p.y += p.vy * dt * 0.03;
                p.z += p.vz * dt * 0.03;
            }
            if (exp.life <= 0) this.explosions.splice(i, 1);
        }
    }
    
    updateDifficultyDisplay() {
        const speedMult = this.getSpeedMultiplier();
        document.getElementById('speedVal').textContent = speedMult.toFixed(1) + 'x';
    }
    
    addExplosion(x, y, z, color, count) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y, z,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                vz: (Math.random() - 0.5) * 8,
                color
            });
        }
        this.explosions.push({ particles, life: 1, maxLife: 1 });
    }
    
    updateHUD() {
        document.getElementById('scoreVal').textContent = this.score;
        document.getElementById('livesVal').textContent = this.lives;
        document.getElementById('comboVal').textContent = 'x' + this.combo;
    }

    project(x, y, z) {
        const fov = 350;
        const scale = fov / Math.max(z, 1);
        return {
            x: this.canvas.width / 2 + x * scale,
            y: this.canvas.height / 2 + y * scale,
            s: Math.min(scale, 8)
        };
    }
    
    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Sky gradient
        const sky = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w * 0.7);
        sky.addColorStop(0, '#1a1a3a');
        sky.addColorStop(1, '#050510');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);
        
        // Stars
        ctx.fillStyle = '#fff';
        for (let s of this.stars) {
            const p = this.project(s.x * 500, s.y * 500, s.z);
            const alpha = Math.min(1, (1500 - s.z) / 800);
            ctx.globalAlpha = alpha * 0.8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, s.size * p.s * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        
        // Clouds
        for (let c of this.clouds) {
            const p = this.project(c.x, c.y, c.z);
            ctx.fillStyle = `rgba(80, 100, 130, ${0.15 * p.s})`;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, c.size * p.s, c.size * p.s * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        if (this.state === 'menu') return;
        
        // Sort enemies by depth
        const sorted = [...this.enemies].sort((a, b) => b.z - a.z);
        
        // Draw enemies
        for (let e of sorted) {
            const p = this.project(e.x, e.y, e.z);
            if (p.s < 0.03) continue;
            
            ctx.save();
            ctx.translate(p.x, p.y);
            this.drawEnemy(ctx, e, p.s);
            ctx.restore();
        }
        
        // Draw bullets
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        for (let b of this.bullets) {
            const p = this.project(b.x, b.y, b.z);
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4 * p.s + 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        
        // Draw explosions
        for (let exp of this.explosions) {
            ctx.globalAlpha = exp.life;
            for (let p of exp.particles) {
                const proj = this.project(p.x, p.y, p.z);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(proj.x, proj.y, 4 * proj.s, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        
        // Draw crosshair
        this.drawCrosshair(ctx);
        
        // Pause overlay
        if (this.state === 'paused') {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, w, h);
        }
    }
    
    drawCrosshair(ctx) {
        const x = this.aimX;
        const y = this.aimY;
        const r = 25;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        
        // Aim line
        if (this.isPointing || this.state === 'playing') {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        ctx.strokeStyle = this.isPointing ? '#ff3333' : '#00ffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 8;
        
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        
        if (this.isPointing) {
            ctx.beginPath();
            ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        const gap = 8;
        ctx.beginPath();
        ctx.moveTo(x - r - 8, y); ctx.lineTo(x - gap, y);
        ctx.moveTo(x + gap, y); ctx.lineTo(x + r + 8, y);
        ctx.moveTo(x, y - r - 8); ctx.lineTo(x, y - gap);
        ctx.moveTo(x, y + gap); ctx.lineTo(x, y + r + 8);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
    }
    
    drawEnemy(ctx, e, scale) {
        const size = e.size * scale;
        if (size < 2) return;
        
        if (e.hp < e.maxHp && size > 10) {
            ctx.fillStyle = '#333';
            ctx.fillRect(-size * 0.6, -size - 8, size * 1.2, 4);
            ctx.fillStyle = '#0f0';
            ctx.fillRect(-size * 0.6, -size - 8, size * 1.2 * (e.hp / e.maxHp), 4);
        }
        
        switch(e.type) {
            case 'fighter': this.drawFighter(ctx, size, e); break;
            case 'bomber': this.drawBomber(ctx, size, e); break;
            case 'rocket': this.drawRocket(ctx, size, e); break;
            case 'missile': this.drawMissile(ctx, size, e); break;
            case 'eagle': this.drawBird(ctx, size, e, '#5d4037', '#f5f5f5'); break;
            case 'hawk': this.drawBird(ctx, size, e, '#8d6e63', '#a1887f'); break;
            case 'drone': this.drawDrone(ctx, size, e); break;
            case 'ufo': this.drawUFO(ctx, size, e); break;
        }
    }

    drawFighter(ctx, s, e) {
        ctx.fillStyle = '#3d4852';
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.6);
        ctx.lineTo(s * 0.18, s * 0.4);
        ctx.lineTo(-s * 0.18, s * 0.4);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#2d3640';
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, s * 0.15);
        ctx.lineTo(0, -s * 0.15);
        ctx.lineTo(s * 0.5, s * 0.15);
        ctx.lineTo(0, s * 0.25);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.3, s * 0.08, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ff6b35';
        ctx.beginPath();
        ctx.ellipse(0, s * 0.45, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    drawBomber(ctx, s, e) {
        ctx.fillStyle = '#4a5568';
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.18, s * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#2d3748';
        ctx.beginPath();
        ctx.moveTo(-s * 0.7, s * 0.08);
        ctx.lineTo(-s * 0.12, -s * 0.12);
        ctx.lineTo(s * 0.12, -s * 0.12);
        ctx.lineTo(s * 0.7, s * 0.08);
        ctx.lineTo(s * 0.12, s * 0.12);
        ctx.lineTo(-s * 0.12, s * 0.12);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#ffa500';
        ctx.beginPath();
        ctx.ellipse(-s * 0.4, s * 0.25, s * 0.04, s * 0.08, 0, 0, Math.PI * 2);
        ctx.ellipse(s * 0.4, s * 0.25, s * 0.04, s * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#63b3ed';
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.32, s * 0.1, s * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    drawRocket(ctx, s, e) {
        ctx.fillStyle = '#e53e3e';
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.55);
        ctx.quadraticCurveTo(s * 0.15, -s * 0.25, s * 0.12, s * 0.35);
        ctx.lineTo(-s * 0.12, s * 0.35);
        ctx.quadraticCurveTo(-s * 0.15, -s * 0.25, 0, -s * 0.55);
        ctx.fill();
        
        ctx.fillStyle = '#742a2a';
        ctx.beginPath();
        ctx.moveTo(-s * 0.12, s * 0.2);
        ctx.lineTo(-s * 0.25, s * 0.4);
        ctx.lineTo(-s * 0.1, s * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s * 0.12, s * 0.2);
        ctx.lineTo(s * 0.25, s * 0.4);
        ctx.lineTo(s * 0.1, s * 0.35);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#fbd38d';
        ctx.beginPath();
        ctx.moveTo(-s * 0.08, s * 0.35);
        ctx.quadraticCurveTo(0, s * 0.7, s * 0.08, s * 0.35);
        ctx.fill();
    }
    
    drawMissile(ctx, s, e) {
        ctx.fillStyle = '#1a202c';
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.5);
        ctx.lineTo(s * 0.1, s * 0.35);
        ctx.lineTo(-s * 0.1, s * 0.35);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#e53e3e';
        ctx.beginPath();
        ctx.arc(0, -s * 0.4, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#2d3748';
        ctx.beginPath();
        ctx.moveTo(-s * 0.1, s * 0.25);
        ctx.lineTo(-s * 0.18, s * 0.4);
        ctx.lineTo(-s * 0.08, s * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s * 0.1, s * 0.25);
        ctx.lineTo(s * 0.18, s * 0.4);
        ctx.lineTo(s * 0.08, s * 0.35);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#fc8181';
        ctx.beginPath();
        ctx.ellipse(0, s * 0.45, s * 0.06, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    drawBird(ctx, s, e, bodyColor, headColor) {
        const flap = Math.sin(e.phase * 8) * 0.35;
        
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.15, s * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-s * 0.1, 0);
        ctx.quadraticCurveTo(-s * 0.45, -s * 0.25 * (1 + flap), -s * 0.55, s * 0.1);
        ctx.quadraticCurveTo(-s * 0.3, s * 0.15, -s * 0.1, s * 0.08);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s * 0.1, 0);
        ctx.quadraticCurveTo(s * 0.45, -s * 0.25 * (1 + flap), s * 0.55, s * 0.1);
        ctx.quadraticCurveTo(s * 0.3, s * 0.15, s * 0.1, s * 0.08);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.arc(0, -s * 0.32, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffc107';
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.32);
        ctx.lineTo(s * 0.06, -s * 0.48);
        ctx.lineTo(-s * 0.06, -s * 0.48);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-s * 0.05, -s * 0.35, s * 0.025, 0, Math.PI * 2);
        ctx.arc(s * 0.05, -s * 0.35, s * 0.025, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.moveTo(-s * 0.08, s * 0.3);
        ctx.lineTo(0, s * 0.5);
        ctx.lineTo(s * 0.08, s * 0.3);
        ctx.closePath();
        ctx.fill();
    }
    
    drawDrone(ctx, s, e) {
        const rot = e.phase * 15;
        
        ctx.fillStyle = '#37474f';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        for (let i = 0; i < 4; i++) {
            const angle = Math.PI / 4 + i * Math.PI / 2;
            const ax = Math.cos(angle) * s * 0.4;
            const ay = Math.sin(angle) * s * 0.4;
            
            ctx.strokeStyle = '#263238';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ax, ay);
            ctx.stroke();
            
            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(rot + i);
            ctx.fillStyle = 'rgba(144, 164, 174, 0.7)';
            ctx.beginPath();
            ctx.ellipse(0, 0, s * 0.15, s * 0.03, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.arc(0, s * 0.06, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
    }
    
    drawUFO(ctx, s, e) {
        const hover = Math.sin(e.phase * 3) * s * 0.04;
        
        ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
        ctx.beginPath();
        ctx.ellipse(0, s * 0.12 + hover, s * 0.35, s * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#546e7a';
        ctx.beginPath();
        ctx.ellipse(0, hover, s * 0.5, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.08 + hover, s * 0.22, s * 0.18, 0, Math.PI, 0);
        ctx.fill();
        
        ctx.fillStyle = '#00ff88';
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3 + e.phase;
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * s * 0.4, Math.sin(angle) * s * 0.06 + hover, s * 0.035, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // UI Screens
    showStartScreen() {
        document.getElementById('startScreen').innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;">
                <h1 style="font-size:52px;color:#0ff;text-shadow:0 0 40px #0ff;margin-bottom:10px;">🎮 3D SKY DEFENDER</h1>
                <p style="font-size:20px;color:#aaa;margin:15px;">Shoot down incoming enemies!</p>
                
                <div style="background:rgba(0,255,255,0.1);padding:25px;border-radius:15px;margin:20px;border:1px solid #0ff;">
                    <h3 style="color:#0ff;margin-bottom:15px;">🎯 CONTROLS</h3>
                    <p style="color:#ddd;margin:8px 0;">✋ <b>Move hand</b> to aim crosshair</p>
                    <p style="color:#ddd;margin:8px 0;">👆 <b>Open index finger</b> = AUTO FIRE!</p>
                    <p style="color:#ddd;margin:8px 0;">✊ <b>Close index finger</b> = Stop firing</p>
                    <p style="color:#888;margin:8px 0;">🖱️ Mouse: Move to aim, Hold click to fire</p>
                </div>
                
                <button class="menu-btn" onclick="game.askPlayerName()" style="padding:18px 50px;font-size:22px;background:linear-gradient(45deg,#00bcd4,#0097a7);border:none;border-radius:12px;color:white;cursor:pointer;margin:10px;">▶️ START GAME</button>
                <button class="menu-btn" onclick="game.showLeaderboard()" style="padding:12px 30px;font-size:16px;">🏆 LEADERBOARD</button>
            </div>`;
        document.getElementById('startScreen').style.display = 'block';
    }
    
    askPlayerName() {
        document.getElementById('startScreen').innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;">
                <h1 style="font-size:42px;color:#0ff;margin-bottom:20px;">👤 Enter Your Name</h1>
                <input type="text" id="playerNameInput" placeholder="Your name..." maxlength="15" 
                    style="padding:15px 25px;font-size:24px;border:2px solid #0ff;border-radius:10px;background:rgba(0,0,0,0.5);color:white;text-align:center;width:300px;margin:20px;">
                <div style="display:flex;gap:15px;margin-top:10px;">
                    <button class="menu-btn" onclick="game.startGameWithName()" style="padding:15px 40px;font-size:20px;background:#00bcd4;border:none;border-radius:10px;color:white;">▶️ PLAY</button>
                    <button class="menu-btn" onclick="game.showStartScreen()" style="padding:15px 30px;font-size:16px;">← BACK</button>
                </div>
            </div>`;
        
        setTimeout(() => {
            const input = document.getElementById('playerNameInput');
            if (input) {
                input.focus();
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.startGameWithName();
                });
            }
        }, 100);
    }
    
    startGameWithName() {
        const input = document.getElementById('playerNameInput');
        // Sanitize player name for security
        this.playerName = this.sanitizeName(input ? input.value : 'Player');
        this.startGame();
    }
    
    showPauseMenu() {
        document.getElementById('pauseMenu').innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;">
                <h1 style="font-size:56px;color:#0ff;">⏸️ PAUSED</h1>
                <p style="color:#aaa;font-size:18px;margin:15px;">Player: ${this.playerName} | Score: ${this.score}</p>
                <div style="display:flex;flex-direction:column;gap:12px;margin-top:15px;">
                    <button class="menu-btn pause-btn-large" onclick="game.togglePause()" style="padding:14px 45px;font-size:18px;background:#00bcd4;border:none;border-radius:10px;color:white;">▶️ RESUME</button>
                    <button class="menu-btn" onclick="game.restart()" style="padding:14px 45px;font-size:18px;background:#ff9800;border:none;border-radius:10px;color:white;">🔄 RESTART</button>
                    <button class="menu-btn" onclick="game.quit()" style="padding:14px 45px;font-size:18px;background:#f44336;border:none;border-radius:10px;color:white;">❌ QUIT</button>
                </div>
            </div>`;
        document.getElementById('pauseMenu').style.display = 'block';
    }
    
    showLeaderboard() {
        const scores = this.highScores.slice(0, 10);
        const list = scores.length ? scores.map((s, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 15px;background:rgba(0,255,255,${0.15 - i*0.012});border-radius:8px;margin:5px 0;">
                <span style="color:#ffd700;font-size:18px;width:40px;">${medal}</span>
                <span style="color:white;flex:1;text-align:left;margin-left:10px;">${s.name}</span>
                <span style="color:#0ff;font-weight:bold;">${s.score}</span>
            </div>`;
        }).join('') : '<p style="color:#888;text-align:center;padding:20px;">No scores yet! Be the first!</p>';
        
        document.getElementById('scoreboardModal').innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:250;">
                <h1 style="font-size:48px;color:#ffd700;text-shadow:0 0 20px #ffd700;">🏆 LEADERBOARD</h1>
                <div style="width:400px;max-height:400px;overflow-y:auto;margin:20px;padding:15px;background:rgba(0,0,0,0.5);border-radius:15px;border:2px solid #ffd700;">
                    ${list}
                </div>
                <button class="menu-btn" onclick="game.hideLeaderboard()" style="padding:12px 40px;font-size:16px;background:#ffd700;color:#000;border:none;border-radius:8px;">✓ CLOSE</button>
            </div>`;
        document.getElementById('scoreboardModal').style.display = 'block';
    }
    
    hideLeaderboard() { 
        document.getElementById('scoreboardModal').style.display = 'none'; 
    }
    
    showGameOver() {
        // Save score with player name
        this.highScores.push({ 
            name: this.playerName, 
            score: this.score, 
            date: new Date().toLocaleDateString() 
        });
        this.highScores.sort((a, b) => b.score - a.score);
        this.highScores = this.highScores.slice(0, 20); // Keep top 20
        localStorage.setItem('skyDefenderScores', JSON.stringify(this.highScores));
        
        // Check rank
        const rank = this.highScores.findIndex(s => s.score === this.score && s.name === this.playerName) + 1;
        const isTop3 = rank <= 3;
        const bestScore = this.highScores[0];
        
        document.getElementById('gameOverScreen').innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;">
                <h1 style="font-size:60px;color:#ff4444;text-shadow:0 0 30px #ff0000;">💥 GAME OVER</h1>
                
                <p style="font-size:24px;color:#aaa;margin:10px;">${this.playerName}</p>
                <p style="font-size:42px;color:#0ff;margin:10px;">Score: ${this.score}</p>
                
                ${isTop3 ? `<p style="font-size:28px;color:#ffd700;margin:10px;">🎉 ${rank === 1 ? '🥇 NEW HIGH SCORE!' : rank === 2 ? '🥈 2nd Place!' : '🥉 3rd Place!'} 🎉</p>` : 
                `<p style="font-size:18px;color:#888;margin:10px;">Rank: #${rank}</p>`}
                
                <div style="background:rgba(255,215,0,0.1);padding:15px 30px;border-radius:10px;margin:15px;border:1px solid #ffd700;">
                    <p style="color:#ffd700;font-size:16px;">🏆 Best Score: ${bestScore.score} by ${bestScore.name}</p>
                </div>
                
                <div style="display:flex;gap:15px;margin-top:20px;">
                    <button class="menu-btn" onclick="game.restart()" style="padding:16px 40px;font-size:20px;background:#4caf50;border:none;border-radius:10px;color:white;">🔄 PLAY AGAIN</button>
                    <button class="menu-btn" onclick="game.showLeaderboard()" style="padding:16px 30px;font-size:16px;background:#9c27b0;border:none;border-radius:10px;color:white;">🏆 LEADERBOARD</button>
                    <button class="menu-btn" onclick="game.quit()" style="padding:16px 30px;font-size:16px;background:#f44336;border:none;border-radius:10px;color:white;">❌ QUIT</button>
                </div>
            </div>`;
        document.getElementById('gameOverScreen').style.display = 'block';
    }
    
    // Game control
    startGame() {
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'none';
        this.state = 'playing';
        this.score = 0;
        this.lives = 5;
        this.combo = 1;
        this.gameTime = 0;
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];
        this.lastSpawn = performance.now();
        this.updateHUD();
        document.getElementById('speedVal').textContent = '0.3x';
    }
    
    togglePause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            this.showPauseMenu();
        } else if (this.state === 'paused') {
            this.state = 'playing';
            document.getElementById('pauseMenu').style.display = 'none';
        }
    }
    
    restart() {
        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'none';
        this.startGame();
    }
    
    quit() {
        this.state = 'menu';
        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'none';
        this.showStartScreen();
    }
    
    gameOver() {
        this.state = 'gameover';
        this.showGameOver();
    }
    
    gameLoop(time) {
        const dt = Math.min(time - this.lastTime, 50);
        this.lastTime = time;
        
        this.update(dt);
        this.render();
        
        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

// Initialize
let game;
window.addEventListener('load', () => { game = new SkyDefender3D(); });
