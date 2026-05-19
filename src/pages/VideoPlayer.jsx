import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './VideoPlayer.module.css'

// 임시 placeholder 영상 목록 (나중에 실제 Supabase URL로 교체)
// 각 영상은 { id, url, title } 형태
const PLACEHOLDER_VIDEOS = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  url: '', // 나중에 실제 URL 입력
  title: `영상 ${i + 1}`,
  // 색상 기반 placeholder
  color: `hsl(${(i * 37) % 360}, 40%, 20%)`,
}))

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function VideoPlayer({ mode, experimentType, participantId, onComplete }) {
  const [videos] = useState(() => shuffleArray(PLACEHOLDER_VIDEOS).slice(0, 30))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [startTime] = useState(Date.now())
  const [videoStartTime, setVideoStartTime] = useState(Date.now())
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [log, setLog] = useState({
    videosWatched: 0,
    videoTimes: [], // { id, duration }
    exitedAt: null,
    exitedOnVideo: null,
    exitedDuringFriction: false, // Type B용
    wrongSwipeCount: 0, // Type C용
    frictionExits: [], // Type B: 대기 중 종료 타이밍
  })

  // Type B: friction state
  const [showFriction, setShowFriction] = useState(false)
  const [frictionProgress, setFrictionProgress] = useState(0)

  // Type C: swap direction after 10th
  const isHorizontal = experimentType === 'C' && currentIndex >= 10

  // Touch handling
  const touchStartRef = useRef(null)
  const containerRef = useRef(null)

  // Screen recording
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const streamRef = useRef(null)

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTotalSeconds(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  // Start screen recording
  useEffect(() => {
    startRecording()
    return () => stopRecording()
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' },
        audio: false,
      })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = e => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }
      recorder.start(1000)
    } catch {
      console.log('화면 녹화 권한 없음 - 녹화 없이 진행')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
  }

  const getRecordingBlob = () => {
    if (recordedChunksRef.current.length === 0) return null
    return new Blob(recordedChunksRef.current, { type: 'video/webm' })
  }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}분 ${String(s).padStart(2, '0')}초`
  }

  // Navigate to next video
  const goNext = useCallback(() => {
    const duration = (Date.now() - videoStartTime) / 1000
    const videoId = videos[currentIndex]?.id

    setLog(prev => ({
      ...prev,
      videosWatched: currentIndex + 1,
      videoTimes: [...prev.videoTimes, { id: videoId, duration }],
    }))

    if (currentIndex >= videos.length - 1) {
      handleAutoComplete()
      return
    }

    // Type B: friction every 10 videos
    if (experimentType === 'B' && (currentIndex + 1) % 10 === 0) {
      setShowFriction(true)
      setFrictionProgress(0)
      const interval = setInterval(() => {
        setFrictionProgress(p => {
          if (p >= 100) {
            clearInterval(interval)
            setShowFriction(false)
            setCurrentIndex(i => i + 1)
            setVideoStartTime(Date.now())
            return 100
          }
          return p + 5
        })
      }, 100) // 2초 동안 (100ms * 20 = 2000ms)
    } else {
      setCurrentIndex(i => i + 1)
      setVideoStartTime(Date.now())
    }
  }, [currentIndex, videoStartTime, videos, experimentType])

  const handleAutoComplete = () => {
    stopRecording()
    const blob = getRecordingBlob()
    onComplete({
      ...log,
      totalSeconds,
      totalVideos: videos.length,
      recordingBlob: blob,
      exitType: 'auto',
      mode,
      experimentType,
    })
  }

  const handleExit = () => {
    stopRecording()
    const blob = getRecordingBlob()
    const now = Date.now()
    onComplete({
      ...log,
      videosWatched: currentIndex + 1,
      totalSeconds,
      recordingBlob: blob,
      exitType: 'manual',
      exitedAt: totalSeconds,
      exitedOnVideo: currentIndex + 1,
      exitedDuringFriction: experimentType === 'B' && showFriction,
      wrongSwipeCount: log.wrongSwipeCount,
      mode,
      experimentType,
    })
  }

  // Touch/swipe handling
  const handleTouchStart = (e) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    }
  }

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y

    if (isHorizontal) {
      // Type C 가로 스와이프
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx < 0) goNext() // 왼쪽으로 스와이프 = 다음
      } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
        // 세로 스와이프 시도 = 잘못된 방향
        setLog(prev => ({ ...prev, wrongSwipeCount: prev.wrongSwipeCount + 1 }))
      }
    } else {
      // 세로 스와이프 (위로 = 다음)
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
        if (dy < 0) goNext()
      }
    }
    touchStartRef.current = null
  }

  // Keyboard support
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') goNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext])

  const current = videos[currentIndex]
  const isTypeC11th = experimentType === 'C' && currentIndex === 10

  return (
    <div
      className={styles.container}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ background: current?.color || '#141414' }}
    >
      {/* Type A: 상단 정보 */}
      {experimentType === 'A' && (
        <div className={styles.awarenessBar}>
          <span className={styles.awarenessCount}>현재 <strong>{currentIndex + 1}개째</strong> 시청중</span>
          <span className={styles.awarenessTime}>총 시청 시간 · {formatTime(totalSeconds)}</span>
        </div>
      )}

      {/* Type C 11번째 안내 */}
      {isTypeC11th && (
        <div className={styles.patternBreakNotice}>
          지금부터는 가로방향으로 넘겨서 시청해주세요
        </div>
      )}

      {/* 종료 버튼 - 항상 노출 */}
      <button className={styles.exitBtn} onClick={handleExit}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        시청 종료
      </button>

      {/* Type B: Friction 로딩 */}
      {showFriction && experimentType === 'B' && (
        <div className={styles.frictionOverlay}>
          <div className={styles.frictionContent}>
            <div className={styles.frictionBar}>
              <div
                className={styles.frictionBarFill}
                style={{ width: `${frictionProgress}%`, transition: 'width 0.1s linear' }}
              />
            </div>
            <p className={styles.frictionText}>2초 후 다음 영상이 재생됩니다.</p>
          </div>
        </div>
      )}

      {/* 영상 영역 */}
      {!showFriction && (
        <div className={styles.videoArea}>
          {current?.url ? (
            <video
              key={current.id}
              src={current.url}
              autoPlay
              loop
              playsInline
              className={styles.video}
            />
          ) : (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>▶</div>
              <p className={styles.placeholderText}>영상 {currentIndex + 1}</p>
              <p className={styles.placeholderSub}>
                {isHorizontal ? '← 가로로 스와이프' : '↑ 위로 스와이프'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 영상 제목 */}
      {!showFriction && (
        <div className={styles.videoTitle}>
          <p>{current?.title}</p>
          {experimentType !== 'A' && (
            <p className={styles.swipeHint}>
              {isHorizontal ? '← 스와이프하여 다음 영상' : '↑ 스와이프하여 다음 영상'}
            </p>
          )}
        </div>
      )}

      {/* 완료 메시지 */}
    </div>
  )
}
