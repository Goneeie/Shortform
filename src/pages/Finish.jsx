import styles from './Finish.module.css'

export default function Finish() {
  return (
    <div className={styles.container}>
      <div className={styles.inner + ' fade-in'}>
        <div className={styles.checkmark}>✓</div>
        <h1 className={styles.title}>모든 실험이 종료되었습니다.</h1>
        <p className={styles.desc}>참여해주셔서 감사합니다.</p>
        <div className={styles.divider} />
        <p className={styles.note}>
          이 창을 닫으셔도 됩니다.<br />
          수고하셨습니다.
        </p>
      </div>
    </div>
  )
}
