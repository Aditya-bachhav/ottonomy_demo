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
        <a className="strim-navbar__title" href="#home" aria-label="Ottonomy — back to top">
          Ottonomy
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
    label: 'Platform',
    title: 'Autonomy that moves work forward',
    copy: 'Ottonomy builds autonomous robots that move goods safely and seamlessly through the places people work, shop, and receive care.',
  },
  {
    id: 'technology',
    number: '02',
    label: 'Healthcare',
    title: 'Critical deliveries, handled with care',
    copy: 'Move medicines, lab samples, and essential materials across hospitals and care environments with less friction.',
  },
  {
    id: 'commerce',
    number: '03',
    label: 'Commerce',
    title: 'The last mile, made more capable',
    copy: 'Support curbside and retail delivery with an autonomous fleet designed for dependable handoffs and smoother operations.',
  },
  {
    id: 'enterprise',
    number: '04',
    label: 'Enterprise',
    title: 'One fleet, many environments',
    copy: 'Connect campuses, facilities, and indoor routes through a flexible delivery layer built for modern operations.',
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
        <span className="site-layout-label">Ottonomy Autonomous Delivery</span>
      </div>
      <div className="site-layout-intro reveal-group" ref={intro}>
        <p className="site-layout-kicker reveal-fade">The future of delivery is autonomous</p>
        <h2 id="site-layout-title">
          <span className="line">
            <span>Move what matters</span>
          </span>
          <span className="line">
            <span>with less friction.</span>
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
        <span className="site-footer__eyebrow">Ottonomy®</span>
        <p>Autonomous delivery for the places that keep the world moving.</p>
      </div>
      <div className="site-footer__grid">
        <div>
          <span className="site-footer__label">Explore</span>
          <a href="#about">Platform</a>
          <a href="#about-us">Healthcare</a>
          <a href="#technology">Commerce</a>
          <a href="#enterprise">Enterprise</a>
        </div>
        <div id="careers">
          <span className="site-footer__label">Connect</span>
          <a href="mailto:hello@ottonomy.io">Contact Us ↗</a>
          <a href="mailto:hello@ottonomy.io?subject=Careers">Careers ↗</a>
          <a href="https://www.linkedin.com/company/ottonomy/" target="_blank" rel="noreferrer noopener">
            LinkedIn ↗
          </a>
        </div>
        <div className="site-footer__mark" aria-hidden="true">
          Ottonomy
        </div>
      </div>
      <div className="site-footer__bottom">
        <span>© {new Date().getFullYear()} Ottonomy®. All rights reserved.</span>
        <button type="button" className="site-footer__top-link" onClick={() => scrollToTarget(0)}>
          Back to top ↑
        </button>
        <span>Demo experience inspired by autonomous delivery.</span>
      </div>
    </footer>
  )
}
