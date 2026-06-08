import "@testing-library/jest-dom";

// jsdom (as bundled with jest-environment-jsdom) doesn't implement Blob.text(),
// which our file-import flow relies on. Polyfill it so components using the
// standard, browser-supported API are testable. Reads via FileReader, which
// jsdom does implement.
if (typeof Blob !== "undefined" && typeof Blob.prototype.text !== "function") {
  Blob.prototype.text = function (this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
