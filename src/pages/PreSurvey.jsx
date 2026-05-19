import { useState } from 'react'
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

export default function PreSurvey({ onComplete }) {
  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: '',
    dailyUsage: '',
    bedUsage: '',
    tendencyA: '',
    tendencyB: '',
  })

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const isValid =
    form.name && form.age && form.gender &&
    form.dailyUsage && form.bedUsage &&
    form.tendencyA && form.tendencyB

  const handleSubmit = () => {
    if (!isValid) return
    onComplete({
      ...form,
      userType: ['1','2','3'].includes(form.dailyUsage) ? 'Light' : 'Heavy',
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <div className={styles.container}>
      <div className={styles.inner + ' fade-in'}>
        <div className={styles.stepLabel}>사전 설문</div>
        <h2 className={styles.title}>참가자 정보 입력</h2>

        {/* 기본 인적 사항 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>1. 기본 인적 사항</h3>

          <div className={styles.field}>
            <label className={styles.label}>성함 또는 참가자 식별 번호</label>
            <input
              className={styles.input}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="입력해주세요"
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>나이 (만 나이)</label>
              <div className={styles.ageRow}>
                <span className={styles.agePrefix}>만</span>
                <input
                  className={styles.input}
                  type="number"
                  min="10" max="99"
                  value={form.age}
                  onChange={e => set('age', e.target.value)}
                  placeholder="0"
                  style={{ width: 80 }}
                />
                <span className={styles.ageSuffix}>세</span>
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>성별</label>
            <div className={styles.radioGroup}>
              {[['남성', '1'], ['여성', '2'], ['선택 안 함 / 기타', '3']].map(([label, val]) => (
                <label key={val} className={styles.radioItem + (form.gender === val ? ' ' + styles.radioSelected : '')}>
                  <input type="radio" name="gender" value={val} checked={form.gender === val} onChange={() => set('gender', val)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* 숏폼 이용 습관 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>2. 평소 숏폼 이용 습관</h3>

          <div className={styles.field}>
            <label className={styles.label}>하루 평균 숏폼 시청 시간</label>
            <div className={styles.radioGroup}>
              {[
                ['30분 미만', '1'],
                ['30분 이상 ~ 1시간 미만', '2'],
                ['1시간 이상 ~ 2시간 미만', '3'],
                ['2시간 이상 ~ 3시간 미만', '4'],
                ['3시간 이상', '5'],
              ].map(([label, val]) => (
                <label key={val} className={styles.radioItem + (form.dailyUsage === val ? ' ' + styles.radioSelected : '')}>
                  <input type="radio" name="dailyUsage" value={val} checked={form.dailyUsage === val} onChange={() => set('dailyUsage', val)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>잠들기 전 침대에서 숏폼 시청 빈도</label>
            <div className={styles.radioGroup}>
              {[
                ['전혀 보지 않는다', '1'],
                ['거의 보지 않는다 (주 1~2회 미만)', '2'],
                ['가끔 본다 (주 2~3회)', '3'],
                ['자주 본다 (주 4~5회)', '4'],
                ['거의 매일 본다 (주 6~7회)', '5'],
              ].map(([label, val]) => (
                <label key={val} className={styles.radioItem + (form.bedUsage === val ? ' ' + styles.radioSelected : '')}>
                  <input type="radio" name="bedUsage" value={val} checked={form.bedUsage === val} onChange={() => set('bedUsage', val)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* 숏폼 이용 성향 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>3. 숏폼 이용 성향 점검</h3>
          <p className={styles.sectionDesc}>평소 자신의 모습과 가장 일치하는 곳에 체크해 주세요.</p>

          <div className={styles.field}>
            <label className={styles.label}>문항 A. "그만 봐야겠다고 생각해도 계속 본 적이 많다."</label>
            <div className={styles.likertGroup}>
              {LIKERT_7.map((label, i) => (
                <label key={i} className={styles.likertItem + (form.tendencyA === String(i+1) ? ' ' + styles.likertSelected : '')}>
                  <input type="radio" name="tendencyA" value={String(i+1)} checked={form.tendencyA === String(i+1)} onChange={() => set('tendencyA', String(i+1))} />
                  <span className={styles.likertNum}>{i+1}</span>
                  <span className={styles.likertLabel}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>문항 B. "무의식적으로 숏폼 앱을 켠 적이 많다."</label>
            <div className={styles.likertGroup}>
              {LIKERT_7.map((label, i) => (
                <label key={i} className={styles.likertItem + (form.tendencyB === String(i+1) ? ' ' + styles.likertSelected : '')}>
                  <input type="radio" name="tendencyB" value={String(i+1)} checked={form.tendencyB === String(i+1)} onChange={() => set('tendencyB', String(i+1))} />
                  <span className={styles.likertNum}>{i+1}</span>
                  <span className={styles.likertLabel}>{label}</span>
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
          다음 단계로
          <span>→</span>
        </button>
      </div>
    </div>
  )
}
