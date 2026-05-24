import styles from './Landing.module.css'

export default function Landing({ onStart }) {
  return (
    <div className={styles.container}>
      <div className={styles.noise} />
      <div className={styles.inner + ' fade-in'}>
        <div className={styles.badge}>UX Research</div>
        <h1 className={styles.title}>
          숏폼 인터페이스<br />
          <span className={styles.accent}>행동 분석 실험</span>
        </h1>
        <p className={styles.desc}>
          본 실험은 짧은 콘텐츠 이용 중<br />
          사용자의 <strong>종료 판단 과정</strong>을 분석하기 위한 실험입니다.
        </p>
        <div className={styles.guide}>
          <div className={styles.guideItem}>
            <span className={styles.guideNum}>01</span>
            <span>콘텐츠를 자유롭게 넘겨보세요</span>
          </div>
          <div className={styles.guideItem}>
            <span className={styles.guideNum}>02</span>
            <span>그만 보고 싶을 때 종료 버튼을 눌러주세요</span>
          </div>
          <div className={styles.guideItem}>
            <span className={styles.guideNum}>03</span>
            <span>짧은 설문에 응답해주세요</span>
          </div>
        </div>
        <div className={styles.notice}>
          <span className={styles.noticeIcon}>⚡</span>
          <span>
            숏폼 영상 시청은 총 <strong>두 차례</strong>에 걸쳐 진행됩니다.
          </span>
        </div>

        <div className={styles.notice}>
          <p><span className={styles.neon}>모바일 환경</span>에서 시청해주세요.</p>
          <p>숏폼 영상 시청은 총 <span className={styles.neon}>두 차례</span>에 걸쳐 진행됩니다.</p>
        </div>

        <button className={styles.startBtn} onClick={onStart}>
          실험 시작하기
          <span className={styles.arrow}>→</span>
        </button>
        <p className={styles.footer}>예상 소요 시간 · 약 10~20분</p>
      </div>
    </div>
  )
}
