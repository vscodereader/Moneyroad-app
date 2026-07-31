"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { navigation } from "../content";
import { Brand } from "./brand";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.body.classList.add("menu-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("menu-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="header-inner container">
        <Link aria-label="머니게이트 홈" className="brand-link" href="/">
          <Brand />
        </Link>
        <nav aria-label="주요 메뉴" className="desktop-nav">
          {navigation.map((item) => (
            <div className="nav-item" key={item.label}>
              <a href={item.href}>{item.label}</a>
              {item.children.length ? (
                <div className="nav-dropdown">
                  {item.children.map((child) => (
                    <a href={child.href} key={child.label}>
                      {child.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="header-actions">
          <a
            className="header-product"
            href="https://moneyroad.ai.kr/"
            rel="noreferrer"
            target="_blank"
          >
            머니로드
          </a>
          <a className="header-contact" href="/contact">
            문의하기
          </a>
          <button
            aria-expanded={open}
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            className={`menu-button ${open ? "is-open" : ""}`}
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            <span />
            <span />
          </button>
        </div>
      </div>
      <div className={`mobile-menu ${open ? "is-open" : ""}`}>
        <nav aria-label="모바일 메뉴" className="container">
          {navigation.map((item) => (
            <div key={item.label}>
              <a href={item.href} onClick={() => setOpen(false)}>
                {item.label}
                <span>↗</span>
              </a>
              {item.children.map((child) => (
                <a
                  className="mobile-sub"
                  href={child.href}
                  key={child.label}
                  onClick={() => setOpen(false)}
                >
                  {child.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}
