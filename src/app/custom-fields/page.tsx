import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomFieldsIcon } from "@/components/icons";
import Header from "@/components/Header";
import CustomFieldsManager from "@/components/custom-fields/CustomFieldsManager";
import { readShowcaseSlug } from "@/lib/serverShowcase";
import styles from "./customFields.module.css";

export const metadata: Metadata = {
  title: "Custom Fields · The Game Pensieve",
};

export default async function CustomFieldsPage() {
  // Custom fields are the VIEWER's own configuration — they have no meaning
  // while browsing someone else's showcase, so the page (like its sidebar
  // link) is unavailable in showcase mode.
  if (await readShowcaseSlug()) redirect("/");

  return (
    <>
      <Header
        icon={<CustomFieldsIcon />}
        title="CUSTOM"
        titleAccent="FIELDS"
        tagline="Customized your collection with the data you want!"
        beginnerHint="Custom Fields are the heart and soul of the pensieve, you setup what data points you want to track, and what they apply to. Then as the data is entered in you can then filter, sort, and rearrage the data so you can better understand your collection!"
      />

      <main className={styles.content}>
        <CustomFieldsManager />
      </main>
    </>
  );
}
