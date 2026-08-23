import type { ReactNode } from 'react'
import Link from 'next/link'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'
import { siteConfig } from '@/lib/config'

const COPYRIGHT_YEAR = new Date().getFullYear()

interface TerminalLayoutProps {
  header?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

function HeaderNav() {
  return (
    <div className="header__inner">
      <div className="header__logo">
        <Link href="/" className="logo">
          {siteConfig.title}
        </Link>
      </div>
      <ThemeSwitcher />
    </div>
  )
}

export function TerminalLayout({ header, children, footer }: TerminalLayoutProps) {
  return (
    <div className="container">
      <a href="#main-content" className="skip-link">跳到主要內容</a>

      <header className="header">
        <HeaderNav />
      </header>

      <main id="main-content" className="content" tabIndex={-1}>
        {header}
        {children}
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <div className="copyright">
            <span>
              ©
              {COPYRIGHT_YEAR}
              {' '}
              {siteConfig.title}
            </span>
            <span>
              :: Theme based on
              {' '}
              <a href="https://github.com/panr/hugo-theme-terminal" target="_blank" rel="noreferrer">Terminal</a>
            </span>
          </div>
        </div>
        {footer}
      </footer>
    </div>
  )
}
