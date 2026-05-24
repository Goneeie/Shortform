import { useState } from 'react'
import { supabase } from './lib/supabase.js'
import Landing from './pages/Landing.jsx'
import PreSurvey from './pages/PreSurvey.jsx'
import VideoPlayer from './pages/VideoPlayer.jsx'
import MidSurvey from './pages/MidSurvey.jsx'
import PostSurvey from './pages/PostSurvey.jsx'
import Finish from './pages/Finish.jsx'
import ResearcherDashboard from './pages/ResearcherDashboard.jsx'

const STEPS = {
  LANDING: 'landing',
  PRE_SURVEY: 'pre_survey',
  CONTROL_VIDEO: 'control_video',
  MID_SURVEY: 'mid_survey',
  EXPERIMENT_VIDEO: 'experiment_video',
  POST_SURVEY: 'post_survey',
  FINISH: 'finish',
  RESEARCHER: 'researcher',
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 전체 영상을 한 번에 fetch → 셔플 → 대조군 30 / 실험군 30 분리
async function fetchAndSplitVideos() {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('storage_path, title')
      .eq('active', true)
      .order('id', { ascending: true })

    if (error || !data || data.length === 0) return { control: [], experiment: [] }

    const all = shuffleArray(data.map((row, i) => ({
      id: row.storage_path,
      url: supabase.storage.from('videos').getPublicUrl(row.storage_path).data.publicUrl,
      title: row.title,
      color: `hsl(${(i * 37) % 360}, 40%, 20%)`,
    })))

    const half = Math.floor(all.length / 2)
    return { control: all.slice(0, half), experiment: all.slice(half) }
  } catch {
    return { control: [], experiment: [] }
  }
}

// 삭제되지 않은 세션 기준으로 가장 수가 적은 실험군 타입 배정
// 동률이면 그 중에서 랜덤
async function assignExperimentType() {
  try {
    const { data } = await supabase
      .from('sessions')
      .select('experiment_type')
      .is('deleted_at', null)

    const counts = { A: 0, B: 0, C: 0 }
    data?.forEach(s => {
      if (s.experiment_type in counts) counts[s.experiment_type]++
    })

    const minCount = Math.min(...Object.values(counts))
    const candidates = Object.keys(counts).filter(k => counts[k] === minCount)
    return candidates[Math.floor(Math.random() * candidates.length)]
  } catch {
    const types = ['A', 'B', 'C']
    return types[Math.floor(Math.random() * types.length)]
  }
}

export default function App() {
  const [step, setStep] = useState(STEPS.LANDING)
  const [sessionData, setSessionData] = useState({
    participantId: null,
    preSurvey: null,
    experimentType: null,
    videoPool: null,   // { control: [...30개], experiment: [...30개] }
    controlLog: null,
    midSurvey: null,
    experimentLog: null,
    postSurvey: null,
  })

  if (window.location.search.includes('researcher')) {
    return <ResearcherDashboard />
  }

  const updateSession = (key, value) => {
    setSessionData(prev => ({ ...prev, [key]: value }))
  }

  const goTo = (nextStep) => setStep(nextStep)

  return (
    <div style={{ height: '100%' }}>
      {step === STEPS.LANDING && (
        <Landing onStart={() => goTo(STEPS.PRE_SURVEY)} />
      )}
      {step === STEPS.PRE_SURVEY && (
        <PreSurvey
          onComplete={async (data) => {
            updateSession('preSurvey', data)
            updateSession('participantId', data.name + '_' + Date.now())
            const [type, pool] = await Promise.all([
              assignExperimentType(),
              fetchAndSplitVideos(),
            ])
            updateSession('experimentType', type)
            updateSession('videoPool', pool)
            goTo(STEPS.CONTROL_VIDEO)
          }}
        />
      )}
      {step === STEPS.CONTROL_VIDEO && (
        <VideoPlayer
          mode="control"
          experimentType={null}
          participantId={sessionData.participantId}
          videoList={sessionData.videoPool?.control}
          onComplete={(log) => {
            updateSession('controlLog', log)
            goTo(STEPS.MID_SURVEY)
          }}
        />
      )}
      {step === STEPS.MID_SURVEY && (
        <MidSurvey
          controlLog={sessionData.controlLog}
          onComplete={(data) => {
            updateSession('midSurvey', data)
            goTo(STEPS.EXPERIMENT_VIDEO)
          }}
        />
      )}
      {step === STEPS.EXPERIMENT_VIDEO && (
        <VideoPlayer
          mode="experiment"
          experimentType={sessionData.experimentType}
          participantId={sessionData.participantId}
          videoList={sessionData.videoPool?.experiment}
          onComplete={(log) => {
            updateSession('experimentLog', log)
            goTo(STEPS.POST_SURVEY)
          }}
        />
      )}
      {step === STEPS.POST_SURVEY && (
        <PostSurvey
          sessionData={sessionData}
          onComplete={(data) => {
            updateSession('postSurvey', data)
            goTo(STEPS.FINISH)
          }}
        />
      )}
      {step === STEPS.FINISH && (
        <Finish sessionData={sessionData} />
      )}
    </div>
  )
}
