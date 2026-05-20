import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import styles from './VideoPlayer.module.css'

const SESSION_SIZE = 30

function generatePlaceholders(count, startIdx = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `ph_${startIdx + i}`,
    url: '',
    title: `영상 ${startIdx + i + 1}`,
    color: `hsl(${((startIdx + i) * 37) % 360}, 40%, 20%)`,
  }))
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function fetchVideoList() {
  const { data, error } = await supabase
    .from('videos')
    .select('storage_path, title')
    .eq('active', true)
    .order('id', { ascending: true })

  if (error || !data || data.length === 0) return generatePlaceholders(SESSION_SIZE)

  const realVideos = data.map((row, i) => ({
    id: row.storage_path,
    url: supabase.storage.from('videos').getPublicUrl(row.storage_path).data.publicUrl,
    title: row.title,
    color: `hsl(${(i * 37) % 360}, 40%, 20%)`,
  }))

  const shuffled = shuffleArray(realVideos)

  // 60개 초과 업로드 시: 전체 셔플 후 SESSION_SIZE개 선택 (매 세션마다 다른 조합)
  // SESSION_SIZE 미만: 실제 영상 모두 + 나머지 자리는 플레이스홀더로 채움
  if (shuffled.length >= SESSION_SIZE) {
    return shuffled.slice(0, SESSION_SIZE)
  }
  const placeholders = generatePlaceholders(SESSION_SIZE - shuffled.length, shuffled.length)
  return shuffleArray([...shuffled, ...placeholders])
}

export default function VideoPlayer({ mode, experimentType, participantId, onComplete }) {
  const [videos, setVideos] = useState([])
  const [videosReady, setVideosReady] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const startTimeRef = useRef(null)
  const videoStartTimeRef = useRef(null)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const videoRefs = useRef({})
  const [log, setLog] = useState({
    videosWatched: 0,
    videoTimes: [],
    exitedAt: null,
    exitedOnVideo: null,
    exitedDuringFriction: false,
    wrongSwipeCount: 0,
    frictionExits: [],
  })

  const [showFriction, setShowFriction] = useState(false)
  const [frictionProgress, setFrictionProgress] = useState(0)

  const isHorizontal = experimentType === 'C' && currentIndex >= 10

  const touchStartRef = useRef(null)
  const containerRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const streamRef = useRef(null)

  useEffect(() => {
    fetchVideoList().then(vids => {
      setVideos(vids)
      setVideosReady(true)
      startTimeRef.current = Date.now()
      videoStartTimeRef.current = Date.now()
    })
  }, [])

  useEffect(() => {
    if (!videosReady) return
    const interval = setInterval(() => {
      setTotalSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [videosReady])

  // 현재 영상 재생, 나머지 일시정지 — DOM 재마운트 없이 제어
  useEffect(() => {
    if (!videosReady) return
    Object.entries(videoRefs.current).forEach(([idx, el]) => {
      if (!el) return
      if (parseInt(idx) === currentIndex) {
        el.currentTime = 0
        el.muted = false
        el.play().catch(() => {})
      } else {
        el.pause()
        el.muted = true
      }
    })
  }, [currentIndex, videosReady])

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

  const goNext = useCallback(() => {
    const duration = (Date.now() - videoStartTimeRef.current) / 1000
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

    if (experimentType === 'B' && (currentIndex + 1) % 10 === 0) {
      setShowFriction(true)
      setFrictionProgress(0)
      const interval = setInterval(() => {
        setFrictionProgress(p => {
          if (p >= 100) {
            clearInterval(interval)
            setShowFriction(false)
            setCurrentIndex(i => i + 1)
            videoStartTimeRef.current = Date.now()
            return 100
          }
          return p + 5
        })
      }, 100)
    } else {
      setCurrentIndex(i => i + 1)
      videoStartTimeRef.current = Date.now()
    }
  }, [currentIndex, videos, experimentType])

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
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx < 0) goNext()
      } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
        setLog(prev => ({ ...prev, wrongSwipeCount: prev.wrongSwipeCount + 1 }))
      }
    } else {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
        if (dy < 0) goNext()
      }
    }
    touchStartRef.current = null
  }

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') goNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext])

  if (!videosReady) {
    return (
      <div className={styles.videoLoading}>
        <div className={styles.videoLoadingSpinner} />
        <p>영상 불러오는 중...</p>
      </div>
    )
  }

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
      {experimentType === 'A' && (
        <div className={styles.awarenessBar}>
          <span className={styles.awarenessCount}>현재 <strong>{currentIndex + 1}개째</strong> 시청중</span>
          <span className={styles.awarenessTime}>총 시청 시간 · {formatTime(totalSeconds)}</span>
        </div>
      )}

      {isTypeC11th && (
        <div className={styles.patternBreakNotice}>
          지금부터는 가로방향으로 넘겨서 시청해주세요
        </div>
      )}

      <button className={styles.exitBtn} onClick={handleExit}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        시청 종료
      </button>

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

      {/* 슬라이딩 윈도우: 현재 ± 앞뒤 영상을 DOM에 유지, opacity로만 전환 */}
      <div className={styles.videoArea}>
        {videos.map((v, i) => {
          const inWindow = i >= Math.max(0, currentIndex - 1) && i <= currentIndex + 3
          if (!inWindow) return null
          const isActive = i === currentIndex && !showFriction
          return (
            <div
              key={v.id}
              style={{
                position: 'absolute', inset: 0,
                opacity: isActive ? 1 : 0,
                transition: 'opacity 0.15s',
                pointerEvents: 'none',
              }}
            >
              {v.url ? (
                <video
                  ref={el => { if (el) videoRefs.current[i] = el; else delete videoRefs.current[i] }}
                  src={v.url}
                  loop
                  playsInline
                  preload="auto"
                  className={styles.video}
                />
              ) : isActive ? (
                <div className={styles.placeholder}>
                  <div className={styles.placeholderIcon}>▶</div>
                  <p className={styles.placeholderText}>영상 {i + 1}</p>
                  <p className={styles.placeholderSub}>
                    {isHorizontal ? '← 가로로 스와이프' : '↑ 위로 스와이프'}
                  </p>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

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
    </div>
  )
}
