import { useState } from 'react'
import Landing from './pages/Landing.jsx'
import PreSurvey from './pages/PreSurvey.jsx'
import VideoPlayer from './pages/VideoPlayer.jsx'
import MidSurvey from './pages/MidSurvey.jsx'
import PostSurvey from './pages/PostSurvey.jsx'
import Finish from './pages/Finish.jsx'
import ResearcherDashboard from './pages/ResearcherDashboard.jsx'

// STEP 정의
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

// 실험군 타입 랜덤 배정
function assignExperimentType() {
  const types = ['A', 'B', 'C']
  return types[Math.floor(Math.random() * types.length)]
}

export default function App() {
  const [step, setStep] = useState(STEPS.LANDING)
  const [sessionData, setSessionData] = useState({
    participantId: null,
    preSurvey: null,
    experimentType: null,
    controlLog: null,
    midSurvey: null,
    experimentLog: null,
    postSurvey: null,
  })

  // URL에 ?researcher 있으면 연구원 대시보드
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
          onComplete={(data) => {
            updateSession('preSurvey', data)
            updateSession('participantId', data.name + '_' + Date.now())
            updateSession('experimentType', assignExperimentType())
            goTo(STEPS.CONTROL_VIDEO)
          }}
        />
      )}
      {step === STEPS.CONTROL_VIDEO && (
        <VideoPlayer
          mode="control"
          experimentType={null}
          participantId={sessionData.participantId}
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
