import styles from "./Stats.module.css";

type Stat = { value: string; label: string };

type StatsProps = {
  stats: Stat[];
};

export default function Stats({ stats }: StatsProps) {
  return (
    <div className={styles.stats}>
      {stats.map((stat) => (
        <div key={stat.label} className={styles.stat}>
          <b>{stat.value}</b>
          <span>{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
