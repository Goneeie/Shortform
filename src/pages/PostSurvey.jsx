import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import styles from './Survey.module.css'

const LIKERT_7 = [
  '전혀 그렇지 않다',
  '그렇지 않다',
  '약간 그렇지 않다',
  '보통이다',
  '약간 그렇다',
  '그렇다',
  '매우 그렇다',
]

export default function PostSurvey({ sessionData, onComplete }) {
  const [form, setForm] = useState({ control: '', easyExit: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const isValid = form.control && form.easyExit

  const handleSubmit = async () => {
    if (!isValid || saving) return
    setSaving(true)

    const postSurvey = { ...form, timestamp: new Date().toISOString() }

    // 화면 녹화 파일 Supabase Storage 업로드
    let controlRecordingUrl = null
    let experimentRecordingUrl = null

    try {
      if (sessionData.controlLog?.recordingBlob) {
        const { data } = await supabase.storage
          .from('recordings')
          .upload(
            `${sessionData.participantId}/control.webm`,
            sessionData.controlLog.recordingBlob,
            { contentType: 'video/webm', upsert: true }
          )
        if (data) {
          const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(data.path)
          controlRecordingUrl = urlData.publicUrl
        }
      }
      if (sessionData.experimentLog?.recordingBlob) {
        const { data } = await supabase.storage
          .from('recordings')
          .upload(
            `${sessionData.participantId}/experiment.webm`,
            sessionData.experimentLog.recordingBlob,
            { contentType: 'video/webm', upsert: true }
          )
        if (data) {
          const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(data.path)
          experimentRecordingUrl = urlData.publicUrl
        }
      }
    } catch (e) {
      console.error('Recording upload error:', e)
    }

    // Supabase DB 저장
    const payload = {
      participant_id: sessionData.participantId,
      pre_survey: sessionData.preSurvey,
      experiment_type: sessionData.experimentType,

      // 대조군 로그
      control_total_seconds: sessionData.controlLog?.totalSeconds || 0,
      control_videos_watched: sessionData.controlLog?.videosWatched || 0,
      control_video_times: sessionData.controlLog?.videoTimes || [],
      control_exit_type: sessionData.controlLog?.exitType,
      control_exited_at_seconds: sessionData.controlLog?.exitedAt || null,
      control_exited_on_video: sessionData.controlLog?.exitedOnVideo || null,
      control_recording_url: controlRecordingUrl,

      // 중간 설문
      mid_survey: sessionData.midSurvey,

      // 실험군 로그
      experiment_total_seconds: sessionData.experimentLog?.totalSeconds || 0,
      experiment_videos_watched: sessionData.experimentLog?.videosWatched || 0,
      experiment_video_times: sessionData.experimentLog?.videoTimes || [],
      experiment_exit_type: sessionData.experimentLog?.exitType,
      experiment_exited_at_seconds: sessionData.experimentLog?.exitedAt || null,
      experiment_exited_on_video: sessionData.experimentLog?.exitedOnVideo || null,
      experiment_recording_url: experimentRecordingUrl,
      experiment_exited_during_friction: sessionData.experimentLog?.exitedDuringFriction || false,
      experiment_wrong_swipe_count: sessionData.experimentLog?.wrongSwipeCount || 0,

      // 사후 설문
      post_survey: postSurvey,
      created_at: new Date().toISOString(),
    }

    try {
      await supabase.from('sessions').insert([payload])
    } catch (e) {
      console.error('DB save error:', e)
    }

    setSaving(false)
    onComplete(postSurvey)
  }

  return (
    <div className={styles.container}>
      <div className={styles.inner + ' fade-in'}>
        <div className={styles.stepLabel}>사후 설문</div>
        <h2 className={styles.title}>시청 경험 평가</h2>

        <section className={styles.section}>
          <div className={styles.field}>
            <label className={styles.label}>나는 시청을 통제하고 있다고 느꼈다</label>
            <div className={styles.likertGroup}>
              {LIKERT_7.map((label, i) => (
                <label key={i} className={styles.likertItem + (form.control === String(i+1) ? ' ' + styles.likertSelected : '')}>
                  <input type="radio" name="control" value={String(i+1)} checked={form.control === String(i+1)} onChange={() => set('control', String(i+1))} />
                  <span className={styles.likertNum}>{i+1}</span>
                  <span className={styles.likertLabel}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>원할 때 쉽게 종료할 수 있었다</label>
            <div className={styles.likertGroup}>
              {LIKERT_7.map((label, i) => (
                <label key={i} className={styles.likertItem + (form.easyExit === String(i+1) ? ' ' + styles.likertSelected : '')}>
                  <input type="radio" name="easyExit" value={String(i+1)} checked={form.easyExit === String(i+1)} onChange={() => set('easyExit', String(i+1))} />
                  <span className={styles.likertNum}>{i+1}</span>
                  <span className={styles.likertLabel}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <button
          className={styles.submitBtn + (!isValid || saving ? ' ' + styles.disabled : '')}
          onClick={handleSubmit}
          disabled={!isValid || saving}
        >
          {saving ? '저장 중...' : '실험 완료하기 →'}
        </button>
      </div>
    </div>
  )
}
