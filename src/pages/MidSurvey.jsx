import { useState } from 'react'
import styles from './Survey.module.css'

export default function MidSurvey({ controlLog, onComplete }) {
  const [form, setForm] = useState({
    estimatedMinutes: '',
    estimatedVideos: '',
    thoughtAboutStopping: '',
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const isValid = form.estimatedMinutes && form.estimatedVideos && form.thoughtAboutStopping

  const handleSubmit = () => {
    if (!isValid) return
    onComplete({ ...form, timestamp: new Date().toISOString() })
  }

  return (
    <div className={styles.container}>
      <div className={styles.inner + ' fade-in'}>
        <div className={styles.stepLabel}>중간 설문</div>
        <h2 className={styles.title}>대조군 시청 후 설문</h2>

        <section className={styles.section}>
          <div className={styles.field}>
            <label className={styles.label}>1. 몇 분 정도 시청했다고 생각하나요?</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={form.estimatedMinutes}
                onChange={e => set('estimatedMinutes', e.target.value)}
                placeholder="0"
                style={{ width: 100 }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>분</span>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>2. 몇 개 정도 영상을 본 것 같나요?</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={form.estimatedVideos}
                onChange={e => set('estimatedVideos', e.target.value)}
                placeholder="0"
                style={{ width: 100 }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>개</span>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>3. 중간에 종료를 생각한 적이 있었나요?</label>
            <div className={styles.radioGroup}>
              {[['예', 'yes'], ['아니오', 'no']].map(([label, val]) => (
                <label key={val} className={styles.radioItem + (form.thoughtAboutStopping === val ? ' ' + styles.radioSelected : '')}>
                  <input type="radio" name="stopping" value={val} checked={form.thoughtAboutStopping === val} onChange={() => set('thoughtAboutStopping', val)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </section>

        <button
          className={styles.submitBtn + (!isValid ? ' ' + styles.disabled : '')}
          onClick={handleSubmit}
          disabled={!isValid}
        >
          다음 단계로 <span>→</span>
        </button>
      </div>
    </div>
  )
}
