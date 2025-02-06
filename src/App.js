import React, { useState, useEffect, useRef } from 'react';
import { Analytics } from "@vercel/analytics/react";

// Updated game dimensions
const GAME_WIDTH = 1500;
const GAME_HEIGHT = 400;
const DINO_WIDTH = 50;
const DINO_HEIGHT = 50;
const DINO_LEFT = 50; // Fixed horizontal position for the dino
const OBSTACLE_WIDTH = 30;
const OBSTACLE_HEIGHT = 50;

// Physics and speed parameters for each planet.
const planetConfigs = {
  Earth: { gravity: 0.8, jumpSpeed: 15 },
  Moon: { gravity: 0.2, jumpSpeed: 12 },
  Mars: { gravity: 0.5, jumpSpeed: 14 },
  Jupiter: { gravity: 1.2, jumpSpeed: 18 }
};

// Obstacle spawn delay range (in milliseconds)
const MIN_OBSTACLE_DELAY = 1100;
const MAX_OBSTACLE_DELAY = 2500;

// Initial game speed (pixels per update)
const INITIAL_GAME_SPEED = 5;

function App() {
  // Game state: "ready", "playing", or "gameOver"
  const [gameStatus, setGameStatus] = useState("ready");
  const [obstacles, setObstacles] = useState([]);
  const [dinoBottom, setDinoBottom] = useState(0);
  const [isJumping, setIsJumping] = useState(false);

  // Planet selection (default Earth)
  const [selectedPlanet, setSelectedPlanet] = useState("Earth");

  // Game speed and score states
  const [gameSpeed, setGameSpeed] = useState(INITIAL_GAME_SPEED);
  const [score, setScore] = useState(0);

  // Refs for timeouts/intervals so we can clear them on game restart/planet change.
  const gameLoopIntervalId = useRef(null);
  const obstacleTimeoutId = useRef(null);
  const jumpIntervalId = useRef(null);

  // Ref to always have the current dinoBottom (for collision detection)
  const dinoBottomRef = useRef(dinoBottom);
  useEffect(() => {
    dinoBottomRef.current = dinoBottom;
  }, [dinoBottom]);

  // Reset game state and physics parameters.
  const resetGame = () => {
    clearInterval(gameLoopIntervalId.current);
    clearTimeout(obstacleTimeoutId.current);
    clearInterval(jumpIntervalId.current);
    setGameStatus("ready");
    setObstacles([]);
    setDinoBottom(0);
    setIsJumping(false);
    setScore(0);
    setGameSpeed(INITIAL_GAME_SPEED); // Reset to initial speed on game over/restart
  };
  
  // When the selected planet changes, reset the game.
  const handlePlanetChange = (e) => {
    setSelectedPlanet(e.target.value);
    e.target.blur();
    resetGame();
  };

  // Centralize action logic for starting, jumping, and restarting.
  const handleAction = () => {
    if (gameStatus === "ready") {
      startGame();
    } else if (gameStatus === "playing") {
      if (!isJumping) {
        startJump();
      }
    } else if (gameStatus === "gameOver") {
      resetGame();
    }
  };

  // Keydown listener to start game, jump, or restart after game over.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        handleAction();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStatus, isJumping]);

  // Start the game (transition from "ready" to "playing")
  const startGame = () => {
    setGameStatus("playing");
    spawnObstacle();
    startGameLoop();
  };

  // End the game on collision.
  const gameOver = () => {
    setGameStatus("gameOver");
    clearInterval(gameLoopIntervalId.current);
    clearTimeout(obstacleTimeoutId.current);
    clearInterval(jumpIntervalId.current);
  };

  // Spawn obstacles recursively with a random delay.
  const spawnObstacle = () => {
    setObstacles(prev => [
      ...prev,
      { id: Date.now(), left: GAME_WIDTH, passed: false }
    ]);
    const nextDelay =
      Math.random() * (MAX_OBSTACLE_DELAY - MIN_OBSTACLE_DELAY) +
      MIN_OBSTACLE_DELAY;
    obstacleTimeoutId.current = setTimeout(spawnObstacle, nextDelay);
  };

  // Main game loop: update obstacle positions, perform collision detection, and increase speed.
  const startGameLoop = () => {
    gameLoopIntervalId.current = setInterval(() => {
      setObstacles(prevObstacles => {
        let passedCount = 0;
        const updatedObstacles = prevObstacles
          .map(obs => {
            const newLeft = obs.left - gameSpeed;
            // If an obstacle has passed the dino and hasn't been counted yet, mark it.
            if (!obs.passed && newLeft + OBSTACLE_WIDTH < DINO_LEFT) {
              passedCount++;
              return { ...obs, left: newLeft, passed: true };
            }
            return { ...obs, left: newLeft };
          })
          .filter(obs => obs.left + OBSTACLE_WIDTH > 0);

        // Increase score based on obstacles passed.
        if (passedCount > 0) {
          setScore(prevScore => prevScore + passedCount);
        }

        // Collision detection.
        updatedObstacles.forEach(obs => {
          if (
            obs.left < DINO_LEFT + DINO_WIDTH &&
            obs.left + OBSTACLE_WIDTH > DINO_LEFT &&
            dinoBottomRef.current < OBSTACLE_HEIGHT
          ) {
            gameOver();
          }
        });
        return updatedObstacles;
      });
    }, 20);
  };

  // Jump logic using the current planet's physics parameters.
  const startJump = () => {
    setIsJumping(true);
    const { jumpSpeed, gravity } = planetConfigs[selectedPlanet];
    let currentJumpSpeed = jumpSpeed;
    let lastTime = performance.now(); // Track the last frame time
  
    jumpIntervalId.current = setInterval(() => {
      const now = performance.now();
      const deltaTime = (now - lastTime) / 16.67; // Normalize to 60 FPS (16.67ms per frame)
      lastTime = now;
  
      setDinoBottom(prevBottom => {
        let newBottom = prevBottom + currentJumpSpeed * deltaTime;
        currentJumpSpeed -= gravity * deltaTime;
  
        if (newBottom <= 0) {
          newBottom = 0;
          setIsJumping(false);
          clearInterval(jumpIntervalId.current);
        }
        return newBottom;
      });
    }, 20);
  };
  
  useEffect(() => {
    if (gameStatus === "playing") {
      // Increase game speed using a logarithmic function.
      // Adjust the multiplier (here 5) to achieve your desired difficulty.
      setGameSpeed(INITIAL_GAME_SPEED + 5 * Math.log(score + 1));
    } else {
      // When not playing, ensure game speed stays at the initial value.
      setGameSpeed(INITIAL_GAME_SPEED);
    }
  }, [score, gameStatus]);  
  
  // Clean up intervals/timeouts if the component unmounts.
  useEffect(() => {
    return () => {
      clearInterval(gameLoopIntervalId.current);
      clearTimeout(obstacleTimeoutId.current);
      clearInterval(jumpIntervalId.current);
    };
  }, []);

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid black',
          backgroundColor: '#f7f7f7',
          margin: '0 auto'
        }}
        onTouchStart={handleAction}  // Allow mobile tap to trigger game actions
      >
        {/* Dino element */}
        <img
          src="/dino.png"
          alt="Dinosaur"
          style={{
            width: DINO_WIDTH,
            height: DINO_HEIGHT,
            position: 'absolute',
            left: DINO_LEFT,
            bottom: dinoBottom,
            objectFit: 'contain'
          }}
        />
  
        {/* Render obstacles as cactus images */}
        {obstacles.map(obs => (
          <img
            key={obs.id}
            src="/cactus.png"
            alt="Cactus"
            style={{
              width: OBSTACLE_WIDTH,
              height: OBSTACLE_HEIGHT,
              position: 'absolute',
              left: obs.left,
              bottom: 0,
              objectFit: 'contain'
            }}
          />
        ))}
  
        {/* Display game state messages */}
        {gameStatus === "ready" && (
          <div
            style={{
              position: 'absolute',
              top: '40%',
              width: '100%',
              textAlign: 'center',
              fontSize: '24px',
              color: '#333'
            }}
          >
            Press Space or Tap to Start
          </div>
        )}
        {gameStatus === "gameOver" && (
          <div
            style={{
              position: 'absolute',
              top: '40%',
              width: '100%',
              textAlign: 'center',
              fontSize: '24px',
              color: 'red'
            }}
          >
            Game Over! Press Space or Tap to Restart
          </div>
        )}
      </div>
  
      {/* Score and Planet Selector below the game view */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ fontSize: '28px', marginBottom: '10px', color: '#333' }}>
          Score: {score}
        </div>
        <select
          value={selectedPlanet}
          onChange={handlePlanetChange}
          style={{ fontSize: '24px', padding: '10px' }}
        >
          {Object.keys(planetConfigs).map(planet => (
            <option key={planet} value={planet}>
              {planet}
            </option>
          ))}
        </select>
      </div>
      <Analytics />
    </div>
  );
}
  
export default App;
