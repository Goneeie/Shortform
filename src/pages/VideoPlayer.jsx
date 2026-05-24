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

// 최대 maxRetries 번 재시도 — 네트워크 순간 오류 방어
async function fetchVideoList(maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('storage_path, title')
        .eq('active', true)
        .order('id', { ascending: true })

      if (error || !data || data.length === 0) {
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
          continue
        }
        return null  // 모든 재시도 실패
      }

      const realVideos = data.map((row, i) => ({
        id: row.storage_path,
        url: supabase.storage.from('videos').getPublicUrl(row.storage_path).data.publicUrl,
        title: row.title,
        color: `hsl(${(i * 37) % 360}, 40%, 20%)`,
      }))

      const shuffled = shuffleArray(realVideos)
      if (shuffled.length >= SESSION_SIZE) return shuffled.slice(0, SESSION_SIZE)
      const placeholders = generatePlaceholders(SESSION_SIZE - shuffled.length, shuffled.length)
      return shuffleArray([...shuffled, ...placeholders])
    } catch {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
      }
    }
  }
  return null  // 완전 실패
}

// 슬롯에 현재 어떤 영상 인덱스가 할당됐는지 추적
function loadSlot(el, url) {
  if (!el || !url) return
  if (el.dataset.loadedUrl === url) return  // 이미 로드됨
  el.dataset.loadedUrl = url
  el.src = url
  el.load()
}

export default function VideoPlayer({ mode, experimentType, participantId, onComplete }) {
  const [videos, setVideos] = useState([])
  const [videosReady, setVideosReady] = useState(false)
  const [videosError, setVideosError] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  // 'A' 또는 'B' — 현재 재생 중인 슬롯
  const [activeSlot, setActiveSlot] = useState('A')

  const startTimeRef = useRef(null)
  const videoStartTimeRef = useRef(null)
  const [totalSeconds, setTotalSeconds] = useState(0)
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

  // 더블 버퍼 슬롯 refs — 이 두 개 외에 다른 video 엘리먼트 없음
  const slotARef = useRef(null)
  const slotBRef = useRef(null)

  const touchStartRef = useRef(null)
  const containerRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const streamRef = useRef(null)

  // 영상 목록 로드 및 초기 슬롯 설정 (실패 시 재시도 후 에러 화면)
  useEffect(() => {
    fetchVideoList().then(vids => {
      if (!vids) {
        setVideosError(true)
        return
      }
      setVideos(vids)
      loadSlot(slotARef.current, vids[0]?.url)
      loadSlot(slotBRef.current, vids[1]?.url)
      setVideosReady(true)
      startTimeRef.current = Date.now()
      videoStartTimeRef.current = Date.now()
    })
  }, [])

  // 현재 슬롯 재생 / 대기 슬롯 mute+pause+다음 영상 로드
  useEffect(() => {
    if (!videosReady || videos.length === 0) return

    const activeEl = activeSlot === 'A' ? slotARef.current : slotBRef.current
    const standbyEl = activeSlot === 'A' ? slotBRef.current : slotARef.current

    // 대기 슬롯: 확실히 멈추고 다음 영상 미리 로드
    if (standbyEl) {
      standbyEl.pause()
      standbyEl.muted = true
      loadSlot(standbyEl, videos[currentIndex + 1]?.url)
    }

    // 현재 슬롯 재생
    // muted=true로 먼저 play() → 모바일 브라우저 autoplay 제한 우회
    // play() Promise가 resolve된 후 unmute → 소리 정상 출력
    if (activeEl) {
      activeEl.muted = true
      const tryPlay = () => {
        activeEl.play()
          .then(() => { activeEl.muted = false })
          .catch(() => {})
      }
      if (activeEl.readyState >= 2) {
        tryPlay()
      } else {
        activeEl.addEventListener('loadeddata', tryPlay, { once: true })
        activeEl.addEventListener('canplay', tryPlay, { once: true })
      }
    }
  }, [currentIndex, activeSlot, videosReady, videos])

  // 타이머
  useEffect(() => {
    if (!videosReady) return
    const interval = setInterval(() => {
      setTotalSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [videosReady])

  // 화면 녹화
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

    const advance = () => {
      setCurrentIndex(i => i + 1)
      setActiveSlot(s => s === 'A' ? 'B' : 'A')
      videoStartTimeRef.current = Date.now()
    }

    if (experimentType === 'B' && (currentIndex + 1) % 10 === 0) {
      setShowFriction(true)
      setFrictionProgress(0)
      const interval = setInterval(() => {
        setFrictionProgress(p => {
          if (p >= 100) {
            clearInterval(interval)
            setShowFriction(false)
            advance()
            return 100
          }
          return p + 5
        })
      }, 100)
    } else {
      advance()
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

  if (videosError) {
    return (
      <div className={styles.videoLoading}>
        <p style={{ color: '#ff6b6b', marginBottom: 16 }}>영상을 불러오지 못했습니다</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#fff', color: '#000', fontSize: 15, cursor: 'pointer' }}
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (!videosReady) {
    return (
      <div className={styles.videoLoading}>
        <div className={styles.videoLoadingSpinner} />
        <p>영상 불러오는 중...</p>
      </div>
    )
  }

  const currentVideo = videos[currentIndex]
  const isTypeC11th = experimentType === 'C' && currentIndex === 10

  return (
    <div
      className={styles.container}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ background: currentVideo?.color || '#141414' }}
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

      {/* 더블 버퍼: 슬롯 A / B */}
      <div className={styles.videoArea}>
        <div style={{ position: 'absolute', inset: 0, opacity: activeSlot === 'A' && !showFriction ? 1 : 0, pointerEvents: 'none' }}>
          <video ref={slotARef} loop playsInline preload="auto" className={styles.video} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: activeSlot === 'B' && !showFriction ? 1 : 0, pointerEvents: 'none' }}>
          <video ref={slotBRef} loop playsInline preload="auto" className={styles.video} />
        </div>

        {/* 플레이스홀더 (URL 없는 영상) */}
        {!showFriction && !currentVideo?.url && (
          <div className={styles.placeholder}>
            <div className={styles.placeholderIcon}>▶</div>
            <p className={styles.placeholderText}>영상 {currentIndex + 1}</p>
            <p className={styles.placeholderSub}>
              {isHorizontal ? '← 가로로 스와이프' : '↑ 위로 스와이프'}
            </p>
          </div>
        )}
      </div>

      {!showFriction && (
        <div className={styles.videoTitle}>
          <p>{currentVideo?.title}</p>
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
