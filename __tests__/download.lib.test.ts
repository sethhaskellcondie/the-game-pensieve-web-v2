import { backupFilename, downloadTextFile } from "@/lib/download";

describe("backupFilename", () => {
  it("produces a backup-<timestamp>.txt name with no colons", () => {
    const name = backupFilename();
    expect(name).toMatch(/^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.txt$/);
    expect(name).not.toContain(":");
  });

  it("truncates to whole seconds (no fractional part in the timestamp)", () => {
    const stamp = backupFilename().replace(/^backup-/, "").replace(/\.txt$/, "");
    expect(stamp).not.toContain(".");
  });
});

describe("downloadTextFile", () => {
  it("clicks an anchor carrying the filename and revokes the object URL", () => {
    const createObjectURL = jest.fn(() => "blob:fake-url");
    const revokeObjectURL = jest.fn();
    // jsdom doesn't implement the object-URL APIs; stub them for the test.
    (URL as unknown as { createObjectURL: unknown }).createObjectURL =
      createObjectURL;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL =
      revokeObjectURL;

    const click = jest.fn();
    const realCreateElement = document.createElement.bind(document);
    const createElementSpy = jest
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        const el = realCreateElement(tag) as HTMLElement;
        if (tag === "a") {
          (el as HTMLAnchorElement).click = click;
        }
        return el;
      });

    downloadTextFile("backup-test.txt", "hello");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
    // The temporary anchor is removed after the click.
    expect(document.querySelector("a")).toBeNull();

    createElementSpy.mockRestore();
  });
});
