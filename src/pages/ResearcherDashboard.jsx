import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import styles from './ResearcherDashboard.module.css'

const EXP_LABELS = { A: 'Awareness Cue', B: 'Friction UI', C: 'Pattern Breaker' }

function formatSecs(s) {
  if (!s) return '0분 0초'
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}분 ${sec}초`
}

function avgVideoTime(videoTimes) {
  if (!videoTimes || videoTimes.length === 0) return '–'
  const avg = videoTimes.reduce((sum, v) => sum + (v.duration || 0), 0) / videoTimes.length
  return `${avg.toFixed(1)}초`
}

export default function ResearcherDashboard() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
  setLoading(true)
  setError(null)
  try {
    const { data, error: sbError } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
    if (sbError) throw new Error(sbError.message)
    setSessions(data || [])
  } catch (e) {
    setError(e.message)
  } finally {
    setLoading(false)
  }
}

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      <p>데이터 불러오는 중...</p>
    </div>
  )

  if (error) return (
  <div className={styles.loading}>
    <p style={{ color: 'var(--danger)', marginBottom: 12 }}>⚠ 연결 오류: {error}</p>
    <button onClick={fetchSessions} style={{ padding: '10px 24px', background: 'var(--accent)', color: '#000', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
      다시 시도
    </button>
  </div>
)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerLabel}>Researcher View</div>
          <h1 className={styles.headerTitle}>실험 데이터 대시보드</h1>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{sessions.length}</span>
            <span className={styles.statLabel}>총 참가자</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{sessions.filter(s => s.experiment_type === 'A').length}</span>
            <span className={styles.statLabel}>Type A</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{sessions.filter(s => s.experiment_type === 'B').length}</span>
            <span className={styles.statLabel}>Type B</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{sessions.filter(s => s.experiment_type === 'C').length}</span>
            <span className={styles.statLabel}>Type C</span>
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        {/* 참가자 목록 */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarTitle}>참가자 목록</div>
          {sessions.length === 0 && (
            <p className={styles.empty}>아직 데이터가 없습니다.</p>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              className={styles.participantCard + (selected?.id === s.id ? ' ' + styles.participantSelected : '')}
              onClick={() => setSelected(s)}
            >
              <div className={styles.pName}>{s.pre_survey?.name || '–'}</div>
              <div className={styles.pMeta}>
                <span className={styles.typeBadge + ' ' + styles[`type${s.experiment_type}`]}>
                  Type {s.experiment_type}
                </span>
                <span className={styles.pDate}>{new Date(s.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 상세 보기 */}
        <div className={styles.detail}>
          {!selected ? (
            <div className={styles.detailEmpty}>← 참가자를 선택하세요</div>
          ) : (
            <SessionDetail session={selected} />
          )}
        </div>
      </div>
    </div>
  )
}

function SessionDetail({ session: s }) {
  const pre = s.pre_survey || {}
  const mid = s.mid_survey || {}
  const post = s.post_survey || {}

  const userTypeLabel = pre.userType === 'Heavy' ? 'Heavy User (2h+)' : 'Light User (<2h)'

  // 추정치 vs 실제 비교
  const actualMins = Math.floor((s.control_total_seconds || 0) / 60)
  const actualSecs = (s.control_total_seconds || 0) % 60
  const estimatedMins = parseInt(mid.estimatedMinutes || 0)

  return (
    <div className={styles.detailInner}>
      <h2 className={styles.detailTitle}>{pre.name || '–'}</h2>

      {/* 참가자 정보 */}
      <Card title="참가자 정보">
        <Row label="이름/ID" value={pre.name} />
        <Row label="나이" value={`만 ${pre.age}세`} />
        <Row label="성별" value={['', '남성', '여성', '선택 안 함'][pre.gender] || '–'} />
        <Row label="사용자 유형" value={<span style={{ color: pre.userType === 'Heavy' ? '#ff6b6b' : '#69db7c' }}>{userTypeLabel}</span>} />
        <Row label="하루 시청 시간" value={['', '30분 미만', '30분~1시간', '1~2시간', '2~3시간', '3시간 이상'][pre.dailyUsage] || '–'} />
        <Row label="취침 전 시청" value={['', '전혀 안 봄', '거의 안 봄', '가끔', '자주', '거의 매일'][pre.bedUsage] || '–'} />
        <Row label="문항 A (그만봐야지)" value={`${pre.tendencyA}점`} />
        <Row label="문항 B (무의식 시청)" value={`${pre.tendencyB}점`} />
      </Card>

      {/* 대조군 로그 */}
      <Card title="대조군 시청 로그">
        <Row label="실제 시청 시간" value={formatSecs(s.control_total_seconds)} highlight />
        <Row label="실제 시청 개수" value={`${s.control_videos_watched}개`} highlight />
        <Row label="영상별 평균 체류" value={avgVideoTime(s.control_video_times)} />
        <Row label="종료 방식" value={s.control_exit_type === 'manual' ? '직접 종료' : '자동 종료 (전체 시청)'} />
        {s.control_exit_type === 'manual' && <>
          <Row label="종료 시점" value={formatSecs(s.control_exited_at_seconds)} />
          <Row label="종료 시 시청 개수" value={`${s.control_exited_on_video}번째 영상 후`} />
        </>}
        {s.control_recording_url && (
          <div className={styles.recordingRow}>
            <span className={styles.rowLabel}>화면 녹화</span>
            <a href={s.control_recording_url} download className={styles.downloadBtn}>
              ⬇ 다운로드
            </a>
          </div>
        )}
      </Card>

      {/* 중간 설문 비교 */}
      <Card title="중간 설문 — 추정치 vs 실제">
        <div className={styles.compareGrid}>
          <div className={styles.compareCol}>
            <div className={styles.compareHeader}>참가자 추정</div>
            <div className={styles.compareVal}>{mid.estimatedMinutes || '–'}분</div>
            <div className={styles.compareLabel}>시청 시간</div>
          </div>
          <div className={styles.compareDivider}>vs</div>
          <div className={styles.compareCol}>
            <div className={styles.compareHeader}>실제</div>
            <div className={styles.compareVal}>{actualMins}분 {actualSecs}초</div>
            <div className={styles.compareLabel}>시청 시간</div>
          </div>
        </div>
        <div className={styles.compareGrid} style={{ marginTop: 12 }}>
          <div className={styles.compareCol}>
            <div className={styles.compareVal}>{mid.estimatedVideos || '–'}개</div>
            <div className={styles.compareLabel}>시청 개수</div>
          </div>
          <div className={styles.compareDivider}>vs</div>
          <div className={styles.compareCol}>
            <div className={styles.compareVal}>{s.control_videos_watched}개</div>
            <div className={styles.compareLabel}>시청 개수</div>
          </div>
        </div>
        <Row label="종료 고려 여부" value={mid.thoughtAboutStopping === 'yes' ? '예 (생각함)' : '아니오'} />
      </Card>

      {/* 실험군 로그 */}
      <Card title={`실험군 시청 로그 — Type ${s.experiment_type}: ${EXP_LABELS[s.experiment_type]}`}>
        <Row label="실제 시청 시간" value={formatSecs(s.experiment_total_seconds)} highlight />
        <Row label="실제 시청 개수" value={`${s.experiment_videos_watched}개`} highlight />
        <Row label="영상별 평균 체류" value={avgVideoTime(s.experiment_video_times)} />
        <Row label="종료 방식" value={s.experiment_exit_type === 'manual' ? '직접 종료' : '자동 종료 (전체 시청)'} />
        {s.experiment_exit_type === 'manual' && <>
          <Row label="종료 시점" value={formatSecs(s.experiment_exited_at_seconds)} />
          <Row label="종료 시 시청 개수" value={`${s.experiment_exited_on_video}번째 영상 후`} />
        </>}
        {/* Type B 추가 */}
        {s.experiment_type === 'B' && (
          <Row
            label="대기 화면 중 종료"
            value={s.experiment_exited_during_friction ? '예 (로딩 중 종료)' : '아니오 (영상 중 종료)'}
            highlight
          />
        )}
        {/* Type C 추가 */}
        {s.experiment_type === 'C' && (
          <Row
            label="세로 스와이프 오시도 횟수"
            value={`${s.experiment_wrong_swipe_count || 0}회`}
            highlight
          />
        )}
        {s.experiment_recording_url && (
          <div className={styles.recordingRow}>
            <span className={styles.rowLabel}>화면 녹화</span>
            <a href={s.experiment_recording_url} download className={styles.downloadBtn}>
              ⬇ 다운로드
            </a>
          </div>
        )}
      </Card>

      {/* 사후 설문 */}
      <Card title="사후 설문">
        <Row label="시청 통제감" value={`${post.control}점 / 7점`} />
        <Row label="종료 용이성" value={`${post.easyExit}점 / 7점`} />
      </Card>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardBody}>{children}</div>
    </div>
  )
}

function Row({ label, value, highlight }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue + (highlight ? ' ' + styles.rowHighlight : '')}>{value || '–'}</span>
    </div>
  )
}
