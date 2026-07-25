import { useState, useEffect, useRef, useCallback } from 'react'
import { startBgm, stopBgm, playJumpSound, initAudio } from './utils/audio'

function App() {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [finalScores, setFinalScores] = useState({ distance: 0, obstacle: 0, total: 0 })
  const [isGameRunning, setIsGameRunning] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [stage, setStage] = useState(1)
  const [isStageClear, setIsStageClear] = useState(false)
  
  // 환경 변수 로드
  const INITIAL_SPEED = Number(import.meta.env.VITE_GAME_INITIAL_SPEED) || 10
  const SPEED_INCREMENT_RATE = Number(import.meta.env.VITE_GAME_SPEED_INCREMENT_RATE) || 1.05
  const SCORE_MULTIPLIER_INCREMENT_RATE = Number(import.meta.env.VITE_GAME_SCORE_MULTIPLIER_INCREMENT_RATE) || 1.1
  
  const PENGUIN_SPEED = Number(import.meta.env.VITE_PENGUIN_SPEED) || 7
  const PENGUIN_JUMP_STRENGTH = Number(import.meta.env.VITE_PENGUIN_JUMP_STRENGTH) || 18
  const PENGUIN_GRAVITY = Number(import.meta.env.VITE_PENGUIN_GRAVITY) || 1.2
  
  const OBSTACLE_SPAWN_CHANCE_BASE = Number(import.meta.env.VITE_OBSTACLE_SPAWN_CHANCE_BASE) || 0.03
  const OBSTACLE_SPAWN_CHANCE_SPEED_FACTOR = Number(import.meta.env.VITE_OBSTACLE_SPAWN_CHANCE_SPEED_FACTOR) || 0.001
  
  const SCORE_DISTANCE_DIVISOR = Number(import.meta.env.VITE_SCORE_DISTANCE_DIVISOR) || 50
  const SCORE_OBSTACLE_BASE = Number(import.meta.env.VITE_SCORE_OBSTACLE_BASE) || 10
  
  const STAGE_TARGET_SCORE_BASE = Number(import.meta.env.VITE_STAGE_TARGET_SCORE_BASE) || 500

  // 게임 상태 Refs (렌더링 없이 값 유지)
  const gameState = useRef({
    score: 0,
    lastRenderedScore: 0,
    distance: 0,
    obstacleScore: 0,
    speed: 5,
    scoreMultiplier: 1,
    obstacles: [],
    penguin: {
      x: 0, y: 0, width: 50, height: 70, color: '#000000',
      dx: 0, speed: PENGUIN_SPEED, wobble: 0, wobbleDirection: 1,
      jumpY: 0, jumpVy: 0, isJumping: false, jumpStrength: PENGUIN_JUMP_STRENGTH, gravity: PENGUIN_GRAVITY
    },
    mountains: [],
    clouds: [],
    bgZOffset: 0,
    currentCurve: 0,
    targetCurve: 0,
    curveTimer: 0,
    horizonY: 0,
    isUpPressed: false,
    animationId: null,
    envSegments: [], 
    lastGeneratedZ: 0,
    targetScore: STAGE_TARGET_SCORE_BASE
  })

  // 상수
  const MAX_Z = 3000
  const FOV = 300
  const ROAD_WIDTH = 1500

  // 초기화 함수
  const initGame = useCallback((resetStage = true) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 산 초기화
    const mountains = []
    for (let i = 0; i < 15; i++) {
      mountains.push({
        x: Math.random() * 3000 - 1000,
        y: 0,
        w: Math.random() * 400 + 200,
        h: Math.random() * 150 + 50,
        color: Math.random() > 0.5 ? '#B2EBF2' : '#E0F7FA'
      })
    }

    // 구름 초기화
    const clouds = []
    for (let i = 0; i < 8; i++) {
      clouds.push({
        x: Math.random() * 2000,
        y: Math.random() * 200,
        w: Math.random() * 80 + 40,
        speed: Math.random() * 0.2 + 0.05
      })
    }

    const initialSegments = [{ start: 0, end: 3000, type: 0 }];

    // 스테이지 리셋 여부에 따라 초기값 설정
    const currentStage = resetStage ? 1 : gameState.current.stage + 1;
    const currentSpeed = resetStage ? INITIAL_SPEED : gameState.current.speed * SPEED_INCREMENT_RATE;
    const currentMultiplier = resetStage ? 1 : gameState.current.scoreMultiplier * SCORE_MULTIPLIER_INCREMENT_RATE;
    
    // 점수는 스테이지 넘어가도 유지
    const currentScore = resetStage ? 0 : gameState.current.score;
    const currentDistance = resetStage ? 0 : gameState.current.distance;
    const currentObstacleScore = resetStage ? 0 : gameState.current.obstacleScore;

    gameState.current = {
      ...gameState.current,
      score: currentScore,
      lastRenderedScore: currentScore,
      distance: currentDistance,
      obstacleScore: currentObstacleScore,
      speed: currentSpeed,
      scoreMultiplier: currentMultiplier,
      obstacles: [],
      mountains,
      clouds,
      bgZOffset: 0,
      currentCurve: 0,
      targetCurve: 0,
      curveTimer: 0,
      envSegments: initialSegments,
      lastGeneratedZ: 3000 + currentDistance, // 현재 거리 기준으로 생성
      stage: currentStage,
      targetScore: currentScore + (STAGE_TARGET_SCORE_BASE * currentStage), // 목표 점수 누적
      penguin: {
        ...gameState.current.penguin,
        x: canvas.width / 2 - 25, 
        wobble: 0,
        jumpY: 0,
        isJumping: false,
        dx: 0,
        speed: PENGUIN_SPEED,
        jumpStrength: PENGUIN_JUMP_STRENGTH,
        gravity: PENGUIN_GRAVITY
      }
    }
    
    setScore(currentScore)
    setStage(currentStage)
    resize()
  }, [INITIAL_SPEED, PENGUIN_SPEED, PENGUIN_JUMP_STRENGTH, PENGUIN_GRAVITY, STAGE_TARGET_SCORE_BASE, SPEED_INCREMENT_RATE, SCORE_MULTIPLIER_INCREMENT_RATE])

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    
    const horizonY = canvas.height * 0.4
    gameState.current.horizonY = horizonY
    gameState.current.penguin.y = canvas.height - 150
    
    if (!isGameRunning) {
      gameState.current.penguin.x = canvas.width / 2 - gameState.current.penguin.width / 2
    }
    
    gameState.current.mountains.forEach(mt => { mt.y = horizonY })
  }, [isGameRunning])

  useEffect(() => {
    window.addEventListener('resize', resize)
    resize()
    requestAnimationFrame(drawFrame)
    return () => window.removeEventListener('resize', resize)
  }, [resize])

  const startGame = () => {
    initAudio()
    initGame(true) // 처음부터 시작
    setIsGameRunning(true)
    setIsGameOver(false)
    setIsStageClear(false)
    startBgm()
    
    if (gameState.current.animationId) cancelAnimationFrame(gameState.current.animationId)
    gameState.current.animationId = requestAnimationFrame(gameLoop)
  }

  const nextStage = () => {
    initGame(false) // 다음 스테이지로
    setIsGameRunning(true)
    setIsStageClear(false)
    startBgm()
    
    if (gameState.current.animationId) cancelAnimationFrame(gameState.current.animationId)
    gameState.current.animationId = requestAnimationFrame(gameLoop)
  }

  const gameOver = () => {
    setIsGameRunning(false)
    setIsGameOver(true)
    stopBgm()
    cancelAnimationFrame(gameState.current.animationId)
    
    const distanceScore = Math.floor(gameState.current.distance / SCORE_DISTANCE_DIVISOR)
    const obstacleScore = gameState.current.obstacleScore
    setFinalScores({
        distance: distanceScore,
        obstacle: obstacleScore,
        total: distanceScore + obstacleScore
    })
  }

  const stageClear = () => {
    setIsGameRunning(false)
    setIsStageClear(true)
    stopBgm() // 혹은 클리어 효과음 재생
    cancelAnimationFrame(gameState.current.animationId)
  }

  const increaseSpeed = () => {
    if (isGameRunning) {
      // 수동 속도 증가는 스테이지 시스템에서는 제거하거나 보너스로 유지
      // 여기서는 스테이지 클리어 시에만 속도가 증가하도록 변경하므로 주석 처리하거나
      // 일시적인 부스트 기능으로 변경 가능. 일단 유지하되 스테이지 밸런스에 영향 줄 수 있음.
      gameState.current.speed *= 1.05
    }
  }

  const jump = () => {
    const { penguin } = gameState.current
    if (!penguin.isJumping && isGameRunning) {
      penguin.isJumping = true
      penguin.jumpVy = penguin.jumpStrength
      playJumpSound()
    }
  }

  // --- 게임 로직 헬퍼 함수들 ---

  const createObstacle = () => {
    const trackX = (Math.random() * 0.9) - 0.45; 
    const type = Math.random() < 0.7 ? 0 : 1 

    let width, height;
    let points = [];

    if (type === 0) { // 구멍
        width = 150 + Math.random() * 150;
        height = 40 + Math.random() * 30;
        
        const numPoints = 10 + Math.floor(Math.random() * 5);
        let angle = 0;
        for (let i = 0; i < numPoints; i++) {
            angle += (Math.PI * 2) / numPoints;
            const r = 0.4 + Math.random() * 0.6; 
            points.push({ 
                xFactor: Math.cos(angle) * r, 
                yFactor: Math.sin(angle) * r,
                r: r 
            });
        }
    } else { // 빙산
        width = 80 + Math.random() * 100;
        height = 80 + Math.random() * 80;
    }

    gameState.current.obstacles.push({
      trackX: trackX,
      z: MAX_Z,
      width: width,
      height: height,
      type: type,
      color: type === 0 ? '#000000' : '#E0F7FA',
      points: points
    })
  }

  const getCurveOffset = (z) => {
    const t = z / MAX_Z
    return gameState.current.currentCurve * t * t
  }

  // --- 그리기 함수들 ---

  const drawBackground = (ctx, canvas) => {
    const { horizonY, currentCurve, bgZOffset, mountains, clouds, envSegments, distance } = gameState.current
    const centerX = canvas.width / 2

    // 하늘
    ctx.fillStyle = '#87CEEB'
    ctx.fillRect(0, 0, canvas.width, horizonY)

    // 구름
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    clouds.forEach(cloud => {
      if (isGameRunning) {
        cloud.x -= cloud.speed
        if (cloud.x + cloud.w < 0) cloud.x = canvas.width + 50
      }
      ctx.beginPath()
      ctx.ellipse(cloud.x, cloud.y, cloud.w, cloud.w * 0.6, 0, 0, Math.PI * 2)
      ctx.fill()
    })

    // 산
    const parallaxX = currentCurve * 0.3
    const mountainRange = 3000
    mountains.forEach(mt => {
      let drawX = mt.x - parallaxX
      drawX = (drawX % mountainRange + mountainRange) % mountainRange - 1000
      ctx.fillStyle = mt.color
      ctx.beginPath()
      ctx.moveTo(drawX, mt.y)
      ctx.lineTo(drawX + mt.w / 2, mt.y - mt.h)
      ctx.lineTo(drawX + mt.w, mt.y)
      ctx.closePath()
      ctx.fill()
      
      // 산 그림자
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.beginPath()
      ctx.moveTo(drawX + mt.w / 2, mt.y - mt.h)
      ctx.lineTo(drawX + mt.w, mt.y)
      ctx.lineTo(drawX + mt.w / 2, mt.y)
      ctx.closePath()
      ctx.fill()
    })

    // 도로 및 배경 땅 그리기
    const segmentLength = 50
    
    ctx.beginPath(); 
    const borderPath = new Path2D();
    const lanePath = new Path2D();

    for (let z = MAX_Z; z > 0; z -= segmentLength) {
      const zFar = z
      const zNear = z - segmentLength
      const scaleFar = FOV / (FOV + zFar)
      const scaleNear = FOV / (FOV + zNear)
      const yFar = horizonY + (canvas.height - horizonY) * scaleFar
      const yNear = horizonY + (canvas.height - horizonY) * scaleNear
      
      if (yNear < horizonY || yFar > canvas.height) continue

      const wFar = ROAD_WIDTH * scaleFar
      const wNear = ROAD_WIDTH * scaleNear
      const xOffsetFar = getCurveOffset(zFar)
      const xOffsetNear = getCurveOffset(zNear)
      const centerFar = centerX + xOffsetFar
      const centerNear = centerX + xOffsetNear

      const worldZ = distance + z;
      const segment = envSegments.find(s => s.start <= worldZ && s.end > worldZ);
      const envType = segment ? segment.type : 0; 

      // 왼쪽 땅
      ctx.fillStyle = (envType === 1) ? '#1E90FF' : '#F0F8FF'; 
      ctx.beginPath();
      ctx.moveTo(0, yFar);
      ctx.lineTo(centerFar - wFar/2, yFar);
      ctx.lineTo(centerNear - wNear/2, yNear);
      ctx.lineTo(0, yNear);
      ctx.fill();

      // 오른쪽 땅
      ctx.fillStyle = (envType === 2) ? '#1E90FF' : '#F0F8FF'; 
      ctx.beginPath();
      ctx.moveTo(centerFar + wFar/2, yFar);
      ctx.lineTo(canvas.width, yFar);
      ctx.lineTo(canvas.width, yNear);
      ctx.lineTo(centerNear + wNear/2, yNear);
      ctx.fill();

      // 도로 바닥
      ctx.fillStyle = (Math.floor((z - bgZOffset) / 200) % 2 === 0) ? '#FFFFFF' : '#F8F8FF'
      ctx.beginPath()
      ctx.moveTo(centerFar - wFar/2, yFar)
      ctx.lineTo(centerFar + wFar/2, yFar)
      ctx.lineTo(centerNear + wNear/2, yNear)
      ctx.lineTo(centerNear - wNear/2, yNear)
      ctx.fill()

      borderPath.moveTo(centerFar - wFar/2, yFar)
      borderPath.lineTo(centerNear - wNear/2, yNear)
      borderPath.moveTo(centerFar + wFar/2, yFar)
      borderPath.lineTo(centerNear + wNear/2, yNear)

      const laneWFar = wFar / 3
      const laneWNear = wNear / 3
      lanePath.moveTo(centerFar - laneWFar/2, yFar)
      lanePath.lineTo(centerNear - laneWNear/2, yNear)
      lanePath.moveTo(centerFar + laneWFar/2, yFar)
      lanePath.lineTo(centerNear + laneWNear/2, yNear)
    }

    ctx.strokeStyle = '#00BFFF'
    ctx.lineWidth = 2
    ctx.stroke(borderPath)

    ctx.strokeStyle = 'rgba(0, 191, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.stroke(lanePath)
  }

  const drawObstacles = (ctx, canvas) => {
    const { horizonY, obstacles } = gameState.current
    const centerX = canvas.width / 2

    obstacles.forEach(obs => {
      const scale = FOV / (FOV + obs.z)
      const groundHeight = canvas.height - horizonY
      const screenY = horizonY + groundHeight * scale
      const curveOffset = getCurveOffset(obs.z)
      const screenX = (centerX + curveOffset) + (obs.trackX * ROAD_WIDTH) * scale
      const screenW = obs.width * scale
      const screenH = obs.height * scale

      obs.screenX = screenX
      obs.screenY = screenY
      obs.screenW = screenW
      obs.screenH = screenH

      if (obs.type === 0) { // 구멍
        ctx.fillStyle = '#000000'
        ctx.beginPath()
        const radiusX = screenW / 2
        const radiusY = screenH / 2
        const centerY = screenY - screenH / 2

        if (obs.points && obs.points.length > 0) {
            obs.points.forEach((pt, i) => {
                const px = screenX + pt.xFactor * radiusX;
                const py = centerY + pt.yFactor * radiusY;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
        } else {
            ctx.ellipse(screenX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        }

        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle = '#E0F7FA'
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.beginPath()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
        if (obs.points) {
            obs.points.forEach((pt, i) => {
                if (i % 2 === 0) { 
                    const px = screenX + pt.xFactor * radiusX;
                    const py = centerY + pt.yFactor * radiusY;
                    const crackX = screenX + pt.xFactor * radiusX * (1 + 0.3/pt.r);
                    const crackY = centerY + pt.yFactor * radiusY * (1 + 0.3/pt.r);
                    ctx.moveTo(px, py);
                    ctx.lineTo(crackX, crackY);
                }
            })
        }
        ctx.stroke()

      } else { // 빙산
        ctx.fillStyle = '#E0F7FA'
        ctx.beginPath()
        ctx.moveTo(screenX - screenW/2, screenY)
        ctx.lineTo(screenX - screenW/4, screenY - screenH)
        ctx.lineTo(screenX + screenW/4, screenY - screenH)
        ctx.lineTo(screenX + screenW/2, screenY)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = '#B2EBF2'
        ctx.beginPath()
        ctx.moveTo(screenX, screenY - screenH)
        ctx.lineTo(screenX + screenW/4, screenY - screenH)
        ctx.lineTo(screenX + screenW/2, screenY)
        ctx.lineTo(screenX, screenY)
        ctx.closePath()
        ctx.fill()
      }
    })
  }

  const drawPenguin = (ctx) => {
    const { penguin, speed } = gameState.current
    ctx.save()

    const bounceSpeed = Math.max(100 - (speed * 2), 20)
    const bounce = Math.abs(Math.sin(Date.now() / bounceSpeed)) * 5
    const drawY = penguin.y - bounce - penguin.jumpY
    const centerX = penguin.x + penguin.width / 2
    const centerY = drawY + penguin.height

    if (penguin.isJumping) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.beginPath()
      const shadowScale = Math.max(0.5, 1 - penguin.jumpY / 200)
      ctx.ellipse(centerX, penguin.y + penguin.height, 20 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.translate(centerX, centerY)
    ctx.rotate(penguin.wobble * Math.PI / 180)
    ctx.translate(-centerX, -centerY)

    ctx.fillStyle = penguin.color
    ctx.beginPath()
    ctx.ellipse(penguin.x + penguin.width/2, drawY + penguin.height/2, penguin.width/2, penguin.height/2, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = penguin.color
    ctx.beginPath()
    ctx.moveTo(penguin.x + penguin.width/2 - 10, drawY + penguin.height - 15)
    ctx.lineTo(penguin.x + penguin.width/2 + 10, drawY + penguin.height - 15)
    ctx.lineTo(penguin.x + penguin.width/2, drawY + penguin.height + 5)
    ctx.fill()

    const walkCycle = penguin.isJumping ? 0 : Math.sin(Date.now() / bounceSpeed)
    const leftFootY = drawY + penguin.height + (walkCycle > 0 ? -3 : 0)
    const rightFootY = drawY + penguin.height + (walkCycle < 0 ? -3 : 0)

    ctx.fillStyle = '#FFA500'
    ctx.beginPath()
    ctx.ellipse(penguin.x + 10, leftFootY, 8, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(penguin.x + penguin.width - 10, rightFootY, 8, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    const wingAngle = penguin.isJumping ? 0.5 : Math.sin(Date.now() / (bounceSpeed/2)) * 0.2
    ctx.fillStyle = penguin.color
    
    ctx.save()
    ctx.translate(penguin.x, drawY + 30)
    ctx.rotate(Math.PI / 4 + wingAngle)
    ctx.beginPath()
    ctx.ellipse(0, 0, 6, 18, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.translate(penguin.x + penguin.width, drawY + 30)
    ctx.rotate(-Math.PI / 4 - wingAngle)
    ctx.beginPath()
    ctx.ellipse(0, 0, 6, 18, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.restore()
  }

  const gameLoop = () => {
    if (!isGameRunning) return 
    
    update()
    gameState.current.animationId = requestAnimationFrame(gameLoop)
  }

  const update = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const state = gameState.current
    const { penguin } = state

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    state.bgZOffset += state.speed
    if (state.bgZOffset >= 200) state.bgZOffset -= 200

    state.distance += state.speed
    const distanceScore = Math.floor(state.distance / SCORE_DISTANCE_DIVISOR)
    
    state.score = distanceScore + state.obstacleScore
    
    if (state.score !== state.lastRenderedScore) {
        setScore(state.score)
        state.lastRenderedScore = state.score
    }

    // 스테이지 클리어 체크
    if (state.score >= state.targetScore) {
        stageClear()
        return // 루프 중단
    }

    if (state.envSegments.length > 0 && state.envSegments[0].end < state.distance - 100) {
        state.envSegments.shift();
    }

    while (state.lastGeneratedZ < state.distance + MAX_Z + 1000) {
        const startZ = state.lastGeneratedZ;
        const length = 2000 + Math.random() * 3000; 
        const endZ = startZ + length;
        
        const rand = Math.random();
        let type = 0;
        if (rand < 0.5) type = 0;
        else if (rand < 0.75) type = 1;
        else type = 2;

        state.envSegments.push({ start: startZ, end: endZ, type: type });
        state.lastGeneratedZ = endZ;
    }

    state.curveTimer++
    if (state.curveTimer > 300) {
      state.targetCurve = (Math.random() - 0.5) * 3000
      state.curveTimer = 0
    }
    state.currentCurve += (state.targetCurve - state.currentCurve) * 0.005

    drawBackground(ctx, canvas)

    penguin.x += penguin.dx
    
    const centerX = canvas.width / 2
    const roadHalfWidth = ROAD_WIDTH / 2
    const padding = 20 
    
    const minX = Math.max(0, centerX - roadHalfWidth + padding)
    const maxX = Math.min(canvas.width - penguin.width, centerX + roadHalfWidth - penguin.width - padding)

    if (penguin.x < minX) penguin.x = minX
    if (penguin.x > maxX) penguin.x = maxX

    if (penguin.isJumping) {
      penguin.jumpY += penguin.jumpVy
      penguin.jumpVy -= penguin.gravity
      if (penguin.jumpY <= 0) {
        penguin.jumpY = 0;
        penguin.isJumping = false;
      }
    }

    if (penguin.dx !== 0 && !penguin.isJumping) {
      penguin.wobble += 3 * penguin.wobbleDirection
      if (penguin.wobble > 15 || penguin.wobble < -15) {
        penguin.wobbleDirection *= -1
      }
    } else {
      penguin.wobble *= 0.8
    }

    if (Math.random() < OBSTACLE_SPAWN_CHANCE_BASE + (state.speed * OBSTACLE_SPAWN_CHANCE_SPEED_FACTOR)) {
      createObstacle()
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      let obs = state.obstacles[i]
      obs.z -= state.speed

      if (obs.z < -100) {
        state.obstacles.splice(i, 1)
        state.obstacleScore += Math.round(SCORE_OBSTACLE_BASE * state.scoreMultiplier)
        // 스테이지 시스템에서는 자동 속도 증가 제거 (스테이지 클리어 시 증가)
        // if (state.score % 100 === 0) state.speed += 1
      }
    }

    state.obstacles.sort((a, b) => b.z - a.z)
    drawObstacles(ctx, canvas)

    state.obstacles.forEach(obs => {
      if (obs.z < 50 && obs.z > -50) {
        const obsLeft = obs.screenX - obs.screenW/2
        const obsRight = obs.screenX + obs.screenW/2
        const pLeft = penguin.x + 10
        const pRight = penguin.x + penguin.width - 10

        if (pRight > obsLeft && pLeft < obsRight) {
          if (obs.type === 0) { 
             if (penguin.jumpY <= 40) gameOver()
          } else { 
             gameOver()
          }
        }
      }
    })

    drawPenguin(ctx)
  }
  
  const drawFrame = () => {
      const canvas = canvasRef.current
      if(!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawBackground(ctx, canvas)
      drawPenguin(ctx)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      const { penguin } = gameState.current
      if (e.key === 'ArrowLeft') {
        penguin.dx = -penguin.speed
      } else if (e.key === 'ArrowRight') {
        penguin.dx = penguin.speed
      } else if (e.key === 'ArrowUp') {
        if (!gameState.current.isUpPressed) {
          increaseSpeed()
          gameState.current.isUpPressed = true
        }
      } else if (e.key === ' ') {
        jump()
      }
    }

    const handleKeyUp = (e) => {
      const { penguin } = gameState.current
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        penguin.dx = 0
      } else if (e.key === 'ArrowUp') {
        gameState.current.isUpPressed = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isGameRunning]) 

  const handleTouchStart = (e) => {
    if (!isGameRunning) return
    
    const touchX = e.touches[0].clientX
    const touchY = e.touches[0].clientY
    const { penguin } = gameState.current
    
    const pLeft = penguin.x
    const pRight = penguin.x + penguin.width
    const pTop = penguin.y - penguin.jumpY
    const pBottom = penguin.y + penguin.height - penguin.jumpY

    if (touchX > pLeft - 50 && touchX < pRight + 50 &&
        touchY > pTop - 50 && touchY < pBottom + 50) {
        jump()
        return
    }

    const halfWidth = window.innerWidth / 2
    if (touchX < halfWidth) {
        penguin.dx = -penguin.speed
    } else {
        penguin.dx = penguin.speed
    }
  }

  const handleTouchEnd = (e) => {
    if (!isGameRunning) return
    if (e.touches.length === 0) {
        gameState.current.penguin.dx = 0
    }
  }

  useEffect(() => {
      if (isGameRunning) {
          gameState.current.animationId = requestAnimationFrame(gameLoop)
      }
      return () => cancelAnimationFrame(gameState.current.animationId)
  }, [isGameRunning])


  return (
    <div 
        id="gameContainer" 
        onTouchStart={handleTouchStart} 
        onTouchEnd={handleTouchEnd}
    >
        <canvas ref={canvasRef} id="gameCanvas"></canvas>
        <div id="scoreBoard">
            Stage: {stage} | Score: {score} / {gameState.current.targetScore}
        </div>
        
        {(!isGameRunning) && (
            <div id="startMsg" onClick={isStageClear ? nextStage : startGame}>
                {isGameOver ? (
                    <>
                        게임 오버!<br/>
                        <div style={{fontSize: '24px', margin: '10px 0'}}>
                            최종 점수: {finalScores.total}<br/>
                            <span style={{fontSize: '16px', color: '#555'}}>
                                (거리: {finalScores.distance} + 장애물: {finalScores.obstacle})
                            </span>
                        </div>
                        <span style={{fontSize:'16px'}}>클릭하여 다시 시작</span>
                    </>
                ) : isStageClear ? (
                    <>
                        스테이지 {stage} 클리어!<br/>
                        <div style={{fontSize: '24px', margin: '10px 0'}}>
                            현재 점수: {score}<br/>
                        </div>
                        <span style={{fontSize:'16px'}}>클릭하여 다음 스테이지로</span>
                    </>
                ) : (
                    <>
                        클릭하여 시작<br/>
                        <span style={{fontSize:'20px'}}>(이동: 방향키/터치, 점프: 스페이스/펭귄터치)</span>
                    </>
                )}
            </div>
        )}

        {isGameRunning && (
            <div 
                id="speedBtn" 
                onTouchStart={(e) => { e.stopPropagation(); increaseSpeed(); }}
                onMouseDown={(e) => { e.stopPropagation(); increaseSpeed(); }}
                style={{display: 'flex'}}
            >
                SPEED<br/>UP!
            </div>
        )}
    </div>
  )
}

export default App