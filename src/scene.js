import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(container) {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    // Game state variables - Move all to top
    const spawnDistance = 1.5;    // Distance from edge to spawn new plots
    const plots = new Map();      // Store plot positions
    const plotsInProgress = new Set();  // Track plots being added
    let chickie = null;
    const enemySpeed = 0.03;
    const moveSpeed = 0.05;
    let targetPosition = null;
    let isGameOver = false;
    let gameActive = true;
    let score = 0;
    let eggs = [];
    const maxEggs = 5;
    const bombTimer = 3000;
    let enemies = [];  // This is our only enemy tracking now
    let ammo = 0;
    const bulletSpeed = 0.2;
    const bullets = [];

    // Update UI styling and layout with more game-like design
    const uiContainer = document.createElement('div');
    uiContainer.style.position = 'absolute';
    uiContainer.style.top = '20px';
    uiContainer.style.left = '20px';
    uiContainer.style.padding = '20px';
    uiContainer.style.background = 'linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(20, 20, 20, 0.9))';
    uiContainer.style.borderRadius = '15px';
    uiContainer.style.color = 'white';
    uiContainer.style.fontFamily = '"Press Start 2P", "Segoe UI", Roboto, Arial, sans-serif';
    uiContainer.style.fontSize = '16px';
    uiContainer.style.backdropFilter = 'blur(10px)';
    uiContainer.style.border = '2px solid rgba(255, 255, 255, 0.1)';
    uiContainer.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.3)';
    uiContainer.style.minWidth = '200px';
    container.appendChild(uiContainer);

    // Three.js utilities
    const raycaster = new THREE.Raycaster();
    const clickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const mouse = new THREE.Vector2();
    const intersectPoint = new THREE.Vector3();

    // Geometries and materials - Update these with enhanced properties
    const bombGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const bombMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFF0000,
        emissive: 0xFF0000,
        emissiveIntensity: 0.5
    });

    const explosionGeometry = new THREE.SphereGeometry(1, 16, 16);
    const explosionMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffff00,
        emissive: 0xffaa00,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.7
    });

    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff44,
        emissive: 0x00ff44,
        emissiveIntensity: 1
    });
    
    const powerupGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const powerupMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8,
        shininess: 100
    });

    // Camera setup
    const frustumSize = 10;
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        1,
        1000
    );

    // Position for isometric view (more zoomed out)
    camera.position.set(15, 15, 15);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lighting setup for bright, even illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambientLight);

    // Bright main light from above
    const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
    mainLight.position.set(5, 15, 5);
    scene.add(mainLight);

    // Add hemisphere light for natural sky lighting
    const hemisphereLight = new THREE.HemisphereLight(
        0xffffff, // Sky color
        0xffffff, // Ground color
        1.5       // Intensity
    );
    scene.add(hemisphereLight);

    // Bright fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
    fillLight.position.set(-5, 10, -5);
    scene.add(fillLight);

    // Bright front light
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.2);
    frontLight.position.set(0, 8, 12);
    scene.add(frontLight);

    // Enhance renderer settings for better lighting
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Configure shadows
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 100;
    mainLight.shadow.bias = -0.001;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = false;

    // Function declarations - Move all functions here
    function animate() {
        requestAnimationFrame(animate);
        updateChickiePosition();
        updateEnemyPositions();
        updateBullets();
        checkPowerupCollection();
        checkAndAddPlots();
        updateCamera();
        renderer.render(scene, camera);
    }

    // Load models
    const loader = new GLTFLoader();
    
    // Add these helper functions at the top with other functions
    function createDebugBox(object) {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        console.log('Plot size:', size);  // This will show us the exact dimensions

        // Create visible wireframe box for debugging
        const helper = new THREE.Box3Helper(box, 0xff0000);
        scene.add(helper);
        return size;
    }

    // Add plot type definitions at the top with other constants
    const PLOT_TYPES = [
        'forest',
        'water',
        'plain',
        'mountain',
        'desert'
    ];

    // Function to get random plot type
    function getRandomPlotType() {
        const randomIndex = Math.floor(Math.random() * PLOT_TYPES.length);
        return PLOT_TYPES[randomIndex];
    }

    // Update initial plot loading to include plot type
    loader.load('./models/forest.glb', (gltf) => {
        const land = gltf.scene;
        land.position.set(0, 0, 0);
        land.scale.set(1, 1, 1);
        scene.add(land);
        land.userData.plotType = 'forest';
        plots.set(getPlotKey(0, 0), land);
        
        // Measure the actual size
        const size = createDebugBox(land);
        console.log('Measured plot size:', size);
    });

    // Update plot size to match measured dimensions
    const plotSize = 4;  // Changed from 4.96 to exactly 4 units

    // Load player chicken - update starting position to actual center of plot
    loader.load('./models/7.glb', (gltf) => {
        chickie = gltf.scene;
        chickie.scale.set(0.5, 0.5, 0.5);
        chickie.position.set(2, 0.7, 2);  // Center of first plot (half of plotSize)
        scene.add(chickie);

        // Add initial powerup for testing
        const testPowerup = new THREE.Mesh(powerupGeometry, powerupMaterial);
        testPowerup.position.set(3, 0.5, 3);  // Near the player
        testPowerup.userData.isPowerup = true;
        scene.add(testPowerup);

        // Make powerup float and spin
        const startY = testPowerup.position.y;
        const startTime = Date.now();
        
        function animatePowerup() {
            if (!scene.children.includes(testPowerup)) return;
            
            const time = Date.now() - startTime;
            testPowerup.position.y = startY + Math.sin(time * 0.003) * 0.2;
            testPowerup.rotation.y += 0.02;
            
            requestAnimationFrame(animatePowerup);
        }
        animatePowerup();
    });

    // Start animation loop
    animate();

    // Event listeners
    container.addEventListener('click', (event) => {
        if (!gameActive) return;

        mouse.x = (event.clientX / container.clientWidth) * 2 - 1;
        mouse.y = -(event.clientY / container.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // Check for intersections with enemies and their children
        const intersects = raycaster.intersectObjects(enemies, true); // true to check children
        if (intersects.length > 0 && ammo > 0) {
            // Find the root enemy object (parent)
            let targetEnemy = intersects[0].object;
            while (targetEnemy.parent && !enemies.includes(targetEnemy)) {
                targetEnemy = targetEnemy.parent;
            }
            
            // Shoot at the enemy
            shootBulletAt(targetEnemy);
            return;
        }

        // Check for bombs
        const bombIntersects = raycaster.intersectObjects(eggs);
        if (bombIntersects.length > 0) {
            const bomb = bombIntersects[0].object;
            if (bomb.userData.isBomb && 
                Date.now() - bomb.userData.plantTime > 1000) {
                collectEgg(bomb);
                updateUI();
                return;
            }
        }

        // Handle movement if no enemy was clicked
        if (raycaster.ray.intersectPlane(clickPlane, intersectPoint)) {
            const plotX = Math.floor(intersectPoint.x / plotSize);
            const plotZ = Math.floor(intersectPoint.z / plotSize);
            
            if (hasPlot(plotX, plotZ)) {
                const plotType = getPlotTypeAt(intersectPoint.x, intersectPoint.z);
                if (plotType === 'water') {
                    console.log("Can't move on water!");
                    return;
                }

                if (eggs.length < maxEggs) {
                    targetPosition = intersectPoint.clone();
                }
            }
        }
    });

    window.addEventListener('resize', () => {
        const aspect = container.clientWidth / container.clientHeight;
        camera.left = frustumSize * aspect / -2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / -2;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // Add game over check
    function checkGameOver() {
        if (eggs.length === 0) {
            gameActive = false;
            showGameOver();
        }
    }

    // Update UI content with better styling and animations
    function updateUI() {
        uiContainer.innerHTML = `
            <style>
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                @keyframes slideIn {
                    from { transform: translateX(-20px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes float {
                    0% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                    100% { transform: translateY(0); }
                }
                .stat-container {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    animation: slideIn 0.5s ease-out;
                }
                .stat-row {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 15px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    transition: all 0.3s ease;
                    animation: float 3s infinite;
                    backdrop-filter: blur(5px);
                }
                .stat-row:hover {
                    background: rgba(255, 255, 255, 0.2);
                    transform: translateX(5px) scale(1.02);
                }
                .icon {
                    font-size: 24px;
                    width: 30px;
                    text-align: center;
                    animation: pulse 2s infinite;
                }
                .stat-value {
                    font-weight: bold;
                    color: #fff;
                    text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
                }
                .progress-bar {
                    background: rgba(255, 255, 255, 0.1);
                    height: 8px;
                    border-radius: 4px;
                    overflow: hidden;
                    margin-top: 5px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2) inset;
                }
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #ff6b6b, #ff4757);
                    transition: width 0.3s ease;
                    box-shadow: 0 0 10px rgba(255, 75, 87, 0.5);
                }
                .score-value {
                    animation: pulse 2s infinite;
                    color: #FFD700;
                    font-size: 1.2em;
                    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                }
            </style>
            <div class="stat-container">
                <div class="stat-row" style="animation-delay: 0s;">
                    <div class="icon">💣</div>
                    <div>
                        <div>BOMBS</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(eggs.length / maxEggs) * 100}%"></div>
                        </div>
                        <div class="stat-value">${eggs.length}/${maxEggs}</div>
                    </div>
                </div>
                <div class="stat-row" style="animation-delay: 0.2s;">
                    <div class="icon">🎯</div>
                    <div>
                        <div>AMMO</div>
                        <div class="stat-value">${ammo}</div>
                    </div>
                </div>
                <div class="stat-row" style="animation-delay: 0.4s;">
                    <div class="icon">⭐</div>
                    <div>
                        <div>SCORE</div>
                        <div class="score-value">${score}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // Update game over screen with more dynamic styling
    function showGameOver(won) {
        const gameOverDiv = document.createElement('div');
        gameOverDiv.style.position = 'absolute';
        gameOverDiv.style.top = '50%';
        gameOverDiv.style.left = '50%';
        gameOverDiv.style.transform = 'translate(-50%, -50%)';
        gameOverDiv.style.background = 'linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(20, 20, 20, 0.95))';
        gameOverDiv.style.padding = '40px 60px';
        gameOverDiv.style.borderRadius = '20px';
        gameOverDiv.style.color = 'white';
        gameOverDiv.style.fontFamily = '"Press Start 2P", "Segoe UI", Roboto, Arial, sans-serif';
        gameOverDiv.style.fontSize = '24px';
        gameOverDiv.style.textAlign = 'center';
        gameOverDiv.style.backdropFilter = 'blur(15px)';
        gameOverDiv.style.border = '3px solid rgba(255, 255, 255, 0.2)';
        gameOverDiv.style.boxShadow = '0 0 40px rgba(0, 0, 0, 0.6)';
        gameOverDiv.style.animation = 'fadeIn 0.5s ease-out';

        gameOverDiv.innerHTML = `
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; transform: translate(-50%, -40%); }
                    to { opacity: 1; transform: translate(-50%, -50%); }
                }
                @keyframes glow {
                    0% { text-shadow: 0 0 5px #fff; }
                    50% { text-shadow: 0 0 20px #fff, 0 0 30px #ff4da6; }
                    100% { text-shadow: 0 0 5px #fff; }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .game-over-title {
                    font-size: 36px;
                    margin-bottom: 30px;
                    animation: glow 2s infinite;
                }
                .score-display {
                    font-size: 28px;
                    color: #FFD700;
                    margin-bottom: 40px;
                    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                    animation: bounce 2s infinite;
                }
                .replay-button {
                    font-size: 20px;
                    padding: 20px 40px;
                    background: linear-gradient(45deg, #ff6b6b, #ff4757);
                    border: none;
                    border-radius: 15px;
                    color: white;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-family: inherit;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                    position: relative;
                    overflow: hidden;
                }
                .replay-button:hover {
                    transform: translateY(-3px) scale(1.05);
                    box-shadow: 0 7px 25px rgba(0, 0, 0, 0.4);
                    animation: shake 0.5s ease-in-out;
                }
                .replay-button::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: linear-gradient(
                        45deg,
                        transparent,
                        rgba(255, 255, 255, 0.1),
                        transparent
                    );
                    transform: rotate(45deg);
                    animation: shine 3s infinite;
                }
                @keyframes shine {
                    0% { transform: translateX(-100%) rotate(45deg); }
                    100% { transform: translateX(100%) rotate(45deg); }
                }
            </style>
            <div class="game-over-title">
                ${won ? '🏆 VICTORY!' : '💀 GAME OVER'}
            </div>
            <div class="score-display">
                FINAL SCORE: ${score}
            </div>
            <button class="replay-button" onclick="location.reload()">
                ⚡ Play Again ⚡
            </button>
        `;
        container.appendChild(gameOverDiv);
    }

    // Function to collect an egg
    function collectEgg(egg) {
        scene.remove(egg);
        eggs = eggs.filter(e => e !== egg);
        score += 1;
        movesLeft += 2;  // Bonus moves for collecting eggs
        updateUI();
    }

    // Modify updateChickiePosition to lay eggs when stopping
    function updateChickiePosition() {
        if (!chickie || !targetPosition || isGameOver) return;

        const direction = new THREE.Vector3();
        direction.subVectors(targetPosition, chickie.position);
        direction.y = 0;

        if (direction.length() < 0.1) {
            if (eggs.length < maxEggs) {
                createBomb(chickie.position.clone());
            }
            targetPosition = null;
            return;
        }

        // Calculate next position
        const nextX = chickie.position.x + direction.normalize().x * moveSpeed;
        const nextZ = chickie.position.z + direction.z * moveSpeed;

        // Check if next position would be on water
        const nextPlotType = getPlotTypeAt(nextX, nextZ);
        if (nextPlotType === 'water') {
            targetPosition = null;
            return;
        }

        // Move if not water
        chickie.position.x = nextX;
        chickie.position.z = nextZ;

        const angle = Math.atan2(direction.x, direction.z);
        chickie.rotation.y = angle;
    }

    // Function to create an egg at a position
    function createEgg(position) {
        const egg = new THREE.Mesh(eggGeometry, eggMaterial);
        egg.position.set(position.x, 0.2, position.z);  // Slightly above ground
        egg.scale.set(1, 1.3, 1);  // Make it slightly egg-shaped
        scene.add(egg);
        eggs.push(egg);
        
        // Make egg clickable
        egg.userData = { 
            isEgg: true,
            clickTime: Date.now()
        };
    }

    // Function to create a bomb instead of an egg
    function createBomb(position) {
        const bomb = new THREE.Mesh(bombGeometry, bombMaterial);
        bomb.position.set(position.x, 0.2, position.z);
        scene.add(bomb);
        eggs.push(bomb);
        
        bomb.userData = { 
            isBomb: true,
            plantTime: Date.now()
        };

        // Schedule explosion
        setTimeout(() => explodeBomb(bomb), bombTimer);
    }

    // Function to handle bomb explosion
    function explodeBomb(bomb) {
        if (!eggs.includes(bomb)) return;

        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.copy(bomb.position);
        scene.add(explosion);
        createExplosionParticles(bomb.position);

        // Check if any enemies are caught in explosion
        enemies.forEach((enemy, index) => {
            const distance = bomb.position.distanceTo(enemy.position);
            if (distance < 1.5) {
                // Remove hit enemy
                scene.remove(enemy);
                enemies.splice(index, 1);
                
                // Spawn two new enemies
                spawnEnemy();
                spawnEnemy();
                
                score += 10;
            }
        });

        scene.remove(bomb);
        eggs = eggs.filter(e => e !== bomb);
        updateUI();

        // Remove explosion effect after a short delay
        setTimeout(() => {
            scene.remove(explosion);
        }, 300);
    }

    // Function to reset enemy position when hit
    function resetEnemyPosition() {
        const angle = Math.random() * Math.PI * 2;
        const distance = 8;
        enemyChickie.position.x = Math.cos(angle) * distance;
        enemyChickie.position.z = Math.sin(angle) * distance;
    }

    // Update UI to show score
    function updateUI() {
        uiContainer.innerHTML = `
            Bombs: ${eggs.length}/${maxEggs}<br>
            Ammo: ${ammo}<br>
            Score: ${score}
        `;
    }

    // Modify checkGameOver to include win/lose condition
    function gameOver(won) {
        if (!won && chickie) {
            createBloodEffect(chickie.position.clone(), 2); // More intense effect for player death
        }
        isGameOver = true;
        gameActive = false;
        showGameOver(won);
    }

    // Update showGameOver to show win/lose message
    function showGameOver(won) {
        const gameOverDiv = document.createElement('div');
        gameOverDiv.style.position = 'absolute';
        gameOverDiv.style.top = '50%';
        gameOverDiv.style.left = '50%';
        gameOverDiv.style.transform = 'translate(-50%, -50%)';
        gameOverDiv.style.color = 'white';
        gameOverDiv.style.fontFamily = 'Arial, sans-serif';
        gameOverDiv.style.fontSize = '32px';
        gameOverDiv.style.textAlign = 'center';
        gameOverDiv.style.textShadow = '2px 2px 2px rgba(0,0,0,0.5)';
        gameOverDiv.innerHTML = `
            Game Over!<br>
            ${won ? 'You Win!' : 'You were caught!'}<br>
            Final Score: ${score}<br>
            <button onclick="location.reload()" style="font-size: 24px; padding: 10px 20px; margin-top: 20px; cursor: pointer;">
                Play Again
            </button>
        `;
        container.appendChild(gameOverDiv);
    }

    // Modify updateChickiePosition to create bombs instead of eggs
    function updateChickiePosition() {
        if (!chickie || !targetPosition || isGameOver) return;

        const direction = new THREE.Vector3();
        direction.subVectors(targetPosition, chickie.position);
        direction.y = 0;

        if (direction.length() < 0.1) {
            if (eggs.length < maxEggs) {
                createBomb(chickie.position.clone());
            }
            targetPosition = null;
            return;
        }

        // Calculate next position
        const nextX = chickie.position.x + direction.normalize().x * moveSpeed;
        const nextZ = chickie.position.z + direction.z * moveSpeed;

        // Check if next position would be on water
        const nextPlotType = getPlotTypeAt(nextX, nextZ);
        if (nextPlotType === 'water') {
            targetPosition = null;
            return;
        }

        // Move if not water
        chickie.position.x = nextX;
        chickie.position.z = nextZ;

        const angle = Math.atan2(direction.x, direction.z);
        chickie.rotation.y = angle;
    }

    // Function to generate position key for plots map
    function getPlotKey(x, z) {
        return `${x},${z}`;
    }

    // Function to check if a plot exists at position
    function hasPlot(x, z) {
        return plots.has(getPlotKey(x, z));
    }

    // Function to add new plot with animation
    function addPlot(x, z) {
        const plotKey = getPlotKey(x, z);
        if (hasPlot(x, z) || plotsInProgress.has(plotKey)) return;

        // Mark this plot as in progress
        plotsInProgress.add(plotKey);

        const plotType = getRandomPlotType();
        loader.load(`./models/${plotType}.glb`, (gltf) => {
            const newPlot = gltf.scene.clone();
            
            // Position exactly at grid coordinates using measured size
            newPlot.position.set(
                x * plotSize, 
                -2,
                z * plotSize
            );

            newPlot.scale.set(1, 1, 1);
            
            scene.add(newPlot);
            plots.set(plotKey, newPlot);
            newPlot.userData.plotType = plotType;

            // Animate plot rising from below
            const startY = -2;
            const targetY = 0;
            const duration = 500;
            const startTime = Date.now();

            function animatePlot() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                newPlot.position.y = startY + (targetY - startY) * progress;

                if (progress < 1) {
                    requestAnimationFrame(animatePlot);
                } else {
                    // Remove from in-progress once animation is complete
                    plotsInProgress.delete(plotKey);
                }
            }

            animatePlot();
        });
    }

    // Function to check and add new plots based on player position
    let lastCheckTime = 0;
    const checkDelay = 100; // milliseconds

    function checkAndAddPlots() {
        if (!chickie) return;

        // Add delay between checks
        const currentTime = Date.now();
        if (currentTime - lastCheckTime < checkDelay) return;
        lastCheckTime = currentTime;

        // Get current plot coordinates
        const currentPlotX = Math.floor(chickie.position.x / plotSize);
        const currentPlotZ = Math.floor(chickie.position.z / plotSize);

        // Check distance from edges of current plot
        const relativeX = chickie.position.x % plotSize;
        const relativeZ = chickie.position.z % plotSize;

        // Check each direction and add plots if needed
        if (relativeX > plotSize - spawnDistance) {
            addPlot(currentPlotX + 1, currentPlotZ);
        }
        if (relativeX < spawnDistance) {
            addPlot(currentPlotX - 1, currentPlotZ);
        }
        if (relativeZ > plotSize - spawnDistance) {
            addPlot(currentPlotX, currentPlotZ + 1);
        }
        if (relativeZ < spawnDistance) {
            addPlot(currentPlotX, currentPlotZ - 1);
        }
    }

    // Update camera to follow player
    function updateCamera() {
        if (!chickie) return;
        
        const targetX = chickie.position.x;
        const targetZ = chickie.position.z;
        
        camera.position.set(
            targetX + 15,
            15,
            targetZ + 15
        );
        camera.lookAt(targetX, 0, targetZ);
    }

    // Add this helper function to get plot type at a position
    function getPlotTypeAt(x, z) {
        const plotKey = getPlotKey(Math.floor(x / plotSize), Math.floor(z / plotSize));
        const plot = plots.get(plotKey);
        return plot?.userData.plotType || null;
    }

    // Update enemy handling to work with multiple enemies
    function updateEnemyPositions() {
        if (!chickie || isGameOver) return;

        enemies.forEach(enemy => {
            const direction = new THREE.Vector3();
            direction.subVectors(chickie.position, enemy.position);
            direction.y = 0;
            direction.normalize();

            enemy.position.x += direction.x * enemySpeed;
            enemy.position.z += direction.z * enemySpeed;

            const angle = Math.atan2(direction.x, direction.z);
            enemy.rotation.y = angle;

            const distance = enemy.position.distanceTo(chickie.position);
            if (distance < 0.8) {
                gameOver(false);
            }
        });
    }

    // Update initial enemy spawn
    function spawnInitialEnemy() {
        loader.load('./models/7.glb', (gltf) => {
            const firstEnemy = gltf.scene.clone();
            firstEnemy.scale.set(0.5, 0.5, 0.5);
            firstEnemy.position.set(8, 0.7, 8);
            firstEnemy.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.color.setHex(0xFF0000);
                }
            });
            scene.add(firstEnemy);
            enemies.push(firstEnemy);
        });
    }

    // Call spawnInitialEnemy instead of the old enemy loading code
    spawnInitialEnemy();

    // Add this function to spawn new enemies
    function spawnEnemy() {
        loader.load('./models/7.glb', (gltf) => {
            const newEnemy = gltf.scene.clone();
            newEnemy.scale.set(0.5, 0.5, 0.5);
            
            // Spawn at random position around the player
            const angle = Math.random() * Math.PI * 2;
            const distance = 8;  // Distance from player
            newEnemy.position.set(
                chickie.position.x + Math.cos(angle) * distance,
                0.7,
                chickie.position.z + Math.sin(angle) * distance
            );
            
            // Make enemy red
            newEnemy.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.color.setHex(0xFF0000);
                }
            });
            
            scene.add(newEnemy);
            enemies.push(newEnemy);
        });
    }

    // Function to spawn ammo powerup
    function spawnAmmoPowerup() {
        const powerup = new THREE.Mesh(powerupGeometry, powerupMaterial);
        
        // Random position within current plot
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 2 + 2; // Between 2-4 units from player
        powerup.position.set(
            chickie.position.x + Math.cos(angle) * distance,
            0.5,
            chickie.position.z + Math.sin(angle) * distance
        );

        powerup.userData.isPowerup = true;
        scene.add(powerup);

        // Make powerup float and spin
        const startY = powerup.position.y;
        const startTime = Date.now();
        
        function animatePowerup() {
            if (!scene.children.includes(powerup)) return;
            
            const time = Date.now() - startTime;
            powerup.position.y = startY + Math.sin(time * 0.003) * 0.2;
            powerup.rotation.y += 0.02;
            
            requestAnimationFrame(animatePowerup);
        }
        animatePowerup();

        // Remove powerup after some time if not collected
        setTimeout(() => {
            if (scene.children.includes(powerup)) {
                scene.remove(powerup);
            }
        }, 10000);
    }

    // Spawn powerups periodically
    setInterval(spawnAmmoPowerup, 15000);

    // Function to shoot bullet
    function shootBullet() {
        if (ammo <= 0 || !chickie) return;

        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        bullet.position.copy(chickie.position);
        bullet.position.y = 0.5;

        // Get click point for direction
        if (raycaster.ray.intersectPlane(clickPlane, intersectPoint)) {
            const direction = new THREE.Vector3();
            direction.subVectors(intersectPoint, chickie.position);
            direction.y = 0;
            direction.normalize();

            bullet.userData.direction = direction;
            bullet.userData.spawnTime = Date.now();

            scene.add(bullet);
            bullets.push(bullet);
            ammo--;
            updateUI();
        }
    }

    // Update bullet movement
    function updateBullets() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            const movement = bullet.userData.direction.clone().multiplyScalar(bulletSpeed);
            bullet.position.add(movement);

            // Check for enemy hits
            enemies.forEach((enemy, enemyIndex) => {
                if (bullet.position.distanceTo(enemy.position) < 0.5) {
                    // Create blood effect at hit location
                    createBloodEffect(enemy.position.clone(), 1);
                    
                    // Remove enemy and bullet
                    scene.remove(enemy);
                    enemies.splice(enemyIndex, 1);
                    scene.remove(bullet);
                    bullets.splice(i, 1);
                    score += 5;
                    
                    // Spawn two new enemies
                    spawnEnemy();
                    spawnEnemy();
                }
            });

            // Remove old bullets
            if (Date.now() - bullet.userData.spawnTime > 3000) {
                scene.remove(bullet);
                bullets.splice(i, 1);
            }
        }
    }

    // Add this function to check for nearby powerups
    function checkPowerupCollection() {
        if (!chickie) return;
        
        scene.children.forEach(object => {
            if (object.userData.isPowerup) {
                const distance = object.position.distanceTo(chickie.position);
                if (distance < 0.8) { // Collection radius
                    scene.remove(object);
                    ammo += 5;
                    updateUI();
                }
            }
        });
    }

    // Update shooting function to target specific enemy
    function shootBulletAt(targetEnemy) {
        if (ammo <= 0 || !chickie) return;

        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        // Start bullet at chicken position
        bullet.position.copy(chickie.position);
        bullet.position.y = 0.5;

        // Calculate direction to enemy
        const direction = new THREE.Vector3();
        direction.subVectors(targetEnemy.position, chickie.position);
        direction.y = 0; // Keep bullets level
        direction.normalize();

        bullet.userData.direction = direction;
        bullet.userData.spawnTime = Date.now();
        bullet.userData.targetEnemy = targetEnemy; // Store target for better tracking

        scene.add(bullet);
        bullets.push(bullet);
        ammo--;
        updateUI();
    }



    // Add particle effect for explosions
    function createExplosionParticles(position) {
        const particleCount = 20;
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff8844,
            transparent: true
        });

        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);
            
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.1 + 0.05;
            particle.userData.velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.random() * 0.1,
                Math.sin(angle) * speed
            );

            scene.add(particle);

            // Animate particle
            const startTime = Date.now();
            function animateParticle() {
                const elapsed = Date.now() - startTime;
                if (elapsed > 1000) {
                    scene.remove(particle);
                    return;
                }

                particle.position.add(particle.userData.velocity);
                particle.userData.velocity.y -= 0.001; // Gravity
                particle.material.opacity = 1 - (elapsed / 1000);

                requestAnimationFrame(animateParticle);
            }
            animateParticle();
        }
    }

    // Add blood particle materials and settings
    const bloodParticleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const bloodParticleMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.8
    });

    // Function to create blood splash effect
    function createBloodEffect(position, intensity = 1) {
        const particleCount = 30 * intensity;
        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(bloodParticleGeometry, bloodParticleMaterial.clone());
            particle.position.copy(position);
            
            // Random spread in all directions
            const angle = Math.random() * Math.PI * 2;
            const upwardBias = Math.random() * 0.15; // Upward spread
            const speed = (Math.random() * 0.2 + 0.1) * intensity;
            
            particle.userData.velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                upwardBias + Math.random() * 0.1,
                Math.sin(angle) * speed
            );

            particle.userData.rotationSpeed = Math.random() * 0.2 - 0.1;
            particle.scale.multiplyScalar(Math.random() * 0.5 + 0.5);

            scene.add(particle);
            particles.push(particle);
        }

        // Animate blood particles
        const startTime = Date.now();
        function animateBlood() {
            const elapsed = Date.now() - startTime;
            if (elapsed > 1000) {
                particles.forEach(particle => scene.remove(particle));
                return;
            }

            particles.forEach(particle => {
                // Update position
                particle.position.add(particle.userData.velocity);
                particle.userData.velocity.y -= 0.005; // Gravity
                
                // Rotate particle
                particle.rotation.x += particle.userData.rotationSpeed;
                particle.rotation.z += particle.userData.rotationSpeed;
                
                // Fade out
                particle.material.opacity = 0.8 * (1 - (elapsed / 1000));
                
                // Scale down over time
                const scale = 1 - (elapsed / 1000) * 0.5;
                particle.scale.set(scale, scale, scale);
            });

            requestAnimationFrame(animateBlood);
        }
        animateBlood();
    }
} 