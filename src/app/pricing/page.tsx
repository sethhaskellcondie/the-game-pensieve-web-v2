import type { Metadata } from "next";
import PricingActions from "@/components/auth/PricingActions";
import styles from "./pricing.module.css";

export const metadata: Metadata = {
  title: "Pricing · The Game Pensieve",
};

const PLANS = [
  {
    name: "Guest",
    price: "Free",
    note: null,
    featured: false,
    features: ["Browse the public showcase", "Filter the showcase", "No account needed"],
  },
  {
    name: "Collector",
    price: "$4",
    note: "/ month",
    featured: true,
    features: [
      "Your own private collection",
      "Unlimited reads, filters & writes",
      "Custom fields & saved filters",
      "Bulk import your existing data",
      "Starts with a 30-day free trial",
    ],
  },
  {
    name: "Lapsed",
    price: "—",
    note: null,
    featured: false,
    features: [
      "Read & list your own data",
      "Back up your collection",
      "Upgrade anytime to filter & edit again",
    ],
  },
];

export default function PricingPage() {
  return (
    <main className={styles.content}>
      <h1>Pricing</h1>
      <p className={styles.lede}>
        Start with a free 30-day trial — write, filter, and back up from day one.
        Upgrade to unlock bulk import. Cancel anytime — your data is always
        readable and exportable.
      </p>

      <div className={styles.grid}>
        {PLANS.map((plan) => (
          <section
            key={plan.name}
            className={styles.card}
            data-featured={plan.featured}
            aria-label={`${plan.name} plan`}
          >
            <h2 className={styles.planName}>{plan.name}</h2>
            <p className={styles.price}>
              {plan.price}
              {plan.note ? <span> {plan.note}</span> : null}
            </p>
            <ul className={styles.features}>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <PricingActions />
    </main>
  );
}
