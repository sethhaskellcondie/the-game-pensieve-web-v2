import type { Metadata } from "next";
import { CustomFieldsIcon } from "@/components/icons";
import Header from "@/components/Header";
import CustomFieldsManager from "@/components/custom-fields/CustomFieldsManager";
import styles from "./customFields.module.css";

export const metadata: Metadata = {
  title: "Custom Fields · The Game Pensieve",
};

export default async function CustomFieldsPage() {
  // Viewable while browsing a public showcase: the manager shows the showcase
  // owner's field definitions read-only (its write controls are gated on
  // canWrite, which is false in showcase mode). The definitions read is
  // showcase-scoped, so it returns the owner's fields the same way the
  // collection pages do.
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
