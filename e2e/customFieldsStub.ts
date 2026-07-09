import { type Page } from "@playwright/test";

// A custom field as the backend would return it.
export type StubField = {
  id: number;
  name: string;
  type: string;
  entityKey: string;
  order: number;
  options: { id: number; customFieldId: number; name: string; isDefault: boolean; order: number }[];
};

// Stubs the /api/custom-fields/** proxy with an in-memory store so the screen
// is exercised end-to-end without a live backend. Each test gets a fresh store.
// Shared by the desktop custom-fields spec and its mobile touch-parity twin.
export async function stubCustomFields(page: Page, initial: StubField[]) {
  let fields = initial.map((f) => ({ ...f, options: [...f.options] }));
  let nextId = Math.max(0, ...fields.map((f) => f.id)) + 1;

  await page.route("**/api/custom-fields**", async (route) => {
    const req = route.request();
    const method = req.method();
    const path = new URL(req.url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    const entityMatch = path.match(/\/api\/custom-fields\/entity\/(.+)$/);
    if (method === "GET" && entityMatch) {
      const key = entityMatch[1];
      const data = fields
        .filter((f) => f.entityKey === key)
        .sort((a, b) => a.order - b.order);
      return json({ status: "ok", data });
    }

    if (method === "POST" && /\/api\/custom-fields$/.test(path)) {
      const body = req.postDataJSON();
      const created: StubField = {
        id: nextId++,
        name: body.name,
        type: body.type,
        entityKey: body.entityKey,
        order: fields.filter((f) => f.entityKey === body.entityKey).length,
        options: (body.options ?? []).map(
          (o: { name: string; isDefault: boolean; order: number }, i: number) => ({
            id: 1000 + i,
            customFieldId: 0,
            name: o.name,
            isDefault: o.isDefault,
            order: o.order,
          }),
        ),
      };
      fields.push(created);
      return json({ status: "ok", data: created });
    }

    const idMatch = path.match(/\/api\/custom-fields\/(\d+)$/);
    if (method === "PUT" && idMatch) {
      const id = Number(idMatch[1]);
      const body = req.postDataJSON();
      const field = fields.find((f) => f.id === id);
      if (field) {
        field.name = body.name;
        field.order = body.order;
        if (body.options) {
          field.options = body.options.map(
            (
              o: { id: number | null; name: string; isDefault: boolean; order: number },
              i: number,
            ) => ({
              id: o.id ?? 2000 + i,
              customFieldId: id,
              name: o.name,
              isDefault: o.isDefault,
              order: o.order,
            }),
          );
        }
      }
      return json({ status: "ok", data: field });
    }

    if (method === "DELETE" && idMatch) {
      const id = Number(idMatch[1]);
      fields = fields.filter((f) => f.id !== id);
      return json({ status: "ok" });
    }

    return json({ status: "ok", data: {} });
  });
}

export const SEED: StubField[] = [
  { id: 1, name: "Designers", type: "text", entityKey: "boardGame", order: 0, options: [] },
  {
    id: 2,
    name: "Theme",
    type: "dropdown",
    entityKey: "boardGame",
    order: 1,
    options: [
      { id: 9, customFieldId: 2, name: "Fantasy", isDefault: true, order: 0 },
    ],
  },
  { id: 3, name: "Platform", type: "dropdown", entityKey: "videoGame", order: 0, options: [] },
];
