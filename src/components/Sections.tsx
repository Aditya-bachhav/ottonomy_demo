import { useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { useInView } from '../hooks'
import { scrollToTarget } from '../lenis'

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav
      className="strim-navbar"
      aria-label="Main navigation"
      data-open={open}
      onClick={(event) => {
        const link = (event.target as HTMLElement).closest('a')
        setOpen(link ? false : !open)
      }}
      onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
    >
      <div className="strim-navbar__inner">
        <div className="strim-navbar__image strim-navbar__image--left" aria-hidden="true">
          <span>
            <img src="/neuron.webp" alt="" width="240" height="160" decoding="async" />
          </span>
        </div>
        <a className="strim-navbar__title" href="#home" aria-label="StimCardio — back to top">
          StimCardio
        </a>
        <div className="strim-navbar__image strim-navbar__image--right" aria-hidden="true">
          <span>
            <img src="/neuron.webp" alt="" width="240" height="160" decoding="async" />
          </span>
        </div>
        <div className="strim-navbar__links">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
          <a href="#careers">Careers</a>
        </div>
      </div>
    </nav>
  )
}

const siteCards = [
  {
    id: 'about-us',
    number: '01',
    label: 'About',
    title: 'A new signal for everyday care',
    copy: 'StimCardio is building a non-invasive, wearable neuromodulation platform that brings personalized therapy into daily life.',
  },
  {
    id: 'technology',
    number: '02',
    label: 'Technology',
    title: 'Sensing that adapts to you',
    copy: 'Continuous physiological sensing and intelligent therapy work together to create a more responsive path to rhythm care.',
  },
  {
    id: 'clinical-research',
    number: '03',
    label: 'Clinical research',
    title: 'Evidence, built step by step',
    copy: 'Our structured clinical program evaluates feasibility, safety, usability, physiological effects, and clinical efficacy.',
  },
  {
    id: 'news',
    number: '04',
    label: 'News',
    title: 'Follow the next chapter',
    copy: 'Explore the latest research, milestones, and thinking from StimCardio Medical as the platform develops.',
  },
]

const spotlight = (event: PointerEvent<HTMLElement>) => {
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`)
  event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`)
}

export function PostModelLayout() {
  const intro = useInView<HTMLDivElement>()
  const grid = useInView<HTMLDivElement>({ threshold: 0.08 })

  return (
    <section className="site-layout" id="about" aria-labelledby="site-layout-title">
      <div className="site-layout-head">
        <span className="site-layout-index">01 — 04</span>
        <span className="site-layout-label">StimCardio Medical</span>
      </div>
      <div className="site-layout-intro reveal-group" ref={intro}>
        <p className="site-layout-kicker reveal-fade">A different rhythm of care</p>
        <h2 id="site-layout-title">
          <span className="line">
            <span>Designed for the moments</span>
          </span>
          <span className="line">
            <span>between medicine and life.</span>
          </span>
        </h2>
      </div>
      <div className="site-card-grid reveal-group" ref={grid}>
        {siteCards.map((card, index) => (
          <article
            className="site-card"
            id={card.id}
            key={card.number}
            style={{ '--i': index } as CSSProperties}
            onPointerMove={spotlight}
          >
            <div className="site-card-top">
              <span>{card.number}</span>
              <span>{card.label}</span>
            </div>
            <div className="site-card-body">
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
            </div>
            <span className="site-card-arrow" aria-hidden="true">
              ↗
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer" id="contact">
      <div className="site-footer__top">
        <span className="site-footer__eyebrow">StimCardio Medical</span>
        <p>Building a more responsive future for atrial fibrillation care.</p>
      </div>
      <div className="site-footer__grid">
        <div>
          <span className="site-footer__label">Explore</span>
          <a href="#about">About</a>
          <a href="#technology">Technology</a>
          <a href="#clinical-research">Clinical Research</a>
          <a href="#news">News</a>
        </div>
        <div id="careers">
          <span className="site-footer__label">Connect</span>
          <a href="mailto:hello@stimcardio.com">Contact Us ↗</a>
          <a href="mailto:hello@stimcardio.com?subject=Careers">Careers ↗</a>
          <a href="https://www.linkedin.com/company/stimcardio/" target="_blank" rel="noreferrer noopener">
            LinkedIn ↗
          </a>
        </div>
        <div className="site-footer__mark" aria-hidden="true">
          StimCardio
        </div>
      </div>
      <div className="site-footer__bottom">
        <span>© {new Date().getFullYear()} StimCardio Medical. All rights reserved.</span>
        <button type="button" className="site-footer__top-link" onClick={() => scrollToTarget(0)}>
          Back to top ↑
        </button>
        <span>Investigational device. Not approved for sale.</span>
      </div>
    </footer>
  )
}
