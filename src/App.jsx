import { useState, useEffect, useRef, useCallback } from 'react'
import { startBgm, stopBgm, playJumpSound, initAudio } from './utils/audio'

function App() {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [isGameRunning, setIsGameRunning] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  
  // 게임 상태 Refs (렌더링 없이 값 유지)
  const gameState = useRef({
    score: 0,
    speed: 5,
    scoreMultiplier: 1,
    obstacles: [],
    penguin: {
      x: 0, y: 0, width: 50, height: 70, color: '#000000',
      dx: 0, speed: 7, wobble: 0, wobbleDirection: 1,
      jumpY: 0, jumpVy: 0, isJumping: false, jumpStrength: 25, gravity: 1.5
    },
    mountains: [],
    clouds: [],
    bgZOffset: 0,
    currentCurve: 0,
    targetCurve: 0,
    curveTimer: 0,
    horizonY: 0,
    isUpPressed: false,
    animationId: null
  })

  // 상수
  const MAX_Z = 3000
  const FOV = 300
  const ROAD_WIDTH = 1500

  // 초기화 함수
  const initGame = useCallback(() => {
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

    gameState.current = {
      ...gameState.current,
      score: 0,
      speed: 10,
      scoreMultiplier: 1,
      obstacles: [],
      mountains,
      clouds,
      bgZOffset: 0,
      currentCurve: 0,
      targetCurve: 0,
      curveTimer: 0,
      penguin: {
        ...gameState.current.penguin,
        x: canvas.width / 2 - 25, // width 50 / 2
        wobble: 0,
        jumpY: 0,
        isJumping: false,
        dx: 0
      }
    }
    
    setScore(0)
    resize()
  }, [])

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    
    const horizonY = canvas.height * 0.4
    gameState.current.horizonY = horizonY
    gameState.current.penguin.y = canvas.height - 150
    
    // 게임 중이 아닐 때 펭귄 위치 중앙 정렬
    if (!isGameRunning) {
      gameState.current.penguin.x = canvas.width / 2 - gameState.current.penguin.width / 2
    }
    
    gameState.current.mountains.forEach(mt => { mt.y = horizonY })
  }, [isGameRunning])

  useEffect(() => {
    window.addEventListener('resize', resize)
    resize()
    // 초기 렌더링 시 배경 한번 그리기
    requestAnimationFrame(drawFrame)
    return () => window.removeEventListener('resize', resize)
  }, [resize])

  const startGame = () => {
    initAudio()
    initGame()
    setIsGameRunning(true)
    setIsGameOver(false)
    startBgm()
    
    if (gameState.current.animationId) cancelAnimationFrame(gameState.current.animationId)
    gameState.current.animationId = requestAnimationFrame(gameLoop)
  }

  const gameOver = () => {
    setIsGameRunning(false)
    setIsGameOver(true)
    stopBgm()
    cancelAnimationFrame(gameState.current.animationId)
  }

  const increaseSpeed = () => {
    if (isGameRunning) {
      gameState.current.speed *= 1.05
      gameState.current.scoreMultiplier *= 1.1
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
    // trackX는 도로 중심(0)을 기준으로 -0.5 ~ 0.5 범위가 도로 전체 폭입니다.
    // 장애물이 도로 밖으로 나가지 않도록 -0.45 ~ 0.45 범위 내에서 생성합니다.
    const trackX = (Math.random() * 0.9) - 0.45; 

    const type = Math.random() < 0.7 ? 0 : 1 // 0: Hole, 1: Iceberg

    let width, height;
    let points = []; // 구멍 모양을 위한 점들

    if (type === 0) { // 구멍
        width = 150 + Math.random() * 150;
        height = 40 + Math.random() * 30;
        
        // 깨진 얼음 모양을 위한 불규칙한 정점 생성
        const numPoints = 10 + Math.floor(Math.random() * 5); // 10~14개
        let angle = 0;
        for (let i = 0; i < numPoints; i++) {
            angle += (Math.PI * 2) / numPoints;
            // 불규칙성 추가 (반지름의 0.4 ~ 1.0 배)
            const r = 0.4 + Math.random() * 0.6; 
            points.push({ angle, r });
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
    const { horizonY, currentCurve, bgZOffset, mountains, clouds } = gameState.current
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

    // 땅
    ctx.fillStyle = '#F0F8FF'
    ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY)

    // 도로 (세그먼트)
    const segmentLength = 50
    for (let z = MAX_Z; z > 0; z -= segmentLength) {
      const zFar = z
      const zNear = z - segmentLength
      const scaleFar = FOV / (FOV + zFar)
      const scaleNear = FOV / (FOV + zNear)
      const yFar = horizonY + (canvas.height - horizonY) * scaleFar
      const yNear = horizonY + (canvas.height - horizonY) * scaleNear
      const wFar = ROAD_WIDTH * scaleFar
      const wNear = ROAD_WIDTH * scaleNear
      const xOffsetFar = getCurveOffset(zFar)
      const xOffsetNear = getCurveOffset(zNear)
      const centerFar = centerX + xOffsetFar
      const centerNear = centerX + xOffsetNear

      if (yNear < horizonY || yFar > canvas.height) continue

      ctx.fillStyle = (Math.floor((z - bgZOffset) / 200) % 2 === 0) ? '#FFFFFF' : '#F8F8FF'
      ctx.beginPath()
      ctx.moveTo(centerFar - wFar/2, yFar)
      ctx.lineTo(centerFar + wFar/2, yFar)
      ctx.lineTo(centerNear + wNear/2, yNear)
      ctx.lineTo(centerNear - wNear/2, yNear)
      ctx.fill()

      // 도로 외곽선
      ctx.strokeStyle = '#00BFFF'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(centerFar - wFar/2, yFar)
      ctx.lineTo(centerNear - wNear/2, yNear)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(centerFar + wFar/2, yFar)
      ctx.lineTo(centerNear + wNear/2, yNear)
      ctx.stroke()

      // 차선
      const laneWFar = wFar / 3
      const laneWNear = wNear / 3
      ctx.strokeStyle = 'rgba(0, 191, 255, 0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(centerFar - laneWFar/2, yFar)
      ctx.lineTo(centerNear - laneWNear/2, yNear)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(centerFar + laneWFar/2, yFar)
      ctx.lineTo(centerNear + laneWNear/2, yNear)
      ctx.stroke()
    }
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
                const px = screenX + Math.cos(pt.angle) * radiusX * pt.r;
                const py = centerY + Math.sin(pt.angle) * radiusY * pt.r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
        } else {
            ctx.ellipse(screenX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        }

        ctx.closePath()
        ctx.fill()

        // 깨진 얼음 테두리
        ctx.strokeStyle = '#E0F7FA'
        ctx.lineWidth = 2
        ctx.stroke()

        // 주변 잔금 (Cracks)
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
        if (obs.points) {
            obs.points.forEach((pt, i) => {
                if (i % 2 === 0) { // 격주로 금이 감
                    const px = screenX + Math.cos(pt.angle) * radiusX * pt.r;
                    const py = centerY + Math.sin(pt.angle) * radiusY * pt.r;
                    const crackX = screenX + Math.cos(pt.angle) * radiusX * (pt.r + 0.3);
                    const crackY = centerY + Math.sin(pt.angle) * radiusY * (pt.r + 0.3);
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

    // 그림자
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

    // 몸통
    ctx.fillStyle = penguin.color
    ctx.beginPath()
    ctx.ellipse(penguin.x + penguin.width/2, drawY + penguin.height/2, penguin.width/2, penguin.height/2, 0, 0, Math.PI * 2)
    ctx.fill()

    // 배 (흰색 부분 - 원본 코드에 없었으나 추가하면 좋음, 일단 원본 유지)
    // 꼬리?
    ctx.fillStyle = penguin.color
    ctx.beginPath()
    ctx.moveTo(penguin.x + penguin.width/2 - 10, drawY + penguin.height - 15)
    ctx.lineTo(penguin.x + penguin.width/2 + 10, drawY + penguin.height - 15)
    ctx.lineTo(penguin.x + penguin.width/2, drawY + penguin.height + 5)
    ctx.fill()

    // 발
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

    // 날개
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

  // --- 메인 게임 루프 ---
  const gameLoop = () => {
    if (!isGameRunning) return // 상태가 바뀌면 루프 중단 (useEffect 의존성 문제 해결 위해 ref 체크가 나을 수 있음)
    // 하지만 여기선 requestAnimationFrame 내부에서 재귀 호출하므로, 
    // 외부 변수(isGameRunning state)는 클로저에 캡처됨. 
    // 따라서 ref를 사용하거나, 루프 안에서 체크해야 함.
    // 여기서는 gameState.current.animationId를 통해 제어하므로 일단 진행.
    
    update()
    gameState.current.animationId = requestAnimationFrame(gameLoop)
  }

  // gameLoop에서 호출할 update 함수 (state가 아닌 ref 기반으로 동작해야 함)
  const update = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const state = gameState.current
    const { penguin } = state

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 배경 업데이트
    state.bgZOffset += state.speed
    if (state.bgZOffset >= 200) state.bgZOffset -= 200

    state.curveTimer++
    if (state.curveTimer > 300) {
      state.targetCurve = (Math.random() - 0.5) * 3000
      state.curveTimer = 0
    }
    state.currentCurve += (state.targetCurve - state.currentCurve) * 0.005

    drawBackground(ctx, canvas)

    // 펭귄 이동
    penguin.x += penguin.dx
    
    // 도로 안쪽으로 이동 제한 (파란 선 안쪽)
    const centerX = canvas.width / 2
    const roadHalfWidth = ROAD_WIDTH / 2
    const padding = 20 // 파란 선을 밟지 않도록 약간의 여유
    
    const minX = Math.max(0, centerX - roadHalfWidth + padding)
    const maxX = Math.min(canvas.width - penguin.width, centerX + roadHalfWidth - penguin.width - padding)

    if (penguin.x < minX) penguin.x = minX
    if (penguin.x > maxX) penguin.x = maxX

    // 점프 물리
    if (penguin.isJumping) {
      penguin.jumpY += penguin.jumpVy
      penguin.jumpVy -= penguin.gravity
      if (penguin.jumpY <= 0) {
        penguin.jumpY = 0;
        penguin.isJumping = false;
      }
    }

    // 뒤뚱거림
    if (penguin.dx !== 0 && !penguin.isJumping) {
      penguin.wobble += 3 * penguin.wobbleDirection
      if (penguin.wobble > 15 || penguin.wobble < -15) {
        penguin.wobbleDirection *= -1
      }
    } else {
      penguin.wobble *= 0.8
    }

    // 장애물 생성
    if (Math.random() < 0.03 + (state.speed * 0.001)) {
      createObstacle()
    }

    // 장애물 이동 및 충돌 처리
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      let obs = state.obstacles[i]
      obs.z -= state.speed

      if (obs.z < -100) {
        state.obstacles.splice(i, 1)
        state.score += Math.round(10 * state.scoreMultiplier)
        setScore(state.score) // React State 업데이트
        if (state.score % 100 === 0) state.speed += 1
      }
    }

    state.obstacles.sort((a, b) => b.z - a.z)
    drawObstacles(ctx, canvas)

    // 충돌 감지
    state.obstacles.forEach(obs => {
      if (obs.z < 50 && obs.z > -50) {
        const obsLeft = obs.screenX - obs.screenW/2
        const obsRight = obs.screenX + obs.screenW/2
        const pLeft = penguin.x + 10
        const pRight = penguin.x + penguin.width - 10

        if (pRight > obsLeft && pLeft < obsRight) {
          if (obs.type === 0) { // 구멍
             if (penguin.jumpY <= 40) gameOver()
          } else { // 빙산
             gameOver()
          }
        }
      }
    })

    drawPenguin(ctx)
  }
  
  // 단순 그리기 (게임 정지 상태일 때)
  const drawFrame = () => {
      const canvas = canvasRef.current
      if(!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawBackground(ctx, canvas)
      drawPenguin(ctx)
  }

  // 키보드 이벤트
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
  }, [isGameRunning]) // isGameRunning 의존성 추가

  // 터치 이벤트 핸들러
  const handleTouchStart = (e) => {
    if (!isGameRunning) return
    // 버튼 터치는 별도 핸들러가 처리
    
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

  // 게임 루프 시작/정지 관리
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
        <div id="scoreBoard">Score: {score}</div>
        
        {(!isGameRunning) && (
            <div id="startMsg" onClick={startGame}>
                {isGameOver ? (
                    <>
                        게임 오버!<br/>점수: {score}<br/>
                        <span style={{fontSize:'16px'}}>클릭하여 다시 시작</span>
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