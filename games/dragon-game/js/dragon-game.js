/*
Horizontal Side-scrolling Dragon Game (Mario-style)
- Dragon moves horizontally
- Camera follows the dragon
- Princess moves toward the gate automatically
- NPCs try to stop the dragon or escort the princess
*/

// This code runs inside a "self-executing function" to keep variables organized and safe.
(() => {
  // --- Game Settings ---
  const worldWidth = 4000; // How long the castle level is
  const viewport = document.getElementById("gameViewport"); // The "window" we see the game through
  const gameWorld = document.getElementById("gameWorld"); // The actual long world inside the viewport
  const statusDisplay = document.getElementById("status"); // Text at the top showing score/messages
  const introScreen = document.getElementById("intro"); // The starting screen
  const startButton = document.getElementById("startBtn"); // The button to start the game
  const gameArea = document.getElementById("gameArea"); // The container for the active game
  const restartButton = document.getElementById("restart"); // The button to play again
  const helpButton = document.getElementById("help"); // The "How to play" button

  // --- Game State (Current Status) ---
  let isGameOver = false;
  let scorePoints = 0;
  let gameUpdateLoop = null; // This will hold the "timer" that runs the game
  let activeKeys = {}; // Tracks which keyboard keys are being pressed
  
  // Floor positions (Y coordinates)
  const mainFloorY = 280; 
  const dragonStartingY = 250; 
  const gravityStrength = 0.6; // How fast things fall down

  // The Dragon (The Player)
  let dragon = { 
    x: 100, 
    y: dragonStartingY, 
    velocityX: 0, // Horizontal speed
    velocityY: 0, // Vertical speed
    acceleration: 0.8, // How fast the dragon starts moving
    friction: 0.88, // How much the dragon slides to a stop
    maxSpeed: 8, 
    viewDirection: 1, // 1 for right, -1 for left
    isJumping: false, 
    animationFrame: 0,
    coyoteTime: 0, // Grace period to jump after walking off an edge
    jumpBuffer: 0 // Remembers if you pressed jump just before landing
  };

  let princess = { x: 700, y: mainFloorY, speed: 2.2 };
  let enemyCharacters = []; // Guards and NPCs
  let fireballs = []; 
  let barriers = []; 
  let platforms = []; 
  let visualParticles = []; 
  let backgroundDecoration = { pillars: [], torches: [] };
  let screenShakeAmount = 0;
  const castleGateX = 3800; // Where the princess is trying to go

  // This function sets up the level
  function setupGameLevel() {
    enemyCharacters = [];
    barriers = [];
    platforms = [];
    visualParticles = [];
    backgroundDecoration.pillars = [];
    backgroundDecoration.torches = [];
    
    // Create castle pillars and torches for the background
    for (let i = 0; i < 20; i++) {
        backgroundDecoration.pillars.push({ x: i * 400 + 200 });
        backgroundDecoration.torches.push({ x: i * 400 + 400, y: 150 });
    }

    // Create different types of obstacles (stones, crystals, crates, spikes)
    const obstacleTypes = ["stone", "crystal", "crate", "spikes"];
    for (let i = 0; i < 15; i++) {
        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        let width = 60, height = 50;
        
        if (type === "crystal") { width = 40; height = 80; }
        else if (type === "crate") { width = 70; height = 70; }
        else if (type === "spikes") { width = 80; height = 30; }
        else { width = 60 + Math.random() * 40; height = 40 + Math.random() * 30; }

        barriers.push({
            x: 600 + i * 250 + Math.random() * 100,
            y: 0, // Calculated below
            w: width,
            h: height,
            type: type
        });
    }

    // Position obstacles exactly on the floor
    barriers.forEach(barrier => {
        barrier.y = mainFloorY + 50 - barrier.h; 
    });

    // Create some floating platforms in the air
    for (let i = 0; i < 10; i++) {
        platforms.push({
            x: 800 + i * 400,
            y: 180,
            w: 120,
            h: 20
        });
    }

    // Add guards to the castle
    for (let i = 0; i < 20; i++) {
        enemyCharacters.push({
            x: 1000 + Math.random() * 2500,
            y: mainFloorY,
            alive: true,
            speed: 1 + Math.random() * 1.5,
            npcType: "knight",
            bobbingValue: 0
        });
    }
  }

  // Generates visual effects like dust or blood
  function createVisualEffect(x, y, velocityX, velocityY, lifeDuration, color) {
    visualParticles.push({ x, y, velocityX, velocityY, life: lifeDuration, color, maxLife: lifeDuration });
  }

  // Resets everything and starts the game loop
  function startGame() {
    isGameOver = false;
    scorePoints = 0;
    dragon = { 
        x: 100, 
        y: dragonStartingY, 
        velocityX: 0, 
        velocityY: 0, 
        acceleration: 0.8, 
        friction: 0.88, 
        maxSpeed: 8, 
        viewDirection: 1, 
        isJumping: false,
        animationFrame: 0,
        coyoteTime: 0,
        jumpBuffer: 0
    };
    princess = { x: 800, y: mainFloorY, speed: 2.3 };
    fireballs = [];
    setupGameLevel();
    
    introScreen.hidden = true;
    gameArea.hidden = false;
    statusDisplay.textContent = "Run! Stop the princess! Arrow keys to move, Space to breathe fire.";
    
    if (gameUpdateLoop) clearInterval(gameUpdateLoop);
    gameUpdateLoop = setInterval(runGameTick, 1000 / 60);
  }

  function runGameTick() {
    if (isGameOver) return;

    dragon.animationFrame++;
    if (screenShakeAmount > 0) screenShakeAmount *= 0.9;

    // Movement
    let isMovingHorizontally = false;
    if (activeKeys["ArrowLeft"]) { 
        dragon.velocityX -= dragon.acceleration; 
        dragon.viewDirection = -1; 
        isMovingHorizontally = true;
    }
    if (activeKeys["ArrowRight"]) { 
        dragon.velocityX += dragon.acceleration; 
        dragon.viewDirection = 1; 
        isMovingHorizontally = true;
    }

    if (!isMovingHorizontally) {
        dragon.velocityX *= dragon.friction;
    }
    
    // Air resistance
    if (dragon.isJumping) {
        dragon.velocityX *= 0.98;
    }

    dragon.velocityX = Math.max(-dragon.maxSpeed, Math.min(dragon.maxSpeed, dragon.velocityX));
    if (Math.abs(dragon.velocityX) < 0.1) dragon.velocityX = 0;
    
    const previousX = dragon.x;
    dragon.x += dragon.velocityX;

    if (isMovingHorizontally && !dragon.isJumping && dragon.animationFrame % 10 === 0) {
        createVisualEffect(dragon.x + 50, dragon.y + 90, (Math.random()-0.5)*2, -Math.random()*2, 20, "#888");
    }
    
    // Jump buffering
    if (activeKeys["ArrowUp"]) {
        dragon.jumpBuffer = 8;
    } else if (dragon.jumpBuffer > 0) {
        dragon.jumpBuffer--;
    }

    // Coyote time
    if (!dragon.isJumping) {
        dragon.coyoteTime = 8;
    } else if (dragon.coyoteTime > 0) {
        dragon.coyoteTime--;
    }

    // Jump physics
    if (dragon.jumpBuffer > 0 && dragon.coyoteTime > 0) {
        dragon.velocityY = -16;
        dragon.isJumping = true;
        dragon.jumpBuffer = 0;
        dragon.coyoteTime = 0;
        for(let i=0; i<5; i++) createVisualEffect(dragon.x + 50, dragon.y + 90, (Math.random()-0.5)*5, -Math.random()*3, 30, "#888");
    }

    // Variable jump height
    if (!activeKeys["ArrowUp"] && dragon.velocityY < -7) {
        dragon.velocityY *= 0.5;
    }

    dragon.velocityY += gravityStrength;
    const previousDragonY = dragon.y - dragon.velocityY;
    dragon.y += dragon.velocityY;

    // Floor collision
    if (dragon.y >= dragonStartingY) {
        if (dragon.isJumping) {
            for(let i=0; i<8; i++) createVisualEffect(dragon.x + 50, dragonStartingY + 90, (Math.random()-0.5)*10, -Math.random()*5, 30, "#888");
            screenShakeAmount = 5;
        }
        dragon.y = dragonStartingY;
        dragon.velocityY = 0;
        dragon.isJumping = false;
    }

    // Platform collisions
    platforms.forEach(platform => {
        if (dragon.velocityY > 0 && 
            dragon.x + 80 > platform.x && dragon.x + 20 < platform.x + platform.w &&
            previousDragonY + 90 <= platform.y && dragon.y + 90 >= platform.y) {
            dragon.y = platform.y - 90;
            dragon.velocityY = 0;
            dragon.isJumping = false;
        }
    });

    dragon.x = Math.max(0, Math.min(worldWidth - 60, dragon.x));

    // Barrier collisions
    barriers.forEach(barrier => {
        if (dragon.x + 80 > barrier.x && dragon.x + 20 < barrier.x + barrier.w && 
            dragon.y + 100 > barrier.y && dragon.y < barrier.y + barrier.h) {
            
            if (barrier.type === "spikes") {
                // Hurt/Push back
                dragon.velocityX = -dragon.viewDirection * 15;
                dragon.velocityY = -10;
                screenShakeAmount = 15;
                for(let i=0; i<10; i++) createVisualEffect(dragon.x + 50, dragon.y + 50, (Math.random()-0.5)*10, (Math.random()-0.5)*10, 20, "#f00");
                return;
            }

            // Smarter collision response
            if (previousX + 80 <= barrier.x) {
                dragon.x = barrier.x - 80;
                dragon.velocityX = 0;
            } else if (previousX + 20 >= barrier.x + barrier.w) {
                dragon.x = barrier.x + barrier.w - 20;
                dragon.velocityX = 0;
            }
        }
    });

    princess.x += princess.speed;

    enemyCharacters.forEach(enemy => {
        if (!enemy.alive) return;
        enemy.bobbingValue += 0.1;
        
        const distanceToDragon = Math.abs(enemy.x - dragon.x);
        if (distanceToDragon < 500) {
            enemy.x += (dragon.x > enemy.x ? 1 : -1) * enemy.speed;
        } else {
            enemy.x += (princess.x > enemy.x ? 1 : -1) * enemy.speed * 0.5;
        }

        if (Math.abs(enemy.x - (dragon.x + 30)) < 50) {
            enemy.alive = false;
            scorePoints += 100;
            for(let i=0; i<10; i++) createVisualEffect(enemy.x + 30, enemy.y + 30, (Math.random()-0.5)*10, -Math.random()*10, 40, "#f00");
            screenShakeAmount = 10;
        }
    });

    // Fireballs and particles
    visualParticles.forEach((p, i) => {
        p.x += p.velocityX;
        p.y += p.velocityY;
        p.velocityY += 0.1;
        p.life--;
        if (p.life <= 0) visualParticles.splice(i, 1);
    });

    fireballs.forEach((fb, i) => {
        fb.x += fb.velocityX;
        if (dragon.animationFrame % 2 === 0) createVisualEffect(fb.x, fb.y, 0, (Math.random()-0.5)*2, 10, "#ff0");
        
        enemyCharacters.forEach(enemy => {
            if (enemy.alive && Math.abs(fb.x - enemy.x) < 30) {
                enemy.alive = false;
                fb.life = 0;
                scorePoints += 100;
                for(let j=0; j<10; j++) createVisualEffect(enemy.x + 30, enemy.y + 30, (Math.random()-0.5)*15, (Math.random()-0.5)*15, 30, "#f00");
                screenShakeAmount = 15;
            }
        });
        fb.life--;
        if (fb.life <= 0) fireballs.splice(i, 1);
    });

    checkGameState();
    renderGame();
  }

  // Checks if the player won or lost
  function checkGameState() {
    if (princess.x >= castleGateX) {
        statusDisplay.textContent = "GAME OVER — The princess escaped! Score: " + scorePoints;
        isGameOver = true;
    }
    if (Math.abs(dragon.x - princess.x) < 60) {
        statusDisplay.textContent = "GAME OVER — You touched the princess! She escaped in the confusion. Score: " + scorePoints;
        isGameOver = true;
    }
    if (enemyCharacters.filter(enemy => enemy.alive).length === 0) {
        statusDisplay.textContent = "VICTORY — All defenders fallen! Score: " + scorePoints;
        isGameOver = true;
    }
  }

  // Draws all game objects to the screen
  function renderGame() {
    // Clear and Redraw the world
    const floorElement = gameWorld.querySelector(".castle-floor");
    gameWorld.innerHTML = "";
    if (floorElement) gameWorld.appendChild(floorElement);
    else {
        const newFloor = document.createElement('div');
        newFloor.className = 'castle-floor';
        gameWorld.appendChild(newFloor);
    }

    // Draw background pillars and torches
    backgroundDecoration.pillars.forEach(pillar => {
        const pillarElement = document.createElement("div");
        pillarElement.className = "castle-pillar";
        pillarElement.style.left = pillar.x + "px";
        gameWorld.appendChild(pillarElement);
    });
    backgroundDecoration.torches.forEach(torch => {
        const torchElement = document.createElement("div");
        torchElement.className = "torch";
        torchElement.style.left = torch.x + "px";
        torchElement.style.top = torch.y + "px";
        gameWorld.appendChild(torchElement);
    });

    // Draw floating platforms
    platforms.forEach(platform => {
        const platformElement = document.createElement("div");
        platformElement.className = "barrier";
        platformElement.style.left = platform.x + "px";
        platformElement.style.top = platform.y + "px";
        platformElement.style.width = platform.w + "px";
        platformElement.style.height = platform.h + "px";
        platformElement.style.background = "linear-gradient(#666, #333)";
        gameWorld.appendChild(platformElement);
    });

    // Draw obstacles (barriers)
    barriers.forEach(barrier => {
        const barrierElement = document.createElement("div");
        barrierElement.className = `barrier barrier-${barrier.type}`;
        barrierElement.style.left = barrier.x + "px";
        barrierElement.style.top = barrier.y + "px";
        barrierElement.style.width = barrier.w + "px";
        barrierElement.style.height = barrier.h + "px";
        
        if (barrier.type === "crystal") {
            barrierElement.style.boxShadow = "0 0 15px #3b82f6";
            barrierElement.style.clipPath = "polygon(50% 0%, 100% 20%, 80% 100%, 20% 100%, 0% 20%)";
        } else if (barrier.type === "crate") {
            barrierElement.innerHTML = '<div style="border: 4px solid #451a03; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#451a03; font-weight:bold;">X</div>';
        } else if (barrier.type === "spikes") {
            barrierElement.style.background = "transparent";
            barrierElement.style.border = "none";
            barrierElement.style.boxShadow = "none";
            barrierElement.innerHTML = '<div style="width:100%; height:100%; display:flex; gap:2px;">' + 
                '<div style="flex:1; background:#94a3b8; clip-path:polygon(50% 0%, 100% 100%, 0% 100%)"></div>'.repeat(3) + 
                '</div>';
        }
        
        gameWorld.appendChild(barrierElement);
    });

    // Move the camera to follow the dragon
    const viewportWidth = viewport.clientWidth;
    let cameraX = dragon.x - viewportWidth / 2;
    // Keep camera within level bounds
    cameraX = Math.max(0, Math.min(worldWidth - viewportWidth, cameraX));
    
    // Calculate screen shake
    let shakeX = (Math.random() - 0.5) * screenShakeAmount;
    let shakeY = (Math.random() - 0.5) * screenShakeAmount;
    gameWorld.style.transform = `translateX(${-cameraX + shakeX}px) translateY(${shakeY}px)`;

    // Draw visual effect particles
    visualParticles.forEach(particle => {
        const particleElement = document.createElement("div");
        particleElement.style.position = "absolute";
        particleElement.style.left = particle.x + "px";
        particleElement.style.top = particle.y + "px";
        particleElement.style.width = (2 + Math.random()*3) + "px";
        particleElement.style.height = (2 + Math.random()*3) + "px";
        particleElement.style.backgroundColor = particle.color;
        particleElement.style.opacity = particle.life / particle.maxLife;
        particleElement.style.borderRadius = "50%";
        particleElement.style.pointerEvents = "none";
        gameWorld.appendChild(particleElement);
    });

    // Draw the exit gate
    const gateElement = document.createElement("div");
    gateElement.className = "sprite sprite-gate";
    gateElement.style.left = castleGateX + "px";
    gateElement.style.bottom = "50px";
    gateElement.innerHTML = `<div style="width:120px;height:180px;background:#331a00;border:6px solid #1a1a1a;border-radius:60px 60px 0 0;box-shadow: 0 0 50px rgba(0,0,0,0.8)"></div>`;
    gameWorld.appendChild(gateElement);

    // Draw Characters
    createGameSprite(princess.x, princess.y, "sprite-princess", generatePrincessGraphics());
    
    enemyCharacters.forEach(enemy => { 
        if (enemy.alive) {
            createGameSprite(enemy.x, enemy.y + Math.sin(enemy.bobbingValue) * 5, "sprite-npc", generateGuardGraphics()); 
        }
    });

    // Draw Dragon with a slight breathing animation
    const breathingOffset = Math.sin(dragon.animationFrame * 0.1) * 3;
    const dragonSprite = createGameSprite(dragon.x, dragon.y + breathingOffset, "sprite-dragon", generateDragonGraphics());
    // Flip dragon model based on movement direction
    if (dragon.viewDirection === -1) dragonSprite.style.transform = "scaleX(-1)";

    // Draw Fireballs
    fireballs.forEach(fireball => {
        const fireballElement = document.createElement("div");
        fireballElement.className = "sprite-fire";
        fireballElement.style.left = fireball.x + "px";
        fireballElement.style.top = (fireball.y + 20) + "px";
        // Flickering size
        const fireballSize = 20 + Math.sin(dragon.animationFrame * 0.5) * 8;
        fireballElement.style.width = fireballSize + "px"; 
        fireballElement.style.height = fireballSize + "px";
        fireballElement.style.boxShadow = `0 0 ${10+screenShakeAmount}px #ff4500`;
        gameWorld.appendChild(fireballElement);
    });

    // Update status text
    if (!isGameOver) {
        statusDisplay.textContent = `Points: ${scorePoints} | Defenders Remaining: ${enemyCharacters.filter(e=>e.alive).length} | Distance to Gate: ${Math.max(0, Math.round(castleGateX - princess.x))}m`;
    }
  }

  // Helper function to add a character or object to the world
  function createGameSprite(x, y, className, graphicsCanvas) {
    const spriteContainer = document.createElement("div");
    spriteContainer.className = "sprite " + className;
    spriteContainer.style.left = x + "px";
    spriteContainer.style.top = y + "px";
    spriteContainer.appendChild(graphicsCanvas);
    gameWorld.appendChild(spriteContainer);
    return spriteContainer;
  }

  // --- Graphics Generation Functions (Drawing on Canvas) ---

  function generateDragonGraphics() {
    const canvas = document.createElement("canvas"); canvas.width = 100; canvas.height = 100;
    const ctx = canvas.getContext("2d");
    
    ctx.fillStyle = "#22c55e"; // Green body
    ctx.fillRect(20, 50, 60, 30); // Body
    ctx.fillRect(60, 25, 30, 30); // Neck/Head
    ctx.fillRect(5, 60, 15, 15); // Tail
    
    ctx.fillStyle = "#166534"; // Darker green wings
    ctx.fillRect(30, 30, 20, 20);

    ctx.fillStyle = "#000"; // Angry brows
    ctx.fillRect(65, 30, 25, 4);
    
    ctx.fillStyle = "#ef4444"; // Glowing red eyes
    ctx.fillRect(70, 38, 6, 6);
    ctx.fillRect(85, 38, 6, 6);
    
    ctx.fillStyle = "#f8fafc"; // Horns
    ctx.fillRect(65, 15, 6, 10);
    ctx.fillRect(85, 15, 6, 10);

    return canvas;
  }

  function generateGuardGraphics() {
    const canvas = document.createElement("canvas"); canvas.width = 48; canvas.height = 48;
    const ctx = canvas.getContext("2d");
    
    ctx.fillStyle = "#64748b"; // Steel body
    ctx.fillRect(14, 15, 20, 33);
    ctx.fillStyle = "#94a3b8"; // Helmet
    ctx.fillRect(12, 12, 24, 15);
    ctx.fillStyle = "#1e293b"; // Visor
    ctx.fillRect(15, 18, 18, 3);
    
    ctx.fillStyle = "#78350f"; // Spear wood
    ctx.fillRect(38, 10, 4, 38);
    ctx.fillStyle = "#cbd5e1"; // Spear point
    ctx.fillRect(36, 0, 8, 10);
    return canvas;
  }

  function generatePrincessGraphics() {
    const canvas = document.createElement("canvas"); canvas.width = 48; canvas.height = 48;
    const ctx = canvas.getContext("2d");
    
    ctx.fillStyle = "#ec4899"; // Pink dress
    ctx.fillRect(10, 25, 28, 23);
    ctx.fillStyle = "#fde68a"; // Blonde hair
    ctx.fillRect(12, 8, 24, 17);
    ctx.fillStyle = "#fef3c7"; // Face
    ctx.fillRect(18, 12, 12, 12);
    
    ctx.fillStyle = "#eab308"; // Golden crown
    ctx.fillRect(16, 4, 16, 4);
    return canvas;
  }

  // --- Input Handling ---

  window.addEventListener("keydown", event => { 
    activeKeys[event.key] = true; 
    // Press Space to breathe fire
    if (event.key === " ") breatheFire(); 
  });
  window.addEventListener("keyup", event => { 
    activeKeys[event.key] = false; 
  });

  function breatheFire() {
    if (isGameOver) return;
    // Create a new fireball moving in the direction the dragon is facing
    fireballs.push({ 
        x: dragon.x + (dragon.viewDirection === 1 ? 80 : -20), 
        y: dragon.y + 30, 
        velocityX: dragon.viewDirection * 15, 
        life: 60 
    });
  }

  // Listen for button clicks
  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", () => { 
    clearInterval(gameUpdateLoop); 
    introScreen.hidden = false; 
    gameArea.hidden = true; 
  });
  helpButton.addEventListener("click", () => {
    alert("Controls:\n- Arrow Keys: Move & Jump\n- Space: Breathe Fire\n\nGoal:\nStop the princess and the defenders from reaching the tower gate!");
  });

})();
