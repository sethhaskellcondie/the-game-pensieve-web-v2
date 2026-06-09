import type { Metadata } from "next";
import { CustomFieldsIcon } from "@/components/icons";
import Header from "@/components/Header";
import CustomFieldsManager from "@/components/custom-fields/CustomFieldsManager";
import styles from "./customFields.module.css";

export const metadata: Metadata = {
  title: "Custom Fields · The Game Pensieve",
};

export default function CustomFieldsPage() {
  return (
    <>
      <Header
        icon={<CustomFieldsIcon />}
        title="CUSTOM"
        titleAccent="FIELDS"
        tagline="Customized your collection with the data you want!"
      />

      <main className={styles.content}>
        <CustomFieldsManager />
      </main>
    </>
  );
}
