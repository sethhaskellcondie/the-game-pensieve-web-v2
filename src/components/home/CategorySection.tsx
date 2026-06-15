import { PlusIcon } from "@/components/custom-fields/icons";
import { FilterIcon } from "@/components/toys/icons";
import SavedFilterCard from "./SavedFilterCard";
import type { FilterCategory, SavedFilter } from "./types";
import styles from "./CategorySection.module.css";

// One category: a blue grid header bar (name + "New filter" + filter count) over
// a horizontally scrolling row of its saved-filter cards.
export default function CategorySection({
  category,
  onNewFilter,
  onEditFilter,
}: {
  category: FilterCategory;
  onNewFilter?: (category: FilterCategory) => void;
  onEditFilter?: (filter: SavedFilter) => void;
}) {
  const count = category.filters.length;

  return (
    <section className={styles.category} aria-label={category.name}>
      <div className={styles.head}>
        <h3 className={styles.name}>{category.name}</h3>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.newFilterBtn}
            onClick={() => onNewFilter?.(category)}
          >
            <PlusIcon /> New filter
          </button>
          <span className={styles.count}>
            {count} {count === 1 ? "filter" : "filters"}
          </span>
        </div>
      </div>

      <div className={styles.body}>
        {count === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <FilterIcon />
            </span>
            <p className={styles.emptyText}>
              No saved filters in this category yet.
            </p>
            <button
              type="button"
              className={styles.emptyBtn}
              onClick={() => onNewFilter?.(category)}
            >
              <PlusIcon /> Add a filter
            </button>
          </div>
        ) : (
          <div className={styles.row}>
            {category.filters.map((filter) => (
              <SavedFilterCard
                key={filter.id}
                filter={filter}
                onEdit={onEditFilter}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
