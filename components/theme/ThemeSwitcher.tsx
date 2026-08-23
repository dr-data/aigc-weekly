'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { useMounted } from './hooks'
import { useTheme } from './ThemeContext'

export function ThemeSwitcher() {
  const { theme, themes, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLLIElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  const mounted = useMounted()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!mounted) {
    return (
      <ul className="menu menu--desktop menu--theme-selector">
        <li className="menu__item menu__dropdown-wrapper">
          <span className="menu__trigger" aria-hidden="true">
            主題
            {' '}
            <span aria-hidden="true">▾</span>
          </span>
        </li>
      </ul>
    )
  }

  return (
    <ul className="menu menu--desktop menu--theme-selector">
      <li
        className={`menu__item menu__dropdown-wrapper ${isOpen ? 'open' : ''}`}
        ref={wrapperRef}
      >
        <button
          aria-controls={menuId}
          aria-expanded={isOpen}
          className="menu__trigger"
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
        >
          {themes.find(preset => preset.id === theme)?.label ?? '主題'}
          {' '}
          <span aria-hidden="true">▾</span>
        </button>
        <ul id={menuId} className="menu__dropdown">
          {themes.map(preset => (
            <li key={preset.id}>
              <button
                aria-pressed={preset.id === theme}
                className="menu__dropdown-item"
                type="button"
                onClick={() => {
                  setTheme(preset.id)
                  setIsOpen(false)
                  triggerRef.current?.focus()
                }}
              >
                {preset.label}
              </button>
            </li>
          ))}
        </ul>
      </li>
    </ul>
  )
}
