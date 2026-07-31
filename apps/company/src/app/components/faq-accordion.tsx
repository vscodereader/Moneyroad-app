"use client";

import { useMemo, useState } from "react";
import { faqs } from "../content";

const categories = [
  "전체",
  "회사·신고",
  "투자정보",
  "머니로드",
  "토론·커뮤니티",
  "이용·문의",
] as const;

export function FaqAccordion() {
  const [category, setCategory] = useState<(typeof categories)[number]>("전체");
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const visibleFaqs = useMemo(
    () =>
      category === "전체"
        ? faqs
        : faqs.filter((faq) => faq.category === category),
    [category]
  );

  return (
    <>
      <fieldset className="filter-pills">
        <legend>FAQ 분류</legend>
        {categories.map((item) => (
          <button
            aria-pressed={category === item}
            className={category === item ? "is-active" : ""}
            key={item}
            onClick={() => {
              setCategory(item);
              setOpenIndex(null);
            }}
            type="button"
          >
            {item}
          </button>
        ))}
      </fieldset>
      <div className="accordion">
        {visibleFaqs.map((faq, index) => {
          const isOpen = index === openIndex;
          return (
            <article className={isOpen ? "is-open" : ""} key={faq.question}>
              <button
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                type="button"
              >
                <span>Q</span>
                <strong>{faq.question}</strong>
                <i aria-hidden="true">{isOpen ? "−" : "+"}</i>
              </button>
              <div className="accordion-answer" hidden={!isOpen}>
                <span>A</span>
                <p>{faq.answer}</p>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
