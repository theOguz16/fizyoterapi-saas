"use client";

import { trackMarketingEvent } from "./site-analytics";

type FaqItem = {
  question: string;
  answer: string;
};

export function MarketingFaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="product-faq-list">
      {items.map((item, index) => (
        <details
          className="product-faq-item"
          key={item.question}
          open={index === 0}
          onToggle={(event) => {
            if (event.currentTarget.open && event.nativeEvent.isTrusted) {
              trackMarketingEvent("faq_open", {
                question: item.question,
                position: index + 1,
              });
            }
          }}
        >
          <summary>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{item.question}</h3>
            <i aria-hidden="true" />
          </summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
