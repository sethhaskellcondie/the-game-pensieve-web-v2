import Image from "next/image";
import Header from "@/components/Header";
import Stats from "@/components/Stats";
import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      <Header
        icon={<Image src="/blue_pensieve.svg" alt="" width={78} height={78} />}
        title="THE GAME"
        titleAccent="PENSIEVE"
        tagline="Explore ALL your games — not just how they appear on the shelf."
      >
        <Stats
          stats={[
            { value: "520", label: "Video Games on Shelf" },
            { value: "612", label: "All Video Games" },
            { value: "83", label: "Board Games on Shelf" },
            { value: "97", label: "All Board Games" },
            { value: "61", label: "Toys" },
          ]}
        />
      </Header>

      <main className={styles.content}>
        {/* Page content */}
      </main>
    </>
  );
}
