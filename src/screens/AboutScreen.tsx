import { useLocale } from '../lib/i18n'
import { primaryBtn, secondaryBtn } from '../lib/styles'

interface Props {
  onStart: () => void
  onAccount: () => void
}

export function AboutScreen({ onStart, onAccount }: Props) {
  const { t } = useLocale()
  const steps = [
    ['01', 'about.stepCreate', 'about.stepCreateDetail'],
    ['02', 'about.stepAdd', 'about.stepAddDetail'],
    ['03', 'about.stepReview', 'about.stepReviewDetail'],
  ]

  return (
    <div className="about-screen">
      <section className="about-hero" aria-labelledby="about-title">
        <p className="about-eyebrow">OPENFLASH / {t('about.eyebrow')}</p>
        <h1 id="about-title">{t('about.title')}</h1>
        <p className="about-lead">{t('about.lead')}</p>
        <div className="about-actions">
          <button type="button" onClick={onStart} style={primaryBtn}>{t('about.openApp')}</button>
          <button type="button" onClick={onAccount} style={secondaryBtn}>{t('about.createAccount')}</button>
          <a href="https://github.com/openflashapp/openflash" target="_blank" rel="noreferrer">{t('about.source')}</a>
        </div>
      </section>

      <section className="about-intro" aria-labelledby="about-what-title">
        <span>01</span>
        <div>
          <h2 id="about-what-title">{t('about.whatTitle')}</h2>
          <p>{t('about.whatBody')}</p>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-start-title">
        <div className="about-section-heading">
          <span>02 / {t('about.eyebrow')}</span>
          <h2 id="about-start-title">{t('about.startTitle')}</h2>
        </div>
        <ol className="about-steps">
          {steps.map(([number, title, detail]) => (
            <li key={number}>
              <span>{number}</span>
              <div>
                <h3>{t(title)}</h3>
                <p>{t(detail)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="about-section about-data" id="privacy" aria-labelledby="about-data-title">
        <div className="about-section-heading">
          <span>03 / {t('about.dataLabel')}</span>
          <h2 id="about-data-title">{t('about.dataTitle')}</h2>
        </div>
        <div className="about-data-grid">
          <article>
            <h3>{t('about.localTitle')}</h3>
            <p>{t('about.localBody')}</p>
          </article>
          <article>
            <h3>{t('about.accountTitle')}</h3>
            <p>{t('about.accountBody')}</p>
          </article>
          <article>
            <h3>{t('about.signInTitle')}</h3>
            <p>{t('about.signInBody')}</p>
          </article>
        </div>
      </section>
    </div>
  )
}
